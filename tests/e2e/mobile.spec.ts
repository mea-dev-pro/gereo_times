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

/**
 * Écrans publics, avec ce qu'on doit y trouver. `/auth/reinitialiser` affiche
 * un état de traitement, puis un message d'erreur — jamais de formulaire tant
 * qu'aucune session n'est ouverte ; on y attend donc simplement le contenu
 * principal.
 */
const PUBLICS: { chemin: string; attendu: string }[] = [
  { chemin: "/connexion", attendu: "form" },
  { chemin: "/inscription", attendu: "form" },
  { chemin: "/mot-de-passe-oublie", attendu: "form" },
  { chemin: "/auth/reinitialiser", attendu: "main" },
];

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

  for (const { chemin, attendu } of PUBLICS) {
    test(`aucun débordement sur ${chemin}`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page.locator(attendu).first()).toBeVisible();

      const { scroll, client } = await mesure(page);
      expect(
        scroll,
        `débordement de ${scroll - client} px sur ${chemin}`
      ).toBeLessThanOrEqual(client + 1);
    });
  }
});

test.describe("Mobile — tiroir de navigation", () => {
  test("un clic à côté du tiroir le referme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();

    const rail = page.locator("#rail-navigation");
    await expect(rail).toBeVisible();

    // Geste réel : on tape à droite du tiroir (320 px de large sur 390 px
    // d'écran), là où se trouve le voile. Le clic est fait sur le voile
    // lui-même pour vérifier qu'il est bien au-dessus du contenu.
    const boite = await rail.boundingBox();
    expect(boite).not.toBeNull();
    const x = Math.round(boite!.x + boite!.width + 30);
    expect(x, "il reste de la place à droite du tiroir").toBeLessThan(390);
    await page.mouse.click(x, 300);

    await expect(rail).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Menu" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("le contenu ne prend pas le focus tant que le tiroir est ouvert", async ({
    page,
  }) => {
    await page.goto("/");
    const contenu = page.locator("main");

    // Fermé : le contenu est atteignable, c'est l'état normal.
    expect(await contenu.evaluate((el: HTMLElement) => el.inert)).toBe(false);

    await page.getByRole("button", { name: "Menu" }).click();

    // Ouvert : le voile recouvre le contenu, il ne doit plus être focalisable.
    expect(await contenu.evaluate((el: HTMLElement) => el.inert)).toBe(true);

    // Le focus entre dans le tiroir à l'ouverture, puis la tabulation ne
    // descend jamais dans le contenu recouvert.
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const dansLeContenu = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("main"))
      );
      expect(dansLeContenu, `le focus entre dans le contenu au ${i + 1}e Tab`).toBe(
        false
      );
    }

    // Échap referme et rend la main au bouton, pas au document.
    await page.keyboard.press("Escape");
    await expect(page.locator("#rail-navigation")).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
    expect(await contenu.evaluate((el: HTMLElement) => el.inert)).toBe(false);
  });
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

    // Le bouton doit tenir dans la largeur de l'écran. La mesure est rejouée
    // jusqu'à obtenir une boîte : l'horloge du pointage redessine le panneau
    // chaque seconde, et un relevé unique peut tomber entre deux rendus et
    // rendre `null` — ce n'est pas un débordement, seulement un instant sans
    // élément.
    await expect
      .poll(
        async () => {
          const boite = await action.boundingBox();
          if (!boite) return null;
          return boite.x >= 0 && boite.x + boite.width <= 390 + 1
            ? "dans l'écran"
            : `hors écran : x=${Math.round(boite.x)}, largeur=${Math.round(boite.width)}`;
        },
        { timeout: 10_000 }
      )
      .toBe("dans l'écran");
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
