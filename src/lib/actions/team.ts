"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isHrOrAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import type { OrgRole } from "@/types/database";

function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("réservé aux rh")) return "Action réservée aux RH et administrateurs.";
  if (m.includes("fait déjà partie")) return "Cette personne fait déjà partie de l'organisation.";
  if (m.includes("adresse email invalide")) return "Cette adresse email n'est pas valide.";
  if (m.includes("hors de cette organisation")) return "Le département ou le responsable choisi n'appartient pas à cette organisation.";
  if (m.includes("plus en attente")) return "Cette invitation n'est plus en attente.";
  return message;
}

/**
 * Invite un collaborateur.
 *
 * Deux temps : l'invitation est enregistrée en base (RPC `invite_member`), puis
 * un lien d'activation est produit via l'API d'administration. Le lien est
 * affiché à l'administrateur, qui le transmet — aucun mot de passe ne transite.
 */
export async function inviteMember(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!isHrOrAdmin(session.membership.role)) {
    return { error: "Action réservée aux RH et administrateurs." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "employee") as OrgRole;
  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const managerId = String(formData.get("manager_id") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");

  if (!email.includes("@")) return { error: "Renseignez une adresse email valide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_organization_id: session.organization.id,
    p_email: email,
    p_role: role,
    p_department_id: null,
    p_manager_id: managerId || null,
    p_job_title: jobTitle || null,
    p_hire_date: hireDate || null,
  });

  if (error) return { error: traduire(error.message) };

  revalidatePath("/equipe");

  // --- Production du lien d'activation ---------------------------------------
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const redirectTo = `${proto}://${host}/auth/confirmer`;

  try {
    const admin = createAdminClient();

    // « invite » crée le compte ; s'il existe déjà (personne ayant déjà eu un
    // accès), on retombe sur un lien de connexion à usage unique.
    let link = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (link.error) {
      link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
    }

    if (link.error) {
      return {
        success: `Invitation enregistrée pour ${email}.`,
        error: `Lien d'activation non généré : ${link.error.message}`,
      };
    }

    const url = link.data?.properties?.action_link;
    return {
      success: `Invitation enregistrée pour ${email}.`,
      link: url ?? undefined,
      error: url
        ? undefined
        : "L'API n'a pas renvoyé de lien d'activation.",
    };
  } catch (e) {
    return {
      success: `Invitation enregistrée pour ${email}.`,
      error:
        "Lien d'activation non généré (clé service_role absente ?) : " +
        (e instanceof Error ? e.message : String(e)),
    };
  }
}

export async function revokeInvitation(
  invitationId: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!isHrOrAdmin(session.membership.role)) {
    return { error: "Action réservée aux RH et administrateurs." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/equipe");
  return { success: "Invitation révoquée." };
}

export async function updateMemberRole(
  memberId: string,
  role: OrgRole
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!isHrOrAdmin(session.membership.role)) {
    return { error: "Action réservée aux RH et administrateurs." };
  }
  if (memberId === session.membership.id) {
    return { error: "Vous ne pouvez pas modifier votre propre rôle." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", session.organization.id);

  if (error) return { error: traduire(error.message) };

  revalidatePath("/equipe");
  return { success: "Rôle mis à jour." };
}

export async function setMemberStatus(
  memberId: string,
  active: boolean
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!isHrOrAdmin(session.membership.role)) {
    return { error: "Action réservée aux RH et administrateurs." };
  }
  if (memberId === session.membership.id) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", memberId)
    .eq("organization_id", session.organization.id);

  if (error) return { error: traduire(error.message) };

  revalidatePath("/equipe");
  return {
    success: active ? "Collaborateur réactivé." : "Collaborateur désactivé.",
  };
}

/** Accepte une invitation en attente pour l'utilisateur connecté. */
export async function acceptInvitation(): Promise<{
  accepted: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { accepted: false, error: "Session expirée." };

  const { data, error } = await supabase.rpc("accept_pending_invitation");
  if (error) return { accepted: false, error: error.message };

  revalidatePath("/", "layout");
  return { accepted: Boolean(data) };
}
