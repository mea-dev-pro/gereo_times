"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

/** Longueur minimale : même seuil que l'inscription et l'API d'authentification. */
const MINIMUM = 6;

/** Traductions locales : `lib/auth/actions` est un module serveur. */
const MESSAGES: [RegExp, string][] = [
  [
    /should be at least|password.*too short/i,
    "Le mot de passe doit contenir au moins 6 caractères.",
  ],
  [
    /should be different|same as the old/i,
    "Le nouveau mot de passe doit être différent de l'ancien.",
  ],
  [
    /rate limit|too many/i,
    "Trop de tentatives. Réessayez dans quelques minutes.",
  ],
  [
    /auth session missing|not authenticated|invalid.*token/i,
    "Votre session a expiré. Ouvrez de nouveau le lien reçu par courriel.",
  ],
];

function traduire(message: string): string {
  for (const [motif, texte] of MESSAGES) {
    if (motif.test(message)) return texte;
  }
  return message;
}

export function NouveauMotDePasseForm() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const motDePasse = String(donnees.get("password") ?? "");
    const confirmation = String(donnees.get("confirmation") ?? "");

    // Les mêmes contrôles que côté serveur à l'inscription, faits ici pour
    // éviter un aller-retour réseau inutile.
    if (motDePasse.length < MINIMUM) {
      setErreur(`Le mot de passe doit contenir au moins ${MINIMUM} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux saisies ne correspondent pas.");
      return;
    }

    setErreur(null);
    setEnvoi(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setEnvoi(false);

    if (error) {
      setErreur(traduire(error.message));
      return;
    }
    setFait(true);
  }

  if (fait) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title="Mot de passe modifié">
          Il remplace désormais l&apos;ancien. Vos autres sessions restent
          ouvertes.
        </Alert>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "brand" }), "w-full")}
        >
          Aller à mon espace
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="space-y-4">
      {erreur && <Alert variant="danger">{erreur}</Alert>}

      <div>
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={MINIMUM}
          autoComplete="new-password"
        />
      </div>

      <div>
        <Label htmlFor="confirmation">Confirmation</Label>
        <PasswordInput
          id="confirmation"
          name="confirmation"
          required
          minLength={MINIMUM}
          autoComplete="new-password"
        />
      </div>

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={envoi}
      >
        {envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
