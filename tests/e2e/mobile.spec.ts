import { expect, test } from "@playwright/test";

/**
 * Critère UX-05 du PRD : « Aucun bouton critique inaccessible ni débordement
 * horizontal non prévu ».
 *
 * Le contrôle porte sur `documentElement.scrollWidth` comparé à `clientWidth`.
 * C'est la seule mesure fiable : un élément peut dépasser sans que la page
 * paraisse cassée, et l'utilisateur se retrouve alors à faire défiler
 * latéralement sans comprendre pourquoi.
 *
 * Les tableaux larges sont légitimes À CONDITION de défiler dans leur propre
 * conteneur (`overflow-x-auto`) : c'est le cas ici, et le contrôle le vérifie.
 */

// Le compte administrateur voit tous les écrans, employé compris.
const ECRANS = [
  "/",
  "/pointage",
  "/conges",
  "/calendrier",
  "/notifications",
  "/validations",
  "/equipe",
  "/rapports",
  "/parametres",
];

const PUBLICS = ["/connexion", "/inscription"];

async function mesure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
}

test.describe("Mobile — débordement horizontal", () => {
  for (const chemin of ECRANS) {
    test(`aucun débordement sur ${chemin}`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page.locator("main").first()).toBeVisible();

      const { scroll, client } = await mesure(page);
      expect(
        scroll,
        `débordement de ${scroll - client} px sur ${chemin}`
      ).toBeLessThanOrEqual(client + 1);
    });
  }

  for (const chemin of PUBLICS) {
    test(`aucun débordement sur ${chemin} (public)`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page.locator("form").first()).toBeVisible();

      const { scroll, client } = await mesure(page);
      expect(
        scroll,
        `débordement de ${scroll - client} px sur ${chemin}`
      ).toBeLessThanOrEqual(client + 1);
    });
  }
});

test.describe("Mobile — accès aux actions", () => {
  test("l'action de pointage est visible sans défilement latéral", async ({
    page,
  }) => {
    await page.goto("/pointage");

    const action = page
      .getByRole("button", { name: /Pointer l'arrivée|Pointer la sortie|Reprendre/ })
      .first();
    await expect(action).toBeVisible();

    // Le bouton doit tenir dans la largeur de l'écran.
    const boite = await action.boundingBox();
    expect(boite).not.toBeNull();
    expect(boite!.x).toBeGreaterThanOrEqual(0);
    expect(boite!.x + boite!.width).toBeLessThanOrEqual(390 + 1);
  });

  test("la navigation reste utilisable", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Pointage" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Mes congés" })).toBeVisible();
  });

  test("un tableau large défile dans son conteneur, pas la page", async ({
    page,
  }) => {
    await page.goto("/equipe");
    await expect(page.locator("table").first()).toBeVisible();

    const { scroll, client } = await mesure(page);
    expect(scroll).toBeLessThanOrEqual(client + 1);

    // Le conteneur du tableau, lui, est bien défilable.
    const defilable = await page.evaluate(() => {
      const t = document.querySelector("table");
      const conteneur = t?.parentElement;
      if (!conteneur) return null;
      return {
        scroll: conteneur.scrollWidth,
        client: conteneur.clientWidth,
        overflow: getComputedStyle(conteneur).overflowX,
      };
    });
    expect(defilable).not.toBeNull();
    expect(defilable!.overflow).toBe("auto");
  });
});
