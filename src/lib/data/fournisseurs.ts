import { cacheLife } from "next/cache";
import { FOURNISSEURS, type Fournisseur } from "@/lib/auth/fournisseurs";

/**
 * Fournisseurs d'identité tiers réellement configurés sur le projet Supabase.
 *
 * Un bouton « Continuer avec Google » n'a de sens que si Google est activé
 * côté Supabase : sinon il ne mène qu'à un message d'erreur du fournisseur
 * d'authentification. On interroge donc `/auth/v1/settings`, qui expose l'état
 * de chaque fournisseur, et on n'affiche que ceux qui répondent présent.
 *
 * Conséquence agréable : activer un fournisseur dans Supabase suffit à faire
 * apparaître son bouton, sans toucher au code ni redéployer.
 *
 * Durée : profil `minutes` (fraîcheur 5 min côté navigateur, régénération à la
 * minute côté serveur) — assez court pour qu'un fournisseur tout juste activé
 * apparaisse dans la minute, assez long pour que l'écran de connexion ne coûte
 * pas un aller-retour à chaque visite.
 *
 * L'appel utilise la clé publique : `/auth/v1/settings` ne renvoie que des
 * booléens, aucune donnée confidentielle. En cas d'échec, la liste est vide —
 * mieux vaut une entrée sans bouton tiers que des boutons qui échouent.
 */
export async function fournisseursActifs(): Promise<Fournisseur[]> {
  "use cache";
  cacheLife("minutes");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return [];

  try {
    const reponse = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: cle },
    });
    if (!reponse.ok) return [];

    const { external } = (await reponse.json()) as {
      external?: Record<string, boolean>;
    };
    return FOURNISSEURS.filter((f) => external?.[f.id]).map((f) => f.id);
  } catch {
    return [];
  }
}
