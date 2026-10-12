import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Lit `searchParams` (redirection post-connexion) : route bloquante.
export const instant = false;

export default async function ConnexionPage({
  searchParams,
}: PageProps<"/connexion">) {
  const params = await searchParams;
  const raw = params.suivant;
  const next = typeof raw === "string" && raw.startsWith("/") ? raw : "/";

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
          <h1 className="mb-4 text-lg font-semibold text-slate-900">
            Connexion
          </h1>
          <LoginForm next={next} />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-blue-600 hover:underline"
          >
            Créer une organisation
          </Link>
        </p>
      </div>
    </main>
  );
}
