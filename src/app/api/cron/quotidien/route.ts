import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingEmails, type DispatchResult } from "@/lib/notifications/email";

/**
 * Tâche planifiée quotidienne : acquisition des congés, puis expédition des
 * notifications en attente.
 *
 * Appelée par Vercel (voir `crons` dans vercel.json), jamais par un navigateur.
 * Vercel joint `Authorization: Bearer $CRON_SECRET` quand la variable est
 * définie ; sans elle, la route refuse tout le monde (échec fermé) : elle
 * déclenche des écritures comptables, elle ne doit pas être ouverte.
 *
 * L'acquisition est idempotente en base (voir migration 0008) : la route peut
 * donc tourner tous les jours, ce qui rattrape une journée manquée sans jamais
 * créditer deux fois le même mois. Les envois en attente profitent du même
 * passage, ce qui les rend indépendants de l'activité dans l'application.
 *
 * Pas de `export const dynamic` / `runtime` ici : `nextConfig.cacheComponents`
 * les interdit, et la lecture d'un en-tête d'autorisation suffit à rendre la
 * route dynamique.
 */

function secretValide(req: NextRequest): boolean {
  const attendu = process.env.CRON_SECRET;
  if (!attendu) return false;

  const entete = req.headers.get("authorization") ?? "";
  const fourni = entete.replace(/^Bearer\s+/i, "").trim();

  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  // timingSafeEqual exige des longueurs égales : la comparaison de longueur
  // précède, elle ne révèle rien d'exploitable sur un secret aussi long.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!secretValide(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let acquisition: unknown;
  let acquisitionEnEchec = false;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("run_scheduled_accrual");
    if (error) throw new Error(error.message);
    acquisition = data;
  } catch (e) {
    acquisition = { error: e instanceof Error ? e.message : String(e) };
    acquisitionEnEchec = true;
  }

  // Les emails partent même si l'acquisition a échoué : les deux opérations
  // sont indépendantes, et un échec d'écriture ne doit pas retenir la file
  // d'envoi.
  let emails: DispatchResult;
  try {
    emails = await dispatchPendingEmails();
  } catch (e) {
    emails = {
      configured: false,
      sent: 0,
      failed: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(
    {
      ran_at: new Date().toISOString(),
      acquisition,
      emails,
    },
    // Un échec d'acquisition remonte en 500 : la tâche apparaît en échec dans
    // les journaux Vercel, au lieu de passer pour un succès silencieux.
    { status: acquisitionEnEchec ? 500 : 200 }
  );
}
