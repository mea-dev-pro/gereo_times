import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default function InscriptionPage() {
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
      </AuthCard>
    </AuthShell>
  );
}
