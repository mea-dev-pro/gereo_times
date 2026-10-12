import Link from "next/link";
import { canManage, requireSession } from "@/lib/auth/session";
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
import { formatDate, formatDateTime, formatMinutes } from "@/lib/utils";

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

/** Lundi 00:00 de la semaine contenant `date`, en ISO (yyyy-mm-dd). */
function weekBounds(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dow = d.getUTCDay(); // 0 = dimanche
  const shift = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + shift);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
    label: `${monday.getUTCDate()}/${monday.getUTCMonth() + 1} – ${sunday.getUTCDate()}/${sunday.getUTCMonth() + 1}`,
  };
}

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const memberId = session.membership.id;
  const orgId = session.organization.id;
  const week = weekBounds(new Date());

  const [
    { data: balances },
    { data: leaveTypes },
    { data: weekEntries },
    { data: myRequests },
    { data: openEntry },
    { count: pendingLeaves },
    { count: pendingAdjustments },
  ] = await Promise.all([
    supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId)
      .eq("member_id", memberId),
    supabase
      .from("leave_types")
      .select("*")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("time_entries")
      .select("*")
      .eq("member_id", memberId)
      .gte("work_date", week.monday)
      .lte("work_date", week.sunday)
      .order("work_date"),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("time_entries")
      .select("*")
      .eq("member_id", memberId)
      .is("clock_out", null)
      .maybeSingle(),
    canManage(session.membership.role)
      ? supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canManage(session.membership.role)
      ? supabase
          .from("time_adjustments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const typeById = new Map((leaveTypes ?? []).map((t) => [t.id, t]));
  const weekMinutes = (weekEntries ?? []).reduce(
    (sum, e) => sum + (e.effective_minutes ?? 0),
    0
  );
  const totalAvailable = (balances ?? []).reduce(
    (sum, b) => sum + Number(b.available_days),
    0
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Bonjour {session.profile.full_name?.split(" ")[0] ?? ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {session.organization.name} · semaine du {week.label}
        </p>
      </header>

      {/* Indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Heures cette semaine
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatMinutes(weekMinutes)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {(weekEntries ?? []).length} jour(s) pointé(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Congés disponibles
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalAvailable.toFixed(2).replace(".", ",")} j
            </p>
            <p className="mt-1 text-xs text-slate-500">tous types confondus</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Statut de pointage
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {openEntry ? "En cours" : "Arrêté"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {openEntry
                ? `depuis ${formatDateTime(openEntry.clock_in)}`
                : "aucune session ouverte"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              À traiter
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {(pendingLeaves ?? 0) + (pendingAdjustments ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canManage(session.membership.role)
                ? `${pendingLeaves ?? 0} congé(s), ${pendingAdjustments ?? 0} correction(s)`
                : "réservé aux managers"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Soldes */}
        <Card>
          <CardHeader>
            <CardTitle>Mes soldes de congés</CardTitle>
            <CardDescription>
              Reconstruits à partir du journal des mouvements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(balances ?? []).filter((b) => Number(b.accrued_days) !== 0).length ===
            0 ? (
              <EmptyState
                title="Aucun droit acquis"
                description="Les soldes apparaîtront après la première acquisition."
              />
            ) : (
              (balances ?? [])
                .filter((b) => Number(b.accrued_days) !== 0)
                .map((b) => {
                  const type = typeById.get(b.leave_type_id);
                  return (
                    <div
                      key={b.leave_type_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: type?.color ?? "#94a3b8" }}
                        />
                        <span className="truncate text-sm text-slate-700">
                          {type?.name ?? "Type inconnu"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">
                          {Number(b.used_days) > 0
                            ? `${Number(b.used_days).toFixed(1)} j utilisés`
                            : ""}
                        </span>
                        <Badge tone={Number(b.available_days) > 0 ? "brand" : "neutral"}>
                          {Number(b.available_days).toFixed(2).replace(".", ",")} j
                        </Badge>
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>

        {/* Dernières demandes */}
        <Card>
          <CardHeader>
            <CardTitle>Mes dernières demandes</CardTitle>
            <CardDescription>
              <Link href="/conges" className="text-blue-600 hover:underline">
                Voir toutes mes demandes
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myRequests ?? []).length === 0 ? (
              <EmptyState
                title="Aucune demande"
                description="Vos demandes de congé apparaîtront ici."
              />
            ) : (
              (myRequests ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {typeById.get(r.leave_type_id)?.name ?? "Congé"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)} ·{" "}
                      {Number(r.total_days).toFixed(2).replace(".", ",")} j
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
