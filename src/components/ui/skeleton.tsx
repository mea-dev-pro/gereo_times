import { cn } from "@/lib/utils";

/**
 * Squelette de chargement. Le PRD exige un état de chargement par écran
 * (section 8) ; aucun n'existait.
 *
 * L'animation est neutralisée par `prefers-reduced-motion` (voir globals.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-control bg-slate-200/70 dark:bg-white/10",
        className
      )}
    />
  );
}

/** Squelette d'une liste de lignes, pour les tableaux et les fils d'activité. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Chargement en cours">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
