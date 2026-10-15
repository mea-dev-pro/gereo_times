"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import {
  FOURNISSEURS,
  nomFournisseur,
  type Fournisseur,
} from "@/lib/auth/fournisseurs";
import { MarqueFournisseur } from "@/components/marques-fournisseurs";

/**
 * Connexion par un fournisseur d'identité tiers.
 *
 * Les trois fournisseurs sont toujours affichés — c'est la composition de la
 * maquette — mais seuls ceux que Supabase déclare actifs sont cliquables (voir
 * `lib/data/fournisseurs`). Les autres sont **désactivés**, avec la mention
 * « bientôt » : un bouton qui ne fait rien est un défaut, un bouton grisé qui
 * dit pourquoi est une information. Activer un fournisseur dans Supabase suffit
 * à rendre le sien actif, sans toucher à ce fichier.
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
        {FOURNISSEURS.map(({ id }) => {
          const nom = nomFournisseur(id);
          const actif = fournisseurs.includes(id);
          const libelle = enCours === id ? "Ouverture…" : `Continuer avec ${nom}`;

          return (
            <button
              key={id}
              type="button"
              onClick={() => continuer(id)}
              disabled={!actif || enCours !== null}
              // Le nom accessible porte la raison : sans cela, un lecteur
              // d'écran annonce un bouton désactivé sans dire pourquoi.
              aria-label={actif ? libelle : `${libelle} (bientôt disponible)`}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-control border border-border-strong bg-surface text-sm font-medium text-content transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <MarqueFournisseur fournisseur={id} />
              <span className={actif ? undefined : "text-content-muted"}>
                {libelle}
              </span>
              {!actif ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-subtle">
                  bientôt
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
