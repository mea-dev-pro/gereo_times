"use client";

import { useActionState } from "react";
import { signUp, type ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signUp,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert variant="danger">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="full_name">Nom complet</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          autoComplete="name"
          placeholder="Rasoa Andrianina"
        />
      </div>

      <div>
        <Label htmlFor="organization_name">Nom de l&apos;organisation</Label>
        <Input
          id="organization_name"
          name="organization_name"
          required
          placeholder="Acme SARL"
        />
        <p className="mt-1.5 text-xs text-content-muted">
          Vous en serez l&apos;administrateur. Un calendrier de travail, cinq
          types de congés et les jours fériés seront créés automatiquement.
        </p>
      </div>

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

      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
        <p className="mt-1.5 text-xs text-content-muted">6 caractères minimum.</p>
      </div>

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Création…" : "Créer mon organisation"}
      </Button>
    </form>
  );
}
