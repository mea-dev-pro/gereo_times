"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createDepartment,
  createHoliday,
  createLeavePolicy,
  createLeaveType,
  deleteDepartment,
  deleteHoliday,
  deleteLeavePolicy,
  toggleLeaveType,
  updateSchedule,
} from "@/lib/actions/admin";
import type { ActionState } from "@/lib/auth/actions";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/types/database";

type DayPattern = { start?: string; end?: string } | null;

const WEEK: { key: string; label: string }[] = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

/** Bouton déclenchant une action serveur sans formulaire. */
function ActionButton({
  run,
  label,
  variant = "ghost",
}: {
  run: () => Promise<ActionState>;
  label: string;
  variant?: "ghost" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await run()))}
      >
        {pending ? "…" : label}
      </Button>
      {state?.error && (
        <span className="max-w-[16rem] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </div>
  );
}

// =============================================================================
export function DepartmentSection({
  departments,
  memberCounts,
}: {
  departments: Tables<"departments">[];
  memberCounts: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createDepartment,
    null
  );

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      {departments.length === 0 ? (
        <EmptyState
          title="Aucun département"
          description="Structurez votre organisation en départements."
        />
      ) : (
        <ul className="divide-y divide-border">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium text-content">{d.name}</p>
                <p className="text-xs text-content-muted">
                  {d.code ? `${d.code} · ` : ""}
                  {memberCounts[d.id] ?? 0} membre(s)
                </p>
              </div>
              <ActionButton
                label="Supprimer"
                run={() => deleteDepartment(d.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div className="flex-1 min-w-40">
          <Label htmlFor="dept-name">Nom</Label>
          <Input id="dept-name" name="name" required placeholder="Production" />
        </div>
        <div className="w-28">
          <Label htmlFor="dept-code">Code</Label>
          <Input id="dept-code" name="code" placeholder="PROD" />
        </div>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "…" : "Ajouter"}
        </Button>
      </form>
    </div>
  );
}

// =============================================================================
export function HolidaySection({
  holidays,
}: {
  holidays: Tables<"holidays">[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createHoliday,
    null
  );

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      {holidays.length === 0 ? (
        <EmptyState title="Aucun jour férié" />
      ) : (
        <ul className="divide-y divide-border">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium text-content">{h.name}</p>
                <p className="text-xs text-content-muted">
                  {formatDate(h.holiday_date)}
                  {h.is_recurring ? " · tous les ans" : ""}
                </p>
              </div>
              <ActionButton label="Supprimer" run={() => deleteHoliday(h.id)} />
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div className="flex-1 min-w-40">
          <Label htmlFor="hol-name">Nom</Label>
          <Input id="hol-name" name="name" required placeholder="Fête nationale" />
        </div>
        <div className="w-44">
          <Label htmlFor="hol-date">Date</Label>
          <Input id="hol-date" name="holiday_date" type="date" required />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-content-muted">
          <input type="checkbox" name="is_recurring" className="h-4 w-4 rounded" />
          Chaque année
        </label>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "…" : "Ajouter"}
        </Button>
      </form>
    </div>
  );
}

// =============================================================================
export function LeaveTypeSection({
  types,
  policyCounts,
}: {
  types: Tables<"leave_types">[];
  policyCounts: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLeaveType,
    null
  );
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <ul className="divide-y divide-border">
        {types.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-content">
                  {t.name}{" "}
                  <span className="font-mono text-xs text-content-subtle">{t.code}</span>
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <Badge tone={t.is_paid ? "success" : "neutral"}>
                    {t.is_paid ? "rémunéré" : "non rémunéré"}
                  </Badge>
                  {t.requires_justification && (
                    <Badge tone="warning">justificatif</Badge>
                  )}
                  <Badge tone="info">
                    {policyCounts[t.id] ?? 0} politique(s)
                  </Badge>
                  {!t.active && <Badge tone="danger">désactivé</Badge>}
                </div>
              </div>
            </div>
            <ActionButton
              label={t.active ? "Désactiver" : "Réactiver"}
              run={() => toggleLeaveType(t.id, !t.active)}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Annuler" : "Ajouter un type de congé"}
        </Button>
      </div>

      {open && (
        <form action={formAction} className="grid gap-3 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lt-name">Libellé</Label>
            <Input id="lt-name" name="name" required placeholder="Congé sabbatique" />
          </div>
          <div>
            <Label htmlFor="lt-code">Code</Label>
            <Input id="lt-code" name="code" required placeholder="SABBATIQUE" />
          </div>
          <div>
            <Label htmlFor="lt-color">Couleur</Label>
            <Input id="lt-color" name="color" type="color" defaultValue="#2563eb" />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-content-muted">
              <input type="checkbox" name="is_paid" defaultChecked className="h-4 w-4 rounded" />
              Rémunéré
            </label>
            <label className="flex items-center gap-2 text-sm text-content-muted">
              <input type="checkbox" name="requires_justification" className="h-4 w-4 rounded" />
              Justificatif obligatoire
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "…" : "Créer le type"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// =============================================================================
export function LeavePolicySection({
  policies,
  types,
}: {
  policies: Tables<"leave_policies">[];
  types: Tables<"leave_types">[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLeavePolicy,
    null
  );
  const [open, setOpen] = useState(false);
  const typeById = new Map(types.map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      {policies.length === 0 ? (
        <EmptyState
          title="Aucune politique"
          description="Sans politique, aucune demande de congé n'est acceptée : le solde et le préavis en dépendent."
        />
      ) : (
        <ul className="divide-y divide-border">
          {policies.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-content">
                  {typeById.get(p.leave_type_id)?.name ?? "Type inconnu"} — {p.name}
                </p>
                <p className="mt-0.5 text-xs text-content-muted">
                  effet le {formatDate(p.effective_from)}
                  {p.effective_to ? ` → ${formatDate(p.effective_to)}` : ""} ·{" "}
                  {p.accrual_frequency === "none"
                    ? "sans acquisition"
                    : `${Number(p.accrual_amount)} j ${p.accrual_frequency === "monthly" ? "par mois" : p.accrual_frequency === "quarterly" ? "par trimestre" : "par an"}`}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">
                    {p.approval_levels} niveau(x) de validation
                  </Badge>
                  {p.min_notice_days > 0 && (
                    <Badge tone="info">préavis {p.min_notice_days} j</Badge>
                  )}
                  {p.allow_half_days ? (
                    <Badge tone="success">demi-journées</Badge>
                  ) : (
                    <Badge tone="neutral">journées entières</Badge>
                  )}
                  {p.allow_negative_balance && (
                    <Badge tone="warning">solde négatif autorisé</Badge>
                  )}
                </div>
              </div>
              <ActionButton
                label="Supprimer"
                run={() => deleteLeavePolicy(p.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Annuler" : "Ajouter une politique"}
        </Button>
      </div>

      {open && (
        <form action={formAction} className="grid gap-3 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lp-type">Type de congé</Label>
            <Select id="lp-type" name="leave_type_id" required>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="lp-name">Libellé de la politique</Label>
            <Input id="lp-name" name="name" required defaultValue="Politique par défaut" />
          </div>
          <div>
            <Label htmlFor="lp-from">Date d&apos;effet</Label>
            <Input id="lp-from" name="effective_from" type="date" required />
          </div>
          <div>
            <Label htmlFor="lp-to">Fin (facultatif)</Label>
            <Input id="lp-to" name="effective_to" type="date" />
          </div>
          <div>
            <Label htmlFor="lp-freq">Fréquence d&apos;acquisition</Label>
            <Select id="lp-freq" name="accrual_frequency" defaultValue="monthly">
              <option value="none">Aucune</option>
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
              <option value="yearly">Annuelle</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="lp-amount">Jours acquis par période</Label>
            <Input id="lp-amount" name="accrual_amount" type="number" step="0.25" min="0" defaultValue="2.5" />
          </div>
          <div>
            <Label htmlFor="lp-carry">Report maximum (jours)</Label>
            <Input id="lp-carry" name="carryover_max" type="number" step="0.5" min="0" />
          </div>
          <div>
            <Label htmlFor="lp-notice">Préavis minimum (jours)</Label>
            <Input id="lp-notice" name="min_notice_days" type="number" min="0" defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="lp-max">Durée maximale (jours)</Label>
            <Input id="lp-max" name="max_consecutive_days" type="number" min="1" />
          </div>
          <div>
            <Label htmlFor="lp-levels">Niveaux de validation</Label>
            <Select id="lp-levels" name="approval_levels" defaultValue="1">
              <option value="1">1 niveau</option>
              <option value="2">2 niveaux</option>
              <option value="3">3 niveaux</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-content-muted">
              <input type="checkbox" name="allow_half_days" defaultChecked className="h-4 w-4 rounded" />
              Autoriser les demi-journées
            </label>
            <label className="flex items-center gap-2 text-sm text-content-muted">
              <input type="checkbox" name="proration" defaultChecked className="h-4 w-4 rounded" />
              Proratiser l&apos;acquisition à l&apos;entrée
            </label>
            <label className="flex items-center gap-2 text-sm text-content-muted">
              <input type="checkbox" name="allow_negative_balance" className="h-4 w-4 rounded" />
              Autoriser un solde négatif
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "…" : "Créer la politique"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// =============================================================================
export function ScheduleSection({
  schedules,
}: {
  schedules: Tables<"work_schedules">[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSchedule,
    null
  );

  if (schedules.length === 0) {
    return <EmptyState title="Aucun calendrier de travail" />;
  }

  return (
    <div className="space-y-6">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      {schedules.map((s) => {
        const pattern = (s.weekly_pattern ?? {}) as Record<string, DayPattern>;
        return (
          <form
            key={s.id}
            action={formAction}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <input type="hidden" name="id" value={s.id} />

            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-40 flex-1">
                <Label htmlFor={`name-${s.id}`}>Nom du calendrier</Label>
                <Input id={`name-${s.id}`} name="name" defaultValue={s.name} />
              </div>
              {s.is_default && <Badge tone="brand">par défaut</Badge>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`dh-${s.id}`}>Heures par jour</Label>
                <Input
                  id={`dh-${s.id}`}
                  name="daily_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  defaultValue={Number(s.daily_hours)}
                />
              </div>
              <div>
                <Label htmlFor={`bm-${s.id}`}>Pause (minutes)</Label>
                <Input
                  id={`bm-${s.id}`}
                  name="break_minutes"
                  type="number"
                  min="0"
                  defaultValue={s.break_minutes}
                />
              </div>
            </div>

            <div>
              <Label>Jours travaillés</Label>
              <div className="space-y-2">
                {WEEK.map((d) => {
                  const day = pattern[d.key];
                  const worked = day !== null && day !== undefined;
                  return (
                    <div
                      key={d.key}
                      // Sans retour à la ligne, libellé + deux champs d'heure
                      // dépassaient la largeur d'un téléphone. Sous sm, le
                      // libellé prend sa propre ligne.
                      className="flex flex-wrap items-center gap-2 sm:gap-3"
                    >
                      <label className="flex w-full items-center gap-2 text-sm text-content-muted sm:w-28">
                        <input
                          type="checkbox"
                          name={`day_${d.key}`}
                          defaultChecked={worked}
                          className="h-4 w-4 rounded"
                        />
                        {d.label}
                      </label>
                      <Input
                        aria-label={`Début ${d.label}`}
                        name={`start_${d.key}`}
                        type="time"
                        className="h-8 w-28"
                        defaultValue={day?.start ?? "08:00"}
                      />
                      <span className="text-xs text-content-subtle">→</span>
                      <Input
                        aria-label={`Fin ${d.label}`}
                        name={`end_${d.key}`}
                        type="time"
                        className="h-8 w-28"
                        defaultValue={day?.end ?? "17:00"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" variant="brand" size="sm" disabled={pending}>
              {pending ? "…" : "Enregistrer"}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
