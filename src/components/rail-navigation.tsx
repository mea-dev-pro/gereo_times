"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Le rail de navigation, avec un panneau escamotable sur petit écran.
 *
 * Sous 1024 px (téléphone et tablette, seuil `lg` de Tailwind), le rail est
 * replié derrière un bouton « Menu » dans une barre collante en haut d'écran,
 * avec le compteur de notifications pour que l'information ne disparaisse pas
 * avec le rail. Au-dessus, la barre disparaît et le rail reste affiché en
 * permanence : le bureau ne change pas.
 *
 * Choix d'implémentation : le panneau reste DANS le flux, sous la barre, au
 * lieu d'être une fenêtre par-dessus le contenu. Aucun piégeage du focus n'est
 * alors nécessaire, rien n'est masqué derrière une couche, et tout le reste de
 * la page demeure atteignable au clavier — une fenêtre modale pour une
 * navigation coûterait ces trois garanties pour un gain esthétique.
 *
 * Fermeture : au clic sur une entrée du rail, et par Échap. `aria-expanded` et
 * `aria-controls` exposent l'état aux technologies d'assistance. Le contenu du
 * rail arrive en `children` : un composant serveur ne peut pas transmettre de
 * fonction, donc l'écoute du clic est posée sur le panneau lui-même plutôt que
 * confiée à chaque lien.
 */
export function RailNavigation({
  organisation,
  nonLues,
  children,
}: {
  organisation: string;
  nonLues: number;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const panneau = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const element = panneau.current;
    if (!element) return;

    // Replier est ici la réponse à un événement, pas une réaction à un
    // changement d'adresse : un effet qui recopierait l'URL dans l'état
    // déclencherait un rendu en cascade (règle `set-state-in-effect`).
    const surClic = (evenement: MouseEvent) => {
      if (evenement.target instanceof Element && evenement.target.closest("a")) {
        setOuvert(false);
      }
    };
    // Échap, comme partout ailleurs dans l'application.
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setOuvert(false);
    };

    element.addEventListener("click", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      element.removeEventListener("click", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  return (
    <>
      {/* Barre du haut : téléphone et tablette seulement. */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 lg:hidden">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-content"
          >
            Gereo<span className="text-brand-strong">Times</span>
          </Link>
          <p className="truncate text-[11px] font-medium text-content-subtle">
            {organisation}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOuvert((precedent) => !precedent)}
          aria-expanded={ouvert}
          aria-controls="rail-navigation"
          // Nom accessible stable : le compteur de notifications est décoratif
          // ici (le lecteur d'écran l'annonce déjà sur l'entrée du rail), sinon
          // le bouton s'appellerait « Menu 3 non lue(s) ».
          aria-label={ouvert ? "Fermer" : "Menu"}
          // 44 px de haut : la cible tactile recommandée pour un pouce.
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium text-content transition-colors hover:bg-surface-muted focus-visible:outline-none"
        >
          {ouvert ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <Menu className="size-4" aria-hidden="true" />
          )}
          {ouvert ? "Fermer" : "Menu"}
          {!ouvert && nonLues > 0 ? (
            <span
              aria-hidden="true"
              className="rounded-full bg-brand-strong px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
            >
              {nonLues > 99 ? "99+" : nonLues}
            </span>
          ) : null}
        </button>
      </header>

      <aside
        id="rail-navigation"
        ref={panneau}
        className={cn(
          "no-print border-b border-border bg-surface",
          // Sur téléphone le panneau prend toute la largeur ; à partir de la
          // tablette il se cale à 320 px, largeur d'un rail, plutôt que de
          // s'étirer sur 800 px de vide.
          "sm:max-w-80",
          "lg:flex lg:w-64 lg:max-w-none lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r",
          // `hidden` sous `lg`, `lg:flex` au-dessus : Tailwind place les
          // variantes après les utilitaires de base, donc le rail reste
          // affiché en permanence sur grand écran quel que soit l'état.
          ouvert ? "flex flex-col" : "hidden"
        )}
      >
        {children}
      </aside>
    </>
  );
}
