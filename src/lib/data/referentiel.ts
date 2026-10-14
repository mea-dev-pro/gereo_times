import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

/**
 * Référentiels d'organisation : types de congés, départements, jours fériés.
 *
 * Ces trois tables changent rarement et sont lues par presque tous les écrans.
 * Les relire à chaque changement de page coûtait, en production, un aller-retour
 * vers Supabase par table — environ 200 ms depuis la région d'exécution des
 * fonctions Vercel (Le Cap) vers celle de la base (Irlande). Les mettre en cache
 * les fait disparaître de la plupart des navigations, et leur contenu entre
 * dans la coquille de l'application, donc dans ce qui est préchargé par les
 * liens du rail.
 *
 * Durée : profil `days` (fraîcheur côté navigateur 5 min, régénération
 * quotidienne côté serveur). Les 5 minutes de `stale` ne sont pas décoratives :
 * en dessous, Next exclut le contenu de la coquille de la route.
 *
 * INVALIDATION. Les server actions de `lib/actions/admin.ts` appellent
 * `updateTag(...)` avec les fonctions `tag…` ci-dessous. Toute nouvelle écriture
 * sur ces tables doit faire de même, sinon l'écran montrera l'ancienne valeur
 * jusqu'à la régénération quotidienne.
 *
 * INVARIANT DE SÉCURITÉ. Ces fonctions lisent avec la clé de service, qui
 * contourne la RLS — c'est ce qui autorise la mise en cache partagée entre
 * utilisateurs. Elles ne doivent donc être appelées QU'AVEC l'identifiant
 * d'organisation issu de la session (`session.organization.id`), jamais avec
 * une valeur venant de l'URL, d'un formulaire ou d'un client. Les données
 * renvoyées (libellés, couleurs, dates fériées) ne sont pas confidentielles,
 * mais elles appartiennent à l'organisation : une organisation erronée serait
 * une fuite entre clients.
 */

export const tagTypesConge = (orgId: string) => `org-${orgId}-types-conge`;
export const tagDepartements = (orgId: string) => `org-${orgId}-departements`;
export const tagJoursFeries = (orgId: string) => `org-${orgId}-jours-feries`;

/** Types de congés de l'organisation, actifs et inactifs, triés par libellé. */
export async function typesConge(orgId: string): Promise<Tables<"leave_types">[]> {
  "use cache";
  cacheTag(tagTypesConge(orgId));
  cacheLife("days");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leave_types")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");

  return data ?? [];
}

/** Départements de l'organisation, triés par nom. */
export async function departements(orgId: string): Promise<Tables<"departments">[]> {
  "use cache";
  cacheTag(tagDepartements(orgId));
  cacheLife("days");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("departments")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");

  return data ?? [];
}

/** Jours fériés de l'organisation, triés par date. */
export async function joursFeries(orgId: string): Promise<Tables<"holidays">[]> {
  "use cache";
  cacheTag(tagJoursFeries(orgId));
  cacheLife("days");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("holidays")
    .select("*")
    .eq("organization_id", orgId)
    .order("holiday_date");

  return data ?? [];
}
