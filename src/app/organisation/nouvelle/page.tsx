import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { OrganizationForm } from "./org-form";

export const metadata: Metadata = { title: "Nouvelle organisation" };

// Lit la session (cookies) : route bloquante.
export const instant = false;

export default async function NouvelleOrganisationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  // Déjà rattaché à une organisation : direction le tableau de bord.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-semibold tracking-tight text-slate-900">
            Gereo<span className="text-blue-600">Times</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-slate-900">
            Dernière étape
          </h1>
          <p className="mb-4 text-sm text-slate-500">
            Votre compte est créé. Choisissez le nom de votre organisation pour
            commencer — vous en serez l&apos;administrateur.
          </p>
          <OrganizationForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Connecté en tant que {user.email}
        </p>
      </div>
    </main>
  );
}
