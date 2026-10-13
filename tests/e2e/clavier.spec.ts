import { expect, test, type Page } from "@playwright/test";

/**
 * Critère UX-06 du PRD : « En tant qu'utilisateur clavier, je veux naviguer
 * sans souris. » Trois exigences : ordre de tabulation logique, focus visible,
 * dialogues utilisables au clavier.
 *
 * Rien n'est simulé : chaque étape part d'une vraie pression de touche (Tab,
 * Entrée, Échap) et lit `document.activeElement`, seul témoin de ce que le
 * navigateur a réellement donné au clavier.
 */

/** Nom accessible approximatif de l'élément qui détient le focus. */
function focusActuel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "(aucun)";
    const texte = (el.innerText ?? "").trim().replace(/\s+/g, " ");
    return el.getAttribute("aria-label") ?? texte ?? el.tagName.toLowerCase();
  });
}

/** Nom accessible de la fenêtre modale ouverte, ou null. */
function focusDansUneFenetre(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return Boolean(el?.closest("dialog"));
  });
}

/** Style d'anneau du focus, tel que peint par le navigateur. */
function anneauFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const s = el ? getComputedStyle(el) : null;
    return {
      balise: el?.tagName ?? null,
      style: s?.outlineStyle ?? null,
      largeur: s ? Number.parseFloat(s.outlineWidth) : null,
      couleur: s?.outlineColor ?? null,
    };
  });
}

/**
 * Tabule jusqu'à ce que le focus porte un nom correspondant au motif.
 * Échoue avec le nom réellement atteint : sans cela, un échec ne dit pas où
 * la navigation s'est arrêtée.
 */
async function tabulerVers(page: Page, motif: RegExp, maximum = 40) {
  const vus: string[] = [];
  for (let i = 0; i < maximum; i++) {
    await page.keyboard.press("Tab");
    const nom = await focusActuel(page);
    if (motif.test(nom)) return nom;
    vus.push(nom);
  }
  throw new Error(
    `« ${motif} » non atteint en ${maximum} tabulations. Parcours : ${vus.join(" → ")}`
  );
}

const NAV_ATTENDUE = [
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

test.describe("Clavier — parcours et ordre de tabulation", () => {
  test("le premier arrêt donne accès au contenu", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    expect(await focusActuel(page)).toBe("Aller au contenu");

    // Le lien doit être visible une fois focalisé, sinon il ne sert à rien.
    const lien = page.getByRole("link", { name: "Aller au contenu" });
    await expect(lien).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenu$/);
    expect(
      await page.evaluate(() => document.activeElement?.id),
      "le contenu reçoit le focus"
    ).toBe("contenu");
  });

  test("l'ordre de tabulation suit l'ordre de lecture", async ({ page }) => {
    await page.goto("/");

    const premiers: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      premiers.push(await focusActuel(page));
    }

    expect(premiers).toEqual([
      "Aller au contenu",
      "GereoTimes",
      "Tableau de bord",
      "Pointage",
      "Mes congés",
    ]);

    // Les entrées du rail sont parcourues dans l'ordre où elles sont lues.
    const hrefs = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('nav[aria-label="Navigation principale"] a')
      ).map((a) => a.getAttribute("href"))
    );
    expect(hrefs).toEqual(NAV_ATTENDUE);
  });

  test("le focus est visible au clavier et discret à la souris", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const clavier = await anneauFocus(page);
    expect(clavier.balise, "un lien détient le focus").toBe("A");
    expect(clavier.style, "style d'anneau").not.toBe("none");
    expect(clavier.largeur, "épaisseur").toBeGreaterThanOrEqual(2);
    expect(clavier.couleur, "couleur").not.toMatch(/rgba?\(0, 0, 0, 0\)|transparent/);

    // Au clic, `:focus-visible` ne s'applique pas : pas d'anneau parasite.
    await page.getByRole("radio", { name: "Thème clair" }).click();
    const souris = await anneauFocus(page);
    expect(souris.balise, "le bouton cliqué détient le focus").toBe("BUTTON");
    expect(souris.style, "aucun anneau après un clic").toBe("none");
  });

  test("les actions du pointage s'atteignent au clavier", async ({ page }) => {
    await page.goto("/pointage");

    const nom = await tabulerVers(
      page,
      /Pointer l'arrivée|Pointer la sortie|Reprendre/
    );
    expect(nom).toMatch(/Pointer l'arrivée|Pointer la sortie|Reprendre/);

    const dansLeContenu = await page.evaluate(() =>
      Boolean((document.activeElement as HTMLElement | null)?.closest("main"))
    );
    expect(dansLeContenu, "le focus est entré dans le contenu").toBe(true);

    const anneau = await anneauFocus(page);
    expect(anneau.style, "anneau visible sur l'action").not.toBe("none");
    expect(anneau.largeur).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Clavier — fenêtre de confirmation", () => {
  // Ce test ouvre une session de quelques secondes avec le compte de recette,
  // puis la referme : le compte est rendu dans l'état où il a été trouvé, et il
  // reste un pointage de quelques secondes dans l'historique. C'est le prix de
  // la seule fenêtre modale atteignable sans dépendre d'une file d'attente
  // non vide.
  test("la sortie se confirme sans souris", async ({ page }) => {
    await page.goto("/pointage");

    const arrivee = page.getByRole("button", { name: /^Pointer l'arrivée$/ });
    const sortie = page.getByRole("button", { name: /^Pointer la sortie$/ });

    // On ne touche pas à une session que le test n'a pas ouverte : un
    // utilisateur réel peut être pointé au moment où la suite tourne.
    const sessionEnCours = await sortie.isVisible().catch(() => false);
    if (!sessionEnCours) {
      await tabulerVers(page, /Pointer l'arrivée/);
      await page.keyboard.press("Enter");
      await expect(sortie).toBeVisible();
    }

    // Une sortie de quelques secondes déclenche la confirmation.
    const declencheur = await tabulerVers(page, /Pointer la sortie/);
    await page.keyboard.press("Enter");

    const fenetre = page.getByRole("dialog");
    await expect(fenetre).toBeVisible();
    await expect(
      fenetre.getByRole("heading", { name: "Confirmer la sortie" })
    ).toBeVisible();

    expect(
      await focusDansUneFenetre(page),
      "le focus est entré dans la fenêtre"
    ).toBe(true);

    // Échap ferme et rend le focus au bouton d'origine.
    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden();
    expect(await focusActuel(page), "retour du focus").toBe(declencheur);

    if (sessionEnCours) return; // état rendu tel qu'il a été trouvé

    // Rien n'a été pointé par Échap : on termine au clavier, ce qui remet le
    // compte dans l'état d'origine.
    await page.keyboard.press("Enter");
    await expect(fenetre).toBeVisible();
    await tabulerVers(page, /Confirmer la sortie/);
    await page.keyboard.press("Enter");

    await expect(fenetre).toBeHidden();
    await expect(arrivee, "la session est refermée").toBeVisible();
  });
});
