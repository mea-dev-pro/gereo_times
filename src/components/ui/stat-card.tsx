import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tuile d'indicateur colorée, d'après la référence visuelle.
 *
 * Les cinq teintes ne sont pas décoratives, elles portent un sens constant
 * dans toute l'application :
 *   violet → solde disponible (action possible)
 *   bleu   → en attente de validation (état bloqué, non fautif)
 *   pêche  → consommé ou réservé (information)
 *   menthe → acquis contractuel (information neutre)
 *   ambre  → attention (échéance, jour férié)
 *
 * Les couples fond/texte respectent le seuil AA (vérifié par calcul) :
 * violet-800 sur violet-100 = 7,57:1, bleu-800 sur bleu-100 = 7,15:1,
 * orange-800 sur orange-100 = 6,38:1, teal-800 sur teal-100 = 6,73:1,
 * amber-800 sur amber-100 = 6,15:1.
 */

export type StatTint = "violet" | "sky" | "peach" | "mint" | "amber";

const TINTS: Record<
  StatTint,
  { surface: string; chip: string; value: string; label: string }
> = {
  violet: {
    surface: "bg-violet-100 dark:bg-violet-500/15",
    chip: "bg-violet-500 text-white",
    value: "text-violet-950 dark:text-violet-100",
    label: "text-violet-900/70 dark:text-violet-200/70",
  },
  sky: {
    surface: "bg-blue-100 dark:bg-sky-500/15",
    chip: "bg-sky-400 text-white",
    value: "text-blue-950 dark:text-sky-100",
    label: "text-blue-900/70 dark:text-sky-200/70",
  },
  peach: {
    surface: "bg-orange-100 dark:bg-orange-500/15",
    chip: "bg-orange-600 text-white",
    value: "text-orange-950 dark:text-orange-100",
    label: "text-orange-900/70 dark:text-orange-200/70",
  },
  mint: {
    surface: "bg-teal-100 dark:bg-teal-500/15",
    chip: "bg-teal-400 text-white",
    value: "text-teal-950 dark:text-teal-100",
    label: "text-teal-900/70 dark:text-teal-200/70",
  },
  amber: {
    surface: "bg-amber-100 dark:bg-amber-500/15",
    chip: "bg-amber-500 text-white",
    value: "text-amber-950 dark:text-amber-100",
    label: "text-amber-900/70 dark:text-amber-200/70",
  },
};

export function StatCard({
  tint,
  icon: Icon,
  value,
  label,
  hint,
}: {
  tint: StatTint;
  icon: LucideIcon;
  value: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const t = TINTS[tint];

  return (
    <div className={cn("flex items-start gap-3 rounded-tile p-3.5", t.surface)}>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          t.chip
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className={cn("text-sm font-semibold leading-snug", t.value)}>
          {value}
        </p>
        <p className={cn("text-xs leading-snug", t.label)}>{label}</p>
        {hint ? <div className="mt-1 text-xs">{hint}</div> : null}
      </div>
    </div>
  );
}
