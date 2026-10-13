"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Notifications éphémères.
 *
 * Le PRD demande un retour explicite après une action (sections 7.5 et 8).
 * Jusqu'ici chaque page affichait un encart en haut de contenu, que
 * l'utilisateur ne voyait pas s'il avait fait défiler la page — problème réel
 * sur les longues listes, où les boutons d'action sont en bas.
 *
 * Le conteneur porte `aria-live="polite"` : une personne au lecteur d'écran est
 * prévenue sans que le focus soit déplacé.
 */

type Ton = "success" | "info" | "warning" | "danger";

type Notification = {
  id: number;
  titre: string;
  description?: string;
  ton: Ton;
};

const TONS: Record<Ton, { classe: string; icone: typeof Info }> = {
  success: {
    classe: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100",
    icone: CheckCircle2,
  },
  info: {
    classe: "border-blue-200 bg-blue-50 text-blue-900 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-100",
    icone: Info,
  },
  warning: {
    classe: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
    icone: TriangleAlert,
  },
  danger: {
    classe: "border-red-200 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100",
    icone: TriangleAlert,
  },
};

const DUREE_MS = 6000;

type Api = {
  notifier: (t: { titre: string; description?: string; ton?: Ton }) => void;
};

const Ctx = createContext<Api | null>(null);

export function useToast(): Api {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useToast doit être utilisé dans un <ToastProvider>.");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([]);

  const retirer = useCallback((id: number) => {
    setListe((l) => l.filter((n) => n.id !== id));
  }, []);

  const api = useMemo<Api>(
    () => ({
      notifier: ({ titre, description, ton = "success" }) => {
        const id = Date.now() + Math.random();
        setListe((l) => [...l, { id, titre, description, ton }]);
        setTimeout(() => retirer(id), DUREE_MS);
      },
    }),
    [retirer]
  );

  return (
    <Ctx.Provider value={api}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
      >
        {liste.map((n) => {
          const { classe, icone: Icone } = TONS[n.ton];
          return (
            <div
              key={n.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border px-4 py-3 shadow-raised",
                classe
              )}
            >
              <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.titre}</p>
                {n.description ? (
                  <p className="mt-0.5 text-sm opacity-90">{n.description}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => retirer(n.id)}
                aria-label="Fermer la notification"
                className="-mr-1 -mt-0.5 rounded p-1 opacity-70 hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
