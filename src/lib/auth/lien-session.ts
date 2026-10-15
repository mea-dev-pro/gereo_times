"use client";

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adoption de la session portée par un lien reçu par courriel — activation d'un
 * collaborateur, connexion à usage unique, réinitialisation de mot de passe.
 *
 * Supabase renvoie selon les cas :
 *  - les jetons dans le fragment d'URL (#access_token=…&refresh_token=…)
 *  - un code d'échange en paramètre (?code=…, flux PKCE)
 *  - une erreur dans le fragment (#error=…&error_code=…)
 *
 * Le client @supabase/ssr ne traite QUE le second cas : les jetons du fragment
 * doivent être posés explicitement via setSession, sinon la session n'est jamais
 * ouverte. On couvre donc les deux.
 */

function readHash(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return raw ? new URLSearchParams(raw) : null;
}

/**
 * Message porté par le fragment d'URL, s'il annonce un échec.
 *
 * `suite` complète les messages génériques : la phrase à écrire dépend de ce
 * qu'il faut redemander (invitation, nouveau lien de réinitialisation), pas du
 * fait que le lien est mort.
 */
export function messageErreurFragment(suite: string): string | null {
  const hash = readHash();
  if (!hash) return null;

  if (hash.get("error_code") === "otp_expired") {
    return `Ce lien a déjà été utilisé ou a expiré. ${suite}`;
  }
  if (hash.get("error_description")) {
    return decodeURIComponent(hash.get("error_description") as string);
  }
  if (hash.get("error")) {
    return `Ce lien n'est plus valide. ${suite}`;
  }
  return null;
}

/** Le fragment d'URL ne bouge pas sans rechargement : rien à observer. */
const SANS_ABONNEMENT = () => () => {};
const ERREUR_ABSENTE = () => null;

/**
 * L'erreur du fragment est décidée par le serveur d'authentification : elle est
 * lue comme une source externe, avec un instantané nul côté serveur, sinon le
 * HTML du serveur (sans fragment) divergeait de celui du navigateur.
 */
export function useErreurFragment(suite: string): string | null {
  return useSyncExternalStore(
    SANS_ABONNEMENT,
    () => messageErreurFragment(suite),
    ERREUR_ABSENTE
  );
}

/** Pose la session décrite par le fragment d'URL, s'il y en a un. */
export async function adoptHashSession(
  supabase: SupabaseClient
): Promise<boolean> {
  const hash = readHash();
  if (!hash) return false;

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) return false;

  // Les jetons ont rempli leur office : on nettoie l'URL.
  window.history.replaceState(null, "", window.location.pathname);
  return true;
}

/**
 * Attend qu'une session soit ouverte, sans lien à adopter : c'est le cas du
 * code d'échange PKCE, que le client @supabase/ssr traite seul, en arrière-plan.
 * On laisse une poignée de secondes avant de déclarer le lien mort.
 */
export async function attendreSession(
  supabase: SupabaseClient,
  tentatives = 12,
  delai = 400
): Promise<boolean> {
  for (let tentative = 0; tentative < tentatives; tentative++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    await new Promise((resolve) => setTimeout(resolve, delai));
  }
  return false;
}
