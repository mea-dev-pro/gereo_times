import type { Metadata } from "next";
import Link from "next/link";
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
import { EmptyState } from "@/components/ui/alert";
import { cn, formatDate } from "@/lib/utils";
import type { Views } from "@/types/database";

export const metadata: Metadata = { title: "Calendrier d'équipe" };

// Page bloquante : elle lit la session et la date courante à chaque requête.
export const instant = false;

type Absence = Views<"team_absences">;

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseISO = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
const startOfWeek = (d: Date) => {
  const dow = d.getUTCDay();
  return addDays(d, dow === 0 ? -6 : 1 - dow);
};

/** Indexe les absences par jour couvert. */
function indexByDay(absences: Absence[]): Map<string, Absence[]> {
  const map = new Map<string, Absence[]>();
  for (const a of absences) {
    const start = parseISO(a.start_date);
    const end = parseISO(a.end_date);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = iso(d);
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
  }
  return map;
}

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

  // Bornes de la période affichée
  let rangeStart: Date;
  let rangeEnd: Date;
  let title: string;
  let prev: Date;
  let next: Date;

  if (vue === "semaine") {
    rangeStart = startOfWeek(ref);
    rangeEnd = addDays(rangeStart, 6);
    prev = addDays(rangeStart, -7);
    next = addDays(rangeStart, 7);
    title = `Semaine du ${formatDate(iso(rangeStart))} au ${formatDate(iso(rangeEnd))}`;
  } else {
    const first = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const last = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    rangeStart = startOfWeek(first);
    rangeEnd = addDays(startOfWeek(last), 6);
    prev = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
    next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
    title = `${MONTH_NAMES[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
  }

  const supabase = await createClient();
  const { data: absences } = await supabase
    .from("team_absences")
    .select("*")
    .gte("end_date", iso(rangeStart))
    .lte("start_date", iso(rangeEnd))
    .order("start_date");

  const byDay = indexByDay(absences ?? []);
  const todayISO = iso(new Date());
  const weekParam = iso(rangeStart);

  const switcher = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
        {(["mois", "semaine"] as const).map((v) => (
          <Link
            key={v}
            href={`/calendrier?vue=${v}&date=${weekParam}`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium capitalize",
              vue === v
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {v}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/calendrier?vue=${vue}&date=${iso(prev)}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
          aria-label="Période précédente"
        >
          ←
        </Link>
        <Link
          href={`/calendrier?vue=${vue}&date=${todayISO}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          Aujourd&apos;hui
        </Link>
        <Link
          href={`/calendrier?vue=${vue}&date=${iso(next)}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
          aria-label="Période suivante"
        >
          →
        </Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Calendrier d&apos;équipe
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {title} · {absences?.length ?? 0} absence(s) approuvée(s)
          </p>
        </div>
        {switcher}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilités</CardTitle>
          <CardDescription>
            Congés approuvés. Les motifs et justificatifs ne sont jamais
            affichés ici.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(absences ?? []).length === 0 ? (
            <EmptyState
              title="Aucune absence sur cette période"
              description="Toute l'équipe est disponible."
            />
          ) : vue === "mois" ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[42rem] grid-cols-7 gap-1">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    {d}
                  </div>
                ))}
                {Array.from(
                  { length: Math.round((+rangeEnd - +rangeStart) / 86400000) + 1 },
                  (_, i) => addDays(rangeStart, i)
                ).map((day) => {
                  const key = iso(day);
                  const inMonth = day.getUTCMonth() === ref.getUTCMonth();
                  const dayAbsences = byDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-20 rounded-lg border p-1.5",
                        key === todayISO
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200",
                        !inMonth && "opacity-40"
                      )}
                    >
                      <p
                        className={cn(
                          "mb-1 text-xs",
                          key === todayISO
                            ? "font-semibold text-blue-700"
                            : "text-slate-400"
                        )}
                      >
                        {day.getUTCDate()}
                      </p>
                      <div className="space-y-1">
                        {dayAbsences.slice(0, 3).map((a, i) => (
                          <div
                            key={`${a.member_id}-${i}`}
                            className="truncate rounded px-1 py-0.5 text-[11px] leading-tight"
                            style={{
                              backgroundColor: `${a.leave_type_color}1a`,
                              color: a.leave_type_color,
                            }}
                            title={`${a.member_name} — ${a.leave_type_name}`}
                          >
                            {a.member_name}
                          </div>
                        ))}
                        {dayAbsences.length > 3 && (
                          <p className="px-1 text-[11px] text-slate-400">
                            +{dayAbsences.length - 3}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 text-left font-medium">
                      Collaborateur
                    </th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = addDays(rangeStart, i);
                      return (
                        <th key={i} className="px-1 py-2 text-center font-medium">
                          {DAY_NAMES[i]}
                          <span className="ml-1 font-normal text-slate-300">
                            {d.getUTCDate()}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    new Set((absences ?? []).map((a) => a.member_id))
                  ).map((memberId) => {
                    const mine = (absences ?? []).filter(
                      (a) => a.member_id === memberId
                    );
                    return (
                      <tr
                        key={memberId}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {mine[0].member_name}
                        </td>
                        {Array.from({ length: 7 }, (_, i) => {
                          const key = iso(addDays(rangeStart, i));
                          const hit = (byDay.get(key) ?? []).find(
                            (a) => a.member_id === memberId
                          );
                          return (
                            <td key={i} className="px-1 py-2 text-center">
                              {hit ? (
                                <span
                                  className="inline-block h-5 w-full rounded"
                                  style={{ backgroundColor: hit.leave_type_color }}
                                  title={`${hit.leave_type_name}${
                                    hit.start_date === key && hit.start_half
                                      ? " (demi-journée)"
                                      : ""
                                  }`}
                                />
                              ) : (
                                <span className="inline-block h-5 w-full rounded bg-slate-100" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(absences ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détail des absences</CardTitle>
            <CardDescription>Type et durée, sans motif</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {(absences ?? []).map((a, i) => (
                <li
                  key={`${a.member_id}-${a.start_date}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: a.leave_type_color }}
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {a.member_name}
                    </span>
                    <span className="text-sm text-slate-500">
                      {a.leave_type_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
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
