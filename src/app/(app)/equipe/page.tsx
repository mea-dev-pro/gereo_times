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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/alert";
import { formatDate, ROLE_LABELS } from "@/lib/utils";
import { InviteForm, type ManagerOption } from "./invite-form";
import { MemberRowActions, RevokeInvitationButton } from "./member-actions";

export const metadata: Metadata = { title: "Équipe" };

// Page bloquante : elle lit la session à chaque requête.
export const instant = false;

export default async function EquipePage() {
  const session = await requireSession();
  if (!isHrOrAdmin(session.membership.role)) redirect("/");

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [{ data: members }, { data: invitations }, { data: departments }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", orgId)
        .order("joined_at"),
      supabase
        .from("invitations")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", orgId),
    ]);

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const departmentById = new Map((departments ?? []).map((d) => [d.id, d]));
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  const nameOf = (memberId: string | null) => {
    if (!memberId) return null;
    const m = memberById.get(memberId);
    if (!m) return null;
    const p = profileById.get(m.user_id);
    return p?.full_name ?? p?.email ?? null;
  };

  const managers: ManagerOption[] = (members ?? [])
    .filter(
      (m) =>
        m.status === "active" &&
        (m.role === "manager" || m.role === "hr" || m.role === "admin")
    )
    .map((m) => ({
      id: m.id,
      label: `${nameOf(m.id) ?? "Sans nom"} — ${ROLE_LABELS[m.role]}`,
    }));

  const activeCount = (members ?? []).filter((m) => m.status === "active").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Équipe
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {activeCount} membre(s) actif(s) · {invitations?.length ?? 0} invitation(s)
          en attente
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Inviter un collaborateur</CardTitle>
          <CardDescription>
            Un lien d&apos;activation est généré : le collaborateur y définit son
            propre mot de passe et rejoint l&apos;organisation automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm managers={managers} />
        </CardContent>
      </Card>

      {(invitations ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
            <CardDescription>
              Expirent 14 jours après leur émission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(invitations ?? []).map((inv) => (
              <div
                key={inv.id}
                className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {inv.email}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ROLE_LABELS[inv.role]}
                    {inv.job_title ? ` · ${inv.job_title}` : ""}
                    {inv.manager_id
                      ? ` · responsable : ${nameOf(inv.manager_id) ?? "—"}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    émise le {formatDate(inv.created_at.slice(0, 10))} · expire le{" "}
                    {formatDate(inv.expires_at.slice(0, 10))}
                  </p>
                </div>
                <RevokeInvitationButton invitationId={inv.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          <CardDescription>
            Rôles et rattachements de l&apos;organisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(members ?? []).length === 0 ? (
            <EmptyState title="Aucun membre" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Collaborateur</th>
                    <th className="py-2 pr-3 font-medium">Poste</th>
                    <th className="py-2 pr-3 font-medium">Département</th>
                    <th className="py-2 pr-3 font-medium">Responsable</th>
                    <th className="py-2 pr-3 font-medium">Entrée</th>
                    <th className="py-2 pr-3 font-medium">Statut</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((m) => {
                    const p = profileById.get(m.user_id);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-800">
                            {p?.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-slate-500">{p?.email}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {m.job_title ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {m.department_id
                            ? departmentById.get(m.department_id)?.name ?? "—"
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {nameOf(m.manager_id) ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500">
                          {formatDate(m.hire_date)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={m.status === "active" ? "success" : "neutral"}>
                            {m.status === "active" ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="py-2.5">
                          <MemberRowActions
                            memberId={m.id}
                            role={m.role}
                            active={m.status === "active"}
                            isSelf={m.id === session.membership.id}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
