import { cn } from "@/lib/utils";

/**
 * En-tête de page unifié : titre, description, actions.
 * Jusqu'ici chaque page réécrivait son propre titre avec une taille différente.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
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
        <h1 className="text-xl font-semibold tracking-tight text-content sm:text-2xl">
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
