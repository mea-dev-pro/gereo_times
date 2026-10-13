import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout GereoTimes.
 *
 * Prérequis :
 *   1. l'application tourne (npm run dev)
 *   2. les sessions sont préparées : npm run e2e:auth
 *
 * Les tests s'exécutent en série : ils partagent des données réelles et
 * certaines opérations modifient la base (pointage, demande de congé).
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "employe",
      testMatch: /employe\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/employe.json" },
    },
    {
      name: "admin",
      testMatch: /(admin|theme)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/admin.json" },
    },
    {
      // Critère UX-05 du PRD : aucun débordement horizontal, actions critiques
      // atteignables. Le compte administrateur voit tous les écrans.
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: "tests/.auth/admin.json",
      },
    },
  ],
});
