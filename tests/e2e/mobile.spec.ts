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
});

/**
 * Les écrans publics se visitent SANS session : un utilisateur connecté qui
 * demande /connexion est renvoyé vers le tableau de bord par le rafraîchissement
 * de session, et le test mesurerait alors l'écran d'accueil en croyant mesurer
 * le formulaire de connexion — c'est ce qu'il faisait avant, en trouvant le
 * `<form>` du bouton « Se déconnecter » du rail.
 */
test.describe("Mobile — débordement horizontal (écrans publics)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const chemin of PUBLICS) {
    test(`aucun débordement sur ${chemin}`, async ({ page }) => {
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

    // Sous 1024 px le rail est replié derrière le bouton « Menu » : c'est lui
    // qui donne accès aux entrées, et non plus un rail toujours ouvert.
    await page.getByRole("button", { name: "Menu" }).click();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Pointage" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Mes congés" })).toBeVisible();
  });

  test("le menu s'ouvre, se ferme, et Échap le referme", async ({ page }) => {
    await page.goto("/");

    const bouton = page.getByRole("button", { name: /^(Menu|Fermer)$/ });
    const rail = page.locator("#rail-navigation");

    // Replié au chargement : le panneau ne doit pas manger l'écran d'entrée.
    await expect(rail).toBeHidden();
    await expect(bouton).toHaveAttribute("aria-expanded", "false");

    await bouton.click();
    await expect(rail).toBeVisible();
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(bouton).toHaveAccessibleName("Fermer");

    // Le panneau est bien relié au bouton qui le commande.
    await expect(bouton).toHaveAttribute("aria-controls", "rail-navigation");

    await page.keyboard.press("Escape");
    await expect(rail).toBeHidden();
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
  });

  test("le menu se referme après un changement d'écran", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await nav.getByRole("link", { name: "Pointage" }).click();
    await page.waitForURL(/\/pointage$/);

    // Rouverte, la navigation couvrirait l'écran qu'on vient d'ouvrir.
    await expect(page.locator("#rail-navigation")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Menu" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("le bouton de menu offre une cible tactile de 44 px", async ({ page }) => {
    await page.goto("/");
    const bouton = page.getByRole("button", { name: "Menu" });
    const boite = await bouton.boundingBox();

    expect(boite).not.toBeNull();
    // 44 px : la hauteur recommandée pour une cible au pouce. En dessous, on
    // rate le bouton sur un téléphone.
    expect(boite!.height).toBeGreaterThanOrEqual(44);
    expect(boite!.x + boite!.width).toBeLessThanOrEqual(390 + 1);
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
