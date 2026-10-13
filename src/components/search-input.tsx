"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Recherche sur une liste existante, par l'URL.
 *
 * Le filtrage est fait par le serveur à partir du paramètre d'URL, et non dans
 * le navigateur. Trois raisons :
 *
 *  1. la RLS s'applique — filtrer côté client exigerait d'envoyer au navigateur
 *     des lignes que le rôle n'a peut-être pas le droit de voir ;
 *  2. l'URL reste partageable et rechargeable, comme les filtres de période des
 *     rapports qui fonctionnent déjà ainsi ;
 *  3. le tableau reste un composant serveur, avec ses rendus de colonnes.
 *
 * Ce n'est PAS une recherche globale : elle porte sur la liste de la page
 * courante, conformément à la décision prise en phase 0.
 */
export function SearchInput({
  paramName = "q",
  initial = "",
  label = "Rechercher",
  placeholder = "Rechercher…",
  className,
}: {
  paramName?: string;
  /** Valeur lue par la page serveur, pour que le champ survive au rechargement. */
  initial?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [valeur, setValeur] = useState(initial);

  // `replace` plutôt que `push` : on ne veut pas empiler une entrée d'historique
  // par frappe. `startTransition` garde le champ réactif pendant la requête.
  const [, demarrer] = useTransition();
  const premierRendu = useRef(true);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }

    const minuteur = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);

      if (valeur.trim()) params.set(paramName, valeur.trim());
      else params.delete(paramName);

      // Un changement de filtre invalide la pagination en cours.
      params.delete("page");

      const requete = params.toString();
      demarrer(() => {
        router.replace(requete ? `${pathname}?${requete}` : pathname, {
          scroll: false,
        });
      });
    }, 300);

    return () => clearTimeout(minuteur);
  }, [valeur, paramName, pathname, router]);

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor="recherche" className="sr-only">
        {label}
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-content-subtle"
          aria-hidden="true"
        />

        <input
          id="recherche"
          type="search"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-control border border-border-strong bg-surface py-1 pl-8 pr-8 text-sm text-content placeholder:text-content-subtle sm:w-64"
        />

        {valeur ? (
          <button
            type="button"
            onClick={() => setValeur("")}
            aria-label="Effacer la recherche"
            className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-content-subtle hover:bg-surface-muted hover:text-content"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
