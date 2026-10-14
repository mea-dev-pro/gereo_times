import type { Metadata } from "next";
import { CalendarClock, ClipboardList } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
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
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMinutes } from "@/lib/utils";
import { ClockPanel } from "./clock-panel";
import { AdjustmentForm, type AdjustableEntry } from "./adjustment-form";

export const metadata: Metadata = { title: "Pointage" };

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

type Pointage = {
  id: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  effective_minutes: number | null;
  variance_minutes: number | null;
  status: string;
};

/**
 * Session de pointage encore ouverte, avec ses pauses.
 * Les pauses arrivent dans la même réponse (`break_entries(...)`) : la pause en
 * cours se déduit ensuite en mémoire, sans second aller-retour.
 */
type EntreeOuverte = Tables<"time_entries"> & {
  break_entries: Pick<Tables<"break_entries">, "started_at" | "ended_at">[];
};

function heureCourte(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PointagePage({
  searchParams,
}: {
  searchParams: Promise<{ du?: string; au?: string }>;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const memberId = session.membership.id;

  const { du, au } = await searchParams;

  // Deux vagues d'appels au lieu de cinq : la session ouverte ramène sa pause
  // en cours dans la même réponse, et les trois lectures indépendantes partent
  // ensemble. Chaque aller-retour vers Supabase coûte environ 250 ms depuis un
  // poste client : les enchaîner rendait l'écran sensiblement plus lent.
  const [{ data: openEntry }, { data: adjustments }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, break_entries(started_at, ended_at)" as "*")
      .eq("member_id", memberId)
      .is("clock_out", null)
      .maybeSingle(),
    supabase
      .from("time_adjustments")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // La pause en cours est la seule dont `ended_at` est vide.
  const entreeOuverte = openEntry as EntreeOuverte | null;
  const pauseEnCours = (entreeOuverte?.break_entries ?? []).find(
    (b) => b.ended_at === null
  );
  const breakStartedAt: string | null = pauseEnCours?.started_at ?? null;

  // La date de la journée en cours se lit sur la session ouverte : c'est celle
  // du pointage d'arrivée. Sinon on retombe sur la date du jour.
  const aujourdHui =
    entreeOuverte?.work_date ?? new Date().toISOString().slice(0, 10);
  const debutMois = `${aujourdHui.slice(0, 7)}-01`;

  const debut = du ?? debutMois;
  const fin = au ?? aujourdHui;

  const [{ data: entries }, { data: mois }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*")
      .eq("member_id", memberId)
      .gte("work_date", debut)
      .lte("work_date", fin)
      .order("work_date", { ascending: false }),
    supabase
      .from("time_entries")
      .select("work_date, effective_minutes")
      .eq("member_id", memberId)
      .gte("work_date", debutMois)
      .lte("work_date", aujourdHui),
  ]);

  const pointages = (entries ?? []) as Pointage[];

  // Journée en cours : on ne totalise que les sessions DÉJÀ clôturées, la
  // session ouverte étant comptée en direct par le panneau.
  const cloturesDuJour = pointages.filter(
    (e) => e.work_date === aujourdHui && e.clock_out !== null
  );
  const minutesEffectivesJour = cloturesDuJour.reduce(
    (somme, e) => somme + (e.effective_minutes ?? 0),
    0
  );
  const minutesPauseJour = cloturesDuJour.reduce(
    (somme, e) => somme + (e.break_minutes ?? 0),
    0
  );

  const totalMois = (mois ?? []).reduce(
    (somme, e) => somme + (e.effective_minutes ?? 0),
    0
  );

  const ajustables: AdjustableEntry[] = pointages
    .filter((e) => e.clock_out !== null)
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      work_date: e.work_date,
      clock_in: e.clock_in,
      clock_out: e.clock_out as string,
    }));

  const colonnes: Column<Pointage>[] = [
    {
      key: "date",
      header: "Date",
      cell: (e) => (
        <span className="text-content">
          {new Date(e.work_date + "T00:00:00").toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "arrivee",
      header: "Arrivée",
      hideBelow: "sm",
      cell: (e) => <span className="text-content">{heureCourte(e.clock_in)}</span>,
    },
    {
      key: "sortie",
      header: "Sortie",
      hideBelow: "sm",
      cell: (e) => (
        <span className="text-content">
          {e.clock_out ? heureCourte(e.clock_out) : "—"}
        </span>
      ),
    },
    {
      key: "pauses",
      header: "Pauses",
      hideBelow: "md",
      cell: (e) => (
        <span className="text-content-muted">
          {e.break_minutes > 0 ? `${e.break_minutes} min` : "—"}
        </span>
      ),
    },
    {
      key: "effectif",
      header: "Effectif",
      cell: (e) => (
        <span className="font-medium text-content">
          {formatMinutes(e.effective_minutes)}
        </span>
      ),
    },
    {
      key: "ecart",
      header: "Écart",
      hideBelow: "md",
      cell: (e) =>
        e.variance_minutes === null ? (
          <span className="text-content-muted">—</span>
        ) : (
          <Badge tone={e.variance_minutes >= 0 ? "success" : "warning"}>
            {e.variance_minutes >= 0 ? "+" : ""}
            {formatMinutes(e.variance_minutes)}
          </Badge>
        ),
    },
    {
      key: "statut",
      header: "Statut",
      cell: (e) => <StatusBadge status={e.status} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Pointage"
        description={`${formatMinutes(totalMois)} cumulées ce mois-ci`}
      />

      <ClockPanel
        isOpen={Boolean(entreeOuverte)}
        isOnBreak={Boolean(breakStartedAt)}
        clockedInAt={entreeOuverte?.clock_in ?? null}
        breakStartedAt={breakStartedAt}
        minutesEffectivesJour={minutesEffectivesJour}
        minutesPauseJour={minutesPauseJour}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Historique</CardTitle>
            <CardDescription>
              {du || au
                ? `Du ${formatDate(debut)} au ${formatDate(fin)}`
                : "Le mois en cours"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            actions={
              du || au ? (
                <a
                  href="/pointage"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Revenir au mois en cours
                </a>
              ) : null
            }
          >
            <form className="flex flex-wrap items-end gap-3" action="/pointage">
              <FilterField label="Du" htmlFor="du">
                <input
                  id="du"
                  name="du"
                  type="date"
                  defaultValue={debut}
                  className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-sm text-content"
                />
              </FilterField>
              <FilterField label="Au" htmlFor="au">
                <input
                  id="au"
                  name="au"
                  type="date"
                  defaultValue={fin}
                  className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-sm text-content"
                />
              </FilterField>
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Appliquer
              </button>
            </form>
          </FilterBar>

          <DataTable
            columns={colonnes}
            rows={pointages}
            rowKey={(e) => e.id}
            caption="Historique des pointages"
            empty={
              <EmptyState
                icon={CalendarClock}
                title="Aucun pointage sur la période"
                description={
                  du || au
                    ? "Aucune session enregistrée entre ces deux dates."
                    : "Votre historique apparaîtra après votre premier pointage."
                }
              />
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Demander une correction</CardTitle>
              <CardDescription>
                Toute modification d&apos;un pointage clôturé passe par une
                validation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AdjustmentForm entries={ajustables} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Mes corrections</CardTitle>
              <CardDescription>Suivi de vos demandes</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(adjustments ?? []).length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Aucune demande de correction"
                description="Vos demandes de correction de pointage apparaîtront ici."
              />
            ) : (
              (adjustments ?? []).map((a) => (
                <div
                  key={a.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-content">{a.reason}</p>
                      <p className="mt-0.5 text-xs text-content-muted">
                        demandée le {formatDate(a.created_at.slice(0, 10))}
                      </p>
                      {a.decision_comment && (
                        <p className="mt-1 text-xs italic text-content-muted">
                          Réponse : {a.decision_comment}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
