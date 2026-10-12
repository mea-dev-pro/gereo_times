import { expect, test } from "@playwright/test";

/**
 * Accès public et protection des routes.
 * Aucune session : ce projet s'exécute sans storageState.
 */

test.describe("Accès public", () => {
  test("la racine redirige un visiteur vers la connexion", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion/);
    await expect(
      page.getByRole("heading", { name: "Connexion" })
    ).toBeVisible();
  });

  test("la page de connexion présente le formulaire attendu", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Se connecter" })
    ).toBeVisible();
  });

  test("l'inscription demande le nom et l'organisation", async ({ page }) => {
    await page.goto("/inscription");
    await expect(page.locator("#full_name")).toBeVisible();
    await expect(page.locator("#organization_name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("une route privée renvoie vers la connexion avec la destination", async ({
    page,
  }) => {
    await page.goto("/pointage");
    await expect(page).toHaveURL(/\/connexion\?suivant=/);
  });

  test("le calendrier d'équipe n'est pas accessible sans session", async ({
    page,
  }) => {
    await page.goto("/calendrier");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("les exports ne sont pas accessibles sans session", async ({ page }) => {
    const response = await page.request.get("/api/export/conges");
    expect(response.status()).toBe(401);
  });
});
