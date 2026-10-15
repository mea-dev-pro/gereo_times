import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Habillage des écrans publics : l'entrée de l'application.
 *
 * Inspiration de la maquette `img/ui login.webp` (mesurée au pixel, voir
 * docs/ECRAN-CONNEXION-REFERENCE.md) pour la **composition** : décor de traits
 * en fond, barre du haut avec la marque à gauche et l'action de changement de
 * parcours à droite, carte centrée, titre et sous-titre centrés.
 *
 * Ce qui n'est pas repris de la maquette, et pourquoi :
 *
 * - **sa palette crème et ambre** : l'identité du projet vient de l'autre
 *   maquette (violet, cinq teintes sémantiques) et l'ambre y signifie
 *   « attention » — il ne peut pas devenir décoratif sans perdre son sens ;
 * - **la rangée de boutons Google / Apple / Facebook** : aucun fournisseur
 *   d'identité tiers n'est configuré ici, et un bouton sans effet est pire qu'un
 *   bouton absent ;
 * - **l'illustration d'une personne** : dessin sous licence, sans équivalent
 *   dans le projet. Le décor de traits reprend l'esprit « croquis sur fond
 *   clair » sans rien copier.
 *
 * Tout est peint avec les jetons de `globals.css` : les écrans suivent donc le
 * thème sombre sans variante à écrire.
 */
export function AuthShell({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-surface-muted">
      <Decor />

      <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/connexion" className="min-w-0">
          <span className="block text-xl font-semibold tracking-tight text-content sm:text-2xl">
            Gereo<span className="text-brand-strong">Times</span>
          </span>
          <span className="mt-0.5 hidden text-xs text-content-muted sm:block">
            Gestion du temps de travail et des congés
          </span>
        </Link>

        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-6 shadow-card sm:p-7",
        className
      )}
    >
      <h1 className="text-center text-lg font-semibold text-content">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-center text-sm text-content-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}

/**
 * Décor de fond : traits fins et pointillés, dans l'esprit de la maquette.
 * Décoratif de bout en bout (`aria-hidden`), donc absent de l'arbre
 * d'accessibilité. Réservé aux grands écrans : sur téléphone, la place
 * appartient au formulaire.
 */
function Decor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none lg:block"
    >
      {/* Fenêtre de navigateur, à gauche du formulaire */}
      <svg
        className="absolute left-[6%] top-[26%] h-24 w-40 text-border-strong"
        viewBox="0 0 160 96"
        fill="none"
      >
        <rect x="1" y="1" width="158" height="94" rx="10" stroke="currentColor" />
        <path d="M1 22h158" stroke="currentColor" />
        <path
          d="M42 40h76M42 56h76M42 72h44"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>

      {/* Flèche courbe, en bas à gauche */}
      <svg
        className="absolute bottom-[22%] left-[16%] h-16 w-24 text-border-strong"
        viewBox="0 0 96 64"
        fill="none"
      >
        <path
          d="M4 60C10 24 34 6 74 8"
          stroke="currentColor"
          strokeLinecap="round"
        />
        <path
          d="M62 2l14 6-10 11"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Rectangle pointillé, en bas à gauche */}
      <svg
        className="absolute bottom-[9%] left-[7%] h-28 w-20 text-brand opacity-40"
        viewBox="0 0 80 112"
      >
        <defs>
          <pattern
            id="points-auth-gauche"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3" cy="3" r="2.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="80" height="112" fill="url(#points-auth-gauche)" />
      </svg>

      {/* Trait ondulé, en haut à droite */}
      <svg
        className="absolute right-[10%] top-[17%] h-6 w-32 text-border-strong"
        viewBox="0 0 128 24"
        fill="none"
      >
        <path
          d="M2 12c10-14 22 14 32 0s22 14 32 0 22 14 32 0"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>

      {/* Fenêtre à onglets, à droite du formulaire */}
      <svg
        className="absolute right-[13%] top-[33%] h-16 w-24 text-border-strong"
        viewBox="0 0 96 64"
        fill="none"
      >
        <rect x="1" y="1" width="94" height="62" rx="8" stroke="currentColor" />
        <path d="M1 18h94M14 9h18" stroke="currentColor" strokeLinecap="round" />
      </svg>

      {/* Rectangle pointillé, en bas à droite */}
      <svg
        className="absolute bottom-[11%] right-[8%] h-24 w-24 text-brand opacity-40"
        viewBox="0 0 96 96"
      >
        <defs>
          <pattern
            id="points-auth-droite"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3" cy="3" r="2.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="96" height="96" fill="url(#points-auth-droite)" />
      </svg>

      {/* Quelques éclats, pour l'aération */}
      <svg
        className="absolute left-[24%] top-[13%] h-10 w-10 text-border-strong"
        viewBox="0 0 40 40"
        fill="none"
      >
        <path
          d="M20 4v10M20 26v10M4 20h10M26 20h10"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="absolute bottom-[26%] right-[26%] h-8 w-8 text-border-strong"
        viewBox="0 0 32 32"
        fill="none"
      >
        <circle cx="16" cy="16" r="14" stroke="currentColor" />
      </svg>
    </div>
  );
}
