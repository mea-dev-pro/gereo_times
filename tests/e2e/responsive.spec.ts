import { expect, test } from "@playwright/test";

/**
 * Comportement du rail de navigation selon la largeur : téléphone, tablette,
 * bureau. Chaque projet Playwright fixe une largeur (voir playwright.config.ts)
 * et le fichier lit la largeur réelle pour décider de ce qui est attendu — de
 * cette façon chaque test affirme quelque chose à chaque largeur, au lieu de
 * s'ignorer silencieusement là où il ne s'applique pas.
 *
 * Le seuil est celui de Tailwind : `lg` = 1024 px. En dessous, le rail est
 * replié derrière le bouton « Menu » ; au-dessus, il est affiché en permanence
 * et le bouton n'existe pas.
 */

const SEUIL = 1024;

function largeur(page: import("@playwright/test").Page) {
  return page.viewportSize()?.width ?? 0;
}

test.describe("Responsive — rail de navigation", () => {
  test("le rail est replié sur petit écran, permanent au-dessus", async ({
    page,
  }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;
    const bouton = page.getByRole("button", { name: /^(Menu|Fermer)$/ });
    const rail = page.locator("#rail-navigation");

    if (grand) {
      // Aucun bouton, aucune notion de repli : le rail est là, c'est tout.
      await expect(bouton, `${largeur(page)} px : pas de bouton`).toBeHidden();
      await expect(rail).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Navigation principale" })
      ).toBeVisible();
    } else {
      await expect(bouton, `${largeur(page)} px : bouton attendu`).toBeVisible();
      await expect(rail, "rail replié au chargement").toBeHidden();
      await expect(bouton).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("le menu s'ouvre et donne accès à toutes les entrées", async ({
    page,
  }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;

    if (!grand) await page.getByRole("button", { name: "Menu" }).click();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    // Les entrées du rail sont présentes à toutes les largeurs : la différence
    // est qu'elles attendent un geste sous 1024 px.
    for (const libelle of ["Tableau de bord", "Pointage", "Mes congés"]) {
      await expect(
        nav.getByRole("link", { name: libelle }),
        `« ${libelle} » accessible à ${largeur(page)} px`
      ).toBeVisible();
    }
  });

  test("le rail ne provoque aucun débordement horizontal", async ({ page }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;

    for (const etat of grand ? ["ouvert"] : ["replié", "ouvert"]) {
      if (etat === "ouvert" && !grand) {
        await page.getByRole("button", { name: "Menu" }).click();
        await expect(page.locator("#rail-navigation")).toBeVisible();
      }

      const mesure = await page.evaluate(() => {
        const d = document.documentElement;
        return { scroll: d.scrollWidth, client: d.clientWidth };
      });
      expect(
        mesure.scroll,
        `débordement de ${mesure.scroll - mesure.client} px (panneau ${etat})`
      ).toBeLessThanOrEqual(mesure.client + 1);
    }
  });

  test("le rail occupe la largeur prévue pour la taille d'écran", async ({
    page,
  }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;
    if (!grand) await page.getByRole("button", { name: "Menu" }).click();

    const boite = await page.locator("#rail-navigation").boundingBox();
    expect(boite).not.toBeNull();

    if (grand) {
      // Rail permanent : largeur fixe, il ne bouge pas d'un écran à l'autre.
      expect(boite!.width).toBe(256);
    } else {
      // Panneau : toute la largeur sur téléphone, 320 px à partir de la
      // tablette (seuil `sm` de Tailwind), sans jamais dépasser l'écran.
      const attendu = largeur(page) >= 640 ? 320 : largeur(page);
      expect(boite!.width).toBeLessThanOrEqual(Math.min(attendu, largeur(page)) + 1);
      expect(boite!.width).toBeGreaterThan(attendu - 2);
    }
  });

  test("Échap referme le panneau là où il est repliable", async ({ page }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;
    const rail = page.locator("#rail-navigation");

    if (grand) {
      // Le rail n'a pas d'état : Échap ne doit rien lui faire.
      await page.keyboard.press("Escape");
      await expect(rail).toBeVisible();
      return;
    }

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(rail).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(rail).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Menu" })
    ).toHaveAttribute("aria-expanded", "false");
  });
});
