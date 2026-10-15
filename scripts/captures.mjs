#!/usr/bin/env node
/**
 * Captures d'écran pour la revue visuelle.
 *
 *   npm run captures
 *
 * Écrit dans docs/captures/<largeur>/<ecran>.jpg — une image par écran et par
 * largeur, page entière. Format JPEG : ce sont des pièces de revue, pas des
 * références de test ; à qualité 82 une page complète pèse ~10 fois moins
 * qu'en PNG pour une différence invisible.
 *
 * Prérequis : l'application tourne (npm run dev) et les sessions de test sont
 * préparées (npm run e2e:auth). Le script ne saisit aucun mot de passe.
 */

import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** Écrans de l'espace authentifié, avec le compte de recette (administrateur). */
const ECRANS = [
  ["accueil", "/"],
  ["pointage", "/pointage"],
  ["conges", "/conges"],
  ["calendrier", "/calendrier"],
  ["notifications", "/notifications"],
  ["validations", "/validations"],
  ["equipe", "/equipe"],
  ["rapports", "/rapports"],
  ["parametres", "/parametres"],
];

/**
 * Écrans publics, sans session, avec ce qu'on doit y voir apparaître.
 * `/auth/reinitialiser` n'a pas de formulaire sans session ouverte : il affiche
 * un état de traitement, puis un message.
 */
const PUBLICS = [
  ["connexion", "/connexion", "form"],
  ["inscription", "/inscription", "form"],
  ["mot-de-passe-oublie", "/mot-de-passe-oublie", "form"],
  ["reinitialiser", "/auth/reinitialiser", "main"],
];

const LARGEURS = [
  { nom: "1440", viewport: { width: 1440, height: 900 }, mobile: false, menu: false },
  { nom: "834", viewport: { width: 834, height: 1112 }, mobile: false, menu: true },
  { nom: "390", viewport: { width: 390, height: 844 }, mobile: true, menu: true },
];

const navigateur = await chromium.launch();
let total = 0;
let octets = 0;

for (const largeur of LARGEURS) {
  const dossier = join(root, "docs", "captures", largeur.nom);
  mkdirSync(dossier, { recursive: true });

  const contexte = await navigateur.newContext({
    baseURL,
    viewport: largeur.viewport,
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
    deviceScaleFactor: 1,
    storageState: join(root, "tests", ".auth", "admin.json"),
  });
  const page = await contexte.newPage();

  for (const [nom, chemin] of ECRANS) {
    await page.goto(chemin);
    await page.locator("main").first().waitFor({ state: "visible" });
    // L'indicateur Next.js Devtools (le rond en bas à gauche) n'existe qu'en
    // développement : on le retire pour que la capture montre l'application
    // telle qu'un utilisateur la voit.
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    });
    // Les compteurs vivants et les transitions de thème se stabilisent vite,
    // mais un délai court évite de figer une animation d'apparition.
    await page.waitForTimeout(400);
    const fichier = join(dossier, `${nom}.jpg`);
    await page.screenshot({ path: fichier, fullPage: true, type: "jpeg", quality: 82 });
    octets += statSync(fichier).size;
    total++;
    console.log(`  ${largeur.nom.padStart(4)}  ${nom}`);
  }

  // Sous 1024 px la navigation est repliée : sa version ouverte est un état à
  // part entière, invisible autrement dans la revue visuelle.
  if (largeur.menu) {
    await page.goto("/");
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#rail-navigation").waitFor({ state: "visible" });
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    });
    await page.waitForTimeout(400);
    const fichier = join(dossier, "menu-ouvert.jpg");
    // Capture à la fenêtre, et non de la page entière : le tiroir est une
    // couche fixe, de la hauteur de l'écran. Sur une page entière il
    // apparaîtrait détaché, posé en haut d'une longue bande, et le voile ne
    // couvrirait que sa hauteur — une image qui ne montrerait pas ce que
    // l'utilisateur voit.
    await page.screenshot({
      path: fichier,
      fullPage: false,
      type: "jpeg",
      quality: 82,
    });
    octets += statSync(fichier).size;
    total++;
    console.log(`  ${largeur.nom.padStart(4)}  menu-ouvert`);
  }

  await contexte.close();
}

// Les écrans publics demandent un contexte sans session.
{
  const dossier = join(root, "docs", "captures", "1440");
  const contexte = await navigateur.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
  });
  const page = await contexte.newPage();
  for (const [nom, chemin, attendu] of PUBLICS) {
    await page.goto(chemin);
    await page.locator(attendu).first().waitFor({ state: "visible" });
    const fichier = join(dossier, `${nom}.jpg`);
    await page.screenshot({ path: fichier, fullPage: true, type: "jpeg", quality: 82 });
    octets += statSync(fichier).size;
    total++;
    console.log(`  public  ${nom}`);
  }
  await contexte.close();
}

await navigateur.close();
console.log(
  `\n  ${total} captures dans docs/captures/ — ${(octets / 1024 / 1024).toFixed(1)} Mo\n`
);
