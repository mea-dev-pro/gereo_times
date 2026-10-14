import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, isHrOrAdmin } from "@/lib/auth/session";
import { typesConge } from "@/lib/data/referentiel";

/**
 * Exports CSV réservés aux RH et aux administrateurs.
 *
 *   /api/export/presence?from=2026-10-01&to=2026-10-31
 *   /api/export/conges?from=…&to=…
 *   /api/export/soldes
 *
 * Le contrôle d'accès est fait ici, côté serveur : la RLS ne suffit pas seule,
 * car un manager verrait ses subordonnés et non l'ensemble de l'organisation.
 * Séparateur « ; » et BOM UTF-8 : le format attendu par Excel en français.
 */

const KINDS = ["presence", "conges", "soldes"] as const;
type Kind = (typeof KINDS)[number];

const separator = ";";

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvValue).join(separator));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** Heures décimales à partir de minutes, au format français. */
function hours(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "";
  return (minutes / 60).toFixed(2).replace(".", ",");
}

function isoDate(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function monthBounds() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> }
) {
  const { kind } = await context.params;
  if (!KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "Export inconnu." }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!isHrOrAdmin(session.membership.role)) {
    return NextResponse.json(
      { error: "Export réservé aux RH et administrateurs." },
      { status: 403 }
    );
  }

  const orgId = session.organization.id;
  const supabase = await createClient();
  const bounds = monthBounds();
  const from = isoDate(request.nextUrl.searchParams.get("from"), bounds.from);
  const to = isoDate(request.nextUrl.searchParams.get("to"), bounds.to);

  // --- Référentiels partagés -------------------------------------------------
  const [{ data: members }, { data: profiles }, types] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, job_title, hire_date, status")
        .eq("organization_id", orgId),
      supabase.from("profiles").select("id, full_name, email"),
      // Référentiel mis en cache : voir lib/data/referentiel.ts.
      typesConge(orgId),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));

  const nameOf = (memberId: string) => {
    const m = memberById.get(memberId);
    if (!m) return "—";
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? "—";
  };
  const emailOf = (memberId: string) => {
    const m = memberById.get(memberId);
    return m ? (profileById.get(m.user_id)?.email ?? "") : "";
  };

  let csv = "";
  let filename = "";

  if (kind === "presence") {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("*")
      .eq("organization_id", orgId)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date")
      .order("clock_in");

    csv = toCsv(
      [
        "Date", "Collaborateur", "Email", "Arrivée", "Sortie",
        "Pause (min)", "Effectif (h)", "Prévu (h)", "Écart (h)", "Statut", "Note",
      ],
      (entries ?? []).map((e) => [
        e.work_date,
        nameOf(e.member_id),
        emailOf(e.member_id),
        new Date(e.clock_in).toLocaleString("fr-FR"),
        e.clock_out ? new Date(e.clock_out).toLocaleString("fr-FR") : "",
        e.break_minutes,
        hours(e.effective_minutes),
        hours(e.planned_minutes),
        hours(e.variance_minutes),
        e.status,
        e.notes ?? "",
      ])
    );
    filename = `presence_${from}_${to}.csv`;
  }

  if (kind === "conges") {
    const { data: requests } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("organization_id", orgId)
      .gte("start_date", from)
      .lte("start_date", to)
      .order("start_date");

    csv = toCsv(
      [
        "Type", "Collaborateur", "Email", "Début", "Fin",
        "Début demi-journée", "Fin demi-journée", "Jours ouvrés",
        "Statut", "Soumise le", "Décidée le", "Motif",
      ],
      (requests ?? []).map((r) => [
        typeById.get(r.leave_type_id)?.name ?? "",
        nameOf(r.member_id),
        emailOf(r.member_id),
        r.start_date,
        r.end_date,
        r.start_half ?? "",
        r.end_half ?? "",
        Number(r.total_days).toFixed(2).replace(".", ","),
        r.status,
        r.submitted_at ? new Date(r.submitted_at).toLocaleString("fr-FR") : "",
        r.decided_at ? new Date(r.decided_at).toLocaleString("fr-FR") : "",
        r.reason ?? "",
      ])
    );
    filename = `conges_${from}_${to}.csv`;
  }

  if (kind === "soldes") {
    const { data: balances } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId);

    csv = toCsv(
      [
        "Collaborateur", "Email", "Type", "Acquis (j)", "Utilisé (j)",
        "Réservé (j)", "Expiré (j)", "Disponible (j)",
      ],
      (balances ?? [])
        .map((b) => [
          nameOf(b.member_id),
          emailOf(b.member_id),
          typeById.get(b.leave_type_id)?.name ?? "",
          Number(b.accrued_days).toFixed(2).replace(".", ","),
          Number(b.used_days).toFixed(2).replace(".", ","),
          Number(b.reserved_days).toFixed(2).replace(".", ","),
          Number(b.expired_days).toFixed(2).replace(".", ","),
          Number(b.available_days).toFixed(2).replace(".", ","),
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    );
    filename = `soldes_${new Date().toISOString().slice(0, 10)}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
