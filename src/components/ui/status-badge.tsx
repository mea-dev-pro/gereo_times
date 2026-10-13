import { cn } from "@/lib/utils";

/**
 * Badge de statut métier.
 *
 * Une seule table de correspondance statut → teinte, partagée par toute
 * l'application : c'est ce qui garantit qu'un « approuvé » a la même couleur
 * sur l'écran des congés, celui des validations et celui des rapports.
 */

type Tone = "neutral" | "info" | "brand" | "success" | "danger" | "warning";

const TONES: Record<Tone, string> = {
  neutral:
    "bg-surface-muted text-content dark:bg-slate-400/15 dark:text-slate-300",
  info: "bg-blue-100 text-blue-800 dark:bg-sky-500/15 dark:text-sky-200",
  brand: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
};

/**
 * Libellés français — tous statuts confondus (congés, pointage, adhésion,
 * invitation). Sans cette table, un TimeEntryStatus s'afficherait « open ».
 */
const LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  cancelled: "Annulée",
  open: "En cours",
  closed: "Terminée",
  corrected: "Corrigée",
  flagged: "À vérifier",
  active: "Actif",
  inactive: "Inactif",
  accepted: "Acceptée",
  revoked: "Révoquée",
  expired: "Expirée",
  skipped: "Ignorée",
};

/** Statuts de congé, de pointage, d'ajustement, d'adhésion et d'invitation. */
const STATUS_TONE: Record<string, Tone> = {
  // RequestStatus
  draft: "neutral",
  pending: "info",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  // TimeEntryStatus
  open: "info",
  closed: "neutral",
  corrected: "brand",
  flagged: "warning",
  // MemberStatus / InvitationStatus / ApprovalStatus
  active: "success",
  inactive: "neutral",
  accepted: "success",
  revoked: "neutral",
  expired: "warning",
  skipped: "neutral",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Force le libellé ; par défaut, celui de REQUEST_STATUS_LABELS. */
  label?: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
