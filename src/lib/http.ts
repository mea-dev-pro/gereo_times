import { headers } from "next/headers";

/**
 * Origine publique de la requête courante.
 *
 * Sert à construire les liens que Supabase envoie par courriel : activation
 * d'un collaborateur, confirmation d'adresse à l'inscription. Sans elle, le
 * lien généré porte l'adresse vue par le serveur — `localhost:3000` une fois
 * déployé — et le destinataire tombe sur une page inaccessible.
 *
 * Derrière le proxy de Vercel, `host` seul ne suffit pas : c'est
 * `x-forwarded-host` (et `x-forwarded-proto`) qui décrivent le domaine
 * réellement visité.
 *
 * Réservé au serveur : une action, une route ou une page.
 */
export async function origineRequete(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
