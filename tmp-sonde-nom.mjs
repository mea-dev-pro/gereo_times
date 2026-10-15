import { chromium } from "playwright";
const nav = await chromium.launch();
const page = await nav.newPage();
await page.goto("http://localhost:3000/connexion", { waitUntil: "networkidle" });

const essais = [
  ["chaine complete", page.getByRole("button", { name: "Continuer avec Apple (bientôt disponible)" })],
  ["chaine complete exact", page.getByRole("button", { name: "Continuer avec Apple (bientôt disponible)", exact: true })],
  ["regex echappee", page.getByRole("button", { name: /Continuer avec Apple \(bientôt disponible\)/ })],
  ["sous-chaine Apple", page.getByRole("button", { name: "Continuer avec Apple" })],
  ["attribut", page.locator('button[aria-label="Continuer avec Apple (bientôt disponible)"]')],
];
for (const [quoi, loc] of essais) console.log(quoi.padEnd(24), "->", await loc.count());

console.log("attributs reels :", await page.locator("button[aria-label]").evaluateAll((b) => b.map((e) => JSON.stringify(e.getAttribute("aria-label")))));
