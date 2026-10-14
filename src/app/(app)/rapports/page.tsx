import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Clock,
  Gauge,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, type StatTint } from "@/components/ui/stat-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/page-header";
import { typesConge } from "@/lib/data/referentiel";
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

type LigneDetail = {
  id: string;
  nom: string;
  email: string | undefined;
  role: string;
  minutes: number;
  joursConges: number;
  solde: number;
};

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
    typeof params.to === "string" && isoRe.test(params.to)
      ? params.to
      : bounds.to;

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [
    { data: members },
    { data: profiles },
    types,
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
    // Référentiel mis en cache : voir lib/data/referentiel.ts.
    typesConge(orgId),
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
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  const nameOf = (memberId: string) => {
    const m = memberById.get(memberId);
    if (!m) return "—";
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? "—";
  };

  const actifs = (members ?? []).filter((m) => m.status === "active");

  const totalEffective = (entries ?? []).reduce(
    (s, e) => s + (e.effective_minutes ?? 0),
    0
  );
  const totalVariance = (entries ?? []).reduce(
    (s, e) => s + (e.variance_minutes ?? 0),
    0
  );
  const nbSessions = (entries ?? []).length;
  const agentsAyantPointe = new Set((entries ?? []).map((e) => e.member_id)).size;
  const moyenneParAgent = agentsAyantPointe
    ? Math.round(totalEffective / agentsAyantPointe)
    : 0;

  const approuves = (requests ?? []).filter((r) => r.status === "approved");
  const enAttente = (requests ?? []).filter((r) => r.status === "pending");
  const joursApprouves = approuves.reduce((s, r) => s + Number(r.total_days), 0);

  const joursParType = new Map<string, number>();
  for (const r of approuves) {
    joursParType.set(
      r.leave_type_id,
      (joursParType.get(r.leave_type_id) ?? 0) + Number(r.total_days)
    );
  }
  const maxType = Math.max(1, ...Array.from(joursParType.values()));

  const soldeParMembre = new Map<string, number>();
  for (const b of balances ?? []) {
    soldeParMembre.set(
      b.member_id,
      (soldeParMembre.get(b.member_id) ?? 0) + Number(b.available_days)
    );
  }

  const minutesParMembre = new Map<string, number>();
  for (const e of entries ?? []) {
    minutesParMembre.set(
      e.member_id,
      (minutesParMembre.get(e.member_id) ?? 0) + (e.effective_minutes ?? 0)
    );
  }

  const joursParMembre = new Map<string, number>();
  for (const r of approuves) {
    joursParMembre.set(
      r.member_id,
      (joursParMembre.get(r.member_id) ?? 0) + Number(r.total_days)
    );
  }

  const anomalies = (entries ?? []).filter(
    (e) => e.status === "flagged" || (e.variance_minutes ?? 0) < -120
  );

  const exportQuery = `from=${from}&to=${to}`;
  const periodeLisible = `${from.split("-").reverse().join("/")} au ${to
    .split("-")
    .reverse()
    .join("/")}`;

  // Teintes sémantiques : menthe pour une information neutre, ambre dès qu'il
  // y a quelque chose à regarder, pêche pour ce qui est consommé.
  const kpis: {
    label: string;
    value: string;
    hint: string;
    tint: StatTint;
    icon: LucideIcon;
  }[] = [
    {
      label: "Effectif actif",
      value: String(actifs.length),
      hint: `${(members ?? []).length - actifs.length} inactif(s)`,
      tint: "violet",
      icon: Users,
    },
    {
      label: "Heures effectives",
      value: formatMinutes(totalEffective),
      hint: `${nbSessions} session(s) pointée(s)`,
      tint: "mint",
      icon: Clock,
    },
    {
      label: "Moyenne par agent",
      value: formatMinutes(moyenneParAgent),
      hint: `${agentsAyantPointe} agent(s) ayant pointé`,
      tint: "mint",
      icon: Gauge,
    },
    {
      label: "Écart total",
      value: formatMinutes(totalVariance),
      hint:
        totalVariance >= 0 ? "en avance sur le prévu" : "en retard sur le prévu",
      tint: totalVariance >= 0 ? "mint" : "amber",
      icon: totalVariance >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Congés approuvés",
      value: `${joursApprouves.toFixed(1).replace(".", ",")} j`,
      hint: `${approuves.length} demande(s)`,
      tint: "peach",
      icon: CalendarCheck,
    },
    {
      label: "En attente",
      value: String(enAttente.length),
      hint: enAttente.length ? "à traiter" : "à jour",
      tint: enAttente.length ? "amber" : "mint",
      icon: CalendarDays,
    },
  ];

  const details: LigneDetail[] = actifs.map((m) => {
    const p = profileById.get(m.user_id);
    return {
      id: m.id,
      nom: p?.full_name ?? nameOf(m.id),
      email: p?.email,
      role: m.role,
      minutes: minutesParMembre.get(m.id) ?? 0,
      joursConges: joursParMembre.get(m.id) ?? 0,
      solde: soldeParMembre.get(m.id) ?? 0,
    };
  });

  const colonnes: Column<LigneDetail>[] = [
    {
      key: "nom",
      header: "Collaborateur",
      cell: (l) => (
        <>
          <p className="font-medium text-content">{l.nom}</p>
          <p className="text-xs text-content-muted">{l.email}</p>
        </>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      hideBelow: "md",
      cell: (l) => (
        <span className="text-content-muted">
          {ROLE_LABELS[l.role] ?? l.role}
        </span>
      ),
    },
    {
      key: "heures",
      header: "Heures",
      cell: (l) => (
        <span className="font-medium text-content">
          {formatMinutes(l.minutes)}
        </span>
      ),
    },
    {
      key: "conges",
      header: "Congés pris",
      hideBelow: "sm",
      cell: (l) => (
        <span className="text-content-muted">
          {l.joursConges.toFixed(1).replace(".", ",")} j
        </span>
      ),
    },
    {
      key: "solde",
      header: "Solde restant",
      cell: (l) => (
        <Badge tone={l.solde > 0 ? "brand" : "neutral"}>
          {l.solde.toFixed(2).replace(".", ",")} j
        </Badge>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      cell: () => <Badge tone="success">Actif</Badge>,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Rapports RH"
        description={`Indicateurs agrégés du ${periodeLisible}`}
      />

      <Card className="no-print">
        <CardHeader>
          <div>
            <CardTitle>Période et exports</CardTitle>
            <CardDescription>
              Les exports portent sur la période sélectionnée
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar>
            <form className="flex flex-wrap items-end gap-3">
              <FilterField label="Du" htmlFor="from">
                <input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={from}
                  className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-sm text-content"
                />
              </FilterField>
              <FilterField label="Au" htmlFor="to">
                <input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={to}
                  className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-sm text-content"
                />
              </FilterField>
              <Button type="submit" variant="outline" size="sm">
                Appliquer
              </Button>
            </form>
          </FilterBar>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
            {/* Téléchargement de fichier, pas une navigation : <Link> déclencherait
                un rendu client et perdrait le téléchargement. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/export/soldes"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export soldes (CSV)
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <StatCard
            key={k.label}
            tint={k.tint}
            icon={k.icon}
            value={k.value}
            label={k.label}
            hint={k.hint}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Congés par type</CardTitle>
              <CardDescription>Jours approuvés sur la période</CardDescription>
            </div>
            <BarChart3
              className="size-4 shrink-0 text-content-subtle"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {joursParType.size === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Aucun congé approuvé sur la période"
                description="Élargissez la période pour voir les congés validés."
              />
            ) : (
              (types ?? [])
                .filter((t) => joursParType.has(t.id))
                .map((t) => {
                  const jours = joursParType.get(t.id) ?? 0;
                  return (
                    <div key={t.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-content">{t.name}</span>
                        <span className="font-medium tabular-nums text-content">
                          {jours.toFixed(1).replace(".", ",")} j
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(jours / maxType) * 100}%`,
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
            <div>
              <CardTitle>Anomalies de pointage</CardTitle>
              <CardDescription>
                Sessions signalées, ou écart défavorable supérieur à 2 h
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {anomalies.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Aucune anomalie"
                description="Les pointages de la période sont cohérents."
              />
            ) : (
              <p className="text-sm text-content">
                <strong className="text-content">
                  {anomalies.length} session(s)
                </strong>{" "}
                à examiner sur {nbSessions}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Détail par collaborateur</CardTitle>
            <CardDescription>
              Temps effectif, congés approuvés et solde restant sur la période
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colonnes}
            rows={details}
            rowKey={(l) => l.id}
            caption="Temps, congés et solde par collaborateur actif"
            empty={
              <EmptyState
                icon={Users}
                title="Aucun collaborateur actif"
                description="Invitez des collaborateurs depuis l'écran Équipe."
              />
            }
          />
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
