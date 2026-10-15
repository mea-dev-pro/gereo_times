"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({
  next,
  erreurInitiale,
}: {
  next: string;
  /** Motif d'échec renvoyé par un fournisseur d'identité, s'il y en a un. */
  erreurInitiale?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signIn,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state?.error ? (
        <Alert variant="danger">{state.error}</Alert>
      ) : erreurInitiale ? (
        <Alert variant="danger">{erreurInitiale}</Alert>
      ) : null}
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

      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </div>

      {/* Placé avant le bouton, comme « Having trouble in sign in? » de la
          maquette de référence. */}
      <p>
        <Link
          href="/mot-de-passe-oublie"
          className="text-xs font-medium text-brand-strong hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </p>

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
