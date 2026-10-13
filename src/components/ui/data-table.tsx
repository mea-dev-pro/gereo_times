import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tableau de données partagé.
 *
 * Composant SERVEUR : les colonnes reçoivent une fonction de rendu, ce qui
 * permet d'y mettre un badge de statut, un lien ou un bouton d'action sans
 * contorsion. C'est possible parce que le rendu a lieu côté serveur — d'où
 * l'absence de « use client ». Le passer en composant client obligerait à
 * décrire les colonnes de façon déclarative et perdrait cette souplesse.
 *
 * Ne pas confondre avec le filtrage : voir SearchInput, qui agit par l'URL.
 */

export type Column<T> = {
  /** Identifiant stable de la colonne. */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Masque la colonne sous un certain seuil, plutôt que de la comprimer. */
  hideBelow?: "sm" | "md" | "lg";
  className?: string;
};

const MASQUE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Affiché à la place du tableau quand il n'y a aucune ligne. */
  empty?: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "py-2 pr-3 font-medium",
                  col.align === "right" && "text-right",
                  col.hideBelow && MASQUE[col.hideBelow]
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className="border-b border-border last:border-0"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "py-2.5 pr-3 align-top",
                    col.align === "right" && "text-right",
                    col.hideBelow && MASQUE[col.hideBelow],
                    col.className
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
