import { expect, test } from "@playwright/test";

/**
 * Comportement du rail de navigation selon la largeur : téléphone, tablette,
 * bureau. Chaque projet Playwright fixe une largeur (voir playwright.config.ts)
 * et le fichier lit la largeur réelle pour décider de ce qui est attendu — de
 * cette façon chaque test affirme quelque chose à chaque largeur, au lieu de
 * s'ignorer silencieusement là où il ne s'applique pas.
 *
 * Le seuil est celui de Tailwind : `lg` = 1024 px. En dessous, la navigation
 * est un tiroir derrière le bouton « Menu » ; au-dessus, le rail est affiché en
 * permanence et le bouton n'existe pas.
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
      // Tiroir : 320 px, sans jamais dépasser 85 % de l'écran — le voile reste
      // visible à droite, ce qui montre qu'on peut fermer en cliquant à côté.
      const attendu = Math.min(320, largeur(page) * 0.85);
      expect(boite!.width).toBeLessThanOrEqual(attendu + 1);
      expect(boite!.width).toBeGreaterThan(attendu - 2);
    }
  });

  test("le tiroir recouvre le contenu au lieu de le décaler", async ({ page }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;
    const rail = page.locator("#rail-navigation");
    const contenu = page.locator("main");

    const avant = await contenu.boundingBox();
    expect(avant).not.toBeNull();

    if (!grand) await page.getByRole("button", { name: "Menu" }).click();
    await expect(rail).toBeVisible();

    // Le contenu n'a pas bougé d'un pixel : la navigation est une couche
    // par-dessus, elle ne réserve plus de largeur ni de hauteur.
    const apres = await contenu.boundingBox();
    expect(apres).not.toBeNull();
    expect(
      Math.abs(apres!.x - avant!.x),
      "la position du contenu ne change pas à l'ouverture"
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(apres!.width - avant!.width)).toBeLessThanOrEqual(1);

    if (!grand) {
      // Et le tiroir chevauche bien ce contenu.
      const boite = await rail.boundingBox();
      expect(boite!.x + boite!.width).toBeGreaterThan(apres!.x);
      expect(boite!.x).toBeLessThanOrEqual(1);
    }
  });

  test("au bureau, le rail reste en place pendant que la page défile", async ({
    page,
  }) => {
    await page.goto("/");
    const grand = largeur(page) >= SEUIL;
    const rail = page.locator("#rail-navigation");

    // Seul le bureau est concerné : le tiroir, lui, est déjà hors du flux.
    if (!grand) {
      await expect(rail).toBeHidden();
      return;
    }

    // Une page courte ne prouve rien : on allonge le contenu à la main pour que
    // la page défile, quelle que soit la donnée de recette.
    await page.evaluate(() => {
      const poumon = document.createElement("div");
      poumon.style.height = "3000px";
      document.querySelector("main")?.append(poumon);
    });

    const defilable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 100
    );
    expect(
      defilable,
      "la page doit défiler pour que ce contrôle ait un sens"
    ).toBe(true);

    const avant = await rail.boundingBox();
    expect(avant).not.toBeNull();

    // Le rail occupe exactement un écran : c'est ce qui le rend collant, et
    // c'est ce qui a remplacé « hauteur du contenu de la page ».
    const ecran = await page.evaluate(() => window.innerHeight);
    expect(Math.abs(avant!.height - ecran)).toBeLessThanOrEqual(1);
    expect(avant!.y).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo(0, 1500));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    await expect
      .poll(async () => (await rail.boundingBox())?.y ?? -1, {
        message: "le rail ne doit pas suivre le défilement",
      })
      .toBeLessThanOrEqual(1);

    // Et les commandes du bas du rail restent à l'écran, sans avoir à descendre
    // au bout de la page pour les atteindre.
    await expect(
      page.getByRole("button", { name: "Se déconnecter" })
    ).toBeInViewport();
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
