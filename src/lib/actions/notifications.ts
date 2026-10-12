"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Notifications internes.
 *
 * Elles sont produites par les RPC métier (demande de congé, décision,
 * correction de pointage, arrivée d'un collaborateur) — jamais par le client.
 * Ici on ne fait que les lire et les marquer comme lues, ce que la RLS
 * restreint strictement au destinataire.
 */

export async function markNotificationRead(id: string): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { success: "Notification marquée comme lue." };
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", session.membership.id)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { success: "Toutes les notifications sont marquées comme lues." };
}
