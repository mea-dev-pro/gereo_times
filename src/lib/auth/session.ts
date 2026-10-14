import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type SessionContext = {
  userId: string;
  email: string;
  profile: Tables<"profiles">;
  membership: Tables<"organization_members">;
  organization: Tables<"organizations">;
};

/**
 * Colonnes de la session, en une seule requête.
 *
 * `profiles` a besoin d'une indication explicite : `organization_members` porte
 * deux clés étrangères vers `profiles` (`user_id` et `invited_by`), PostgREST ne
 * peut donc pas deviner laquelle suivre.
 */
const SELECT_SESSION =
  "*, organizations(*), profiles!organization_members_user_id_fkey(*)";

type LigneSession = Tables<"organization_members"> & {
  organizations: Tables<"organizations"> | null;
  profiles: Tables<"profiles"> | null;
};

/**
 * Contexte de session : utilisateur, profil, appartenance et organisation.
 * Mémoïsé par requête grâce à `cache`, donc appelable depuis plusieurs
 * Server Components sans multiplier les allers-retours.
 *
 * Coût réseau : un aller-retour. Le jeton est vérifié localement par
 * `getClaims()` (clé asymétrique, JWKS gardé en cache de module) et le profil,
 * l'appartenance et l'organisation arrivent dans la même réponse. La version
 * précédente enchaînait quatre allers-retours — `getUser()` puis trois requêtes
 * en cascade — soit plusieurs centaines de millisecondes de plus par
 * changement de page.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const { data: jeton } = await supabase.auth.getClaims();
  const userId = jeton?.claims?.sub;
  if (!userId) return null;

  // Le type de la base est écrit à la main, sans métadonnées de relations : la
  // liste de colonnes passe donc en chaîne, et le résultat est décrit par
  // `LigneSession`.
  const { data } = await supabase
    .from("organization_members")
    .select(SELECT_SESSION as "*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const ligne = data as LigneSession | null;
  if (!ligne?.organizations || !ligne.profiles) return null;

  const { organizations: organization, profiles: profile, ...membership } = ligne;

  return {
    userId,
    email: jeton?.claims?.email ?? profile.email,
    profile,
    membership,
    organization,
  };
});

/** L'utilisateur est-il authentifié, mais sans organisation ? (onboarding) */
export const isAuthenticatedWithoutOrganization = cache(async () => {
  const supabase = await createClient();
  const { data: jeton } = await supabase.auth.getClaims();
  return Boolean(jeton?.claims?.sub);
});

export async function requireSession(): Promise<SessionContext> {
  // Force le rendu à la requête. Les pages calculent des dates (semaine et mois
  // en cours) : sans cela Next signale « Date.now() rencontré pendant le
  // prérendu » sous Cache Components.
  await connection();

  const session = await getSession();
  if (!session) redirect("/organisation/nouvelle");
  return session;
}

export function canManage(role: string): boolean {
  return role === "manager" || role === "hr" || role === "admin";
}

export function isHrOrAdmin(role: string): boolean {
  return role === "hr" || role === "admin";
}
