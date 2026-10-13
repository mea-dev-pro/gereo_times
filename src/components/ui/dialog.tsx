"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Fenêtre modale.
 *
 * S'appuie sur l'élément natif <dialog> en mode modal, plutôt que de
 * reconstruire une modale à la main. On obtient gratuitement, et sans
 * dépendance ajoutée :
 *   - le piégeage du focus dans la fenêtre ;
 *   - la fermeture par Échap ;
 *   - l'inertie du contenu situé derrière ;
 *   - le retour du focus sur l'élément déclencheur à la fermeture.
 *
 * Ces quatre points sont exactement ce que le critère UX-06 du PRD exige et
 * ce qu'une modale improvisée rate le plus souvent.
 */
export function Dialog({
  trigger,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
  title,
  description,
  children,
  className,
}: {
  /** Contenu du bouton d'ouverture. */
  trigger: ReactNode;
  triggerVariant?: "default" | "brand" | "outline" | "ghost" | "danger" | "success" | "warning";
  triggerSize?: "sm" | "default" | "lg" | "icon";
  triggerClassName?: string;
  title: string;
  description?: ReactNode;
  /** Corps de la fenêtre — peut contenir un formulaire lié à une action serveur. */
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </Button>

      <dialog
        ref={ref}
        aria-labelledby="dialog-titre"
        // Un clic sur le fond cible l'élément <dialog> lui-même : c'est le seul
        // moyen fiable de distinguer le fond du contenu, sans écouter partout.
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className={cn(
          "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-content shadow-raised",
          "backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="dialog-titre" className="text-base font-semibold text-content">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-content-muted">{description}</p>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Fermer"
            onClick={() => ref.current?.close()}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {children ? <div className="px-5 py-4">{children}</div> : null}
      </dialog>
    </>
  );
}
