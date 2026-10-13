#!/usr/bin/env node
/**
 * Mesure de performance perçue, écran par écran.
 *
 *   node scripts/perf.mjs http://localhost:3000
 *   node scripts/perf.mjs http://localhost:3000 /pointage /conges
 *
 * À exécuter sur un serveur **de production** (`npm run build && npm run start`) :
 * en développement, la compilation à la demande fausse tout.
 *
 * Trois passages par écran dans trois contextes neufs — sans quoi le deuxième
 * passage lit le cache et les tailles transférées tombent à zéro. La valeur
 * publiée est la médiane des trois.
 *
 * Mesures : TTFB, DOMContentLoaded, load, LCP (Largest Contentful Paint) et
 * poids réellement transféré (total et scripts). Ce sont des mesures locales,
 * sur une seule machine : elles servent à comparer deux versions entre elles,
 * pas à produire un chiffre absolu.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [, , baseURL = "http://localhost:3000", ...args] = process.argv;
const ECRANS = args.length ? args : ["/", "/pointage", "/conges", "/validations"];
const PASSAGES = 3;
const session = join(process.cwd(), "tests", ".auth", "admin.json");

const navigateur = await chromium.launch();

function mediane(valeurs) {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
}

async function unPassage(chemin) {
  const contexte = await navigateur.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
    storageState: existsSync(session) ? session : undefined,
  });

  // L'observateur doit exister avant la navigation, sinon l'entrée LCP n'est
  // jamais collectée : elle est émise une fois, tôt.
  await contexte.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) window.__lcp = entree.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  const page = await contexte.newPage();
  await page.goto(chemin, { waitUntil: "load" });
  const mesures = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const ressources = performance.getEntriesByType("resource");
    const somme = (liste) => liste.reduce((t, r) => t + (r.transferSize || 0), 0);
    return {
      url: location.pathname,
      ttfb: nav.responseStart,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd || nav.duration,
      lcp: window.__lcp || 0,
      octets: nav.transferSize + somme(ressources),
      octetsJs: somme(ressources.filter((r) => r.initiatorType === "script")),
      requetes: ressources.length,
    };
  });
  await contexte.close();
  return mesures;
}

const ko = (o) => `${Math.round(o / 1024)} Ko`;
const ms = (v) => `${Math.round(v)} ms`;

console.log(`\n  ${baseURL} — ${PASSAGES} passages par écran, médiane\n`);
console.log(
  "  " + "écran".padEnd(14) + "TTFB".padStart(9) + "DCL".padStart(10) +
    "load".padStart(10) + "LCP".padStart(10) + "transféré".padStart(12) +
    "dont JS".padStart(10) + "requêtes".padStart(10)
);

for (const chemin of ECRANS) {
  const passages = [];
  for (let i = 0; i < PASSAGES; i++) passages.push(await unPassage(chemin));
  const cle = (nom) => mediane(passages.map((p) => p[nom]));
  const url = passages[0].url;
  console.log(
    "  " + url.padEnd(14) + ms(cle("ttfb")).padStart(9) + ms(cle("dcl")).padStart(10) +
      ms(cle("load")).padStart(10) + ms(cle("lcp")).padStart(10) +
      ko(cle("octets")).padStart(12) + ko(cle("octetsJs")).padStart(10) +
      String(Math.round(cle("requetes"))).padStart(10)
  );
}

await navigateur.close();
console.log("");
