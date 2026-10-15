import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { OAuthButtons } from "@/components/oauth-buttons";
import { buttonVariants } from "@/components/ui/button";
import { fournisseursActifs } from "@/lib/data/fournisseurs";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Lit `searchParams` (redirection post-connexion) : route bloquante.
export const instant = false;

/** Motifs d'échec renvoyés par /auth/callback, traduits pour l'utilisateur. */
const ERREURS_FOURNISSEUR: Record<string, string> = {
  annule: "La connexion a été annulée. Vous pouvez réessayer ou utiliser votre mot de passe.",
  fournisseur:
    "Le fournisseur d'identité a refusé la connexion. Réessayez, ou utilisez votre mot de passe.",
  echange:
    "La connexion n'a pas pu être finalisée. Réessayez, ou utilisez votre mot de passe.",
};

export default async function ConnexionPage({
  searchParams,
}: PageProps<"/connexion">) {
  const params = await searchParams;
  const raw = params.suivant;
  const next = typeof raw === "string" && raw.startsWith("/") ? raw : "/";

  const motif = typeof params.erreur === "string" ? params.erreur : "";
  const erreur = ERREURS_FOURNISSEUR[motif];
  const fournisseurs = await fournisseursActifs();

  return (
    <AuthShell
      action={
        <Link
          href="/inscription"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Créer une organisation
        </Link>
      }
    >
      <AuthCard
        title="Connexion"
        description="Accédez au suivi du temps et des congés de votre organisation."
      >
        <LoginForm next={next} erreurInitiale={erreur} />
        <OAuthButtons fournisseurs={fournisseurs} suivant={next} />
      </AuthCard>
    </AuthShell>
  );
}
