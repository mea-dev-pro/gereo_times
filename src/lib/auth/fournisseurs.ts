/**
 * Fournisseurs d'identité tiers : identifiants et libellés.
 *
 * Ce fichier est importable depuis un composant client : il ne contient que des
 * données. L'interrogation de Supabase, elle, vit dans `lib/data/fournisseurs`
 * — un module serveur mis en cache, comme les autres référentiels.
 */

export type Fournisseur = "google" | "apple" | "facebook";

export const FOURNISSEURS: { id: Fournisseur; nom: string }[] = [
  { id: "google", nom: "Google" },
  { id: "apple", nom: "Apple" },
  { id: "facebook", nom: "Facebook" },
];

export function nomFournisseur(id: Fournisseur): string {
  return FOURNISSEURS.find((f) => f.id === id)?.nom ?? id;
}
