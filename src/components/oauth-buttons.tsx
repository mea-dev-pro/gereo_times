"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { nomFournisseur, type Fournisseur } from "@/lib/auth/fournisseurs";

/**
 * Connexion par un fournisseur d'identité tiers.
 *
 * Les fournisseurs listés sont ceux que Supabase déclare actifs (voir
 * `lib/auth/fournisseurs`) : aucun bouton sans effet n'est affiché.
 *
 * L'adresse de retour est construite sur l'origine réellement visitée — c'est
 * le même principe que les liens reçus par courriel, et la raison pour laquelle
 * `/auth/callback` doit figurer dans la liste blanche du projet.
 */
export function OAuthButtons({
  fournisseurs,
  suivant = "/",
}: {
  fournisseurs: Fournisseur[];
  suivant?: string;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<Fournisseur | null>(null);

  if (fournisseurs.length === 0) return null;

  async function continuer(fournisseur: Fournisseur) {
    setErreur(null);
    setEnCours(fournisseur);

    const supabase = createClient();
    const retour = new URL("/auth/callback", window.location.origin);
    if (suivant.startsWith("/")) retour.searchParams.set("suivant", suivant);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: fournisseur,
      options: { redirectTo: retour.toString() },
    });

    // En cas de succès, le navigateur part chez le fournisseur : la ligne
    // suivante n'est atteinte que si le départ a échoué.
    setEnCours(null);
    if (error) {
      setErreur(
        `La connexion avec ce fournisseur n'a pas pu démarrer : ${error.message}`
      );
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-content-subtle">
          ou
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {erreur && <Alert variant="danger">{erreur}</Alert>}

      <div className="space-y-2">
        {fournisseurs.map((id) => {
          const nom = nomFournisseur(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => continuer(id)}
              disabled={enCours !== null}
              className="flex h-10 w-full items-center justify-center rounded-control border border-border-strong bg-surface text-sm font-medium text-content transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
            >
              {enCours === id ? `Ouverture…` : `Continuer avec ${nom}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
