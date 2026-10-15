import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { DemandeForm } from "./demande-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function MotDePasseOubliePage() {
  return (
    <AuthShell
      footer={
        <>
          Vous vous en souvenez ?{" "}
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
        title="Mot de passe oublié"
        description="Indiquez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      >
        <DemandeForm />
      </AuthCard>
    </AuthShell>
  );
}
