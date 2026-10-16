import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Expédition des emails.
 *
 * Un seul transport, deux usages :
 *
 *  - les notifications — la table `notifications` sert de boîte d'envoi : les
 *    RPC métier y déposent les messages, `dispatchPendingEmails` les expédie.
 *    Deux raisons à ce détour : un échec d'API n'annule jamais l'opération
 *    métier qui l'a déclenché, et la file reste visible et réessayable en base.
 *  - les invitations — le lien d'activation part directement au collaborateur
 *    (voir `inviteMember`). Il n'est jamais écrit en base : il n'existe que
 *    dans la boîte du destinataire, et à l'écran du RH s'il n'a pas pu partir.
 *    Un lien d'activation stocké serait un mot de passe en clair déguisé.
 *
 * Sans RESEND_API_KEY ni EMAIL_FROM, `emailConfigured()` est faux, rien n'est
 * tenté et l'application reste entièrement fonctionnelle, sans emails.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "email_non_configure" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `HTTP ${res.status} — ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type DispatchResult = {
  configured: boolean;
  sent: number;
  failed: number;
  message?: string;
};

/**
 * Expédie les notifications en attente.
 * Utilise le client d'administration : les notifications appartiennent à
 * d'autres membres, hors de portée de la session courante.
 */
export async function dispatchPendingEmails(limit = 20): Promise<DispatchResult> {
  if (!emailConfigured()) {
    return {
      configured: false,
      sent: 0,
      failed: 0,
      message: "RESEND_API_KEY ou EMAIL_FROM absent : envoi désactivé.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      configured: false,
      sent: 0,
      failed: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const { data: pending, error } = await admin
    .from("notifications")
    .select("id, member_id, title, body, link, created_at")
    .is("email_sent_at", null)
    .is("email_error", null)
    .order("created_at")
    .limit(limit);

  if (error || !pending?.length) {
    return { configured: true, sent: 0, failed: 0 };
  }

  // Résolution des destinataires en une passe
  const memberIds = Array.from(new Set(pending.map((n) => n.member_id)));
  const { data: members } = await admin
    .from("organization_members")
    .select("id, user_id")
    .in("id", memberIds);

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };

  const emailByMember = new Map<string, string>();
  for (const m of members ?? []) {
    const email = (profiles ?? []).find((p) => p.id === m.user_id)?.email;
    if (email) emailByMember.set(m.id, email);
  }

  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    const to = emailByMember.get(n.member_id);
    if (!to) {
      await admin
        .from("notifications")
        .update({ email_error: "destinataire_introuvable" })
        .eq("id", n.id);
      failed++;
      continue;
    }

    const result = await sendEmail({
      to,
      subject: `[GereoTimes] ${n.title}`,
      text: [n.title, "", n.body ?? "", n.link ? `\nOuvrir : ${n.link}` : ""]
        .join("\n")
        .trim(),
    });

    if (result.ok) {
      await admin
        .from("notifications")
        .update({
          email_sent_at: new Date().toISOString(),
          email_error: null,
        })
        .eq("id", n.id);
      sent++;
    } else {
      await admin
        .from("notifications")
        .update({ email_error: result.error ?? "erreur_inconnue" })
        .eq("id", n.id);
      failed++;
    }
  }

  return { configured: true, sent, failed };
}
