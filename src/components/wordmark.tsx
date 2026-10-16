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
 * information. Elle clignote par intervalles : trois brefs éclats coup sur coup
 * (300 ms entre chacun) puis un long repos, l'ensemble toutes les cinq secondes
 * (`--animate-temoin`, défini dans `globals.css`) — comme un voyant qui rappelle
 * que le temps tourne. Les personnes qui demandent un mouvement réduit ne le
 * voient pas : la règle globale `prefers-reduced-motion` ramène toute animation à
 * 0,01 ms et une seule itération (vérifié : opacité constante à 1). La couleur
 * vient du parent ; seul « Times » porte `text-brand-strong`.
 *
 * Taille et position : `28px`, `relative`, `top: -5px`, demandées à l'œil par le
 * commanditaire. Conséquence assumée : l'icône ne suit plus la taille du texte,
 * elle est donc plus grande que les lettres là où le mot-marque est petit
 * (barre du haut du téléphone, `text-base`) et à peu près à l'échelle sur les
 * écrans publics (`text-2xl`). La graisse, elle, reste proportionnelle à
 * l'icône : `stroke-[2.4]` est en unités du dessin (viewBox 24), pas en `em`.
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
        // 28 px et remonté de 5 px : valeurs demandées, à l'œil, par le
        // commanditaire. La conséquence est connue et assumée : la taille ne
        // suit plus celle du texte, l'icône est donc plus grande que les lettres
        // là où le mot-marque est petit (barre du haut du téléphone).
        // `stroke-[2.4]` est en unités du dessin (viewBox 24) et non en `em` :
        // la graisse reste proportionnelle à l'icône, quelle que soit la taille
        // du texte à côté.
        className="animate-temoin relative top-[-5px] inline-block size-[28px] align-middle stroke-[2.4]"
      />
      <span className="text-brand-strong">Times</span>
    </span>
  );
}
