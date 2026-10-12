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
import { formatDate } from "@/lib/utils";
import { LeaveRequestForm } from "./leave-request-form";
import { CancelLeaveButton } from "./cancel-button";

export const metadata: Metadata = { title: "Mes congés" };

export default async function CongesPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const memberId = session.membership.id;
  const orgId = session.organization.id;

  const [{ data: types }, { data: balances }, { data: requests }] =
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
    ]);

  const balanceByType = new Map(
    (balances ?? []).map((b) => [b.leave_type_id, b])
  );
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Mes congés
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Soldes, demandes et suivi des validations
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Mes soldes</CardTitle>
          <CardDescription>
            Disponible = droits acquis − consommé − réservé (en attente de
            validation)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(types ?? []).map((t) => {
              const b = balanceByType.get(t.id);
              const available = Number(b?.available_days ?? 0);
              const reserved = Number(b?.reserved_days ?? 0);
              const used = Number(b?.used_days ?? 0);
              const accrued = Number(b?.accrued_days ?? 0);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {t.name}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {available.toFixed(2).replace(".", ",")}
                    <span className="ml-1 text-sm font-normal text-slate-500">
                      jour(s)
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge tone="neutral">
                      acquis {accrued.toFixed(1).replace(".", ",")}
                    </Badge>
                    {used > 0 && (
                      <Badge tone="info">
                        utilisé {used.toFixed(1).replace(".", ",")}
                      </Badge>
                    )}
                    {reserved > 0 && (
                      <Badge tone="warning">
                        réservé {reserved.toFixed(1).replace(".", ",")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande</CardTitle>
            <CardDescription>
              Le solde est réservé dès la soumission et consommé à
              l&apos;approbation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(types ?? []).length === 0 ? (
              <EmptyState
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
            <CardTitle>Mes demandes</CardTitle>
            <CardDescription>
              Vous pouvez annuler une demande en attente ou un congé futur
              approuvé
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(requests ?? []).length === 0 ? (
              <EmptyState title="Aucune demande enregistrée" />
            ) : (
              (requests ?? []).map((r) => {
                const type = typeById.get(r.leave_type_id);
                const cancellable =
                  r.status === "pending" || r.status === "approved";
                return (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: type?.color ?? "#94a3b8" }}
                        />
                        <p className="truncate text-sm font-medium text-slate-800">
                          {type?.name ?? "Congé"}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(r.start_date)} → {formatDate(r.end_date)} ·{" "}
                        {Number(r.total_days).toFixed(2).replace(".", ",")} j
                      </p>
                      {r.reason && (
                        <p className="mt-0.5 truncate text-xs italic text-slate-400">
                          {r.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      {cancellable && <CancelLeaveButton requestId={r.id} />}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
