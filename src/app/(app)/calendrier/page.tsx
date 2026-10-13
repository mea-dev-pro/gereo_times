import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
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
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { Views } from "@/types/database";
import {
  addDays,
  debutSemaine,
  decouperEnSemaines,
  fondBarre,
  iso,
  parseISO,
  type AbsenceMin,
} from "./segments";

export const metadata: Metadata = { title: "Calendrier d'équipe" };

// Page bloquante : elle lit la session et la date courante à chaque requête.
export const instant = false;

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

type Absence = Views<"team_absences">;

export default async function CalendrierPage({
  searchParams,
}: PageProps<"/calendrier">) {
  await requireSession();
  const params = await searchParams;

  const vue = params.vue === "semaine" ? "semaine" : "mois";
  const refParam = typeof params.date === "string" ? params.date : null;
  const ref =
    refParam && /^\d{4}-\d{2}-\d{2}$/.test(refParam)
      ? parseISO(refParam)
      : parseISO(iso(new Date()));

  let rangeStart: Date;
  let rangeEnd: Date;
  let title: string;
  let prev: Date;
  let next: Date;

  if (vue === "semaine") {
    rangeStart = debutSemaine(ref);
    rangeEnd = addDays(rangeStart, 6);
    prev = addDays(rangeStart, -7);
    next = addDays(rangeStart, 7);
    title = `Semaine du ${formatDate(iso(rangeStart))} au ${formatDate(iso(rangeEnd))}`;
  } else {
    const premier = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const dernier = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    rangeStart = debutSemaine(premier);
    rangeEnd = addDays(debutSemaine(dernier), 6);
    prev = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
    next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
    title = `${MOIS[premier.getUTCMonth()]} ${premier.getUTCFullYear()}`;
  }

  const supabase = await createClient();
  const { data: absences } = await supabase
    .from("team_absences")
    .select("*")
    .gte("end_date", iso(rangeStart))
    .lte("start_date", iso(rangeEnd))
    .order("start_date");

  const liste = (absences ?? []) as Absence[];
  const semaines = decouperEnSemaines(liste as AbsenceMin[], rangeStart, rangeEnd);
  const todayISO = iso(new Date());

  const semaineParam = iso(rangeStart);

  const navigation = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-control bg-surface-muted p-0.5 ring-1 ring-border dark:bg-white/5">
        {(["mois", "semaine"] as const).map((v) => (
          <Link
            key={v}
            href={`/calendrier?vue=${v}&date=${semaineParam}`}
            aria-current={vue === v ? "page" : undefined}
            className={cn(
              "rounded-[6px] px-3 py-1 text-sm font-medium capitalize transition-colors",
              vue === v
                ? "bg-surface text-brand-strong shadow-sm dark:bg-white/15"
                : "text-content-muted hover:text-content"
            )}
          >
            {v}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={`/calendrier?vue=${vue}&date=${iso(prev)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label="Période précédente"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href={`/calendrier?vue=${vue}&date=${todayISO}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Aujourd&apos;hui
        </Link>
        <Link
          href={`/calendrier?vue=${vue}&date=${iso(next)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label="Période suivante"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Calendrier d'équipe"
        description={`${title} · ${liste.length} absence(s) approuvée(s)`}
        actions={navigation}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Disponibilités</CardTitle>
            <CardDescription>
              Congés approuvés. Les motifs et justificatifs ne sont jamais
              affichés ici.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {liste.length === 0 && (
            <EmptyState
              icon={CalendarOff}
              title="Aucune absence sur cette période"
              description="Toute l'équipe est disponible. Le calendrier reste affiché pour vous situer."
            />
          )}

          {vue === "mois" ? (
            <div className="min-w-0 space-y-2">
              <div className="grid grid-cols-7 gap-x-1">
                {JOURS.map((j) => (
                  <div
                    key={j}
                    className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-content-subtle"
                  >
                    {j}
                  </div>
                ))}
              </div>

              {semaines.map((s) => (
                <div
                  key={iso(s.debut)}
                  className="grid grid-cols-7 gap-x-1 gap-y-1 rounded-tile border border-border p-1.5"
                  style={{
                    gridTemplateRows: `auto repeat(${Math.max(s.pistes, 1)}, 1.25rem)`,
                  }}
                >
                  {s.jours.map((jour) => {
                    const cle = iso(jour);
                    const horsMois = jour.getUTCMonth() !== ref.getUTCMonth();
                    const aujourdHui = cle === todayISO;
                    return (
                      <div key={cle} className="min-w-0 px-0.5">
                        <span
                          className={cn(
                            "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                            aujourdHui
                              ? "bg-brand-strong font-semibold text-white"
                              : horsMois
                                ? "text-content-subtle opacity-50"
                                : "text-content-subtle"
                          )}
                        >
                          {jour.getUTCDate()}
                        </span>
                      </div>
                    );
                  })}

                  {s.segments.map((seg, i) => (
                    <div
                      key={`${seg.absence.member_id}-${seg.absence.start_date}-${i}`}
                      style={{
                        gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                        gridRow: seg.piste + 2,
                        backgroundColor: fondBarre(seg.absence.leave_type_color),
                        color: seg.absence.leave_type_color,
                      }}
                      className={cn(
                        "flex min-w-0 items-center px-1.5 text-[11px] font-medium leading-5",
                        !seg.suiteAvant && "rounded-l",
                        !seg.suiteApres && "rounded-r"
                      )}
                      title={`${seg.absence.member_name} — ${seg.absence.leave_type_name} (${formatDate(seg.absence.start_date)} → ${formatDate(seg.absence.end_date)})`}
                    >
                      {/* Le nom n'apparaît qu'au début de la barre : répété sur
                          chaque segment, il deviendrait illisible. */}
                      {!seg.suiteAvant && (
                        <span className="truncate">{seg.absence.member_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-content-subtle">
                    <th className="py-2 pr-3 text-left font-medium">
                      Collaborateur
                    </th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = addDays(rangeStart, i);
                      const aujourdHui = iso(d) === todayISO;
                      return (
                        <th key={i} className="px-1 py-2 text-center font-medium">
                          <span className="block">{JOURS[i]}</span>
                          <span
                            className={cn(
                              "mt-0.5 inline-flex size-5 items-center justify-center rounded-full tabular-nums",
                              aujourdHui
                                ? "bg-brand-strong font-semibold text-white"
                                : "font-normal text-content-subtle"
                            )}
                          >
                            {d.getUTCDate()}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(liste.map((a) => a.member_id))).map(
                    (memberId) => {
                      const miennes = liste.filter((a) => a.member_id === memberId);
                      return (
                        <tr key={memberId} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3 font-medium text-content">
                            {miennes[0].member_name}
                          </td>
                          {Array.from({ length: 7 }, (_, i) => {
                            const cle = iso(addDays(rangeStart, i));
                            const jour = miennes.find(
                              (a) => a.start_date <= cle && a.end_date >= cle
                            );
                            return (
                              <td key={i} className="px-1 py-2">
                                {jour ? (
                                  <span
                                    className="block h-5 rounded"
                                    style={{
                                      backgroundColor: jour.leave_type_color,
                                    }}
                                    title={`${jour.leave_type_name} (${formatDate(jour.start_date)} → ${formatDate(jour.end_date)})`}
                                  />
                                ) : (
                                  <span className="block h-5 rounded bg-surface-muted" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>

              {liste.length === 0 && (
                <p className="py-4 text-center text-sm text-content-muted">
                  Aucune absence cette semaine.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {liste.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Détail des absences</CardTitle>
              <CardDescription>
                Type et durée, sans motif — les informations sensibles restent
                réservées aux personnes habilitées
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {liste.map((a, i) => (
                <li
                  key={`${a.member_id}-${a.start_date}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: a.leave_type_color }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-content">
                      {a.member_name}
                    </span>
                    <span className="text-sm text-content-muted">
                      {a.leave_type_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-content-muted">
                      {formatDate(a.start_date)} → {formatDate(a.end_date)}
                    </span>
                    <Badge tone="neutral">
                      {Number(a.total_days).toFixed(2).replace(".", ",")} j
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
