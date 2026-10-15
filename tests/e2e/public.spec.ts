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

  test("le mot de passe s'affiche et se masque à la demande", async ({ page }) => {
    await page.goto("/connexion");

    const champ = page.locator("#password");
    await expect(champ).toHaveAttribute("type", "password");

    // Le bouton annonce l'action disponible, pas l'état : c'est ce nom qui
    // guide un utilisateur au lecteur d'écran.
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(champ).toHaveAttribute("type", "text");
    await expect(
      page.getByRole("button", { name: "Masquer le mot de passe" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
    await expect(champ).toHaveAttribute("type", "password");
  });

  test("la connexion mène à la demande de réinitialisation", async ({ page }) => {
    await page.goto("/connexion");

    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();

    await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
    await expect(
      page.getByRole("heading", { name: "Mot de passe oublié" })
    ).toBeVisible();

    // Le champ est cherché dans LE formulaire de cette page : après une
    // navigation cliente, la page précédente reste montée dans le document,
    // son `main` masqué — « #email » en désignerait donc deux.
    const formulaire = page.locator("form").filter({ hasText: "Envoyer le lien" });
    await expect(formulaire.locator("#email")).toBeVisible();
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

/**
 * Fournisseurs d'identité tiers.
 *
 * L'écran ne doit proposer que les fournisseurs que Supabase déclare actifs :
 * un bouton qui mène à « provider is not enabled » est pire qu'une absence de
 * bouton. Le test interroge donc l'état réel, puis vérifie la conséquence dans
 * l'interface — il devient exigeant tout seul le jour où un fournisseur est
 * activé dans Supabase, sans qu'une ligne soit à changer ici.
 */
const FOURNISSEURS = ["google", "apple", "facebook"] as const;

async function fournisseursActifs(
  requete: import("@playwright/test").APIRequestContext
): Promise<string[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return null;

  const reponse = await requete.get(`${url}/auth/v1/settings`, {
    headers: { apikey: cle },
  });
  const { external } = (await reponse.json()) as {
    external?: Record<string, boolean>;
  };
  return FOURNISSEURS.filter((f) => external?.[f]);
}

test.describe("Connexion par un fournisseur tiers", () => {
  test("seuls les fournisseurs configurés sont cliquables", async ({
    page,
    request,
  }) => {
    const actifs = await fournisseursActifs(request);
    // Sans ces deux valeurs, l'état des fournisseurs est inconnaissable : mieux
    // vaut le dire que de laisser croire que le contrôle est passé.
    expect(
      actifs,
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont attendus dans .env.local"
    ).not.toBeNull();

    await page.goto("/connexion");

    // 1. État de chaque bouton. Les trois sont affichés — c'est la composition
    // de la maquette — mais seuls les fournisseurs actifs sont cliquables.
    // Cette passe doit précéder les clics : un clic intercepté puis interrompu
    // détruit le document, et tout contrôle d'interface mené après lui serait
    // vrai à vide (c'est précisément ce que faisait la version précédente).
    for (const fournisseur of FOURNISSEURS) {
      const nom = fournisseur[0].toUpperCase() + fournisseur.slice(1);
      const actif = actifs!.includes(fournisseur);

      const bouton = page.getByRole("button", {
        name: actif ? `Continuer avec ${nom}` : `Continuer avec ${nom} (bientôt disponible)`,
        exact: actif,
      });
      await expect(bouton, `${nom} : bouton attendu`).toBeVisible();
      await expect(bouton, `${nom} : état du bouton`).toBeEnabled({ enabled: actif });

      if (!actif) {
        await expect(
          page.getByRole("button", { name: `Continuer avec ${nom}`, exact: true }),
          `${nom} est inactif : aucun bouton cliquable ne doit exister`
        ).toHaveCount(0);
      }
    }

    // 2. Un fournisseur actif doit engager le parcours chez lui, et le retour
    // doit viser /auth/callback — c'est cette adresse qui doit figurer dans la
    // liste blanche du projet.
    for (const fournisseur of actifs!) {
      // Page neuve à chaque tour : le clic quitte le document.
      await page.goto("/connexion");
      let destination = "";
      await page.route("**/*", async (route) => {
        const cible = route.request().url();
        if (cible.startsWith("http://localhost:3000")) return route.continue();
        destination = cible;
        await route.abort();
      });

      await page
        .getByRole("button", {
          name: `Continuer avec ${fournisseur[0].toUpperCase()}${fournisseur.slice(1)}`,
          exact: true,
        })
        .click();
      await expect
        .poll(() => destination, { timeout: 15_000 })
        .toContain(`provider=${fournisseur}`);
      expect(destination).toContain("supabase.co/auth/v1/authorize");
      expect(decodeURIComponent(destination)).toContain("/auth/callback");
      await page.unroute("**/*");
    }
  });

  test("un retour en échec ramène à la connexion avec un motif lisible", async ({
    page,
  }) => {
    // Sans code : le fournisseur a refusé, ou l'utilisateur est revenu en arrière.
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/connexion\?erreur=fournisseur/);
    await expect(
      page.getByRole("alert").filter({ hasText: "refusé la connexion" })
    ).toBeVisible();

    // Annulation explicite.
    await page.goto("/auth/callback?error=access_denied&error_code=access_denied");
    await expect(page).toHaveURL(/\/connexion\?erreur=annule/);
    await expect(
      page.getByRole("alert").filter({ hasText: "a été annulée" })
    ).toBeVisible();

    // Code présent mais échange impossible : le motif doit rester distinct.
    await page.goto("/auth/callback?code=code-invalide");
    await expect(page).toHaveURL(/\/connexion\?erreur=echange/);
    await expect(
      page.getByRole("alert").filter({ hasText: "n'a pas pu être finalisée" })
    ).toBeVisible();
  });
});

/**
 * Demande de réinitialisation. Aucun courriel n'est envoyé pour une adresse
 * inconnue — l'API répond 200 sans rien expédier —, ce qui rend ce contrôle
 * reproductible sans consommer le quota d'envoi du projet.
 */
test.describe("Mot de passe oublié — demande", () => {
  test("la demande annonce l'envoi sans révéler si le compte existe", async ({
    page,
  }) => {
    await page.goto("/mot-de-passe-oublie");

    await page.locator("#email").fill(`inconnu-e2e-${Date.now()}@demo.test`);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();

    // Le message est le même que l'adresse existe ou non : c'est ce qui empêche
    // de découvrir quels comptes existent en essayant des adresses.
    await expect(
      page.getByText(/Si un compte existe pour cette adresse/)
    ).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/error/i);
  });
});

/**
 * Point d'arrivée du lien de réinitialisation. Comme pour l'activation, ce qui
 * est vérifié ici est le traitement du message d'échec : la partie du code qui
 * décide de ne rien tenter quand le lien est mort.
 */
test.describe("Réinitialisation — liens invalides", () => {
  test("un lien mort est annoncé, avec de quoi en demander un autre", async ({
    page,
  }) => {
    await page.goto(
      "/auth/reinitialiser#error=access_denied&error_code=otp_expired"
    );

    await expect(
      page.getByRole("alert").filter({ hasText: "Lien inutilisable" })
    ).toBeVisible();
    await expect(
      page.getByText(/déjà été utilisé ou a expiré/)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Demander un nouveau lien" })
    ).toBeVisible();
    // Aucun formulaire de mot de passe : sans session, il n'aurait rien à
    // enregistrer.
    await expect(page.locator("#password")).toHaveCount(0);
  });

  test("sans code ni jeton, l'écran finit par annoncer un lien invalide", async ({
    page,
  }) => {
    await page.goto("/auth/reinitialiser");

    // Attente de la session : douze tentatives, à 400 ms d'intervalle.
    await expect(
      page.getByText(/Ce lien est invalide ou a expiré/)
    ).toBeVisible({ timeout: 20_000 });
  });
});
