import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, ClipboardCheck, Hourglass, Users } from "lucide-react";
import { canManage, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatDateTime, ROLE_LABELS } from "@/lib/utils";
import { DecisionPanel } from "./decision-panel";

export const metadata: Metadata = { title: "Validations" };

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

/** Les deux périodes se chevauchent-elles (bornes incluses) ? */
function chevauche(aDeb: string, aFin: string, bDeb: string, bFin: string) {
  return aDeb <= bFin && bDeb <= aFin;
}

export default async function ValidationsPage() {
  const session = await requireSession();
  if (!canManage(session.membership.role)) redirect("/");

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [
    { data: requests },
    { data: adjustments },
    { data: types },
    { data: members },
    { data: balances },
    { data: approuves },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("time_adjustments")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("leave_types").select("*").eq("organization_id", orgId),
    supabase
      .from("organization_members")
      .select("id, user_id, job_title, role")
      .eq("organization_id", orgId),
    supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId),
    // Servent à repérer les chevauchements : deux absences simultanées dans la
    // même équipe sont l'information la plus utile avant d'approuver.
    supabase
      .from("leave_requests")
      .select("member_id, start_date, end_date")
      .eq("organization_id", orgId)
      .eq("status", "approved"),
  ]);

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const membre = (memberId: string) => memberById.get(memberId);
  function nomDe(memberId: string) {
    const m = membre(memberId);
    if (!m) return "Collaborateur";
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? "Collaborateur";
  }

  const soldeDe = (memberId: string, leaveTypeId: string) =>
    (balances ?? []).find(
      (b) => b.member_id === memberId && b.leave_type_id === leaveTypeId
    );

  /** Collègues dont l'absence approuvée recouvre la période demandée. */
  function absentsEnMemeTemps(
    demandeur: string,
    debut: string,
    fin: string
  ): string[] {
    return (approuves ?? [])
      .filter(
        (a) =>
          a.member_id !== demandeur &&
          chevauche(debut, fin, a.start_date, a.end_date)
      )
      .map((a) => nomDe(a.member_id));
  }

  const nbConges = (requests ?? []).length;
  const nbCorrections = (adjustments ?? []).length;
  const plusAncienne = (requests ?? [])[0]?.submitted_at ?? null;
  const ancienneteJours = plusAncienne
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(plusAncienne).getTime()) / 86400000
        )
      )
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Validations"
        description="Demandes de votre équipe en attente de décision"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          tint="amber"
          icon={ClipboardCheck}
          value={String(nbConges + nbCorrections)}
          label="À traiter"
          hint={`${nbConges} congé(s), ${nbCorrections} correction(s)`}
        />
        <StatCard
          tint={nbConges > 0 ? "amber" : "mint"}
          icon={CalendarClock}
          value={String(nbConges)}
          label="Congés en attente"
          hint="le solde est déjà réservé"
        />
        <StatCard
          tint={ancienneteJours >= 3 ? "amber" : "mint"}
          icon={Hourglass}
          value={plusAncienne ? `${ancienneteJours} j` : "—"}
          label="Plus ancienne demande"
          hint={
            plusAncienne
              ? `soumise le ${formatDate(plusAncienne.slice(0, 10))}`
              : "aucune demande en attente"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              Demandes de congé{" "}
              <Badge tone={nbConges > 0 ? "warning" : "neutral"}>
                {nbConges}
              </Badge>
            </CardTitle>
            <CardDescription>
              Le solde est déjà réservé. L&apos;approbation le consomme
              définitivement, le refus le restitue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nbConges === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Aucune demande en attente"
              description="Vous êtes à jour."
            />
          ) : (
            (requests ?? []).map((r) => {
              const type = typeById.get(r.leave_type_id);
              const solde = soldeDe(r.member_id, r.leave_type_id);
              const absents = absentsEnMemeTemps(
                r.member_id,
                r.start_date,
                r.end_date
              );
              const demandeur = membre(r.member_id);

              return (
                <div key={r.id} className="rounded-tile border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: type?.color ?? "#94a3b8" }}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-content">
                          {nomDe(r.member_id)}
                        </span>
                        {demandeur ? (
                          <span className="text-xs text-content-subtle">
                            {ROLE_LABELS[demandeur.role] ?? demandeur.role}
                            {demandeur.job_title ? ` · ${demandeur.job_title}` : ""}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-content-muted">
                        {type?.name ?? "Congé"} ·{" "}
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                        {r.start_half ? ` (début ${r.start_half})` : ""}
                        {r.end_half ? ` (fin ${r.end_half})` : ""}
                      </p>

                      {r.reason && (
                        <p className="mt-1 text-sm italic text-content-muted">
                          « {r.reason} »
                        </p>
                      )}

                      <p className="mt-1 text-xs text-content-subtle">
                        soumise le {formatDateTime(r.submitted_at)}
                      </p>
                    </div>

                    <Badge tone="brand">
                      {Number(r.total_days).toFixed(2).replace(".", ",")} j
                    </Badge>
                  </div>

                  {/* Contexte de décision : ce qui permet de trancher sans
                      quitter l'écran ni ouvrir une autre page. */}
                  <dl className="mt-3 grid gap-2 rounded-control bg-surface-muted px-4 py-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-content-subtle">Solde disponible</dt>
                      <dd className="font-medium tabular-nums text-content">
                        {solde
                          ? `${Number(solde.available_days).toFixed(2).replace(".", ",")} j`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-subtle">Dont déjà réservé</dt>
                      <dd className="font-medium tabular-nums text-content">
                        {solde
                          ? `${Number(solde.reserved_days).toFixed(2).replace(".", ",")} j`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-subtle">Collègues absents</dt>
                      <dd className="flex items-center gap-1.5 font-medium text-content">
                        <Users className="size-3.5 text-content-subtle" aria-hidden="true" />
                        {absents.length === 0
                          ? "aucun"
                          : `${absents.length} — ${absents.join(", ")}`}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 border-t border-border pt-3">
                    <DecisionPanel id={r.id} kind="leave" />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              Corrections de pointage{" "}
              <Badge tone={nbCorrections > 0 ? "warning" : "neutral"}>
                {nbCorrections}
              </Badge>
            </CardTitle>
            <CardDescription>
              Une session clôturée ne peut être modifiée que par ce circuit
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nbCorrections === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Aucune correction en attente"
              description="Vous êtes à jour."
            />
          ) : (
            (adjustments ?? []).map((a) => (
              <div key={a.id} className="rounded-tile border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-content">
                      {nomDe(a.member_id)}
                    </p>

                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-content-subtle">
                          Pointage actuel
                        </p>
                        <p className="text-content-muted line-through">
                          {a.original_in
                            ? new Date(a.original_in).toLocaleString("fr-FR")
                            : "—"}
                          {" → "}
                          {a.original_out
                            ? new Date(a.original_out).toLocaleString("fr-FR")
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-content-subtle">
                          Correction demandée
                        </p>
                        <p className="font-medium text-content">
                          {a.new_in
                            ? new Date(a.new_in).toLocaleString("fr-FR")
                            : "—"}
                          {" → "}
                          {a.new_out
                            ? new Date(a.new_out).toLocaleString("fr-FR")
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 text-sm italic text-content-muted">
                      « {a.reason} »
                    </p>
                  </div>

                  <StatusBadge status={a.status} />
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <DecisionPanel id={a.id} kind="adjustment" />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
