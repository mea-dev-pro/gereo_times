#!/usr/bin/env node
/**
 * Vérifie la réinitialisation de mot de passe, de bout en bout.
 *
 *   node scripts/verify-reset-mot-de-passe.mjs [url]   (défaut : http://localhost:3000)
 *
 * À lancer serveur démarré (`npm run build && npm run start`). Le script crée un
 * compte jetable (`reset-e2e-…@demo.test`, domaine réservé, jamais délivrable),
 * puis :
 *
 *   1. se connecte avec le mot de passe initial — la référence ;
 *   2. passe par le formulaire « Mot de passe oublié » de l'application ;
 *   3. demande un lien de réinitialisation à l'API d'administration (le lien
 *      reçu par courriel, obtenu sans boîte aux lettres) ;
 *   4. ouvre ce lien, saisit un nouveau mot de passe, vérifie l'écran de succès ;
 *   5. se reconnecte avec le NOUVEAU mot de passe, et vérifie que l'ANCIEN ne
 *      fonctionne plus ;
 *   6. supprime le compte jetable.
 *
 * Ce qui reste hors de portée : l'expédition du courriel elle-même. Elle dépend
 * du SMTP configuré dans Supabase, et le service d'email intégré est limité en
 * volume. Le script le dit à l'étape 2 au lieu de le laisser croire.
 *
 * La clé `service_role` est nécessaire (création et suppression du compte) :
 * sans elle, le script s'arrête au lieu de faire semblant.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const root = process.cwd();
const env = {};
for (const line of readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

let verifications = 0;
let echecs = 0;

function verifier(intitule, condition, detail = "") {
  verifications++;
  if (condition) {
    console.log(`  ok    ${intitule}`);
  } else {
    echecs++;
    console.log(`  ÉCHEC ${intitule}${detail ? ` — ${detail}` : ""}`);
  }
}

if (!SUPABASE || !ANON || !SERVICE) {
  console.log(
    "  ARRÊT : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et\n" +
      "  SUPABASE_SERVICE_ROLE_KEY sont nécessaires dans .env.local"
  );
  process.exit(1);
}

const enTetesService = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

const email = `reset-e2e-${Date.now()}@demo.test`;
const motDePasseInitial = "Initial-2026!";
const nouveauMotDePasse = "Remplace-2026!";

async function creerCompte() {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: enTetesService,
    body: JSON.stringify({
      email,
      password: motDePasseInitial,
      email_confirm: true,
    }),
  });
  const corps = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`création : ${r.status} ${JSON.stringify(corps)}`);
  return corps.id ?? corps.user?.id;
}

async function supprimerCompte(id) {
  await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: enTetesService,
  });
}

/** Connexion par mot de passe : renvoie true si elle réussit. */
async function connexion(motDePasse) {
  const r = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  return r.ok;
}

/** Lien de réinitialisation, tel qu'il partirait par courriel. */
async function lienDeReinitialisation() {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: enTetesService,
    body: JSON.stringify({
      type: "recovery",
      email,
      // Nom brut de l'API : le client JavaScript traduit `options.redirectTo`.
      redirect_to: `${BASE}/auth/reinitialiser`,
    }),
  });
  const corps = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`lien : ${r.status} ${JSON.stringify(corps)}`);
  return corps;
}

/**
 * Suit le lien de vérification sans le consommer dans un navigateur : la
 * réponse 302 indique où Supabase envoie l'utilisateur, donc si l'adresse de
 * retour est bien dans la liste blanche du projet.
 */
async function destinationDuLien(actionLink) {
  const r = await fetch(actionLink, { redirect: "manual" });
  return { statut: r.status, location: r.headers.get("location") };
}

const navigateur = await chromium.launch();
let id = null;

try {
  console.log(`\n  Compte jetable : ${email}\n`);
  id = await creerCompte();

  verifier(
    "connexion avec le mot de passe initial",
    await connexion(motDePasseInitial)
  );

  // --- 1. Formulaire de demande, dans le navigateur -------------------------
  const contexte = await navigateur.newContext({ baseURL: BASE, locale: "fr-FR" });
  const page = await contexte.newPage();

  /** Soumet le formulaire pour une adresse et renvoie le texte affiché. */
  async function demander(adresse) {
    await page.goto("/mot-de-passe-oublie");
    await page.locator("#email").fill(adresse);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();

    // Le message arrive avec la réponse de l'action. On attend un élément de
    // statut NON VIDE : Next.js pose un « route announcer » avec role="alert",
    // vide la plupart du temps, et le prendre pour le message ferait croire
    // qu'il n'y en a pas.
    try {
      await page
        .locator('[role="status"], [role="alert"]')
        .filter({ hasText: /\S/ })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      console.log(`  [détail] aucun message d'état pour ${adresse}`);
    }

    return (await page.locator("main").innerText()).replace(/\s+/g, " ");
  }

  const adresseInconnue = `inconnu-e2e-${Date.now()}@demo.test`;
  const messageInconnu = await demander(adresseInconnue);
  verifier(
    "une adresse sans compte reçoit le message d'envoi",
    messageInconnu.includes("Si un compte existe"),
    messageInconnu || "aucun message"
  );

  // Même formulaire, cette fois pour une adresse qui existe réellement : le
  // message doit être identique, sinon l'écran permettrait de découvrir quels
  // comptes existent en essayant des adresses.
  const messageReel = await demander(email);
  if (messageReel.includes("Si un compte existe")) {
    verifier("la réponse ne distingue pas les comptes existants", true);
  } else if (/Trop de tentatives/i.test(messageReel)) {
    console.log(
      "  note  quota d'envoi du service d'email Supabase atteint : le message\n" +
        "        de limite s'affiche à la place. La demande a bien été transmise,\n" +
        "        mais rien ne prouve ici que la réponse serait identique."
    );
  } else {
    verifier(
      "la réponse ne distingue pas les comptes existants",
      false,
      messageReel || "aucun message"
    );
  }

  console.log(
    "  note  l'expédition réelle dépend du SMTP configuré dans Supabase\n" +
      "        (le service intégré est limité en volume) : non vérifiée ici."
  );

  // --- 2. Le lien, et l'adresse de retour qu'il porte -----------------------
  const lien = await lienDeReinitialisation();
  // L'API renvoie le lien à plat (`action_link`) ; le client JavaScript, lui,
  // le range sous `properties`. On accepte les deux formes.
  const actionLink = lien.action_link ?? lien.properties?.action_link;
  verifier(
    "l'API renvoie un lien de réinitialisation",
    Boolean(actionLink),
    actionLink ? "" : `champs reçus : ${Object.keys(lien).join(", ")}`
  );
  if (!actionLink) throw new Error("pas de lien à ouvrir");

  const { location } = await destinationDuLien(actionLink);
  const retourAccepte = Boolean(location && location.startsWith(BASE));
  verifier(
    `l'adresse de retour ${BASE}/auth/reinitialiser est autorisée par Supabase`,
    retourAccepte,
    location
      ? `Supabase redirige vers ${location.split("#")[0].split("?")[0]} — ` +
        "ajoutez l'adresse dans Authentication → URL Configuration"
      : "aucune redirection renvoyée"
  );

  // Sans entrée dans la liste blanche, on rejoue le lien à la main sur la
  // bonne origine : ce sont les mêmes jetons, à usage unique.
  const cible = retourAccepte ? location : await lienRejoueSur(actionLink);

  // --- 3. Nouveau mot de passe --------------------------------------------
  await page.goto(cible);
  const champ = page.locator("#password");
  try {
    await champ.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new Error(
      "le formulaire de nouveau mot de passe n'est pas apparu — le lien n'a pas ouvert de session"
    );
  }
  verifier("le lien ouvre le formulaire de nouveau mot de passe", true);

  await champ.fill(nouveauMotDePasse);
  await page.locator("#confirmation").fill(nouveauMotDePasse);
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();

  let succes = false;
  try {
    await page
      .getByText(/Mot de passe modifié/)
      .waitFor({ state: "visible", timeout: 15_000 });
    succes = true;
  } catch {
    succes = false;
  }
  verifier("l'écran confirme la modification", succes, await texteVisible(page));

  // --- 4. Preuve par l'API -------------------------------------------------
  verifier(
    "connexion avec le nouveau mot de passe",
    await connexion(nouveauMotDePasse)
  );
  verifier(
    "l'ancien mot de passe ne fonctionne plus",
    !(await connexion(motDePasseInitial)),
    "l'ancien mot de passe est encore accepté"
  );

  await contexte.close();
} catch (e) {
  echecs++;
  console.log(`  ERREUR ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await navigateur.close();
  if (id) await supprimerCompte(id);
}

/** Reconstruit le lien sur l'origine visée, à partir des jetons renvoyés. */
async function lienRejoueSur(actionLink) {
  const r = await fetch(actionLink, { redirect: "manual" });
  const location = r.headers.get("location") ?? "";
  const fragment = location.includes("#") ? location.slice(location.indexOf("#")) : "";
  if (fragment.includes("access_token")) return `${BASE}/auth/reinitialiser${fragment}`;

  const parametres = new URLSearchParams(location.split("?")[1] ?? "");
  const code = parametres.get("code");
  if (code) return `${BASE}/auth/reinitialiser?code=${code}`;

  throw new Error("le lien ne porte ni jeton ni code exploitable");
}

async function texteVisible(page) {
  try {
    return (await page.locator("body").innerText()).slice(0, 160).replace(/\n/g, " ");
  } catch {
    return "page illisible";
  }
}

console.log(`\n  ${verifications} vérifications, ${echecs} échec(s)\n`);
process.exit(echecs ? 1 : 0);
