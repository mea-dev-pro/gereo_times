"use client";

import { useState, useTransition } from "react";
import {
  resendInvitation,
  revokeInvitation,
  setMemberStatus,
  updateMemberRole,
} from "@/lib/actions/team";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import type { OrgRole } from "@/types/database";
import { ActivationLink } from "./invite-form";

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

/**
 * Actions d'une invitation en attente : renvoyer le lien, ou révoquer.
 *
 * Le renvoi régénère un lien à chaque appel (Supabase n'en conserve aucun) et
 * l'expédie. Si l'envoi automatique est désactivé ou échoue, le lien apparaît
 * ici, à transmettre à la main — l'invitation n'est jamais bloquée.
 */
export function InvitationActions({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  return (
    <div className="flex max-w-[22rem] flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`Renvoyer le lien d'activation à ${email}`}
          onClick={() =>
            startTransition(async () => {
              setState(await resendInvitation(invitationId));
            })
          }
        >
          {pending ? "…" : "Renvoyer le lien"}
        </Button>
        <RevokeInvitationButton invitationId={invitationId} />
      </div>

      {state?.success && (
        <p className="text-right text-xs text-emerald-800">{state.success}</p>
      )}
      {state?.notice && (
        <p className="text-right text-xs text-content-muted">{state.notice}</p>
      )}
      {state?.error && (
        <p className="text-right text-xs text-red-600">{state.error}</p>
      )}
      {state?.link && <ActivationLink url={state.link} />}
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
