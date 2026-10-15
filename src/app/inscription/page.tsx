import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { OAuthButtons } from "@/components/oauth-buttons";
import { buttonVariants } from "@/components/ui/button";
import { fournisseursActifs } from "@/lib/data/fournisseurs";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default async function InscriptionPage() {
  const fournisseurs = await fournisseursActifs();

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
      <AuthCard
        title="Créer une organisation"
        description="Votre espace est isolé : aucune donnée n'est partagée avec d'autres organisations."
      >
        <SignupForm />
        <OAuthButtons fournisseurs={fournisseurs} />
      </AuthCard>
    </AuthShell>
  );
}
