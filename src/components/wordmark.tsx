import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mot-marque : « Gere⏱Times » — le « o » de Gereo laissé dans le texte mais
 * sans corps, l'icône d'un minuteur occupant sa place. C'est l'objet même de
 * l'application : le temps qui se mesure, à l'endroit qu'occuperait la lettre.
 *
 * Le « o » n'est donc PAS retiré du texte, et c'est tout le point. Une icône
 * seule ne se prononce pas : le mot-marque s'annoncerait « GerTimes » au lecteur
 * d'écran, et la ligne d'ordre de tabulation de `clavier.spec.ts` — qui lit le
 * texte rendu de l'élément focalisé — le verrait aussi. La lettre reste écrite,
 * en `text-[0px]` : présente dans la chaîne « GereoTimes » (donc dans une copie,
 * une recherche, une synthèse vocale), invisible et sans largeur à l'écran.
 *
 * Deux tentatives écartées, mesurées dans le navigateur :
 *
 * - `sr-only` : nom accessible correct, mais un élément hors flux crée une
 *   rupture de bloc, et le texte rendu devenait « Gere o Times » ;
 * - la lettre transparente recouverte par une icône en position absolue : même
 *   cause, même effet — l'icône hors flux coupait la chaîne en deux.
 *
 * L'icône est décorative (`aria-hidden`) — une lettre dessinée, pas une
 * information — et tout est en `em` (taille, graisse, alignement) : le même
 * composant tient à `text-base`, `text-lg` et `text-2xl` sans variante. La
 * couleur vient du parent ; seul « Times » porte `text-brand-strong`.
 *
 * Dimensionnement : le cercle occupe les deux tiers de la boîte de l'icône
 * (`circle r=8` sur 24). À `1.05em`, il fait environ `0.75em` — la hauteur d'un
 * « o » gras — et le bouton du chronomètre reste lisible. Mesuré à `0.85em`
 * d'abord : l'icône se lisait comme un tréma sur un « o » (« GeröTimes »), ce
 * qui ne dit plus « chronomètre ».
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    // Surtout PAS de conteneur `flex` ici : dans un conteneur flex, chaque
    // enfant devient un bloc, et le texte rendu (`innerText`) se retrouve coupé
    // en « Gere », « o », « Times » — trois lignes. Mesuré dans le navigateur :
    // un flux en ligne concatène sans séparateur, un flux flex non. C'est ce
    // texte-là que lit la ligne d'ordre de tabulation de `clavier.spec.ts`.
    <span className={cn("whitespace-nowrap", className)}>
      Gere
      {/* La lettre reste dans le texte, à sa place dans la chaîne « GereoTimes »
          (donc dans une copie, une recherche, une synthèse vocale), mais sans
          corps : `text-[0px]` ne peint rien et n'occupe aucune largeur.
          `sr-only` a été essayé : le nom accessible était bon, mais un élément
          hors flux crée une rupture de bloc, et le texte rendait « Gere o
          Times ». */}
      <span className="text-[0px]">o</span>
      <Timer
        aria-hidden="true"
        // `stroke-[0.09em]` suit la taille du texte : la graisse du dessin reste
        // celle du mot-marque, à toutes les tailles. `align-middle` pose le
        // centre de l'icône sur le milieu de la hauteur d'x, comme le ferait le
        // centre d'un « o ».
        className="inline-block size-[1.05em] shrink-0 align-middle stroke-[0.09em]"
      />
      <span className="text-brand-strong">Times</span>
    </span>
  );
}
