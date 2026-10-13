import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default function InscriptionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link
            href="/connexion"
            className="text-2xl font-semibold tracking-tight text-content"
          >
            Gereo<span className="text-brand-strong">Times</span>
          </Link>
          <p className="mt-1 text-sm text-content-muted">
            Gestion du temps de travail et des congés
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-content">
            Créer une organisation
          </h1>
          <p className="mb-4 text-sm text-content-muted">
            Votre espace est isolé : aucune donnée n&apos;est partagée avec
            d&apos;autres organisations.
          </p>
          <SignupForm />
        </div>

        <p className="mt-4 text-center text-sm text-content-muted">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-brand-strong hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
