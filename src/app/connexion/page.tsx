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
            className="text-2xl font-semibold tracking-tight text-content"
          >
            Gereo<span className="text-brand-strong">Times</span>
          </Link>
          <p className="mt-1 text-sm text-content-muted">
            Gestion du temps de travail et des congés
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold text-content">
            Connexion
          </h1>
          <LoginForm next={next} />
        </div>

        <p className="mt-4 text-center text-sm text-content-muted">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-brand-strong hover:underline"
          >
            Créer une organisation
          </Link>
        </p>
      </div>
    </main>
  );
}
