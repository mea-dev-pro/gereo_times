import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Habillage des écrans publics : marque, colonne étroite, carte.
 *
 * Les écrans de connexion, d'inscription et de réinitialisation répétaient le
 * même bloc à l'identique ; il vit ici. Le point d'arrivée des liens reçus par
 * courriel (/auth/confirmer) garde son propre habillage : il n'a pas de carte,
 * son contenu étant un état de traitement centré.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link
            href="/connexion"
            className="text-2xl font-semibold tracking-tight text-content"
          >
            Gereo<span className="text-brand-strong">Times</span>
          </Link>
          <p className="mt-1 text-sm text-content-muted">
            Gestion du temps de travail et des congés
          </p>
        </div>

        {children}

        {footer ? (
          <p className="mt-4 text-center text-sm text-content-muted">{footer}</p>
        ) : null}
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
        "rounded-xl border border-border bg-surface p-6 shadow-sm",
        className
      )}
    >
      <h1
        className={cn(
          "text-lg font-semibold text-content",
          description ? "mb-1" : "mb-4"
        )}
      >
        {title}
      </h1>
      {description ? (
        <p className="mb-4 text-sm text-content-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
