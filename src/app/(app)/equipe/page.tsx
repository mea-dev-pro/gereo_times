import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { isHrOrAdmin, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, ROLE_LABELS } from "@/lib/utils";
import type { MemberStatus, OrgRole, Tables } from "@/types/database";
import { departements } from "@/lib/data/referentiel";
import { InviteForm, type ManagerOption } from "./invite-form";
import { InvitationActions, MemberRowActions } from "./member-actions";

export const metadata: Metadata = { title: "Équipe" };

// Page bloquante : elle lit la session et les filtres à chaque requête.
export const instant = false;

type Membre = {
  id: string;
  user_id: string;
  role: OrgRole;
  status: MemberStatus;
  job_title: string | null;
  department_id: string | null;
  manager_id: string | null;
  hire_date: string | null;
};

/**
 * Colonnes de la liste des membres, profil inclus.
 * `profiles` a besoin de l'indication explicite `organization_members_user_id_fkey` :
 * la table porte deux clés étrangères vers `profiles` (`user_id`, `invited_by`).
 */
const SELECT_MEMBRES =
  "*, profiles!organization_members_user_id_fkey(id, full_name, email)";

type LigneMembre = Tables<"organization_members"> & {
  profiles: Pick<Tables<"profiles">, "id" | "full_name" | "email"> | null;
};

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!isHrOrAdmin(session.membership.role)) redirect("/");

  const { q } = await searchParams;
  const recherche = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const orgId = session.organization.id;

  const [{ data: membres }, { data: invitations }, departments] =
    await Promise.all([
      supabase
        .from("organization_members")
        // Le profil du membre arrive dans la même réponse : sans cette
        // jointure, les noms demandaient une seconde vague d'appels, soit un
        // aller-retour de plus (≈250 ms) avant d'afficher l'écran.
        .select(SELECT_MEMBRES as "*")
        .eq("organization_id", orgId)
        .order("joined_at"),
      supabase
        .from("invitations")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      // Référentiel mis en cache : voir lib/data/referentiel.ts.
      departements(orgId),
    ]);

  const members = (membres ?? []) as LigneMembre[];

  const profileById = new Map<
    string,
    Pick<Tables<"profiles">, "id" | "full_name" | "email">
  >();
  for (const m of members) {
    if (m.profiles) profileById.set(m.user_id, m.profiles);
  }
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

  const actifs = (members ?? []).filter((m) => m.status === "active").length;

  // Filtrage serveur : la RLS s'applique, et rien de non autorisé ne part vers
  // le navigateur. On cherche sur le nom, l'adresse, le poste et le rôle.
  const membresFiltres = ((members ?? []) as Membre[]).filter((m) => {
    if (!recherche) return true;
    const p = profileById.get(m.user_id);
    return [p?.full_name, p?.email, m.job_title, ROLE_LABELS[m.role]]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(recherche));
  });

  const invitationsFiltrees = (invitations ?? []).filter(
    (inv) =>
      !recherche ||
      [inv.email, inv.job_title, ROLE_LABELS[inv.role]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(recherche))
  );

  const colonnes: Column<Membre>[] = [
    {
      key: "collaborateur",
      header: "Collaborateur",
      cell: (m) => {
        const p = profileById.get(m.user_id);
        return (
          <>
            <p className="font-medium text-content">{p?.full_name ?? "—"}</p>
            <p className="text-xs text-content-muted">{p?.email}</p>
          </>
        );
      },
    },
    {
      key: "poste",
      header: "Poste",
      hideBelow: "md",
      cell: (m) => (
        <span className="text-content-muted">{m.job_title ?? "—"}</span>
      ),
    },
    {
      key: "departement",
      header: "Département",
      hideBelow: "lg",
      cell: (m) => (
        <span className="text-content-muted">
          {m.department_id
            ? (departmentById.get(m.department_id)?.name ?? "—")
            : "—"}
        </span>
      ),
    },
    {
      key: "responsable",
      header: "Responsable",
      hideBelow: "lg",
      cell: (m) => (
        <span className="text-content-muted">{nameOf(m.manager_id) ?? "—"}</span>
      ),
    },
    {
      key: "entree",
      header: "Entrée",
      hideBelow: "md",
      cell: (m) => (
        <span className="text-content-muted">{formatDate(m.hire_date)}</span>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      hideBelow: "sm",
      cell: (m) => (
        <span className="text-content-muted">
          {ROLE_LABELS[m.role] ?? m.role}
        </span>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      cell: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (m) => (
        <MemberRowActions
          memberId={m.id}
          role={m.role}
          active={m.status === "active"}
          isSelf={m.id === session.membership.id}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Équipe"
        description={
          <>
            {actifs} membre(s) actif(s) · {invitations?.length ?? 0} invitation(s)
            en attente
          </>
        }
      />

      <FilterBar>
        <FilterField label="Recherche">
          <SearchInput
            initial={q ?? ""}
            placeholder="Nom, adresse, poste…"
            label="Rechercher un collaborateur"
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle>Inviter un collaborateur</CardTitle>
          <CardDescription>
            Le collaborateur reçoit un email avec un lien d&apos;activation : il y
            définit son propre mot de passe et rejoint l&apos;organisation
            automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm managers={managers} />
        </CardContent>
      </Card>

      {invitationsFiltrees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
            <CardDescription>
              Expirent 14 jours après leur émission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitationsFiltrees.map((inv) => (
              <div
                key={inv.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content">
                    {inv.email}
                  </p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {ROLE_LABELS[inv.role]}
                    {inv.job_title ? ` · ${inv.job_title}` : ""}
                    {inv.manager_id
                      ? ` · responsable : ${nameOf(inv.manager_id) ?? "—"}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-content-subtle">
                    émise le {formatDate(inv.created_at.slice(0, 10))} · expire le{" "}
                    {formatDate(inv.expires_at.slice(0, 10))}
                  </p>
                </div>
                <InvitationActions invitationId={inv.id} email={inv.email} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          <CardDescription>
            {recherche
              ? `${membresFiltres.length} résultat(s) pour « ${q} »`
              : "Rôles et rattachements de l'organisation"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colonnes}
            rows={membresFiltres}
            rowKey={(m) => m.id}
            caption="Membres de l'organisation"
            empty={
              recherche ? (
                <EmptyState
                  icon={Users}
                  title="Aucun collaborateur ne correspond"
                  description={`Aucun résultat pour « ${q} ». Essayez un autre nom, une adresse ou un poste.`}
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Aucun membre"
                  description="Invitez un premier collaborateur pour commencer."
                />
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
