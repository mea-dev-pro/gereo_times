import { cache } from "react";
import { redirect } from "next/navigation";
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
 * Contexte de session : utilisateur, profil, appartenance et organisation.
 * Mémoïsé par requête grâce à `cache`, donc appelable depuis plusieurs
 * Server Components sans multiplier les allers-retours.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
  if (!membership) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.organization_id)
    .maybeSingle();
  if (!organization) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    membership,
    organization,
  };
});

/** L'utilisateur est-il authentifié, mais sans organisation ? (onboarding) */
export const isAuthenticatedWithoutOrganization = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
});

export async function requireSession(): Promise<SessionContext> {
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
