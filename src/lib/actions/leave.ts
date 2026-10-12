"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { dispatchPendingEmails } from "@/lib/notifications/email";
import type { ActionState } from "@/lib/auth/actions";
import type { HalfDay } from "@/types/database";

export async function submitLeaveRequest(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const leaveTypeId = String(formData.get("leave_type_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const startHalf = (String(formData.get("start_half") ?? "") || null) as HalfDay | null;
  const endHalf = (String(formData.get("end_half") ?? "") || null) as HalfDay | null;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!leaveTypeId) return { error: "Choisissez un type de congé." };
  if (!startDate || !endDate) return { error: "Renseignez les dates de début et de fin." };
  if (endDate < startDate) return { error: "La date de fin doit suivre la date de début." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_leave_request", {
    p_organization_id: session.organization.id,
    p_leave_type_id: leaveTypeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_start_half: startHalf,
    p_end_half: endHalf,
    p_reason: reason || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/conges");
  revalidatePath("/validations");
  revalidatePath("/");
  return { success: "Demande transmise pour validation." };
}

export async function decideLeaveRequest(
  requestId: string,
  approve: boolean,
  comment: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_comment: comment || null,
  });
  if (error) return { error: error.message };

  // Les notifications sont déposées en base par la RPC ; on vide la file email.
  await dispatchPendingEmails();

  revalidatePath("/validations");
  revalidatePath("/conges");
  revalidatePath("/");
  return { success: approve ? "Demande approuvée." : "Demande refusée." };
}

export async function cancelLeaveRequest(
  requestId: string,
  reason: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_leave_request", {
    p_request_id: requestId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/conges");
  revalidatePath("/validations");
  revalidatePath("/");
  return { success: "Demande annulée, droits restitués." };
}

/** Estimation des jours ouvrés — pour l'aperçu live du formulaire. */
export async function estimateLeaveDays(
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  startHalf: HalfDay | null,
  endHalf: HalfDay | null
): Promise<{ days?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };
  if (!startDate || !endDate || endDate < startDate) return { days: 0 };
  if (!leaveTypeId) return { days: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_leave_days", {
    p_organization_id: session.organization.id,
    p_member_id: session.membership.id,
    p_start: startDate,
    p_end: endDate,
    p_start_half: startHalf,
    p_end_half: endHalf,
  });

  if (error) return { error: error.message };
  return { days: Number(data) };
}
