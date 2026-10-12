"use client";

import { useActionState } from "react";
import { createOrganization, type ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createOrganization,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}

      <div>
        <Label htmlFor="organization_name">Nom de l&apos;organisation</Label>
        <Input
          id="organization_name"
          name="organization_name"
          required
          placeholder="Acme SARL"
          autoFocus
        />
      </div>

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Création…" : "Créer l'organisation"}
      </Button>
    </form>
  );
}
