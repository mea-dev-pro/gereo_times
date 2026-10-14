import { cacheLife } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Views } from "@/types/database";

/**
 * Absences approuvées de l'organisation sur une période, pour le calendrier.
 *
 * Caché côté navigateur (`"use cache: private"`) : la requête garde la session
 * de l'utilisateur, donc la RLS s'applique normalement — la vue
 * `team_absences` ne montre que ce que la personne a le droit de voir. Le
 * résultat est conservé 5 minutes par le routeur, ce qui rend les va-et-vient
 * entre périodes et entre écrans instantanés au lieu de repayer un
 * aller-retour vers Supabase (≈200 ms en production).
 *
 * Ce qui est accepté en échange : un congé approuvé par quelqu'un d'autre peut
 * mettre jusqu'à 5 minutes à apparaître sur le calendrier. Un calendrier de
 * disponibilités le supporte ; des soldes de congés non, c'est pourquoi ils
 * gardent leur lecture directe.
 *
 * Le cache est invalidé en bloc par la première action de l'utilisateur qui
 * passe par une server action (`revalidatePath` vide le cache navigateur).
 */
export async function absencesEquipe(
  debut: string,
  fin: string
): Promise<Views<"team_absences">[]> {
  "use cache: private";
  cacheLife({ stale: 300 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("team_absences")
    .select("*")
    .gte("end_date", debut)
    .lte("start_date", fin)
    .order("start_date");

  return (data ?? []) as Views<"team_absences">[];
}
