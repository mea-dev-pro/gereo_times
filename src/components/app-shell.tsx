"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";

/**
 * Gabarit de l'espace authentifié : barre du haut, navigation, contenu.
 *
 * Au-dessus de 1024 px (seuil `lg` de Tailwind), le rail est une colonne
 * permanente de 256 px, COLLÉE en haut de la fenêtre et haute d'un écran
 * (`sticky top-0 h-dvh`). Il ne prend donc plus la hauteur du contenu : sur une
 * page longue — un tableau de pointage, un rapport — il reste en place pendant
 * que la page défile, et les commandes du bas (compte, « Se déconnecter »)
 * restent atteignables sans descendre au bout de la page. Quand la fenêtre est
 * plus courte que le rail, c'est le rail lui-même qui défile, pas la page.
 *
 * En dessous, la navigation est un TIROIR : un panneau fixe qui glisse depuis
 * la gauche PAR-DESSUS le contenu, sous la barre du haut, avec un voile
 * cliquable. Elle ne réserve donc plus une seule ligne de hauteur : le contenu
 * commence à l'écran, et non après trois cents pixels de liens.
 *
 * Trois conséquences de ce choix, à connaître avant de toucher au composant :
 *
 * - **Le contenu est inerte tant que le tiroir est ouvert** (`inert` sur
 *   `main`). Recouvert par le voile, il ne doit plus prendre le focus : sans
 *   cela, la tabulation sortirait du panneau pour aller derrière le voile, où
 *   rien n'est visible. C'est le prix de la couche, payé autrement que par un
 *   piégeage du focus écrit à la main.
 * - **Le focus entre dans le panneau à l'ouverture** et revient sur le bouton
 *   à la fermeture par Échap (le seul chemin de fermeture qui n'est pas suivi
 *   d'une navigation ou d'un clic de souris).
 * - **La barre du haut reste au-dessus du tiroir** (le panneau commence sous
 *   elle) : le bouton « Fermer » demeure visible et cliquable, et le voile
 *   n'occulte jamais la commande qui l'a ouvert.
 *
 * Fermeture : au clic sur une entrée, au clic sur le voile, et par Échap.
 * `aria-expanded` et `aria-controls` exposent l'état aux technologies
 * d'assistance. Le contenu du rail arrive en `navigation` : un composant serveur
 * ne peut pas transmettre de fonction, donc l'écoute du clic est posée sur le
 * panneau lui-même plutôt que confiée à chaque lien.
 */

/** Seuil `lg` de Tailwind : au-dessus, le rail est permanent. */
const GRAND_ECRAN = "(min-width: 1024px)";

/*
 * `useSyncExternalStore` plutôt qu'un état alimenté par un effet : la valeur ne
 * dépend que du média, pas d'un rendu, et l'abonnement se défait proprement.
 * Sur le serveur et au premier rendu client, on répond « petit écran » — l'état
 * replié, celui que décrit le HTML statique.
 */
function souscrireGrandEcran(rappel: () => void) {
  const media = window.matchMedia(GRAND_ECRAN);
  media.addEventListener("change", rappel);
  return () => media.removeEventListener("change", rappel);
}
const estGrandEcran = () => window.matchMedia(GRAND_ECRAN).matches;
const jamaisGrandEcran = () => false;

export function AppShell({
  organisation,
  nonLues,
  navigation,
  children,
}: {
  organisation: string;
  nonLues: number;
  navigation: ReactNode;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const panneau = useRef<HTMLElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const grandEcran = useSyncExternalStore(
    souscrireGrandEcran,
    estGrandEcran,
    jamaisGrandEcran
  );

  useEffect(() => {
    if (!ouvert) return;
    const element = panneau.current;
    if (!element) return;

    // Le focus entre dans le panneau : sinon la tabulation repartirait de la
    // barre du haut et le panneau se parcourrait à l'envers.
    element.focus();

    // Replier est ici la réponse à un événement, pas une réaction à un
    // changement d'adresse : un effet qui recopierait l'URL dans l'état
    // déclencherait un rendu en cascade (règle `set-state-in-effect`).
    const surClic = (evenement: MouseEvent) => {
      if (evenement.target instanceof Element && evenement.target.closest("a")) {
        setOuvert(false);
      }
    };
    // Échap, comme partout ailleurs dans l'application. Le focus revient sur
    // le bouton : sans cela il retomberait sur le document, une fois le
    // panneau devenu invisible.
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape") return;
      setOuvert(false);
      bouton.current?.focus();
    };

    element.addEventListener("click", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      element.removeEventListener("click", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  // Le contenu n'est inerte que si le voile le recouvre réellement : en
  // repassant au-dessus de 1024 px avec le tiroir ouvert, le rail redevient une
  // colonne et le contenu doit redevenir atteignable.
  const recouvert = ouvert && !grandEcran;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Premier arrêt de tabulation. Sans lui, atteindre le contenu demande
          de traverser les quatorze liens et commandes du rail latéral :
          WCAG 2.4.1, « éviter les blocs ». */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-content"
      >
        Aller au contenu
      </a>

      {/* Barre du haut : téléphone et tablette seulement. Hauteur fixe (h-14),
          car le tiroir et le voile commencent exactement sous elle. */}
      <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-content"
          >
            <Wordmark />
          </Link>
          <p className="truncate text-[11px] font-medium text-content-subtle">
            {organisation}
          </p>
        </div>

        <button
          ref={bouton}
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

      {/* Voile : cliquer à côté referme. Décoratif pour les technologies
          d'assistance — « Fermer » et Échap restent les commandes nommées. */}
      <div
        id="voile-navigation"
        aria-hidden="true"
        onClick={() => setOuvert(false)}
        className={cn(
          "no-print fixed inset-x-0 bottom-0 top-14 z-30 bg-scrim transition-opacity duration-200 lg:hidden",
          ouvert ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        id="rail-navigation"
        ref={panneau}
        // Focalisable par programme seulement : le focus y est posé à
        // l'ouverture pour que la tabulation reparte de la navigation.
        tabIndex={-1}
        className={cn(
          "no-print bg-surface",
          // 320 px, sans jamais dépasser 85 % de l'écran : le voile reste
          // visible à droite, ce qui montre qu'on peut fermer en cliquant.
          "fixed bottom-0 left-0 top-14 z-40 w-80 max-w-[85vw] overflow-y-auto border-r border-border shadow-raised",
          // La visibilité bascule en fin de course (propriété discrète) : le
          // panneau reste peint pendant qu'il sort, mais ne prend plus le focus
          // une fois sorti.
          "transition-[transform,visibility] duration-200 ease-out",
          ouvert ? "visible translate-x-0" : "invisible -translate-x-full",
          // Au-dessus de 1024 px : colonne du flux, à gauche, sans voile ni
          // animation — mais collée en haut et haute d'un écran. `bottom-auto`
          // et `left-auto` neutralisent les décalages du tiroir (`bottom-0`,
          // `left-0`, `top-14`) : sans eux, le collage partirait de 56 px sous
          // le haut de la fenêtre. Les variantes passent après, elles l'emportent
          // sur l'état replié. Le défilement interne vient de l'`overflow-y-auto`
          // de base, qui vaut aussi au bureau.
          "lg:sticky lg:top-0 lg:bottom-auto lg:left-auto lg:z-auto lg:visible lg:h-dvh lg:w-64 lg:max-w-none lg:translate-x-0 lg:border-b-0 lg:shadow-none lg:transition-none",
          "lg:flex lg:shrink-0 lg:flex-col"
        )}
      >
        {navigation}
      </aside>

      {/* tabIndex -1 : cible du lien d'évitement, donc focalisable par le
          fragment d'URL sans entrer dans l'ordre de tabulation. */}
      <main
        id="contenu"
        tabIndex={-1}
        inert={recouvert}
        className="flex-1 px-4 py-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
