import { Skeleton } from "@/components/ui/skeleton";

/**
 * Écran d'attente des pages de l'application.
 *
 * Sans lui, un changement de page ne donne aucun signe de vie avant que le
 * serveur ait rendu la destination : le routeur garde la page précédente à
 * l'écran, puis la remplace d'un coup. C'est ce délai muet qui donne
 * l'impression que la navigation « met du temps à changer de page ».
 *
 * La silhouette reprend celle des pages réelles (en-tête puis cartes), pour que
 * l'arrivée du contenu ne déplace pas la mise en page. `data-chargement` sert
 * de repère aux mesures de `scripts/perf-navigation.mjs`.
 */
export default function Chargement() {
  return (
    <div
      data-chargement="1"
      aria-busy
      className="mx-auto max-w-6xl space-y-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-control" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-card border border-border bg-surface p-4 shadow-card"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
