import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default function InscriptionPage() {
  return (
    <AuthShell
      footer={
        <>
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-brand-strong hover:underline"
          >
            Se connecter
          </Link>
        </>
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
