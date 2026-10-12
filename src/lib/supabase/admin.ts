import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client à privilèges élevés : CONTOURNE ENTIÈREMENT LA RLS.
 *
 * Usage strictement serveur, pour les opérations que la RLS ne doit pas
 * autoriser depuis un client : invitations, tâches planifiées, maintenance.
 * Ne jamais l'importer depuis un composant client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY absente : les opérations d'administration sont indisponibles."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
