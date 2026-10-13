import { expect, test } from "@playwright/test";

/**
 * Parcours de l'employé.
 * Session fournie par tests/.auth/employe.json (rôle employee).
 */

test.describe("Employé", () => {
  test("le tableau de bord affiche l'organisation et les indicateurs", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Bonjour"
    );
    await expect(page.getByText("HEURES CETTE SEMAINE")).toBeVisible();
    await expect(page.getByText("CONGÉS DISPONIBLES")).toBeVisible();
  });

  test("la navigation n'expose aucun écran RH", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });

    await expect(nav.getByRole("link", { name: "Pointage" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Mes congés" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendrier" })).toBeVisible();

    await expect(nav.getByRole("link", { name: "Équipe" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Rapports RH" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Paramètres RH" })).toHaveCount(0);
  });

  test("les écrans RH redirigent vers le tableau de bord", async ({ page }) => {
    for (const path of ["/equipe", "/rapports", "/parametres"]) {
      await page.goto(path);
      await expect
        .poll(() => new URL(page.url()).pathname, {
          message: `${path} devrait ramener au tableau de bord`,
        })
        .toBe("/");
    }
  });

  test("un employé ne peut pas exporter les données RH", async ({ page }) => {
    for (const kind of ["presence", "conges", "soldes"]) {
      const response = await page.request.get(`/api/export/${kind}`);
      expect(response.status(), `export ${kind}`).toBe(403);
    }
  });

  test("le pointage enregistre une arrivée puis une sortie", async ({ page }) => {
    await page.goto("/pointage");
    await expect(page.getByRole("heading", { name: "Pointage" })).toBeVisible();

    // On repart d'un état propre si une session traîne
    const boutonSortie = page.getByRole("button", { name: "Pointer la sortie" });
    if (await boutonSortie.isVisible().catch(() => false)) {
      await boutonSortie.click();
      await expect(
        page.getByText("Pointage de sortie enregistré.")
      ).toBeVisible();
    }

    await page.getByRole("button", { name: "Pointer l'arrivée" }).click();
    await expect(page.getByText("Pointage d'arrivée enregistré.")).toBeVisible();
    await expect(
      page.getByText(/Session ouverte depuis/)
    ).toBeVisible();

    await boutonSortie.click();
    await expect(page.getByText("Pointage de sortie enregistré.")).toBeVisible();
  });

  test("les congés affichent les soldes par type", async ({ page }) => {
    await page.goto("/conges");
    await expect(page.getByRole("heading", { name: "Mes congés" })).toBeVisible();
    await expect(page.getByText("Mes soldes")).toBeVisible();
    await expect(page.getByText("Congé annuel").first()).toBeVisible();
  });

  test("les jours pointés ne peuvent pas dépasser une semaine", async ({
    page,
  }) => {
    await page.goto("/");

    // Invariant : une semaine compte sept jours au plus. Le compteur a déjà
    // affiché « 8 jour(s) » parce qu'il comptait les SESSIONS (plusieurs par
    // jour) au lieu des JOURNÉES distinctes.
    const texte = await page
      .getByText(/jour\(s\) pointé\(s\)/)
      .first()
      .innerText();
    const nombre = Number(texte.match(/(\d+)\s+jour/)?.[1] ?? "0");

    expect(Number.isFinite(nombre)).toBe(true);
    expect(nombre).toBeLessThanOrEqual(7);
  });

  test("l'estimation des jours ouvrés se met à jour à la saisie", async ({
    page,
  }) => {
    await page.goto("/conges");
    // Lundi 7 et mardi 8 juin 2027 : deux jours ouvrés
    await page.locator("#start_date").fill("2027-06-07");
    await page.locator("#end_date").fill("2027-06-08");

    await expect(page.getByText("2,00 j").first()).toBeVisible();
  });

  test("le calendrier d'équipe est consultable", async ({ page }) => {
    await page.goto("/calendrier");
    await expect(
      page.getByRole("heading", { name: "Calendrier d'équipe" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Semaine" })).toBeVisible();

    await page.getByRole("link", { name: "Semaine" }).click();
    await expect(page).toHaveURL(/vue=semaine/);
    await expect(page.getByText(/Semaine du/)).toBeVisible();
  });

  test("la confidentialité des motifs est respectée dans le calendrier", async ({
    page,
  }) => {
    await page.goto("/calendrier?vue=mois&date=2027-03-01");
    const contenu = await page.locator("body").innerText();
    expect(contenu).not.toContain("Motif strictement privé");
  });
});
