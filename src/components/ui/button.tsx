import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Contraste vérifié par calcul (WCAG 2.2 AA, seuil 4,5:1 pour du texte courant) :
 *   blanc sur violet-600 #7C3AED = 5,70:1   (variante `brand`, clair)
 *   blanc sur violet-800 #5B21B6 = 7,10:1   (survol de `brand`, clair)
 *   violet-950 sur violet-400     = très au-dessus (variante `brand`, sombre)
 * Le violet d'identité #8B5CF6 ne donne que 4,23:1 avec du blanc : il n'est
 * donc jamais utilisé comme fond portant du texte.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
        brand:
          "bg-brand-strong text-white hover:bg-violet-800 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300",
        outline:
          "border border-border-strong bg-surface text-content hover:bg-surface-muted",
        ghost:
          "text-content-muted hover:bg-surface-muted hover:text-content",
        danger:
          "bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
        warning:
          "bg-amber-500 text-white hover:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-400",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
