import { cacheLife } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Views } from "@/types/database";

/**
 * Données des rapports RH sur une période : membres, profils, pointages,
 * demandes de congé et soldes. Les types de congés viennent du cache partagé
 * (`lib/data/referentiel.ts`).
 *
 * Caché côté navigateur (`"use cache: private"`) : la session de l'utilisateur
 * est conservée, donc la RLS continue de décider de ce qui est lisible. Cinq
 * minutes de fraîcheur côté routeur, ce qui rend le retour sur l'écran — ou le
 * changement de période — instantané au lieu de repayer un aller-retour vers
 * Supabase par table.
 *
 * Un rapport consolidé supporte cinq minutes de retard ; c'est un écran de
 * consultation, pas un écran de décision. Les actions de l'utilisateur vident
 * de toute façon tout le cache navigateur (`revalidatePath`).
 */
export type DonneesRapports = {
  members: Tables<"organization_members">[];
  profiles: Pick<Tables<"profiles">, "id" | "full_name" | "email">[];
  entries: Pick<
    Tables<"time_entries">,
    "member_id" | "effective_minutes" | "planned_minutes" | "variance_minutes" | "status"
  >[];
  requests: Pick<
    Tables<"leave_requests">,
    "member_id" | "leave_type_id" | "total_days" | "status"
  >[];
  balances: Views<"leave_balances">[];
};

export async function donneesRapports(
  orgId: string,
  from: string,
  to: string
): Promise<DonneesRapports> {
  "use cache: private";
  cacheLife({ stale: 300 });

  const supabase = await createClient();

  const [members, profiles, entries, requests, balances] = await Promise.all([
    supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId)
      .order("joined_at"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase
      .from("time_entries")
      .select("member_id, effective_minutes, planned_minutes, variance_minutes, status")
      .eq("organization_id", orgId)
      .gte("work_date", from)
      .lte("work_date", to),
    supabase
      .from("leave_requests")
      .select("member_id, leave_type_id, total_days, status")
      .eq("organization_id", orgId)
      .lte("start_date", to)
      .gte("end_date", from),
    supabase.from("leave_balances").select("*").eq("organization_id", orgId),
  ]);

  return {
    members: members.data ?? [],
    profiles: profiles.data ?? [],
    entries: entries.data ?? [],
    requests: requests.data ?? [],
    balances: balances.data ?? [],
  };
}
