import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Écrans d'administration et RH.
 * Session fournie par tests/.auth/admin.json (rôle admin).
 */

test.describe("Administrateur", () => {
  test("la navigation expose les écrans RH", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });

    for (const label of [
      "Validations",
      "Équipe",
      "Rapports RH",
      "Paramètres RH",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("l'équipe liste les membres et le formulaire d'invitation", async ({
    page,
  }) => {
    await page.goto("/equipe");
    await expect(page.getByRole("heading", { name: "Équipe" })).toBeVisible();
    await expect(page.getByText(/membre\(s\) actif\(s\)/)).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Inviter ce collaborateur" })
    ).toBeVisible();
  });

  test("les paramètres RH présentent les cinq sections", async ({ page }) => {
    await page.goto("/parametres");
    await expect(
      page.getByRole("heading", { name: "Paramètres RH" })
    ).toBeVisible();

    for (const section of [
      "Calendriers de travail",
      "Jours fériés",
      "Départements",
      "Types de congés",
      "Politiques de congés",
    ]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }
  });

  test("les rapports RH affichent les indicateurs agrégés", async ({ page }) => {
    await page.goto("/rapports");
    await expect(
      page.getByRole("heading", { name: "Rapports RH" })
    ).toBeVisible();

    // Les libellés sont capitalisés par CSS : le DOM conserve la casse initiale.
    for (const kpi of [
      "Effectif actif",
      "Heures effectives",
      "Moyenne par agent",
      "Écart total",
      "Congés approuvés",
      "En attente",
    ]) {
      await expect(page.getByText(kpi, { exact: true })).toBeVisible();
    }

    await expect(page.getByText("Détail par collaborateur")).toBeVisible();
  });

  test("le filtre de période des rapports est appliqué", async ({ page }) => {
    await page.goto("/rapports?from=2027-01-01&to=2027-12-31");
    await expect(page.getByText(/01\/01\/2027 au 31\/12\/2027/)).toBeVisible();
    await expect(page.getByText("Congés par type")).toBeVisible();
  });

  test("les exports CSV se téléchargent avec le bon contenu", async ({ page }) => {
    await page.goto("/rapports");

    const attendus: Record<string, string> = {
      "Export congés (CSV)": "Type;Collaborateur;Email",
      "Export présence (CSV)": "Date;Collaborateur;Email",
      "Export soldes (CSV)": "Collaborateur;Email;Type",
    };

    for (const [label, entete] of Object.entries(attendus)) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: label }).click(),
      ]);

      expect(download.suggestedFilename(), label).toMatch(/\.csv$/);

      const path = await download.path();
      expect(path, `fichier téléchargé pour ${label}`).toBeTruthy();

      const contenu = readFileSync(path as string, "utf8");
      // BOM UTF-8 puis l'en-tête attendu, séparateur point-virgule
      expect(contenu.charCodeAt(0), label).toBe(0xfeff);
      expect(contenu, label).toContain(entete);
    }
  });

  test("les validations affichent les indicateurs de la file", async ({
    page,
  }) => {
    await page.goto("/validations");
    await expect(
      page.getByRole("heading", { name: "Validations" })
    ).toBeVisible();

    // Les trois indicateurs qui résument la charge d'un manager.
    for (const libelle of [
      "À traiter",
      "Congés en attente",
      "Plus ancienne demande",
    ]) {
      await expect(page.getByText(libelle, { exact: true })).toBeVisible();
    }
  });

  test("le fil d'activité est consultable", async ({ page }) => {
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifications" })
    ).toBeVisible();
    await expect(page.getByText(/notification\(s\)|non lue/).first()).toBeVisible();
  });

  test("la recherche de l'équipe filtre la liste par l'URL", async ({ page }) => {
    await page.goto("/equipe");

    const lignes = page.locator("table tbody tr");
    const total = await lignes.count();
    expect(total).toBeGreaterThan(0);

    // Le filtre est calculé par le serveur : l'URL doit le refléter, sinon
    // l'état n'est ni partageable ni rechargeable.
    await page.locator("#recherche").fill("zzzz-introuvable");
    await expect(page).toHaveURL(/q=zzzz-introuvable/);
    await expect(
      page.getByText("Aucun collaborateur ne correspond")
    ).toBeVisible();
    await expect(lignes).toHaveCount(0);

    // Le champ doit conserver la valeur après rechargement.
    await page.reload();
    await expect(page.locator("#recherche")).toHaveValue("zzzz-introuvable");

    // Effacer ramène la liste complète.
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(lignes).toHaveCount(total);
  });

  test("la recherche de l'équipe trouve un collaborateur réel", async ({
    page,
  }) => {
    await page.goto("/equipe");
    const total = await page.locator("table tbody tr").count();

    const premier = (
      await page.locator("table tbody tr").first().innerText()
    ).trim();
    // On cherche un fragment du nom affiché : le test ne dépend pas
    // des données de recette, il s'appuie sur ce que la page montre.
    const fragment = premier.split("\n")[0].slice(0, 3).toLowerCase();
    expect(fragment.length).toBeGreaterThan(0);

    await page.locator("#recherche").fill(fragment);
    await expect(page).toHaveURL(new RegExp(`q=${fragment}`));

    const filtres = await page.locator("table tbody tr").count();
    expect(filtres).toBeGreaterThan(0);
    expect(filtres).toBeLessThanOrEqual(total);
    await expect(
      page.getByText(/\d+ résultat\(s\) pour/)
    ).toBeVisible();
  });

  test("les validations listent les files en attente", async ({ page }) => {
    await page.goto("/validations");
    await expect(
      page.getByRole("heading", { name: "Validations" })
    ).toBeVisible();
    await expect(page.getByText("Demandes de congé")).toBeVisible();
    await expect(page.getByText("Corrections de pointage")).toBeVisible();
  });
});
