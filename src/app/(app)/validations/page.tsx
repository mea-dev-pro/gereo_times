import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import { EmptyState } from "@/components/ui/alert";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DecisionPanel } from "./decision-panel";

export const metadata: Metadata = { title: "Validations" };

// Page bloquante : elle lit la session et l'heure courante à chaque requête.
export const instant = false;

export default async function ValidationsPage() {
  const session = await requireSession();
  if (!canManage(session.membership.role)) redirect("/");

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [
    { data: requests },
    { data: adjustments },
    { data: types },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("time_adjustments")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("leave_types").select("*").eq("organization_id", orgId),
    supabase
      .from("organization_members")
      .select("id, user_id, job_title")
      .eq("organization_id", orgId),
  ]);

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));

  const userIds = Array.from(
    new Set((members ?? []).map((m) => m.user_id))
  );
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function nameOf(memberId: string) {
    const m = memberById.get(memberId);
    if (!m) return "Collaborateur";
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? "Collaborateur";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Validations
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Demandes de votre équipe en attente de décision
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            Demandes de congé{" "}
            <Badge tone={(requests ?? []).length > 0 ? "warning" : "neutral"}>
              {requests?.length ?? 0}
            </Badge>
          </CardTitle>
          <CardDescription>
            Le solde est déjà réservé. L&apos;approbation le consomme
            définitivement, le refus le restitue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(requests ?? []).length === 0 ? (
            <EmptyState
              title="Aucune demande en attente"
              description="Vous êtes à jour."
            />
          ) : (
            (requests ?? []).map((r) => {
              const type = typeById.get(r.leave_type_id);
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: type?.color ?? "#94a3b8" }}
                        />
                        <span className="font-medium text-slate-900">
                          {nameOf(r.member_id)}
                        </span>
                        <span className="text-sm text-slate-500">
                          · {type?.name ?? "Congé"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                        {r.start_half ? ` (début ${r.start_half})` : ""}
                        {r.end_half ? ` (fin ${r.end_half})` : ""}
                      </p>
                      {r.reason && (
                        <p className="mt-1 text-sm italic text-slate-500">
                          « {r.reason} »
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        soumise le {formatDateTime(r.submitted_at)}
                      </p>
                    </div>
                    <Badge tone="brand">
                      {Number(r.total_days).toFixed(2).replace(".", ",")} j
                    </Badge>
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <DecisionPanel id={r.id} kind="leave" />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Corrections de pointage{" "}
            <Badge
              tone={(adjustments ?? []).length > 0 ? "warning" : "neutral"}
            >
              {adjustments?.length ?? 0}
            </Badge>
          </CardTitle>
          <CardDescription>
            Une session clôturée ne peut être modifiée que par ce circuit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(adjustments ?? []).length === 0 ? (
            <EmptyState title="Aucune correction en attente" />
          ) : (
            (adjustments ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {nameOf(a.member_id)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {a.original_in &&
                        new Date(a.original_in).toLocaleString("fr-FR")}
                      {" → "}
                      {a.original_out
                        ? new Date(a.original_out).toLocaleString("fr-FR")
                        : "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Corrigé en :{" "}
                      <strong>
                        {a.new_in
                          ? new Date(a.new_in).toLocaleString("fr-FR")
                          : "—"}
                      </strong>
                      {" → "}
                      <strong>
                        {a.new_out
                          ? new Date(a.new_out).toLocaleString("fr-FR")
                          : "—"}
                      </strong>
                    </p>
                    <p className="mt-1 text-sm italic text-slate-500">
                      « {a.reason} »
                    </p>
                  </div>
                  <Badge tone="warning">En attente</Badge>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <DecisionPanel id={a.id} kind="adjustment" />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
