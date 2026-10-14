"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isHrOrAdmin } from "@/lib/auth/session";
import {
  tagDepartements,
  tagJoursFeries,
  tagTypesConge,
} from "@/lib/data/referentiel";
import type { ActionState } from "@/lib/auth/actions";
import type { AccrualFrequency } from "@/types/database";

/**
 * Administration RH : départements, jours fériés, types de congés, politiques
 * et calendriers de travail.
 *
 * Ces tables de configuration sont modifiables directement par les RH et les
 * administrateurs — les policies RLS le garantissent (`is_hr_or_admin`). Aucune
 * fonction SECURITY DEFINER n'est nécessaire : il n'y a pas d'invariant métier
 * à protéger au-delà de ce que la RLS et les contraintes assurent déjà.
 */

function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "Action réservée aux RH et administrateurs.";
  }
  if (m.includes("duplicate key") && m.includes("name")) {
    return "Un élément portant ce nom existe déjà.";
  }
  if (m.includes("duplicate key") && m.includes("code")) {
    return "Ce code est déjà utilisé.";
  }
  if (m.includes("duplicate key") && m.includes("holiday_date")) {
    return "Un jour férié existe déjà à cette date.";
  }
  if (m.includes("violates foreign key")) {
    return "Impossible : cet élément est référencé ailleurs.";
  }
  if (m.includes("violates check constraint")) {
    return "Valeur refusée par une contrainte de cohérence.";
  }
  return message;
}

async function guard(): Promise<
  { ok: true; orgId: string } | { ok: false; state: ActionState }
> {
  const session = await getSession();
  if (!session) return { ok: false, state: { error: "Session expirée." } };
  if (!isHrOrAdmin(session.membership.role)) {
    return {
      ok: false,
      state: { error: "Action réservée aux RH et administrateurs." },
    };
  }
  return { ok: true, orgId: session.organization.id };
}

function refresh(tag?: string) {
  // Les référentiels (départements, jours fériés, types de congés) vivent dans
  // un cache partagé par organisation : sans cette invalidation, l'écran
  // continuerait de montrer l'ancienne valeur jusqu'à la régénération
  // quotidienne. `updateTag` expire immédiatement, donc la prochaine lecture
  // attend la donnée fraîche — c'est ce qu'un administrateur qui vient de
  // créer un élément doit voir.
  if (tag) updateTag(tag);
  revalidatePath("/parametres");
  revalidatePath("/");
  revalidatePath("/conges");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => {
  const raw = str(fd, key);
  return raw === "" ? null : Number(raw);
};
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

// =============================================================================
// Départements
// =============================================================================
export async function createDepartment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const name = str(formData, "name");
  if (!name) return { error: "Renseignez le nom du département." };

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    organization_id: g.orgId,
    name,
    code: str(formData, "code") || null,
  });
  if (error) return { error: traduire(error.message) };

  refresh(tagDepartements(g.orgId));
  return { success: `Département « ${name} » créé.` };
}

export async function deleteDepartment(id: string): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("organization_id", g.orgId);
  if (error) return { error: traduire(error.message) };

  refresh(tagDepartements(g.orgId));
  return { success: "Département supprimé." };
}

// =============================================================================
// Jours fériés
// =============================================================================
export async function createHoliday(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const name = str(formData, "name");
  const date = str(formData, "holiday_date");
  if (!name || !date) return { error: "Renseignez le nom et la date." };

  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({
    organization_id: g.orgId,
    name,
    holiday_date: date,
    is_recurring: bool(formData, "is_recurring"),
  });
  if (error) return { error: traduire(error.message) };

  refresh(tagJoursFeries(g.orgId));
  return { success: `« ${name} » ajouté au calendrier.` };
}

export async function deleteHoliday(id: string): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id)
    .eq("organization_id", g.orgId);
  if (error) return { error: traduire(error.message) };

  refresh(tagJoursFeries(g.orgId));
  return { success: "Jour férié supprimé." };
}

// =============================================================================
// Types de congés
// =============================================================================
export async function createLeaveType(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const code = str(formData, "code").toUpperCase().replace(/\s+/g, "_");
  const name = str(formData, "name");
  if (!code || !name) return { error: "Renseignez le code et le libellé." };

  const supabase = await createClient();
  const { error } = await supabase.from("leave_types").insert({
    organization_id: g.orgId,
    code,
    name,
    is_paid: bool(formData, "is_paid"),
    requires_justification: bool(formData, "requires_justification"),
    color: str(formData, "color") || "#2563eb",
  });
  if (error) return { error: traduire(error.message) };

  refresh(tagTypesConge(g.orgId));
  return {
    success: `Type « ${name} » créé. Pensez à lui associer une politique d'acquisition.`,
  };
}

export async function toggleLeaveType(
  id: string,
  active: boolean
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_types")
    .update({ active })
    .eq("id", id)
    .eq("organization_id", g.orgId);
  if (error) return { error: traduire(error.message) };

  refresh(tagTypesConge(g.orgId));
  return { success: active ? "Type réactivé." : "Type désactivé." };
}

// =============================================================================
// Politiques de congés
// =============================================================================
export async function createLeavePolicy(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const leaveTypeId = str(formData, "leave_type_id");
  const name = str(formData, "name");
  const effectiveFrom = str(formData, "effective_from");
  if (!leaveTypeId) return { error: "Choisissez un type de congé." };
  if (!name || !effectiveFrom) {
    return { error: "Renseignez le libellé et la date d'effet." };
  }

  const accrualFrequency = (str(formData, "accrual_frequency") ||
    "monthly") as AccrualFrequency;
  const accrualAmount = num(formData, "accrual_amount") ?? 0;
  const approvalLevels = Number(str(formData, "approval_levels") || "1");

  const supabase = await createClient();
  const { error } = await supabase.from("leave_policies").insert({
    organization_id: g.orgId,
    leave_type_id: leaveTypeId,
    name,
    effective_from: effectiveFrom,
    effective_to: str(formData, "effective_to") || null,
    accrual_frequency: accrualFrequency,
    accrual_amount: accrualAmount,
    carryover_max: num(formData, "carryover_max"),
    proration: bool(formData, "proration"),
    min_notice_days: num(formData, "min_notice_days") ?? 0,
    max_consecutive_days: num(formData, "max_consecutive_days"),
    allow_half_days: bool(formData, "allow_half_days"),
    allow_negative_balance: bool(formData, "allow_negative_balance"),
    approval_levels: Math.min(Math.max(approvalLevels, 1), 3),
  });
  if (error) return { error: traduire(error.message) };

  refresh();
  return { success: `Politique « ${name} » créée.` };
}

export async function deleteLeavePolicy(id: string): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_policies")
    .delete()
    .eq("id", id)
    .eq("organization_id", g.orgId);
  if (error) return { error: traduire(error.message) };

  refresh();
  return { success: "Politique supprimée." };
}

// =============================================================================
// Calendriers de travail
// =============================================================================
export async function updateSchedule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const id = str(formData, "id");
  if (!id) return { error: "Calendrier introuvable." };

  // Jours travaillés : cases cochées, avec amplitude et pause
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const pattern: Record<string, { start: string; end: string } | null> = {};
  for (const day of days) {
    if (bool(formData, `day_${day}`)) {
      pattern[day] = {
        start: str(formData, `start_${day}`) || "08:00",
        end: str(formData, `end_${day}`) || "17:00",
      };
    } else {
      pattern[day] = null;
    }
  }

  if (!days.some((d) => pattern[d] !== null)) {
    return { error: "Sélectionnez au moins un jour travaillé." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("work_schedules")
    .update({
      name: str(formData, "name") || "Calendrier",
      daily_hours: num(formData, "daily_hours") ?? 8,
      break_minutes: num(formData, "break_minutes") ?? 60,
      weekly_pattern: pattern,
    })
    .eq("id", id)
    .eq("organization_id", g.orgId);
  if (error) return { error: traduire(error.message) };

  refresh();
  return { success: "Calendrier mis à jour." };
}
