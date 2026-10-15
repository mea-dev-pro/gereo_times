import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
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
        <LoginForm next={next} />
      </AuthCard>
    </AuthShell>
  );
}
