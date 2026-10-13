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

/**
 * Point d'arrivée des liens envoyés par courriel. Aucun jeton réel n'est
 * nécessaire : ce qui est vérifié ici, c'est le traitement du message d'échec,
 * la partie du code qui décide de ne rien tenter quand le lien est mort.
 */
test.describe("Activation — liens invalides", () => {
  test("un lien expiré est annoncé sans tenter d'ouvrir une session", async ({
    page,
  }) => {
    await page.goto("/auth/confirmer#error=access_denied&error_code=otp_expired");

    await expect(
      page.getByRole("alert").filter({ hasText: "Activation impossible" })
    ).toBeVisible();
    await expect(
      page.getByText(/déjà été utilisé ou a expiré/)
    ).toBeVisible();
    // L'écran reste sur place : aucune redirection n'a été déclenchée.
    await expect(page).toHaveURL(/\/auth\/confirmer/);
  });

  test("un fragment porteur d'une erreur explicite est affiché tel quel", async ({
    page,
  }) => {
    await page.goto(
      "/auth/confirmer#error=access_denied&error_description=Lien%20r%C3%A9voqu%C3%A9"
    );

    await expect(page.getByText("Lien révoqué")).toBeVisible();
  });

  test("sans code ni jeton, l'écran finit par annoncer un lien invalide", async ({
    page,
  }) => {
    await page.goto("/auth/confirmer");

    // Le code tente douze fois, à 400 ms d'intervalle : ~5 s avant l'annonce.
    await expect(
      page.getByText(/Ce lien est invalide ou a expiré/)
    ).toBeVisible({ timeout: 20_000 });
  });
});
