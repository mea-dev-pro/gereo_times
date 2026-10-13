import type { Metadata } from "next";
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
import { formatDate } from "@/lib/utils";
import {
  DepartmentSection,
  HolidaySection,
  LeavePolicySection,
  LeaveTypeSection,
  ScheduleSection,
} from "./sections";

export const metadata: Metadata = { title: "Paramètres RH" };

// Page bloquante : elle lit la session à chaque requête.
export const instant = false;

const ANCHORS = [
  { href: "#departements", label: "Départements" },
  { href: "#calendriers", label: "Calendriers" },
  { href: "#feries", label: "Jours fériés" },
  { href: "#types", label: "Types de congés" },
  { href: "#politiques", label: "Politiques" },
];

export default async function ParametresPage() {
  const session = await requireSession();
  if (!isHrOrAdmin(session.membership.role)) redirect("/");

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [
    { data: departments },
    { data: schedules },
    { data: holidays },
    { data: types },
    { data: policies },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("*")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("work_schedules")
      .select("*")
      .eq("organization_id", orgId)
      .order("is_default", { ascending: false }),
    supabase
      .from("holidays")
      .select("*")
      .eq("organization_id", orgId)
      .order("holiday_date"),
    supabase
      .from("leave_types")
      .select("*")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("leave_policies")
      .select("*")
      .eq("organization_id", orgId)
      .order("effective_from", { ascending: false }),
    supabase
      .from("organization_members")
      .select("id, department_id")
      .eq("organization_id", orgId),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const m of members ?? []) {
    if (m.department_id) {
      memberCounts[m.department_id] = (memberCounts[m.department_id] ?? 0) + 1;
    }
  }

  const policyCounts: Record<string, number> = {};
  for (const p of policies ?? []) {
    policyCounts[p.leave_type_id] = (policyCounts[p.leave_type_id] ?? 0) + 1;
  }

  const nextHoliday = (holidays ?? []).find(
    (h) => h.holiday_date >= new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-content">
          Paramètres RH
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Règles de temps de travail et de congés de {session.organization.name}
        </p>
      </header>

      <nav
        aria-label="Sections des paramètres"
        className="no-print flex flex-wrap gap-2"
      >
        {ANCHORS.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-content-muted hover:border-border-strong hover:text-content"
          >
            {a.label}
          </a>
        ))}
      </nav>

      <Card id="calendriers">
        <CardHeader>
          <CardTitle>Calendriers de travail</CardTitle>
          <CardDescription>
            Définissent les jours ouvrés et le temps planifié. Les week-ends et
            les jours non travaillés sont exclus du décompte des congés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleSection schedules={schedules ?? []} />
        </CardContent>
      </Card>

      <Card id="feries">
        <CardHeader>
          <CardTitle>Jours fériés</CardTitle>
          <CardDescription>
            {nextHoliday
              ? `Prochain : ${nextHoliday.name}, le ${formatDate(nextHoliday.holiday_date)}`
              : "Aucun jour férié à venir"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HolidaySection holidays={holidays ?? []} />
        </CardContent>
      </Card>

      <Card id="departements">
        <CardHeader>
          <CardTitle>Départements</CardTitle>
          <CardDescription>
            Servent au rattachement des collaborateurs et aux futurs filtres de
            reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentSection
            departments={departments ?? []}
            memberCounts={memberCounts}
          />
        </CardContent>
      </Card>

      <Card id="types">
        <CardHeader>
          <CardTitle>Types de congés</CardTitle>
          <CardDescription>
            Un type désactivé n&apos;apparaît plus dans le formulaire de demande
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveTypeSection types={types ?? []} policyCounts={policyCounts} />
        </CardContent>
      </Card>

      <Card id="politiques">
        <CardHeader>
          <CardTitle>Politiques de congés</CardTitle>
          <CardDescription>
            Règles d&apos;acquisition, de préavis et de validation, versionnées
            par date d&apos;effet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeavePolicySection policies={policies ?? []} types={types ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
