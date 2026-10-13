import { expect, test } from "@playwright/test";

/**
 * Thème clair / sombre.
 *
 * Le thème est posé par un script en ligne avant peinture (pour éviter tout
 * clignotement), puis mémorisé dans `localStorage`. Ce test couvre les deux
 * mécanismes, ainsi que le fait que les couleurs changent RÉELLEMENT — un
 * simple changement de classe sans effet sur les tokens passerait autrement.
 */

test.describe("Thème de l'interface", () => {
  test("la bascule change les couleurs et survit au rechargement", async ({
    page,
  }) => {
    await page.goto("/");

    const racine = page.locator("html");
    const fond = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Playwright annonce `prefers-color-scheme: light` : on part du thème clair.
    await expect(racine).not.toHaveClass(/dark/);
    expect(await fond()).toBe("rgb(248, 249, 251)");

    await page.getByRole("radio", { name: "Thème sombre" }).click();

    await expect(racine).toHaveClass(/dark/);
    expect(await fond()).toBe("rgb(15, 17, 21)");

    // Le choix doit être rejoué avant peinture au chargement suivant.
    await page.reload();
    await expect(racine).toHaveClass(/dark/);
    expect(await fond()).toBe("rgb(15, 17, 21)");

    await page.getByRole("radio", { name: "Thème clair" }).click();
    await expect(racine).not.toHaveClass(/dark/);
    expect(await fond()).toBe("rgb(248, 249, 251)");
  });

  test("le texte reste lisible dans les deux thèmes", async ({ page }) => {
    await page.goto("/");

    // Contraste calculé sur la couleur réellement appliquée, pas sur la classe.
    async function contrasteTitre() {
      return page.evaluate(() => {
        const el = document.querySelector("h1");
        if (!el) return null;

        const versRgb = (c: string) =>
          c.match(/\d+/g)!.slice(0, 3).map(Number);

        const canal = (v: number) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        const lum = ([r, g, b]: number[]) =>
          0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

        const texte = versRgb(getComputedStyle(el).color);
        let fond = versRgb(getComputedStyle(document.body).backgroundColor);

        const a = lum(texte);
        const b = lum(fond);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    }

    const clair = await contrasteTitre();
    expect(clair).not.toBeNull();
    expect(clair as number).toBeGreaterThanOrEqual(4.5);

    await page.getByRole("radio", { name: "Thème sombre" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const sombre = await contrasteTitre();
    expect(sombre as number).toBeGreaterThanOrEqual(4.5);
  });
});
