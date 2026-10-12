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
            className="text-2xl font-semibold tracking-tight text-slate-900"
          >
            Gereo<span className="text-blue-600">Times</span>
          </Link>
          <p className="mt-1 text-sm text-slate-500">
            Gestion du temps de travail et des congés
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-slate-900">
            Créer une organisation
          </h1>
          <p className="mb-4 text-sm text-slate-500">
            Votre espace est isolé : aucune donnée n&apos;est partagée avec
            d&apos;autres organisations.
          </p>
          <SignupForm />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-blue-600 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
