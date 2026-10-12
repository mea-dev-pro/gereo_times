import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  brand: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

const STATUS_TONES: Record<string, Tone> = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  open: "info",
  closed: "neutral",
  corrected: "brand",
  flagged: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  cancelled: "Annulée",
  open: "En cours",
  closed: "Terminée",
  corrected: "Corrigée",
  flagged: "À vérifier",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
