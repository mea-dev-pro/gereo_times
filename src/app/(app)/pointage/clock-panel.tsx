"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Coffee, LogIn, LogOut, Play, Timer } from "lucide-react";
import { clockIn, clockOut, endBreak, startBreak } from "@/lib/actions/time";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { DialogPanel } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/utils";

/** Seuil en deçà duquel la sortie est confirmée : un clic de trop est probable. */
const SEUIL_CONFIRMATION_MIN = 5;

type Etat = "ferme" | "actif" | "pause";

const APPARENCE: Record<
  Etat,
  { cadre: string; pastille: string; libelle: string }
> = {
  ferme: {
    cadre: "border-border bg-surface-muted",
    pastille: "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200",
    libelle: "Hors service",
  },
  actif: {
    cadre: "border-teal-200 bg-teal-100 dark:border-teal-400/25 dark:bg-teal-500/15",
    pastille: "bg-teal-400 text-teal-950",
    libelle: "En activité",
  },
  pause: {
    cadre: "border-amber-200 bg-amber-100 dark:border-amber-400/25 dark:bg-amber-500/15",
    pastille: "bg-amber-500 text-white",
    libelle: "En pause",
  },
};

function duree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h} h ${mm} min ${ss} s` : `${m} min ${ss} s`;
}

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Secondes écoulées depuis `depart`, rafraîchies chaque seconde ; `null` tant
 * que le point de départ est inconnu.
 *
 * `useSyncExternalStore` plutôt qu'un effet qui appelle `setState` : la valeur
 * vient d'une horloge extérieure à React. L'instantané serveur vaut `null`, donc
 * le HTML rendu par le serveur ne contient jamais de compteur — sinon le
 * navigateur et le serveur ne calculeraient pas la même seconde et
 * l'hydratation protesterait. Le minuteur n'existe que tant que quelqu'un
 * écoute, et il disparaît avec le dernier abonné.
 */
function useSecondesEcoulees(depart: string | null): number | null {
  const souscrire = useCallback(
    (notifier: () => void) => {
      if (!depart) return () => {};
      const minuteur = setInterval(notifier, 1000);
      return () => clearInterval(minuteur);
    },
    [depart]
  );

  const lire = useCallback(
    () =>
      depart
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(depart).getTime()) / 1000)
          )
        : null,
    [depart]
  );

  return useSyncExternalStore(souscrire, lire, () => null);
}

export function ClockPanel({
  isOpen,
  isOnBreak,
  clockedInAt,
  breakStartedAt,
  minutesEffectivesJour,
  minutesPauseJour,
}: {
  isOpen: boolean;
  isOnBreak: boolean;
  clockedInAt: string | null;
  breakStartedAt: string | null;
  /** Total des sessions déjà clôturées aujourd'hui. */
  minutesEffectivesJour: number;
  minutesPauseJour: number;
}) {
  const etat: Etat = !isOpen ? "ferme" : isOnBreak ? "pause" : "actif";
  const apparence = APPARENCE[etat];

  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const { notifier } = useToast();
  const dialogue = useRef<HTMLDialogElement>(null);

  // Compteurs vivants : voir `useSecondesEcoulees`, qui garantit un premier
  // rendu sans valeur pour ne pas diverger de l'hydratation.
  const ecoule = useSecondesEcoulees(clockedInAt);
  const pauseEcoulee = useSecondesEcoulees(isOnBreak ? breakStartedAt : null);

  // Temps effectif du jour = sessions clôturées + session en cours, pauses
  // déduites. Le calcul reste faux tant que les compteurs ne sont pas montés,
  // d'où le repli sur les seules sessions clôturées.
  const pauseEnCours = pauseEcoulee ?? 0;
  const secondesEffectives =
    ecoule === null ? null : Math.max(0, ecoule - pauseEnCours);
  const minutesEffectives =
    minutesEffectivesJour +
    (secondesEffectives === null ? 0 : Math.floor(secondesEffectives / 60));
  const minutesPause =
    minutesPauseJour +
    (isOnBreak ? Math.floor(pauseEnCours / 60) : 0);

  function executer(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const resultat = await fn();
      if (resultat?.error) notifier({ titre: resultat.error, ton: "danger" });
      else if (resultat?.success)
        notifier({ titre: resultat.success, ton: "success" });
    });
  }

  function demanderSortie() {
    const minutes = Math.floor((ecoule ?? 0) / 60);
    // La décision se prend au moment du clic, pas au rendu : une session peut
    // franchir le seuil pendant que la fenêtre est ouverte.
    if (isOpen && minutes < SEUIL_CONFIRMATION_MIN) {
      dialogue.current?.showModal();
      return;
    }
    executer(() => clockOut(note));
  }

  return (
    <div className={cn("rounded-card border p-5", apparence.cadre)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              apparence.pastille
            )}
          >
            <Timer className="size-3.5" aria-hidden="true" />
            {apparence.libelle}
          </span>

          <p className="mt-3 text-sm text-content-muted">
            {isOpen && clockedInAt ? (
              <>
                Depuis <strong className="text-content">{heure(clockedInAt)}</strong>
              </>
            ) : (
              "Aucune session ouverte"
            )}
          </p>

          {/* Hors service, il n'y a rien à chronométrer : afficher un compteur
              à zéro réserverait une place vide sans rien dire. */}
          {isOpen ? (
            // tabular-nums : sans cela, le compteur tressaute à chaque seconde.
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-content">
              {ecoule === null ? (
                <span className="opacity-0">0 min 00 s</span>
              ) : (
                duree(ecoule)
              )}
            </p>
          ) : null}
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">
            Aujourd&apos;hui
          </p>
          <p className="mt-1 text-sm font-semibold text-content">
            {formatMinutes(minutesEffectives)} effectives
          </p>
          <p className="text-xs text-content-muted">
            {minutesPause > 0
              ? `${formatMinutes(minutesPause)} de pause`
              : "aucune pause"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {etat === "ferme" && (
          <Button
            variant="brand"
            size="lg"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() => executer(() => clockIn())}
          >
            <LogIn className="size-4" aria-hidden="true" />
            {pending ? "…" : "Pointer l'arrivée"}
          </Button>
        )}

        {etat === "actif" && (
          <>
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={demanderSortie}
            >
              <LogOut className="size-4" aria-hidden="true" />
              {pending ? "…" : "Pointer la sortie"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => executer(() => startBreak())}
            >
              <Coffee className="size-4" aria-hidden="true" />
              Démarrer une pause
            </Button>
          </>
        )}

        {etat === "pause" && (
          <>
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => executer(() => endBreak())}
            >
              <Play className="size-4" aria-hidden="true" />
              {pending ? "…" : "Reprendre"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={demanderSortie}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Pointer la sortie
            </Button>
          </>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
          <label
            htmlFor="note-sortie"
            className="mb-1 block text-xs font-medium text-content-muted"
          >
            Note de fin de journée (facultatif)
          </label>
          <Input
            id="note-sortie"
            placeholder="Ce que vous avez fait, un imprévu…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
      )}

      {/* Confirmation réservée aux sessions très courtes : sortir après 30
          secondes est presque toujours un clic de trop. */}
      <DialogPanel
        ref={dialogue}
        title="Confirmer la sortie"
        description="La session est très courte. Est-ce bien ce que vous voulez ?"
      >
        <div className="space-y-4">
          <dl className="space-y-2 rounded-control bg-surface-muted px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">Arrivée</dt>
              <dd className="font-medium text-content">
                {clockedInAt ? heure(clockedInAt) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">Durée de la session</dt>
              <dd className="font-medium tabular-nums text-content">
                {ecoule === null ? "—" : duree(ecoule)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">Effectif aujourd&apos;hui</dt>
              <dd className="font-medium text-content">
                {formatMinutes(minutesEffectives)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => dialogue.current?.close()}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="brand"
              disabled={pending}
              className="w-full sm:w-auto"
              onClick={() => {
                dialogue.current?.close();
                executer(() => clockOut(note));
              }}
            >
              Confirmer la sortie
            </Button>
          </div>
        </div>
      </DialogPanel>
    </div>
  );
}
