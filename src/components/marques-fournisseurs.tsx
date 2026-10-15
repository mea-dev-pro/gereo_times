import type { Fournisseur } from "@/lib/auth/fournisseurs";

/**
 * Marques des fournisseurs d'identité, pour leurs boutons de connexion.
 *
 * EXCEPTION ASSUMÉE à la règle « aucune ressource tierce n'est recopiée ». La
 * règle vise les marques décoratives — la maquette de référence affichait un
 * rail d'icônes d'applications tierces, qui n'a rien à faire ici. Un bouton de
 * connexion est l'autre cas : Google, Apple et Facebook demandent explicitement
 * l'usage de leur marque officielle pour leurs boutons, et une icône inventée y
 * serait plus gênante qu'une marque reconnue.
 *
 * Les couleurs de marque ne suivent donc PAS le thème : les quatre teintes du
 * « G » de Google, le bleu de Facebook sont imposés par la charte du
 * fournisseur, et les repeindre serait une infraction. Seule la marque Apple,
 * qui n'existe qu'en noir ou blanc, prend la couleur du texte courant.
 *
 * Les marques sont `aria-hidden` : le nom accessible du bouton reste son texte
 * (« Continuer avec Google »), ce qui évite qu'un lecteur d'écran annonce la
 * marque en plus de l'action.
 */
export function MarqueFournisseur({
  fournisseur,
  className = "size-[18px] shrink-0",
}: {
  fournisseur: Fournisseur;
  className?: string;
}) {
  if (fournisseur === "google") {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    );
  }

  if (fournisseur === "apple") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.29-.88-2.31-3.5zM14.88 5.6c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.55 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.57-1.23z"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#FFFFFF"
        d="M16.4 15.47l.53-3.47h-3.33V9.75c0-.95.47-1.88 1.96-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7.02v3.47h2.84V24a11.9 11.9 0 003.74 0v-8.53h2.8z"
      />
    </svg>
  );
}
