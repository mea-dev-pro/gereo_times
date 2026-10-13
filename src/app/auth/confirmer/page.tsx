"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";

/**
 * Point d'arrivée des liens d'activation (invitation) et de connexion.
 *
 * Supabase renvoie selon les cas :
 *  - les jetons dans le fragment d'URL (#access_token=…&refresh_token=…)
 *  - un code d'échange en paramètre (?code=…, flux PKCE)
 *  - une erreur dans le fragment (#error=…&error_code=…)
 *
 * Le client @supabase/ssr ne traite QUE le second cas : les jetons du fragment
 * doivent être posés explicitement via setSession, sinon la session n'est
 * jamais ouverte. On couvre donc les deux.
 */

function readHash(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return raw ? new URLSearchParams(raw) : null;
}

async function adoptHashSession(supabase: SupabaseClient): Promise<boolean> {
  const hash = readHash();
  if (!hash) return false;

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) return false;

  // Les jetons ont rempli leur office : on nettoie l'URL.
  window.history.replaceState(null, "", window.location.pathname);
  return true;
}

export default function ConfirmerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let finished = false;

    const go = () => {
      if (finished) return;
      finished = true;
      router.replace("/organisation/nouvelle");
      router.refresh();
    };

    // Le lien renvoyé par Supabase peut porter l'erreur dans le fragment.
    const hash = readHash();
    const hashError =
      hash?.get("error_code") === "otp_expired"
        ? "Ce lien a déjà été utilisé ou a expiré. Demandez une nouvelle invitation."
        : hash?.get("error_description")
          ? decodeURIComponent(hash.get("error_description") as string)
          : hash?.get("error")
            ? "Ce lien n'est plus valide. Demandez une nouvelle invitation."
            : null;

    if (hashError) {
      setError(hashError);
      finished = true;
      return;
    }

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
      for (let attempt = 0; attempt < 12; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          go();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      if (!finished) {
        setError(
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
