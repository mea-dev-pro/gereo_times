import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/alert";
import { formatDate, formatMinutes } from "@/lib/utils";
import { ClockWidget } from "./clock-widget";
import { AdjustmentForm, type AdjustableEntry } from "./adjustment-form";

export const metadata: Metadata = { title: "Pointage" };

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

export default async function PointagePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const memberId = session.membership.id;

  const [{ data: openEntry }, { data: entries }, { data: adjustments }] =
    await Promise.all([
      supabase
        .from("time_entries")
        .select("*")
        .eq("member_id", memberId)
        .is("clock_out", null)
        .maybeSingle(),
      supabase
        .from("time_entries")
        .select("*")
        .eq("member_id", memberId)
        .order("work_date", { ascending: false })
        .limit(30),
      supabase
        .from("time_adjustments")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  let isOnBreak = false;
  if (openEntry) {
    const { data: openBreak } = await supabase
      .from("break_entries")
      .select("id")
      .eq("time_entry_id", openEntry.id)
      .is("ended_at", null)
      .maybeSingle();
    isOnBreak = Boolean(openBreak);
  }

  const adjustable: AdjustableEntry[] = (entries ?? [])
    .filter((e) => e.clock_out !== null)
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      work_date: e.work_date,
      clock_in: e.clock_in,
      clock_out: e.clock_out as string,
    }));

  const totalMonth = (entries ?? [])
    .filter((e) => e.work_date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((sum, e) => sum + (e.effective_minutes ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-content">
          Pointage
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          {formatMinutes(totalMonth)} cumulées ce mois-ci
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ma journée</CardTitle>
          <CardDescription>
            Une seule session peut être ouverte à la fois. Les pauses sont
            déduites du temps effectif.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClockWidget
            isOpen={Boolean(openEntry)}
            isOnBreak={isOnBreak}
            clockedInAt={openEntry?.clock_in ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>
            Les 30 dernières sessions pointées
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(entries ?? []).length === 0 ? (
            <EmptyState
              title="Aucun pointage"
              description="Votre historique apparaîtra après votre premier pointage."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Arrivée</th>
                    <th className="py-2 pr-3 font-medium">Sortie</th>
                    <th className="py-2 pr-3 font-medium">Pauses</th>
                    <th className="py-2 pr-3 font-medium">Effectif</th>
                    <th className="py-2 pr-3 font-medium">Écart</th>
                    <th className="py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(entries ?? []).map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2 pr-3 text-content">
                        {new Date(e.work_date + "T00:00:00").toLocaleDateString(
                          "fr-FR",
                          { weekday: "short", day: "2-digit", month: "2-digit" }
                        )}
                      </td>
                      <td className="py-2 pr-3 text-content">
                        {new Date(e.clock_in).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 pr-3 text-content">
                        {e.clock_out
                          ? new Date(e.clock_out).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-content-muted">
                        {e.break_minutes > 0 ? `${e.break_minutes} min` : "—"}
                      </td>
                      <td className="py-2 pr-3 font-medium text-content">
                        {formatMinutes(e.effective_minutes)}
                      </td>
                      <td className="py-2 pr-3">
                        {e.variance_minutes === null ? (
                          "—"
                        ) : (
                          <Badge
                            tone={
                              e.variance_minutes >= 0 ? "success" : "warning"
                            }
                          >
                            {e.variance_minutes >= 0 ? "+" : ""}
                            {formatMinutes(e.variance_minutes)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demander une correction</CardTitle>
            <CardDescription>
              Toute modification d&apos;un pointage clôturé passe par une
              validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdjustmentForm entries={adjustable} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes corrections</CardTitle>
            <CardDescription>Suivi de vos demandes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(adjustments ?? []).length === 0 ? (
              <EmptyState title="Aucune demande de correction" />
            ) : (
              (adjustments ?? []).map((a) => (
                <div
                  key={a.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-content">
                        {a.reason}
                      </p>
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
