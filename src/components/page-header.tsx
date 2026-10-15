import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * En-tête de page unifié : titre, description, actions.
 * Jusqu'ici chaque page réécrivait son propre titre avec une taille différente.
 *
 * `icon` est optionnel : il n'est utilisé que là où la référence en montre un
 * (la salutation du tableau de bord). Il est décoratif — `aria-hidden` — pour
 * que le nom accessible du titre reste le texte seul.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-content sm:text-2xl">
          {Icon ? (
            <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
          ) : null}
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-content-muted">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
