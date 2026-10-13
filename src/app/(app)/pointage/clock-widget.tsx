"use client";

import { useState, useTransition } from "react";
import {
  clockIn,
  clockOut,
  endBreak,
  startBreak,
} from "@/lib/actions/time";
import type { ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export function ClockWidget({
  isOpen,
  isOnBreak,
  clockedInAt,
}: {
  isOpen: boolean;
  isOnBreak: boolean;
  clockedInAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [note, setNote] = useState("");

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      setState(await fn());
    });
  }

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {!isOpen ? (
          <Button
            variant="success"
            size="lg"
            disabled={pending}
            onClick={() => run(() => clockIn())}
          >
            {pending ? "…" : "Pointer l'arrivée"}
          </Button>
        ) : (
          <>
            <Button
              variant="danger"
              size="lg"
              disabled={pending}
              onClick={() => run(() => (isOnBreak ? endBreak() : startBreak()))}
            >
              {pending
                ? "…"
                : isOnBreak
                  ? "Terminer la pause"
                  : "Démarrer une pause"}
            </Button>
          </>
        )}
      </div>

      {isOpen && (
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <p className="mb-2 text-sm text-content-muted">
            Session ouverte depuis{" "}
            <strong className="text-content">
              {clockedInAt
                ? new Date(clockedInAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </strong>
            {isOnBreak && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                en pause
              </span>
            )}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="Note de fin de journée (facultatif)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
              />
            </div>
            <Button
              variant="default"
              disabled={pending}
              onClick={() => run(() => clockOut(note))}
            >
              {pending ? "…" : "Pointer la sortie"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
