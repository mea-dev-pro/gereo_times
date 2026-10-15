import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
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
    <AuthShell
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-brand-strong hover:underline"
          >
            Créer une organisation
          </Link>
        </>
      }
    >
      <AuthCard title="Connexion">
        <LoginForm next={next} />
      </AuthCard>
    </AuthShell>
  );
}
