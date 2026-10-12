"use client";

import { useState, useTransition } from "react";
import { cancelLeaveRequest } from "@/lib/actions/leave";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function CancelLeaveButton({
  requestId,
  disabled,
}: {
  requestId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending || disabled}
        onClick={() => {
          const reason = window.prompt(
            "Motif de l'annulation (facultatif) :"
          );
          if (reason === null) return;
          startTransition(async () => {
            setState(await cancelLeaveRequest(requestId, reason));
          });
        }}
      >
        {pending ? "…" : "Annuler"}
      </Button>
      {state?.error && (
        <span className="max-w-[16rem] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </div>
  );
}
