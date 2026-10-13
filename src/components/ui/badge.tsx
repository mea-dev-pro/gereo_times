import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

const TONES: Record<Tone, string> = {
  neutral:
    "bg-surface-muted text-content ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/20",
  info: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/20",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/20",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20",
  danger:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/20",
  brand:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/20",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

/**
 * `StatusBadge` vit désormais dans son propre fichier, avec la table de
 * correspondance statut → teinte partagée par toute l'application.
 * Ce ré-export évite de modifier les pages qui l'importaient d'ici.
 */
export { StatusBadge } from "./status-badge";
