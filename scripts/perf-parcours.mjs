#!/usr/bin/env node
/**
 * Mesure un parcours réel : un utilisateur qui enchaîne les écrans dans une
 * même session, et qui revient sur un écran déjà visité.
 *
 *   node scripts/perf-parcours.mjs [url] [chemin de session]
 *
 * Complément de `perf-navigation.mjs` : celui-ci ouvre un contexte neuf par
 * passage (donc un premier chargement, avec le préchargement à froid), alors
 * qu'ici la session est unique et le chargement initial est unique aussi. C'est
 * la seule façon de voir l'effet des caches navigateur — un écran déjà visité
 * devrait s'afficher sans repayer d'aller-retour vers le serveur.
 *
 * À exécuter sur un build de production (`npm run build && npm run start`).
 * Le chemin de session par défaut est `tests/.auth/admin.json` ; passer
 * `tests/.auth/admin-prod.json` pour viser la production.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [, , baseURL = "http://localhost:3000", etatArg] = process.argv;
const session = etatArg ?? join(process.cwd(), "tests", ".auth", "admin.json");

// Deux fois les mêmes écrans : la seconde visite de /conges et de /calendrier
// doit montrer le gain du cache navigateur.
const PARCOURS = [
  // Idem perf-navigation : la salutation dépend de l'heure, le repère de la
  // semaine non.
  { href: "/", titre: "semaine du" },
  { href: "/conges", titre: "Mes congés" },
  { href: "/calendrier", titre: "Calendrier d'équipe" },
  { href: "/pointage", titre: "Pointage" },
  { href: "/equipe", titre: "Équipe" },
  { href: "/rapports", titre: "Rapports RH" },
  { href: "/conges", titre: "Mes congés" },
  { href: "/calendrier", titre: "Calendrier d'équipe" },
  { href: "/notifications", titre: "Notifications" },
  { href: "/parametres", titre: "Paramètres RH" },
];

if (!existsSync(session)) {
  console.error(`  session introuvable : ${session}`);
  process.exit(1);
}

// Le domaine des cookies doit correspondre à celui de l'URL visée.
const domaine = new URL(baseURL).hostname;
const brut = JSON.parse(readFileSync(session, "utf8"));
const estLocal = domaine === "localhost" || domaine === "127.0.0.1";
for (const c of brut.cookies) {
  c.domain = estLocal ? domaine : `.${domaine.split(".").slice(-3).join(".")}`;
  c.secure = !estLocal;
}

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({
  baseURL,
  viewport: { width: 1440, height: 900 },
  locale: "fr-FR",
  timezoneId: "Indian/Antananarivo",
  storageState: { cookies: brut.cookies, origins: brut.origins ?? [] },
});
const page = await contexte.newPage();

// Le clic et l'apparition du titre sont datés dans la page : le sondage évite
// de dépendre du moment où Node reprend la main. Le titre attendu est lu, au
// moment du clic, dans `data-attendu` posé sur `<html>` par le script Node :
// l'élément survit aux navigations côté client.
await page.addInitScript(() => {
  window.__nav = { clic: 0, squelette: 0, affiche: 0 };
  document.addEventListener(
    "click",
    (e) => {
      const lien = e.target instanceof Element ? e.target.closest("a") : null;
      if (!lien || window.__nav.clic) return;

      const attendu = document.documentElement.dataset.attendu ?? "";
      window.__nav.clic = performance.now();
      // Sondage à chaque image : un minuteur ne reprend la main qu'une fois le
      // rendu terminé, ce qui gonflerait la mesure de 200 à 300 ms.
      const boucle = () => {
        const t = performance.now();
        if (!window.__nav.squelette && document.querySelector("[data-chargement]")) {
          window.__nav.squelette = t;
        }
        const main = document.querySelector("main");
        if (main && (main.textContent || "").includes(attendu)) {
          window.__nav.affiche = t;
          return;
        }
        if (t - window.__nav.clic < 30_000) requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    },
    true
  );
});

await page.goto("/pointage", { waitUntil: "load" });
await page.waitForSelector("main h1");
console.log(`  ${baseURL} — session : ${session}`);
console.log("  on laisse 2,5 s au préchargement, puis on enchaîne les écrans\n");

const delai = Number(process.env.PERF_ATTENTE ?? 2500);
if (delai > 0) await page.waitForTimeout(delai);

// Temps laissé entre deux clics : c'est ce qui permet au préchargement de la
// destination d'arriver. À 0, on mesure un utilisateur qui clique sans regarder
// et chaque écran repaie son rendu — instructif, mais ce n'est pas l'usage.
const pause = Number(process.env.PERF_PAUSE ?? 1200);

const resultats = [];
for (const { href, titre } of PARCOURS) {
  await page.evaluate((attendu) => {
    window.__nav = { clic: 0, squelette: 0, affiche: 0 };
    document.documentElement.dataset.attendu = attendu;
  }, titre);

  await page.click(`aside a[href="${href}"]`);
  const ok = await page
    .waitForFunction(() => window.__nav.affiche > 0, null, { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (!ok) {
    console.log(`  ${href.padEnd(14)} jamais affiché`);
    resultats.push({ href, total: null, squelette: null });
    continue;
  }

  const m = await page.evaluate(() => ({
    total: window.__nav.affiche - window.__nav.clic,
    squelette: window.__nav.squelette ? window.__nav.squelette - window.__nav.clic : null,
  }));
  resultats.push({ href, ...m });
  console.log(
    `  ${href.padEnd(14)} affiché en ${String(Math.round(m.total)).padStart(5)} ms` +
      `   silhouette ${m.squelette === null ? "absente (instantané)" : `${Math.round(m.squelette)} ms`}`
  );

  if (pause > 0) await page.waitForTimeout(pause);
}

const mesures = resultats.filter((r) => r.total !== null);
const moyenne = mesures.reduce((s, r) => s + r.total, 0) / mesures.length;
console.log(
  `\n  moyenne sur ${mesures.length} écrans : ${Math.round(moyenne)} ms` +
    `   | ${resultats.length - mesures.length} échec(s)\n`
);

await navigateur.close();
