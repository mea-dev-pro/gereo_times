import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate une durée en minutes vers « 7 h 30 ». */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h} h ${String(m).padStart(2, "0")}`;
}

/** Formate une date ISO (yyyy-mm-dd) vers jj/mm/aaaa sans décalage de fuseau. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Nombre de jours entiers écoulés depuis un horodatage ISO.
 *
 * Lit l'heure courante : à réserver au serveur (page, action, route), jamais
 * pendant le rendu d'un composant client. Les pages qui l'utilisent exportent
 * `instant = false`, elles sont donc rendues à chaque requête.
 */
export function joursDepuis(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Nombre de jours ouvrés entre deux dates incluses, hors week-end. */
export function workingDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  let count = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Heure locale (0–23) dans un fuseau donné, et moment de la journée qui en
 * découle pour la salutation d'accueil.
 *
 * Le fuseau vient de l'appartenance (repli sur celui de l'organisation) : lire
 * l'heure du serveur donnerait « Bonjour » à 08 h UTC, soit 11 h à
 * Antananarivo — et un autre résultat en production, qui tourne en UTC.
 */
export type MomentDeLaJournee = "matin" | "apres-midi" | "soir";

function heureLocale(timezone: string, instant: Date): number {
  try {
    const parties = new Intl.DateTimeFormat("fr-FR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).formatToParts(instant);
    const heure = Number(parties.find((p) => p.type === "hour")?.value);
    if (Number.isFinite(heure)) return heure;
  } catch {
    // Fuseau inconnu — la colonne accepte du texte libre. On retombe sur
    // l'heure du serveur plutôt que de faire échouer l'écran d'accueil.
  }
  return instant.getHours();
}

export function momentDeLaJournee(
  timezone: string,
  instant: Date = new Date()
): MomentDeLaJournee {
  const heure = heureLocale(timezone, instant);
  if (heure >= 5 && heure < 12) return "matin";
  if (heure >= 12 && heure < 18) return "apres-midi";
  return "soir";
}

export const ROLE_LABELS: Record<string, string> = {
  employee: "Employé",
  manager: "Manager",
  hr: "RH",
  admin: "Administrateur",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

export const MOVEMENT_LABELS: Record<string, string> = {
  accrual: "Acquisition",
  carryover: "Report",
  expiry: "Expiration",
  correction: "Correction",
  reservation: "Réservation",
  release: "Libération",
  consumption: "Consommation",
  restitution: "Restitution",
};
