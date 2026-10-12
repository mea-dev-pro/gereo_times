"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ id, link }: { id: string; link?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  const mark = () =>
    startTransition(async () => setState(await markNotificationRead(id)));

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {link && (
        <Link
          href={link}
          className="text-xs font-medium text-blue-600 hover:underline"
          onClick={mark}
        >
          Ouvrir
        </Link>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={mark}>
        {pending ? "…" : "Marquer comme lue"}
      </Button>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </div>
  );
}

export function MarkAllReadButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (count === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () =>
            setState(await markAllNotificationsRead())
          )
        }
      >
        {pending ? "…" : `Tout marquer comme lu (${count})`}
      </Button>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </div>
  );
}
