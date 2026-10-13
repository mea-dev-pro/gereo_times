"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Choice = "light" | "dark" | "system";

const OPTIONS: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Thème clair", icon: Sun },
  { value: "dark", label: "Thème sombre", icon: Moon },
  { value: "system", label: "Suivre le système", icon: Monitor },
];

/**
 * Bascule de thème à trois états.
 *
 * L'état initial est lu depuis le DOM, et non depuis le stockage : c'est le
 * script en ligne du layout qui a déjà tranché avant peinture. Lire la même
 * source évite tout désaccord entre l'affichage et le bouton.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    setChoice((localStorage.getItem("theme") as Choice | null) ?? "system");
  }, []);

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

    setChoice(next);
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
