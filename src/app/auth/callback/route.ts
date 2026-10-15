import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { origineRequete } from "@/lib/http";

/**
 * Retour des fournisseurs d'identité tiers (Google, Apple, Facebook).
 *
 * Le navigateur revient ici avec un `?code=` : c'est le même flux PKCE que les
 * liens reçus par courriel, mais l'échange se fait ici, côté serveur, pour que
 * les cookies de session soient posés avant le premier rendu — l'utilisateur
 * arrive donc déjà connecté, sans écran intermédiaire.
 *
 * L'adresse de redirection se construit sur le domaine réellement visité
 * (`origineRequete`) : derrière le proxy de Vercel, l'hôte vu par la fonction
 * n'est pas celui du navigateur, et l'utilisateur se retrouverait sur une autre
 * origine que la sienne.
 *
 * Un échec renvoie vers l'écran de connexion avec un motif, jamais vers une
 * page blanche : c'est le seul cas où l'utilisateur a besoin de comprendre ce
 * qui s'est passé.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const suivant = searchParams.get("suivant");
  const base = await origineRequete();
  const destination = suivant?.startsWith("/") ? suivant : "/";

  const echec = (motif: string) =>
    NextResponse.redirect(`${base}/connexion?erreur=${motif}`);

  if (!code) {
    // Le fournisseur a refusé, ou l'utilisateur a annulé : Supabase joint alors
    // `error` et `error_description`.
    const refus = searchParams.get("error_code") ?? searchParams.get("error");
    return echec(refus === "access_denied" ? "annule" : "fournisseur");
  }

  const reponse = NextResponse.redirect(`${base}${destination}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (liste) => {
          for (const { name, value, options } of liste) {
            reponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return echec("echange");

  return reponse;
}
