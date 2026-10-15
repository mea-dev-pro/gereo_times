"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./form";

/**
 * Champ mot de passe, avec affichage à la demande — le « Hide » de la maquette
 * `img/ui login.webp`.
 *
 * Le bouton ne change pas `aria-pressed` : son nom accessible décrit l'action
 * disponible (« Afficher le mot de passe » / « Masquer le mot de passe »), ce
 * qui suffit et évite de signaler deux fois la même chose aux lecteurs d'écran.
 * Il est en `type="button"` : sans cela, il soumettrait le formulaire.
 */
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((precedent) => !precedent)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-content-subtle transition-colors hover:text-content focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
