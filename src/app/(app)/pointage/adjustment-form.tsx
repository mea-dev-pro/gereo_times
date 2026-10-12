"use client";

import { useActionState, useState } from "react";
import { requestAdjustment } from "@/lib/actions/time";
import type { ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";

export type AdjustableEntry = {
  id: string;
  work_date: string;
  clock_in: string;
  clock_out: string;
};

function localTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AdjustmentForm({ entries }: { entries: AdjustableEntry[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestAdjustment,
    null
  );
  const [entryId, setEntryId] = useState(entries[0]?.id ?? "");

  const selected = entries.find((e) => e.id === entryId);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun pointage clôturé à corriger pour le moment.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="time_entry_id">Pointage à corriger</Label>
        <Select
          id="time_entry_id"
          name="time_entry_id"
          value={entryId}
          onChange={(e) => setEntryId(e.target.value)}
          required
        >
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {new Date(e.work_date + "T00:00:00").toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })}{" "}
              · {localTime(e.clock_in)} → {localTime(e.clock_out)}
            </option>
          ))}
        </Select>
        <input type="hidden" name="date" value={selected?.work_date ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="new_in">Heure d&apos;arrivée corrigée</Label>
          <Input
            id="new_in"
            name="new_in"
            type="time"
            defaultValue={selected ? localTime(selected.clock_in) : ""}
            key={`in-${entryId}`}
          />
        </div>
        <div>
          <Label htmlFor="new_out">Heure de sortie corrigée</Label>
          <Input
            id="new_out"
            name="new_out"
            type="time"
            defaultValue={selected ? localTime(selected.clock_out) : ""}
            key={`out-${entryId}`}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reason">Motif de la correction</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          minLength={5}
          placeholder="Oubli de pointage, panne de badge, mission extérieure…"
        />
      </div>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Envoi…" : "Demander la correction"}
      </Button>
      <p className="text-xs text-slate-500">
        La correction doit être approuvée par votre manager. Un pointage clôturé
        ne peut pas être modifié directement.
      </p>
    </form>
  );
}
