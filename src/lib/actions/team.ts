"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isHrOrAdmin } from "@/lib/auth/session";
import { emailConfigured, sendEmail } from "@/lib/notifications/email";
import { origineRequete } from "@/lib/http";
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
 * Produit un lien d'activation pour une adresse.
 *
 * « invite » crée le compte ; s'il existe déjà (personne ayant déjà eu un
 * accès), on retombe sur un lien de connexion à usage unique.
 */
async function lienActivation(
  email: string,
  redirectTo: string
): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient();

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

  if (link.error) return { error: link.error.message };

  const url = link.data?.properties?.action_link;
  return url ? { url } : { error: "L'API n'a pas renvoyé de lien d'activation." };
}

/**
 * Expédie le lien d'activation au collaborateur invité.
 *
 * Le lien n'est jamais écrit en base : un envoi raté n'est donc pas rejouable
 * tout seul. D'où les deux secours prévus par l'appelant — le lien rendu à
 * l'écran du RH, et le renvoi depuis la liste des invitations en attente.
 */
async function expedierLienActivation(params: {
  email: string;
  url: string;
  organisation: string;
  invitante: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email_non_configure" };

  return sendEmail({
    to: params.email,
    subject: "[GereoTimes] Activez votre accès",
    text: [
      "Bonjour,",
      "",
      `${params.invitante} vous invite à rejoindre l'organisation ${params.organisation} sur GereoTimes.`,
      "",
      "Ouvrez ce lien pour définir votre mot de passe et activer votre accès :",
      params.url,
      "",
      "Ce lien est valable 14 jours et ne peut servir qu'une fois.",
      "Si vous n'attendiez pas cette invitation, ignorez ce message.",
    ].join("\n"),
  });
}

/**
 * Traduit le résultat d'un envoi en état d'action.
 *
 * `envoye` ne sert que si le message est réellement parti : annoncer « lien
 * envoyé » alors que l'envoi est désactivé serait un mensonge vert à l'écran.
 * Dans les autres cas, le lien accompagne le message, à transmettre à la main.
 */
function etatEnvoiLien(params: {
  envoi: { ok: boolean; error?: string };
  url: string;
  destinataire: string;
  envoye: string;
  sansEnvoi: string;
}): ActionState {
  const { envoi, url, destinataire } = params;

  if (envoi.ok) return { success: params.envoye };

  if (envoi.error === "email_non_configure") {
    return {
      success: params.sansEnvoi,
      link: url,
      notice: `Envoi automatique désactivé (RESEND_API_KEY ou EMAIL_FROM absent) : transmettez ce lien à ${destinataire}.`,
    };
  }

  return {
    success: params.sansEnvoi,
    link: url,
    error: `Envoi du lien impossible (${envoi.error}). Transmettez-le manuellement.`,
  };
}

/**
 * Invite un collaborateur.
 *
 * Deux temps : l'invitation est enregistrée en base (RPC `invite_member`), puis
 * un lien d'activation est produit via l'API d'administration et **expédié
 * directement** au collaborateur. Aucun mot de passe ne transite : l'invité
 * définit le sien en ouvrant le lien.
 *
 * Si l'envoi est désactivé ou échoue, le lien est rendu à l'administrateur, qui
 * le transmet lui-même — l'invitation n'est jamais perdue.
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

  const succes = `Invitation enregistrée pour ${email}.`;

  // --- Lien d'activation -----------------------------------------------------
  // Le domaine visité, pas celui vu par le serveur : voir `origineRequete`.
  const redirectTo = `${await origineRequete()}/auth/confirmer`;

  let lien: { url?: string; error?: string };
  try {
    lien = await lienActivation(email, redirectTo);
  } catch (e) {
    return {
      success: succes,
      error:
        "Lien d'activation non généré (clé service_role absente ?) : " +
        (e instanceof Error ? e.message : String(e)),
    };
  }

  if (!lien.url) {
    return { success: succes, error: `Lien d'activation non généré : ${lien.error}` };
  }

  // --- Envoi direct au collaborateur ----------------------------------------
  const envoi = await expedierLienActivation({
    email,
    url: lien.url,
    organisation: session.organization.name,
    invitante: session.profile.full_name ?? session.email,
  });

  return etatEnvoiLien({
    envoi,
    url: lien.url,
    destinataire: email,
    envoye: `Invitation enregistrée : lien d'activation envoyé à ${email}.`,
    sansEnvoi: succes,
  });
}

/**
 * Renvoie le lien d'activation d'une invitation en attente.
 *
 * Supabase ne conserve aucun lien : chaque appel en régénère un. Sert quand
 * l'email s'est perdu, quand l'envoi automatique est désactivé, ou avant que
 * les 14 jours ne soient écoulés.
 */
export async function resendInvitation(
  invitationId: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!isHrOrAdmin(session.membership.role)) {
    return { error: "Action réservée aux RH et administrateurs." };
  }

  const supabase = await createClient();
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("email, status")
    .eq("id", invitationId)
    .eq("organization_id", session.organization.id)
    .maybeSingle();

  if (error) return { error: traduire(error.message) };
  if (!invitation) return { error: "Invitation introuvable." };
  if (invitation.status !== "pending") {
    return { error: "Cette invitation n'est plus en attente." };
  }

  const redirectTo = `${await origineRequete()}/auth/confirmer`;

  let lien: { url?: string; error?: string };
  try {
    lien = await lienActivation(invitation.email, redirectTo);
  } catch (e) {
    return {
      error:
        "Lien non généré (clé service_role absente ?) : " +
        (e instanceof Error ? e.message : String(e)),
    };
  }

  if (!lien.url) return { error: `Lien non généré : ${lien.error}` };

  const envoi = await expedierLienActivation({
    email: invitation.email,
    url: lien.url,
    organisation: session.organization.name,
    invitante: session.profile.full_name ?? session.email,
  });

  return etatEnvoiLien({
    envoi,
    url: lien.url,
    destinataire: invitation.email,
    envoye: `Nouveau lien d'activation envoyé à ${invitation.email}.`,
    sansEnvoi: `Nouveau lien d'activation généré pour ${invitation.email}.`,
  });
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
