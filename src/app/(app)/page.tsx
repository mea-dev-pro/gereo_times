import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  Timer,
  TrendingUp,
} from "lucide-react";
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
import { StatCard, type StatTint } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
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
  const semaine = weekBounds(new Date());
  const peutValider = canManage(session.membership.role);

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
      .gte("work_date", semaine.monday)
      .lte("work_date", semaine.sunday)
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
    peutValider
      ? supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    peutValider
      ? supabase
          .from("time_adjustments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const typeById = new Map((leaveTypes ?? []).map((t) => [t.id, t]));
  const minutesSemaine = (weekEntries ?? []).reduce(
    (somme, e) => somme + (e.effective_minutes ?? 0),
    0
  );
  // On compte les JOURNÉES distinctes, pas les pointages : plusieurs sessions
  // peuvent tomber le même jour (pause, reprise), et afficher leur nombre
  // donnerait un total supérieur à sept pour une semaine.
  const joursPointes = new Set((weekEntries ?? []).map((e) => e.work_date)).size;
  const joursDisponibles = (balances ?? []).reduce(
    (somme, b) => somme + Number(b.available_days),
    0
  );
  const aTraiter = (pendingLeaves ?? 0) + (pendingAdjustments ?? 0);
  const soldes = (balances ?? []).filter(
    (b) => Number(b.accrued_days) !== 0
  );

  // Chaque tuile porte une teinte qui a un sens : le violet signale une action
  // possible, l'ambre une attention requise, la menthe une information neutre.
  const tuiles: {
    tint: StatTint;
    icon: typeof Clock;
    valeur: string;
    libelle: string;
    detail: string;
  }[] = [
    {
      tint: "mint",
      icon: Clock,
      valeur: formatMinutes(minutesSemaine),
      libelle: "Heures cette semaine",
      detail: `${joursPointes} jour(s) pointé(s)`,
    },
    {
      tint: "violet",
      icon: CalendarDays,
      valeur: `${joursDisponibles.toFixed(2).replace(".", ",")} j`,
      libelle: "Congés disponibles",
      detail: "tous types confondus",
    },
    {
      tint: "sky",
      icon: Timer,
      valeur: openEntry ? "En cours" : "Arrêté",
      libelle: "Statut de pointage",
      detail: openEntry
        ? `depuis ${formatDateTime(openEntry.clock_in)}`
        : "aucune session ouverte",
    },
    {
      tint: "amber",
      icon: ClipboardCheck,
      valeur: String(aTraiter),
      libelle: "À traiter",
      detail: peutValider
        ? `${pendingLeaves ?? 0} congé(s), ${pendingAdjustments ?? 0} correction(s)`
        : "réservé aux managers",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Bonjour ${session.profile.full_name?.split(" ")[0] ?? ""}`}
        description={`${session.organization.name} · semaine du ${semaine.label}`}
        actions={
          <>
            <Link
              href="/pointage"
              className={buttonVariants({ variant: "brand" })}
            >
              <Timer className="size-4" aria-hidden="true" />
              Pointer
            </Link>
            <Link
              href="/conges"
              className={buttonVariants({ variant: "outline" })}
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              Demander un congé
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Mes soldes de congés</CardTitle>
              <CardDescription>
                Reconstruits à partir du journal des mouvements
              </CardDescription>
            </div>
            <TrendingUp
              className="size-4 shrink-0 text-content-subtle"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {soldes.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Aucun droit acquis"
                description="Les soldes apparaîtront après la première acquisition."
              />
            ) : (
              soldes.map((b) => {
                const type = typeById.get(b.leave_type_id);
                const dispo = Number(b.available_days);
                return (
                  <div
                    key={b.leave_type_id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: type?.color ?? "#94a3b8" }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm text-content">
                        {type?.name ?? "Type inconnu"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-content-muted">
                        {Number(b.used_days) > 0
                          ? `${Number(b.used_days).toFixed(1)} j utilisés`
                          : ""}
                      </span>
                      <Badge tone={dispo > 0 ? "brand" : "neutral"}>
                        {dispo.toFixed(2).replace(".", ",")} j
                      </Badge>
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
              <CardTitle>Mes dernières demandes</CardTitle>
              <CardDescription>
                <Link
                  href="/conges"
                  className="text-brand-strong hover:underline"
                >
                  Voir toutes mes demandes
                </Link>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myRequests ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="Aucune demande"
                description="Vos demandes de congé apparaîtront ici."
              />
            ) : (
              (myRequests ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">
                      {typeById.get(r.leave_type_id)?.name ?? "Congé"}
                    </p>
                    <p className="text-xs text-content-muted">
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
