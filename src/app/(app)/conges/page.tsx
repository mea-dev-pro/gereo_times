import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, CalendarPlus, Clock, PartyPopper } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, type StatTint } from "@/components/ui/stat-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/utils";
import { LeaveRequestForm } from "./leave-request-form";
import { CancelLeaveButton } from "./cancel-button";

export const metadata: Metadata = { title: "Mes congés" };

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

type Demande = {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string | null;
};

const nb = (v: unknown) => Number(v ?? 0).toFixed(2).replace(".", ",");

export default async function CongesPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const memberId = session.membership.id;
  const orgId = session.organization.id;

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const annee = aujourdHui.slice(0, 4);

  const [{ data: types }, { data: balances }, { data: requests }, { data: feries }] =
    await Promise.all([
      supabase
        .from("leave_types")
        .select("*")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("leave_balances")
        .select("*")
        .eq("organization_id", orgId)
        .eq("member_id", memberId),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("holidays")
        .select("name, holiday_date, is_recurring")
        .eq("organization_id", orgId),
    ]);

  const balanceByType = new Map(
    (balances ?? []).map((b) => [b.leave_type_id, b])
  );
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));

  // Le paramètre est typé : indexer un objet typé par une chaîne quelconque
  // ferait perdre au compilateur la vérification des noms de colonnes.
  type ChampSolde =
    | "available_days"
    | "reserved_days"
    | "used_days"
    | "accrued_days";

  const somme = (champ: ChampSolde) =>
    (balances ?? []).reduce((total, b) => total + Number(b[champ] ?? 0), 0);

  const disponibles = somme("available_days");
  const reserves = somme("reserved_days");
  const consommes = somme("used_days");
  const acquis = somme("accrued_days");

  // Un jour férié récurrent revient chaque année : on le ramène à l'année en
  // cours avant de le comparer à aujourd'hui, sinon il serait compté comme passé.
  const feriesAVenir = (feries ?? [])
    .map((f) => ({
      nom: f.name,
      date: f.is_recurring
        ? `${annee}-${f.holiday_date.slice(5)}`
        : f.holiday_date,
    }))
    .filter((f) => f.date >= aujourdHui)
    .sort((a, b) => a.date.localeCompare(b.date));

  const prochainFerie = feriesAVenir[0];

  const tuiles: {
    tint: StatTint;
    icon: LucideIcon;
    valeur: string;
    libelle: string;
    detail: string;
  }[] = [
    {
      tint: "violet",
      icon: CalendarCheck,
      valeur: `${nb(disponibles)} j`,
      libelle: "Congés disponibles",
      detail: "tous types confondus",
    },
    {
      tint: "sky",
      icon: Clock,
      valeur: `${nb(reserves)} j`,
      libelle: "En attente de validation",
      detail: "réservés dès la soumission",
    },
    {
      tint: "peach",
      icon: CalendarDays,
      valeur: `${nb(consommes)} j`,
      libelle: "Déjà consommés",
      detail: "après approbation",
    },
    {
      tint: "mint",
      icon: CalendarPlus,
      valeur: `${nb(acquis)} j`,
      libelle: "Droits acquis",
      detail: "cumul des acquisitions",
    },
    {
      tint: "amber",
      icon: PartyPopper,
      valeur: String(feriesAVenir.length),
      libelle: "Jours fériés à venir",
      detail: prochainFerie
        ? `prochain : ${prochainFerie.nom}, le ${formatDate(prochainFerie.date)}`
        : "aucun sur l'année en cours",
    },
  ];

  const demandes = (requests ?? []) as Demande[];

  const colonnes: Column<Demande>[] = [
    {
      key: "type",
      header: "Type",
      cell: (r) => {
        const t = typeById.get(r.leave_type_id);
        return (
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: t?.color ?? "#94a3b8" }}
              aria-hidden="true"
            />
            <span className="truncate font-medium text-content">
              {t?.name ?? "Congé"}
            </span>
          </div>
        );
      },
    },
    {
      key: "periode",
      header: "Période",
      cell: (r) => (
        <span className="text-content-muted">
          {formatDate(r.start_date)} → {formatDate(r.end_date)}
        </span>
      ),
    },
    {
      key: "jours",
      header: "Jours",
      hideBelow: "sm",
      cell: (r) => (
        <span className="font-medium text-content">
          {Number(r.total_days).toFixed(2).replace(".", ",")} j
        </span>
      ),
    },
    {
      key: "motif",
      header: "Motif",
      hideBelow: "lg",
      cell: (r) =>
        r.reason ? (
          <span className="text-content-subtle italic">{r.reason}</span>
        ) : (
          <span className="text-content-subtle">—</span>
        ),
    },
    {
      key: "statut",
      header: "Statut",
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) =>
        r.status === "pending" || r.status === "approved" ? (
          <CancelLeaveButton requestId={r.id} />
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Mes congés"
        description="Soldes, demandes et suivi des validations"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tuiles.map((t) => (
          <StatCard
            key={t.libelle}
            tint={t.tint}
            icon={t.icon}
            value={t.valeur}
            label={t.libelle}
            hint={t.detail}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Mes soldes</CardTitle>
            <CardDescription>
              Disponible = droits acquis − consommé − réservé (en attente de
              validation)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(types ?? []).length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Aucun type de congé configuré"
              description="Un RH ou un administrateur doit en créer."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(types ?? []).map((t) => {
                const b = balanceByType.get(t.id);
                const dispo = Number(b?.available_days ?? 0);
                return (
                  <div key={t.id} className="rounded-tile border border-border p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-content">
                        {t.name}
                      </span>
                    </div>

                    <p className="mt-2 text-2xl font-semibold text-content">
                      {nb(dispo)}
                      <span className="ml-1 text-sm font-normal text-content-muted">
                        jour(s) disponible(s)
                      </span>
                    </p>

                    <dl className="mt-3 space-y-1 text-xs">
                      {[
                        ["Acquis", Number(b?.accrued_days ?? 0)],
                        ["Utilisé", Number(b?.used_days ?? 0)],
                        ["Réservé", Number(b?.reserved_days ?? 0)],
                      ].map(([libelle, valeur]) => (
                        <div
                          key={libelle as string}
                          className="flex justify-between gap-2"
                        >
                          <dt className="text-content-muted">{libelle}</dt>
                          <dd className="font-medium tabular-nums text-content">
                            {nb(valeur)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Nouvelle demande</CardTitle>
            <CardDescription>
              Le solde est réservé dès la soumission et consommé à
              l&apos;approbation
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(types ?? []).length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Aucun type de congé configuré"
              description="Un RH ou un administrateur doit en créer."
            />
          ) : (
            <LeaveRequestForm
              types={(types ?? []).map((t) => ({
                id: t.id,
                name: t.name,
                requires_justification: t.requires_justification,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Mes demandes</CardTitle>
            <CardDescription>
              Vous pouvez annuler une demande en attente ou un congé futur
              approuvé
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colonnes}
            rows={demandes}
            rowKey={(r) => r.id}
            caption="Mes demandes de congé"
            empty={
              <EmptyState
                icon={CalendarCheck}
                title="Aucune demande enregistrée"
                description="Vos demandes de congé apparaîtront ici, avec leur statut."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
