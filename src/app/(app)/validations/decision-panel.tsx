"use client";

import { useState, useTransition } from "react";
import { decideLeaveRequest } from "@/lib/actions/leave";
import { decideAdjustment } from "@/lib/actions/time";
import type { ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export function DecisionPanel({
  id,
  kind,
}: {
  id: string;
  kind: "leave" | "adjustment";
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [comment, setComment] = useState("");

  function decide(approve: boolean) {
    startTransition(async () => {
      const res =
        kind === "leave"
          ? await decideLeaveRequest(id, approve, comment)
          : await decideAdjustment(id, approve, comment);
      setState(res);
    });
  }

  if (state?.success) {
    return <Alert variant="success">{state.success}</Alert>;
  }

  return (
    <div className="space-y-2">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      <Input
        placeholder="Commentaire (obligatoire en cas de refus)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
      />
      <div className="flex gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={pending}
          onClick={() => decide(true)}
        >
          {pending ? "…" : "Approuver"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || comment.trim().length === 0}
          onClick={() => decide(false)}
          title={
            comment.trim().length === 0
              ? "Un motif de refus est requis"
              : undefined
          }
        >
          Refuser
        </Button>
      </div>
    </div>
  );
}
