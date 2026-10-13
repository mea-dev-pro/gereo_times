import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État vide unifié. Le PRD le demande explicitement pour chaque écran
 * (section 8) : jusqu'ici chaque page écrivait le sien, avec des mots
 * différents pour dire la même chose.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-content-subtle dark:bg-white/5">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}

      <div className="space-y-1">
        <p className="text-sm font-medium text-content">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-content-muted">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
