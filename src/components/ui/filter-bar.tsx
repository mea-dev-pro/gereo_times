import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Barre de filtres.
 *
 * Simple conteneur de mise en page : elle aligne des contrôles (recherche,
 * sélecteur de période, bouton d'application) sur une même ligne, avec retour
 * à la ligne automatique. Les contrôles eux-mêmes restent libres — chaque page
 * garde la main sur ses filtres.
 */
export function FilterBar({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  /** Placées à droite, sur la même ligne. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface px-4 py-3",
        className
      )}
    >
      <div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Champ de formulaire étiqueté, pour les contrôles d'une FilterBar. */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-content-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
