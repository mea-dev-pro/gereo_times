"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { origineRequete } from "@/lib/http";

export type ActionState = {
  error?: string;
  success?: string;
  /** Lien d'activation à transmettre (invitations). */
  link?: string;
} | null;

/** Convertit les messages d'erreur Supabase en français. */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez votre adresse email avant de vous connecter.";
  if (m.includes("user already registered")) return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("unable to validate email")) return "Cette adresse email n'est pas valide.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (m.includes("duplicate key") && m.includes("slug")) return "Ce nom d'organisation est déjà pris.";
  return message;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function signIn(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Renseignez votre email et votre mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traduire(error.message) };

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/");
}

export async function signUp(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const orgName = String(formData.get("organization_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Renseignez votre email et votre mot de passe." };
  }
  if (password.length < 6) {
    return { error: "Le mot de passe doit contenir au moins 6 caractères." };
  }
  if (!fullName) {
    return { error: "Renseignez votre nom complet." };
  }
  if (!orgName) {
    return { error: "Renseignez le nom de votre organisation." };
  }

  const supabase = await createClient();

  // Sans `emailRedirectTo`, Supabase retombe sur sa « Site URL » : en
  // production, le lien de confirmation reçu par courriel mènerait alors à
  // l'adresse de développement (localhost) et le compte ne pourrait jamais
  // être confirmé.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await origineRequete()}/auth/confirmer`,
    },
  });

  if (error) return { error: traduire(error.message) };
  if (!data.user) return { error: "La création du compte a échoué." };

  // Si la confirmation par email est activée, aucune session n'est ouverte :
  // l'utilisateur devra confirmer puis créer son organisation.
  if (!data.session) {
    return {
      success:
        "Compte créé. Confirmez votre adresse email, puis connectez-vous pour créer votre organisation.",
    };
  }

  const slug = slugify(orgName);
  const { error: orgError } = await supabase.rpc("create_organization", {
    p_name: orgName,
    p_slug: slug.length >= 2 ? slug : `org-${data.user.id.slice(0, 8)}`,
  });

  if (orgError) {
    return {
      error:
        "Compte créé, mais la création de l'organisation a échoué : " +
        traduire(orgError.message),
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function createOrganization(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const orgName = String(formData.get("organization_name") ?? "").trim();
  if (!orgName) return { error: "Renseignez le nom de votre organisation." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  const slug = slugify(orgName);
  const { error } = await supabase.rpc("create_organization", {
    p_name: orgName,
    p_slug: slug.length >= 2 ? slug : `org-${user.id.slice(0, 8)}`,
  });

  if (error) return { error: traduire(error.message) };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/connexion");
}

/**
 * Demande de réinitialisation de mot de passe.
 *
 * La réponse est la même que l'adresse existe ou non : une réponse différenciée
 * dirait à un inconnu quels comptes existent. Seule une limite de débit est
 * remontée, car c'est un vrai échec dont l'utilisateur doit être informé.
 *
 * Le lien envoyé pointe sur le domaine réellement visité (voir
 * `origineRequete`) : sans cela il mènerait à l'adresse de développement, une
 * fois l'application déployée.
 */
export async function demanderReinitialisation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Renseignez votre adresse email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origineRequete()}/auth/reinitialiser`,
  });

  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: traduire(error.message) };
  }

  return {
    success:
      "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé. Pensez à regarder dans les indésirables.",
  };
}
