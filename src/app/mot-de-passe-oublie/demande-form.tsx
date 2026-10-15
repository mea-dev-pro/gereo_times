"use client";

import { useActionState } from "react";
import {
  demanderReinitialisation,
  type ActionState,
} from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function DemandeForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    demanderReinitialisation,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@entreprise.mg"
        />
      </div>

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Envoi…" : "Envoyer le lien"}
      </Button>

      <p className="text-xs text-content-muted">
        Le lien reçu est valable une heure et ne peut servir qu&apos;une fois.
      </p>
    </form>
  );
}
