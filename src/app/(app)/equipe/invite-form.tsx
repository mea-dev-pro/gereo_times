"use client";

import { useActionState, useState } from "react";
import { inviteMember } from "@/lib/actions/team";
import type { ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";

export type ManagerOption = { id: string; label: string };

const ROLES = [
  { value: "employee", label: "Employé" },
  { value: "manager", label: "Manager" },
  { value: "hr", label: "RH" },
  { value: "admin", label: "Administrateur" },
];

function ActivationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-emerald-800">
        Lien d&apos;activation à transmettre au collaborateur
      </p>
      <code className="block max-h-24 overflow-auto break-all rounded bg-surface-muted p-2 text-xs text-content">
        {url}
      </code>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copié" : "Copier le lien"}
      </Button>
      <p className="mt-2 text-xs text-content-muted">
        Aucun mot de passe ne transite : le collaborateur définit le sien en
        ouvrant ce lien.
      </p>
    </div>
  );
}

export function InviteForm({ managers }: { managers: ManagerOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    inviteMember,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && (
        <div>
          <Alert variant="success">{state.success}</Alert>
          {state.link && <ActivationLink url={state.link} />}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="collaborateur@entreprise.mg"
          />
        </div>

        <div>
          <Label htmlFor="role">Rôle</Label>
          <Select id="role" name="role" defaultValue="employee">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="job_title">Intitulé de poste</Label>
          <Input
            id="job_title"
            name="job_title"
            placeholder="Assistante administrative"
          />
        </div>

        <div>
          <Label htmlFor="manager_id">Responsable</Label>
          <Select id="manager_id" name="manager_id" defaultValue="">
            <option value="">Aucun</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="hire_date">Date d&apos;entrée</Label>
          <Input id="hire_date" name="hire_date" type="date" />
        </div>
      </div>

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Invitation…" : "Inviter ce collaborateur"}
      </Button>
    </form>
  );
}
