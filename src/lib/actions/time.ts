"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { dispatchPendingEmails } from "@/lib/notifications/email";
import type { ActionState } from "@/lib/auth/actions";

function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("déjà ouverte") || m.includes("already open"))
    return "Une session de pointage est déjà ouverte.";
  if (m.includes("aucune session")) return "Aucune session de pointage ouverte.";
  if (m.includes("pause")) return message;
  if (m.includes("correction justifiée")) return message;
  return message;
}

export async function clockIn(): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", {
    p_organization_id: session.organization.id,
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/pointage");
  revalidatePath("/");
  return { success: "Pointage d'arrivée enregistré." };
}

export async function clockOut(note?: string): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out", {
    p_organization_id: session.organization.id,
    p_note: (note ?? "").trim() || null,
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/pointage");
  revalidatePath("/");
  return { success: "Pointage de sortie enregistré." };
}

export async function startBreak(): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_break", {
    p_organization_id: session.organization.id,
    p_kind: "unpaid",
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/pointage");
  return { success: "Pause démarrée." };
}

export async function endBreak(): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_break", {
    p_organization_id: session.organization.id,
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/pointage");
  return { success: "Pause terminée." };
}

export async function requestAdjustment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const entryId = String(formData.get("time_entry_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const inTime = String(formData.get("new_in") ?? "");
  const outTime = String(formData.get("new_out") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!entryId || !date) return { error: "Sélectionnez un pointage à corriger." };
  if (reason.length < 5) return { error: "Le motif doit être explicite (5 caractères minimum)." };
  if (!inTime && !outTime) return { error: "Indiquez au moins une heure corrigée." };

  const toIso = (t: string) => (t ? new Date(`${date}T${t}:00`).toISOString() : null);

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_time_adjustment", {
    p_organization_id: session.organization.id,
    p_time_entry_id: entryId,
    p_new_in: toIso(inTime),
    p_new_out: toIso(outTime),
    p_reason: reason,
  });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/pointage");
  revalidatePath("/validations");
  return { success: "Demande de correction transmise au manager." };
}

export async function decideAdjustment(
  adjustmentId: string,
  approve: boolean,
  comment: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_time_adjustment", {
    p_adjustment_id: adjustmentId,
    p_approve: approve,
    p_comment: comment || null,
  });
  if (error) return { error: traduire(error.message) };

  // File d'envoi email : la RPC a déposé la notification de décision.
  await dispatchPendingEmails();

  revalidatePath("/validations");
  revalidatePath("/pointage");
  return { success: approve ? "Correction approuvée." : "Correction refusée." };
}
