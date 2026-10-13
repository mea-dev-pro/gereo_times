import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<Variant, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
  danger:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100",
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-4 py-3 text-sm",
        VARIANTS[variant],
        className
      )}
    >
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

/**
 * `EmptyState` vit désormais dans son propre fichier (icône, action, thème
 * sombre). Ce ré-export évite de modifier les pages qui l'importaient d'ici.
 */
export { EmptyState } from "./empty-state";
