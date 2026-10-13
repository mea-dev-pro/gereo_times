"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Choice = "light" | "dark" | "system";

const CHOIX: readonly string[] = ["light", "dark", "system"];

const OPTIONS: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Thème clair", icon: Sun },
  { value: "dark", label: "Thème sombre", icon: Moon },
  { value: "system", label: "Suivre le système", icon: Monitor },
];

/**
 * Bascule de thème à trois états.
 *
 * Le choix vit en trois endroits qui doivent rester d'accord : la classe `dark`
 * posée sur <html> par le script en ligne du layout (avant peinture), la clé
 * « theme » du stockage local, et le bouton. On l'expose donc comme un petit
 * magasin externe lu par `useSyncExternalStore` :
 *   - `lireChoix()` est la seule source de vérité (clé absente = « système ») ;
 *   - l'instantané serveur vaut `null`, donc aucun état actif avant
 *     l'hydratation : pas d'écart entre le HTML du serveur et celui du
 *     navigateur ;
 *   - `applique()` écrit dans le document et le stockage, puis publie.
 */
const abonnes = new Set<() => void>();

function souscrire(notifier: () => void) {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
}

function lireChoix(): Choice {
  try {
    const brut = localStorage.getItem("theme");
    return CHOIX.includes(brut ?? "") ? (brut as Choice) : "system";
  } catch {
    // Navigation privée : le stockage est inaccessible, l'affichage reste juste.
    return "system";
  }
}

function publier() {
  for (const notifier of abonnes) notifier();
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(souscrire, lireChoix, () => null);

  function applique(next: Choice) {
    const sombre =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", sombre);

    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Navigation privée : le choix ne survivra pas, l'affichage reste correct.
    }

    publier();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'interface"
      className="flex items-center gap-0.5 rounded-control bg-surface-muted p-0.5 ring-1 ring-border dark:bg-white/5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const actif = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={actif}
            aria-label={label}
            title={label}
            onClick={() => applique(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-[6px] transition-colors",
              actif
                ? "bg-surface text-brand-strong shadow-sm dark:bg-white/15"
                : "text-content-subtle hover:text-content"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
