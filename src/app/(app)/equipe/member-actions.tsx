"use client";

import { useState, useTransition } from "react";
import {
  revokeInvitation,
  setMemberStatus,
  updateMemberRole,
} from "@/lib/actions/team";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import type { OrgRole } from "@/types/database";

const ROLES: { value: OrgRole; label: string }[] = [
  { value: "employee", label: "Employé" },
  { value: "manager", label: "Manager" },
  { value: "hr", label: "RH" },
  { value: "admin", label: "Administrateur" },
];

function Feedback({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <p className="mt-1 max-w-[18rem] text-right text-xs text-red-600">
      {state.error}
    </p>
  );
}

export function MemberRowActions({
  memberId,
  role,
  active,
  isSelf,
}: {
  memberId: string;
  role: OrgRole;
  active: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [currentRole, setCurrentRole] = useState<OrgRole>(role);

  if (isSelf) {
    return (
      <span className="text-xs text-content-subtle">Vous-même</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Rôle du collaborateur"
          className="h-8 w-36 py-0 text-xs"
          value={currentRole}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as OrgRole;
            setCurrentRole(next);
            startTransition(async () => {
              setState(await updateMemberRole(memberId, next));
            });
          }}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>

        <Button
          variant={active ? "ghost" : "success"}
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setState(await setMemberStatus(memberId, !active));
            })
          }
        >
          {pending ? "…" : active ? "Désactiver" : "Réactiver"}
        </Button>
      </div>
      <Feedback state={state} />
    </div>
  );
}

export function RevokeInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setState(await revokeInvitation(invitationId));
          })
        }
      >
        {pending ? "…" : "Révoquer"}
      </Button>
      <Feedback state={state} />
    </div>
  );
}
