import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isHrOrAdmin, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMinutes, ROLE_LABELS } from "@/lib/utils";

export const metadata: Metadata = { title: "Rapports RH" };

// Page bloquante : elle lit la session et la date courante à chaque requête.
export const instant = false;

function defaultBounds() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export default async function RapportsPage({
  searchParams,
}: PageProps<"/rapports">) {
  const session = await requireSession();
  if (!isHrOrAdmin(session.membership.role)) redirect("/");

  const params = await searchParams;
  const bounds = defaultBounds();
  const from =
    typeof params.from === "string" && isoRe.test(params.from)
      ? params.from
      : bounds.from;
  const to =
    typeof params.to === "string" && isoRe.test(params.to) ? params.to : bounds.to;

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [
    { data: members },
    { data: profiles },
    { data: types },
    { data: entries },
    { data: requests },
    { data: balances },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId)
      .order("joined_at"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase
      .from("leave_types")
      .select("*")
      .eq("organization_id", orgId)
      .order("name"),
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

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const nameOf = (memberId: string) => {
    const m = (members ?? []).find((x) => x.id === memberId);
    if (!m) return "—";
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? "—";
  };

  const activeMembers = (members ?? []).filter((m) => m.status === "active");

  // --- Indicateurs de temps --------------------------------------------------
  const totalEffective = (entries ?? []).reduce(
    (s, e) => s + (e.effective_minutes ?? 0),
    0
  );
  const totalVariance = (entries ?? []).reduce(
    (s, e) => s + (e.variance_minutes ?? 0),
    0
  );
  const sessionCount = (entries ?? []).length;
  const agentsWithTime = new Set((entries ?? []).map((e) => e.member_id)).size;
  const avgPerAgent = agentsWithTime ? Math.round(totalEffective / agentsWithTime) : 0;

  // --- Indicateurs de congés -------------------------------------------------
  const approved = (requests ?? []).filter((r) => r.status === "approved");
  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const approvedDays = approved.reduce((s, r) => s + Number(r.total_days), 0);

  const daysByType = new Map<string, number>();
  for (const r of approved) {
    daysByType.set(
      r.leave_type_id,
      (daysByType.get(r.leave_type_id) ?? 0) + Number(r.total_days)
    );
  }
  const maxTypeDays = Math.max(1, ...Array.from(daysByType.values()));

  const availableByMember = new Map<string, number>();
  for (const b of balances ?? []) {
    availableByMember.set(
      b.member_id,
      (availableByMember.get(b.member_id) ?? 0) + Number(b.available_days)
    );
  }

  const minutesByMember = new Map<string, number>();
  for (const e of entries ?? []) {
    minutesByMember.set(
      e.member_id,
      (minutesByMember.get(e.member_id) ?? 0) + (e.effective_minutes ?? 0)
    );
  }
  const daysByMember = new Map<string, number>();
  for (const r of approved) {
    daysByMember.set(
      r.member_id,
      (daysByMember.get(r.member_id) ?? 0) + Number(r.total_days)
    );
  }

  const anomalies = (entries ?? []).filter(
    (e) => e.status === "flagged" || (e.variance_minutes ?? 0) < -120
  );

  const exportQuery = `from=${from}&to=${to}`;

  const kpis = [
    {
      label: "Effectif actif",
      value: String(activeMembers.length),
      hint: `${(members ?? []).length - activeMembers.length} inactif(s)`,
    },
    {
      label: "Heures effectives",
      value: formatMinutes(totalEffective),
      hint: `${sessionCount} session(s) pointée(s)`,
    },
    {
      label: "Moyenne par agent",
      value: formatMinutes(avgPerAgent),
      hint: `${agentsWithTime} agent(s) ayant pointé`,
    },
    {
      label: "Écart total",
      value: formatMinutes(totalVariance),
      hint: totalVariance >= 0 ? "en avance sur le prévu" : "en retard sur le prévu",
    },
    {
      label: "Congés approuvés",
      value: `${approvedDays.toFixed(1).replace(".", ",")} j`,
      hint: `${approved.length} demande(s)`,
    },
    {
      label: "En attente",
      value: String(pending.length),
      hint: pending.length ? "à traiter" : "à jour",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Rapports RH
          </h1>
          <p className="mt-1 text-sm text-content-muted">
            Indicateurs agrégés du {from.split("-").reverse().join("/")} au{" "}
            {to.split("-").reverse().join("/")}
          </p>
        </div>
      </header>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Période et exports</CardTitle>
          <CardDescription>
            Les exports portent sur la période sélectionnée
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="from"
                className="mb-1.5 block text-sm font-medium text-content"
              >
                Du
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from}
                className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="to"
                className="mb-1.5 block text-sm font-medium text-content"
              >
                Au
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to}
                className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm"
              />
            </div>
            <Button type="submit" variant="outline">
              Appliquer
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <a
              href={`/api/export/presence?${exportQuery}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export présence (CSV)
            </a>
            <a
              href={`/api/export/conges?${exportQuery}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export congés (CSV)
            </a>
            <a
              href="/api/export/soldes"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export soldes (CSV)
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent>
              <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-content">
                {k.value}
              </p>
              <p className="mt-1 text-xs text-content-muted">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Congés par type</CardTitle>
            <CardDescription>Jours approuvés sur la période</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {daysByType.size === 0 ? (
              <EmptyState title="Aucun congé approuvé sur la période" />
            ) : (
              (types ?? [])
                .filter((t) => daysByType.has(t.id))
                .map((t) => {
                  const days = daysByType.get(t.id) ?? 0;
                  return (
                    <div key={t.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-content">{t.name}</span>
                        <span className="font-medium text-content">
                          {days.toFixed(1).replace(".", ",")} j
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(days / maxTypeDays) * 100}%`,
                            backgroundColor: t.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anomalies de pointage</CardTitle>
            <CardDescription>
              Sessions signalées, ou écart défavorable supérieur à 2 h
            </CardDescription>
          </CardHeader>
          <CardContent>
            {anomalies.length === 0 ? (
              <EmptyState
                title="Aucune anomalie"
                description="Les pointages de la période sont cohérents."
              />
            ) : (
              <p className="text-sm text-content">
                {anomalies.length} session(s) à examiner sur {sessionCount}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détail par collaborateur</CardTitle>
          <CardDescription>
            Temps effectif, congés approuvés et solde restant sur la période
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeMembers.length === 0 ? (
            <EmptyState title="Aucun collaborateur actif" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle">
                    <th className="py-2 pr-3 font-medium">Collaborateur</th>
                    <th className="py-2 pr-3 font-medium">Rôle</th>
                    <th className="py-2 pr-3 font-medium">Heures</th>
                    <th className="py-2 pr-3 font-medium">Congés pris</th>
                    <th className="py-2 pr-3 font-medium">Solde restant</th>
                    <th className="py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map((m) => {
                    const p = profileById.get(m.user_id);
                    const available = availableByMember.get(m.id) ?? 0;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-content">
                            {p?.full_name ?? nameOf(m.id)}
                          </p>
                          <p className="text-xs text-content-muted">{p?.email}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-content-muted">
                          {ROLE_LABELS[m.role] ?? m.role}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-content">
                          {formatMinutes(minutesByMember.get(m.id) ?? 0)}
                        </td>
                        <td className="py-2.5 pr-3 text-content-muted">
                          {(daysByMember.get(m.id) ?? 0)
                            .toFixed(1)
                            .replace(".", ",")}{" "}
                          j
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={available > 0 ? "brand" : "neutral"}>
                            {available.toFixed(2).replace(".", ",")} j
                          </Badge>
                        </td>
                        <td className="py-2.5">
                          <Badge tone="success">Actif</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-content-subtle">
        Les exports quittent l&apos;application au format CSV, séparateur
        point-virgule et encodage UTF-8 avec BOM — ouverture directe dans Excel.{" "}
        <Link href="/validations" className="text-brand-strong hover:underline">
          Voir les demandes en attente
        </Link>
      </p>
    </div>
  );
}
