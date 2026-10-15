"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  adoptHashSession,
  attendreSession,
  messageErreurFragment,
  useErreurFragment,
} from "@/lib/auth/lien-session";
import { Alert } from "@/components/ui/alert";

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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <span className="text-2xl font-semibold tracking-tight text-content">
          Gereo<span className="text-brand-strong">Times</span>
        </span>

        <div className="mt-6">
          {error ? (
            <Alert variant="danger" title="Activation impossible">
              {error}
            </Alert>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <p className="text-sm text-content-muted">
                Activation de votre accès en cours…
              </p>
              <div
                className="mx-auto mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted"
                role="status"
                aria-label="Traitement en cours"
              >
                <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-strong" />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
