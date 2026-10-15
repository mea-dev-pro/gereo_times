"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  adoptHashSession,
  attendreSession,
  messageErreurFragment,
  useErreurFragment,
} from "@/lib/auth/lien-session";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth-shell";

/**
 * Point d'arrivée des liens d'activation (invitation) et de connexion.
 *
 * Le traitement du lien lui-même — jetons du fragment, code d'échange PKCE,
 * message d'échec — vit dans `lib/auth/lien-session` : la page de
 * réinitialisation de mot de passe s'appuie sur les mêmes fonctions.
 */

const DEMANDER_UNE_INVITATION = "Demandez une nouvelle invitation.";

export default function ConfirmerPage() {
  const router = useRouter();
  const [erreurSession, setErreurSession] = useState<string | null>(null);
  const erreurFragment = useErreurFragment(DEMANDER_UNE_INVITATION);
  const error = erreurFragment ?? erreurSession;

  useEffect(() => {
    const supabase = createClient();
    let finished = false;

    // Un fragment porteur d'erreur prime : inutile d'ouvrir une session.
    if (messageErreurFragment(DEMANDER_UNE_INVITATION)) return;

    const go = () => {
      if (finished) return;
      finished = true;
      router.replace("/organisation/nouvelle");
      router.refresh();
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) go();
      }
    );

    (async () => {
      // 1. Jetons dans le fragment (liens d'invitation, flux implicite)
      if (await adoptHashSession(supabase)) {
        go();
        return;
      }

      // 2. Code d'échange ou session déjà en cookies (flux PKCE)
      if (await attendreSession(supabase)) {
        go();
        return;
      }

      if (!finished) {
        setErreurSession(
          "Ce lien est invalide ou a expiré. Demandez une nouvelle invitation à votre administrateur."
        );
      }
    })();

    return () => subscription.subscription.unsubscribe();
  }, [router]);

  return (
    <AuthShell
      action={
        <Link
          href="/connexion"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Se connecter
        </Link>
      }
    >
      {error ? (
        <AuthCard title="Activation">
          <Alert variant="danger" title="Activation impossible">
            {error}
          </Alert>
          <p className="mt-4 text-center text-sm text-content-muted">
            <Link
              href="/connexion"
              className="font-medium text-brand-strong hover:underline"
            >
              Retour à la connexion
            </Link>
          </p>
        </AuthCard>
      ) : (
        <AuthCard title="Activation" description="Validation de votre accès en cours…">
          <div
            className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted"
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
