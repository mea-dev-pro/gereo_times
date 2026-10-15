#!/usr/bin/env node
/**
 * Mesure les navigations **entre pages** (clic sur un lien du rail), par
 * opposition à `perf.mjs` qui mesure des chargements complets.
 *
 *   node scripts/perf-navigation.mjs [url] [chemin…]
 *
 * À exécuter sur un serveur de production (`npm run build && npm run start`) :
 * en développement, la compilation à la demande fausse tout.
 *
 * Pour chaque destination, dans un contexte neuf (session de recette admin) :
 *   1. ouverture de la page d'accueil, puis clic sur le lien du rail ;
 *   2. temps « clic → le titre de la page est affiché », mesuré dans le
 *      navigateur (performance.now), pas depuis Node ;
 *   3. requêtes RSC de la navigation (`?_rsc=`) : durée et temps de réponse,
 *      ce qui sépare le travail serveur du travail client ;
 *   4. nombre de requêtes réseau déclenchées par la navigation.
 *
 * La médiane de trois passages est publiée : un premier passage à froid
 * raconterait surtout l'effet du préchargement.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [, , baseURL = "http://localhost:3000", ...args] = process.argv;

const CIBLES = [
  // « Bonjour » ne conviendrait que le matin : la salutation suit l'heure
  // locale de l'organisation. On attend donc le repère de la semaine, présent
  // dans l'en-tête à toute heure.
  { href: "/", titre: "semaine du" },
  { href: "/pointage", titre: "Pointage" },
  { href: "/conges", titre: "Mes congés" },
  { href: "/calendrier", titre: "Calendrier d'équipe" },
  { href: "/notifications", titre: "Notifications" },
  { href: "/validations", titre: "Validations" },
  { href: "/equipe", titre: "Équipe" },
  { href: "/rapports", titre: "Rapports RH" },
  { href: "/parametres", titre: "Paramètres RH" },
].filter((c) => !args.length || args.includes(c.href));

const PASSAGES = 3;
// Délai laissé au préchargement des liens avant de cliquer. À 0, la mesure
// décrit le cas le plus défavorable (clic immédiat, coquille pas encore
// arrivée) ; à 2000 ms, celui d'un utilisateur qui prend le temps de viser,
// et la coquille préchargée s'affiche alors tout de suite.
const ATTENTE_AVANT_CLIC = Number(process.env.PERF_ATTENTE ?? 0);
// `PERF_STATE` permet de viser un autre jeu de cookies que celui de
// localhost — utile pour mesurer la production, dont le domaine diffère.
const session = process.env.PERF_STATE
  ? process.env.PERF_STATE
  : join(process.cwd(), "tests", ".auth", "admin.json");

const navigateur = await chromium.launch();

function mediane(valeurs) {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
}

async function unPassage({ href, titre }) {
  const contexte = await navigateur.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
    storageState: existsSync(session) ? session : undefined,
  });

  // Les marques sont prises dans la page : le clic, l'écran d'attente (s'il
  // apparaît) puis l'affichage du titre.
  //
  // Le sondage remplace un observateur de mutations : sur la production, la
  // silhouette d'attente apparaît bien (≈100 ms) mais l'arbre est remplacé d'un
  // bloc, si bien que l'observateur la manquait et publiait « jamais affichée ».
  await contexte.addInitScript((titreAttendu) => {
    window.__nav = { clic: 0, squelette: 0, affiche: 0 };
    document.addEventListener(
      "click",
      (e) => {
        const lien = e.target instanceof Element ? e.target.closest("a") : null;
        if (!lien || window.__nav.clic) return;

        window.__nav.clic = performance.now();
        // Sondage à chaque image plutôt qu'avec un minuteur : pendant une
        // navigation, le fil principal est occupé à rendre la page, et un
        // `setInterval` ne reprend la main qu'après, ce qui gonflait la mesure
        // de 200 à 300 ms.
        const boucle = () => {
          const t = performance.now();
          if (!window.__nav.squelette && document.querySelector("[data-chargement]")) {
            window.__nav.squelette = t;
          }
          const main = document.querySelector("main");
          if (main && (main.textContent || "").includes(titreAttendu)) {
            window.__nav.affiche = t;
            return;
          }
          if (t - window.__nav.clic < 30_000) requestAnimationFrame(boucle);
        };
        requestAnimationFrame(boucle);
      },
      true
    );
  }, titre);

  const page = await contexte.newPage();
  // Point de départ ≠ destination : cliquer sur le lien de la page courante ne
  // provoque aucune navigation, la mesure serait vide.
  const depart = href === "/pointage" ? "/conges" : "/pointage";
  await page.goto(depart, { waitUntil: "load" });
  await page.waitForSelector("main h1");
  if (ATTENTE_AVANT_CLIC > 0) await page.waitForTimeout(ATTENTE_AVANT_CLIC);

  await page.click(`aside a[href="${href}"]`);

  // Le titre de la destination est le signal « page utilisable » (lu dans
  // `main`, pas dans `h1` seul : le tableau de bord met son repère dans le
  // sous-titre). L'instant est relevé dans la page, au sondage.
  try {
    await page.waitForFunction(() => window.__nav.affiche > 0, null, {
      timeout: 30_000,
    });
  } catch {
    const vu = await page.evaluate(() => {
      const h1 = document.querySelector("main h1");
      return `${location.pathname} — « ${(h1?.textContent ?? "").trim().slice(0, 40)} »`;
    });
    throw new Error(`Destination ${href} : « ${titre} » jamais affiché (vu : ${vu})`);
  }

  const mesures = await page.evaluate(() => {
    const nav = window.__nav;
    const rsc = performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("_rsc="));
    const deLaNavigation = rsc.filter((r) => r.startTime >= nav.clic);
    return {
      total: nav.affiche - nav.clic,
      squelette: nav.squelette ? nav.squelette - nav.clic : null,
      rsc: deLaNavigation.map((r) => ({
        duree: r.duration,
        reponse: r.responseStart - r.startTime,
        poids: r.transferSize,
      })),
      requetes: performance.getEntriesByType("resource").filter((r) => r.startTime >= nav.clic).length,
    };
  });

  await contexte.close();
  return mesures;
}

const resultats = [];
console.log(
  `\n  ${baseURL} — ${PASSAGES} passages par cible, médiane — ` +
    (ATTENTE_AVANT_CLIC > 0
      ? `clic ${ATTENTE_AVANT_CLIC} ms après le chargement, préchargement laissé agir\n`
      : `clic immédiat après le chargement, cas le plus défavorable\n`)
);
for (const cible of CIBLES) {
  const passages = [];
  for (let i = 0; i < PASSAGES; i++) passages.push(await unPassage(cible));

  const total = mediane(passages.map((p) => p.total));
  const squelette = passages.map((p) => p.squelette).filter((v) => v !== null);
  const rsc = passages.map((p) => p.rsc.reduce((s, r) => s + r.duree, 0));
  const serveur = passages.map((p) =>
    p.rsc.reduce((s, r) => s + r.reponse, 0)
  );
  const requetes = mediane(passages.map((p) => p.requetes));

  resultats.push({ cible: cible.href, total, squelette: squelette.length ? mediane(squelette) : null, rsc: mediane(rsc), serveur: mediane(serveur), requetes });

  console.log(
    `  ${cible.href.padEnd(14)} clic → affiché ${String(Math.round(total)).padStart(4)} ms` +
      `   | attente affichée ${String(squelette.length ? Math.round(mediane(squelette)) : "jamais").padStart(6)}` +
      `   | requêtes RSC ${String(Math.round(mediane(rsc))).padStart(4)} ms` +
      ` (dont réponse ${String(Math.round(mediane(serveur))).padStart(4)} ms)` +
      `   | ${requetes} requête(s) réseau`
  );
}

const moyenne = (valeurs) => valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
console.log(
  `\n  moyenne : clic → affiché ${Math.round(moyenne(resultats.map((r) => r.total)))} ms` +
    ` | requêtes RSC ${Math.round(moyenne(resultats.map((r) => r.rsc)))} ms` +
    ` | ${moyenne(resultats.map((r) => r.requetes)).toFixed(1)} requêtes réseau par navigation\n`
);

await navigateur.close();
