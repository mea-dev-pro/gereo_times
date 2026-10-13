"use client";

import { useRef, type ReactNode, type Ref } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Fenêtre modale, appuyée sur l'élément natif <dialog> en mode modal.
 *
 * On obtient gratuitement, sans dépendance ajoutée : le piégeage du focus,
 * la fermeture par Échap, l'inertie du contenu derrière et le retour du focus
 * sur l'élément déclencheur. Ce sont exactement les quatre points que le
 * critère UX-06 exige et qu'une modale improvisée rate le plus souvent.
 *
 * Deux usages :
 *   - <Dialog trigger={…}>  : le déclencheur est fourni avec la fenêtre ;
 *   - <DialogPanel ref={…}> : la fenêtre seule, ouverte par l'appelant quand
 *     la décision d'ouvrir dépend d'un état inconnu au moment du rendu — par
 *     exemple la durée écoulée à l'instant précis du clic.
 */

export function DialogPanel({
  ref,
  title,
  description,
  children,
  className,
}: {
  ref?: Ref<HTMLDialogElement>;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const local = useRef<HTMLDialogElement>(null);
  const dlg = ref ?? local;

  return (
    <dialog
      ref={dlg}
      aria-labelledby="dialog-titre"
      // Un clic sur le fond cible l'élément <dialog> lui-même : c'est le seul
      // moyen fiable de distinguer le fond du contenu, sans écouter partout.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
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

        {/* Remonter au <dialog> parent évite d'avoir à manipuler la référence. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fermer"
          onClick={(e) =>
            (e.currentTarget.closest("dialog") as HTMLDialogElement)?.close()
          }
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {children ? <div className="px-5 py-4">{children}</div> : null}
    </dialog>
  );
}

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
  trigger: ReactNode;
  triggerVariant?:
    | "default"
    | "brand"
    | "outline"
    | "ghost"
    | "danger"
    | "success"
    | "warning";
  triggerSize?: "sm" | "default" | "lg" | "icon";
  triggerClassName?: string;
  title: string;
  description?: ReactNode;
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

      <DialogPanel
        ref={ref}
        title={title}
        description={description}
        className={className}
      >
        {children}
      </DialogPanel>
    </>
  );
}
