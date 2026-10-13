"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { estimateLeaveDays, submitLeaveRequest } from "@/lib/actions/leave";
import type { ActionState } from "@/lib/auth/actions";
import type { HalfDay } from "@/types/database";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";

export type LeaveTypeOption = {
  id: string;
  name: string;
  requires_justification: boolean;
};

export function LeaveRequestForm({ types }: { types: LeaveTypeOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitLeaveRequest,
    null
  );

  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startHalf, setStartHalf] = useState("");
  const [endHalf, setEndHalf] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [estimating, startEstimate] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!leaveTypeId || !startDate || !endDate || endDate < startDate) {
      setDays(null);
      return;
    }
    startEstimate(async () => {
      const res = await estimateLeaveDays(
        leaveTypeId,
        startDate,
        endDate,
        (startHalf || null) as HalfDay | null,
        (endHalf || null) as HalfDay | null
      );
      setDays(res.days ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveTypeId, startDate, endDate, startHalf, endHalf]);

  const selectedType = types.find((t) => t.id === leaveTypeId);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="leave_type_id">Type de congé</Label>
        <Select
          id="leave_type_id"
          name="leave_type_id"
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          required
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start_date">Du</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            min={today}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor="end_date">Au</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            min={startDate || today}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start_half">Début</Label>
          <Select
            id="start_half"
            name="start_half"
            value={startHalf}
            onChange={(e) => setStartHalf(e.target.value)}
          >
            <option value="">Journée complète</option>
            <option value="am">Matin uniquement</option>
            <option value="pm">Après-midi uniquement</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="end_half">Fin</Label>
          <Select
            id="end_half"
            name="end_half"
            value={endHalf}
            onChange={(e) => setEndHalf(e.target.value)}
          >
            <option value="">Journée complète</option>
            <option value="am">Matin uniquement</option>
            <option value="pm">Après-midi uniquement</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="reason">
          Motif
          {selectedType?.requires_justification && (
            <span className="ml-1 text-xs font-normal text-red-600">
              (justificatif requis)
            </span>
          )}
        </Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="Précisez si nécessaire"
          required={selectedType?.requires_justification}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-4 py-3">
        <span className="text-sm text-content-muted">Jours ouvrés décomptés</span>
        <span className="text-lg font-semibold text-content">
          {estimating
            ? "…"
            : days === null
              ? "—"
              : `${days.toFixed(2).replace(".", ",")} j`}
        </span>
      </div>
      <p className="-mt-2 text-xs text-content-muted">
        Week-ends et jours fériés de votre organisation exclus.
      </p>

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Envoi…" : "Soumettre la demande"}
      </Button>
    </form>
  );
}
