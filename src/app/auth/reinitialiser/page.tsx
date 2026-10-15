"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  adoptHashSession,
  attendreSession,
  messageErreurFragment,
  useErreurFragment,
} from "@/lib/auth/lien-session";
import { Alert } from "@/components/ui/alert";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { NouveauMotDePasseForm } from "./nouveau-mot-de-passe-form";

/**
 * Point d'arrivée du lien de réinitialisation.
 *
 * La page n'est pas protégée : c'est le lien qui ouvre la session, à la manière
 * d'une invitation. Le formulaire de nouveau mot de passe passe donc par l'API
 * du navigateur et non par une action serveur — une action posterait vers
 * `/auth/reinitialiser`, que le middleware redirige vers l'accueil dès qu'une
 * session existe (route publique), et la modification n'aurait jamais lieu.
 */

const DEMANDER_UN_LIEN = "Demandez un nouveau lien de réinitialisation.";

export default function ReinitialiserPage() {
  const [erreurSession, setErreurSession] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const erreurFragment = useErreurFragment(DEMANDER_UN_LIEN);
  const erreur = erreurFragment ?? erreurSession;

  useEffect(() => {
    const supabase = createClient();

    // Un fragment porteur d'erreur prime : inutile d'ouvrir une session.
    if (messageErreurFragment(DEMANDER_UN_LIEN)) return;

    (async () => {
      // 1. Jetons dans le fragment (flux implicite)
      if (await adoptHashSession(supabase)) {
        setOuvert(true);
        return;
      }
      // 2. Code d'échange traité par le client, ou session déjà en cookies
      if (await attendreSession(supabase)) {
        setOuvert(true);
        return;
      }
      setErreurSession(
        "Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation."
      );
    })();
  }, []);

  return (
    <AuthShell
      footer={
        <Link
          href="/connexion"
          className="font-medium text-brand-strong hover:underline"
        >
          Retour à la connexion
        </Link>
      }
    >
      {erreur ? (
        <>
          <Alert variant="danger" title="Lien inutilisable">
            {erreur}
          </Alert>
          <p className="mt-4 text-center text-sm text-content-muted">
            <Link
              href="/mot-de-passe-oublie"
              className="font-medium text-brand-strong hover:underline"
            >
              Demander un nouveau lien
            </Link>
          </p>
        </>
      ) : ouvert ? (
        <AuthCard
          title="Nouveau mot de passe"
          description="Choisissez le mot de passe qui remplacera l'ancien."
        >
          <NouveauMotDePasseForm />
        </AuthCard>
      ) : (
        <AuthCard title="Réinitialisation">
          <p className="text-sm text-content-muted">
            Vérification de votre lien en cours…
          </p>
          <div
            className="mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted"
            role="status"
            aria-label="Traitement en cours"
          >
            <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-strong" />
          </div>
        </AuthCard>
      )}
    </AuthShell>
  );
}
