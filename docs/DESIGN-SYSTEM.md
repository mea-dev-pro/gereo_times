# Design system GereoTimes

Document de référence pour l'interface. Les valeurs de couleur proviennent de
la maquette fournie, **mesurées au pixel** puis ajustées quand le contraste
WCAG l'exigeait.

---

## 1. Tokens

Déclarés dans `src/app/globals.css`, en `@theme inline` pour que la bascule de
thème soit instantanée (les utilitaires référencent la variable à l'exécution).

### Couleurs

| Token | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| `--surface` | `#ffffff` | `#16181d` | cartes, barre latérale |
| `--surface-muted` | `#f8f9fb` | `#0f1115` | fond de page |
| `--border` | `#e3e4e8` | `#272b34` | filets, séparateurs |
| `--border-strong` | `#cbd0d8` | `#3a4049` | bordure des champs |
| `--text` | `#0f172a` | `#f1f5f9` | texte principal |
| `--text-muted` | `#64748b` | `#94a3b8` | texte secondaire |
| `--text-subtle` | `#94a3b8` | `#7b8494` | intitulés, icônes |
| `--brand` | `#8b5cf6` | `#a78bfa` | identité : pastilles, soulignements |
| `--brand-strong` | `#7c3aed` | `#a78bfa` | interactif : boutons, liens |
| `--ring` | `#7c3aed` | `#a78bfa` | anneau de focus |
| `--scrim` | `rgb(15 23 42 / .4)` | `rgb(0 0 0 / .6)` | voile sous le tiroir de navigation |

Classes correspondantes : `bg-surface`, `text-content`, `text-content-muted`,
`border-border`, `bg-brand-soft`, `text-brand-strong`…

### Rayons, ombres, typographie

| Token | Valeur | Usage |
| --- | --- | --- |
| `--radius-card` | `1rem` | cartes, fenêtres |
| `--radius-tile` | `0.75rem` | tuiles d'indicateurs |
| `--radius-control` | `0.5rem` | boutons, champs, pastilles de nav |
| `--shadow-card` | ombre douce | cartes |
| `--shadow-raised` | ombre marquée | fenêtres, notifications |
| `--font-sans` | Geist | tout le texte |

### Pourquoi deux violets

Le violet exact de la maquette, `#8B5CF6`, ne donne que **4,23:1** avec du texte
blanc — sous le seuil AA de 4,5:1. Une vérification par calcul a été faite avant
d'écrire la première ligne.

- `--brand` `#8B5CF6` → pastilles, soulignements, icônes. Jamais sous du texte.
- `--brand-strong` `#7C3AED` → **5,70:1**, pour tout élément portant du texte.

---

## 2. Les cinq teintes sémantiques

Elles ne sont pas décoratives. Chaque couleur porte un sens constant dans toute
l'application, ce qui évite qu'une même situation change d'aspect d'un écran à
l'autre.

| Teinte | Sens | Composant |
| --- | --- | --- |
| violet | solde disponible — action possible | `StatCard tint="violet"` |
| bleu | en attente de validation — bloqué, non fautif | `tint="sky"` |
| pêche | consommé ou réservé | `tint="peach"` |
| menthe | acquis contractuel | `tint="mint"` |
| ambre | attention — échéance, jour férié | `tint="amber"` |

Contrastes vérifiés (texte sur fond de tuile) : 7,57 / 7,15 / 6,38 / 6,73 /
6,15 — tous au-dessus de 4,5:1.

---

## 3. Composants

| Composant | Fichier | Nature |
| --- | --- | --- |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `ui/card` | serveur |
| `Button` | `ui/button` | serveur |
| `Badge` | `ui/badge` | serveur |
| `StatusBadge` | `ui/status-badge` | serveur — table unique statut → teinte |
| `StatCard` | `ui/stat-card` | serveur |
| `EmptyState` | `ui/empty-state` | serveur |
| `Skeleton`, `SkeletonRows` | `ui/skeleton` | serveur |
| `DataTable` | `ui/data-table` | **serveur** — colonnes avec fonction de rendu |
| `FilterBar`, `FilterField` | `ui/filter-bar` | serveur |
| `Alert` | `ui/alert` | serveur |
| `PageHeader` | `page-header` | serveur — `icon` optionnel (décoratif) pour la salutation d'accueil |
| `SearchInput` | `search-input` | client — filtre par l'URL |
| `ThemeToggle` | `theme-toggle` | client |
| `Dialog` | `ui/dialog` | client — `<dialog>` natif |
| `AppShell` | `app-shell` | client — barre du haut, rail collé de 256 px et haut d'un écran au-dessus de 1024 px, tiroir coulissant en dessous, contenu inerte tant qu'il est recouvert |
| `AuthShell`, `AuthCard` | `auth-shell` | serveur — habillage des écrans publics : barre du haut, décor de traits (≥ 1024 px), carte centrée |
| `PasswordInput` | `ui/password-input` | client — champ mot de passe affichable à la demande |
| `OAuthButtons` | `oauth-buttons` | client — boutons des fournisseurs d'identité réellement activés |
| `MarqueFournisseur` | `marques-fournisseurs` | serveur — marques officielles des fournisseurs (couleurs de marque, hors thème) |
| `Wordmark` | `wordmark` | serveur — le mot-marque « Gereo⏱Times » : le « o » remplacé par l'icône du minuteur |
| `ToastProvider`, `useToast` | `ui/toast` | client |

`StatusBadge` et `EmptyState` sont ré-exportés depuis `ui/badge` et `ui/alert` :
les importer depuis l'un ou l'autre fichier donne le même composant.

### Pourquoi `DataTable` reste un composant serveur

Les colonnes reçoivent une fonction de rendu (`cell: (row) => ReactNode`), ce
qui permet d'y placer un badge, un lien ou un bouton sans contorsion. Cela n'est
possible que côté serveur : passer le tableau en composant client obligerait à
décrire les colonnes de façon déclarative et ferait perdre cette souplesse.
Le filtrage ne passe donc pas par le tableau mais par l'URL.

### Pourquoi `Dialog` utilise `<dialog>` natif

L'élément natif en mode modal fournit gratuitement le piégeage du focus, la
fermeture par Échap, l'inertie du contenu derrière et le retour du focus sur le
déclencheur — les quatre points que le critère UX-06 exige et qu'une modale
improvisée rate le plus souvent. Aucune dépendance ajoutée.

### Le mot-marque, et pourquoi le « o » est un minuteur

« Gere⏱Times » : le « o » de Gereo garde sa place dans le texte mais perd son
corps, et l'icône `Timer` de Lucide occupe sa place à l'écran
(`src/components/wordmark.tsx`). C'est l'objet même de l'application — le temps
qui se mesure — à l'endroit qu'occuperait la lettre. Le composant est utilisé aux
quatre endroits où le mot-marque apparaît : barre du haut (téléphone et
tablette), rail de bureau, écrans publics (`AuthShell`), écran « dernière
étape » d'une nouvelle organisation.

Trois règles, chacune née d'un défaut constaté :

- **Le « o » reste dans le texte**, écrit mais sans corps (`text-[0px]`). Une
  image ne se prononce pas : sans la lettre, le mot-marque s'annonce « GerTimes »
  au lecteur d'écran et se copie amputé. Deux contournements ont été mesurés
  dans le navigateur puis écartés : `sr-only`, et la lettre transparente
  recouverte par une icône en position absolue. Tous deux placent un élément
  **hors flux**, ce qui crée une rupture de bloc : le texte rendu devenait
  « Gere o Times » — exactement ce que relève `clavier.spec.ts`, qui lit
  `innerText` de l'élément focalisé pour établir l'ordre de tabulation.
- **Le conteneur n'est pas un `flex`.** Mesuré aussi : dans un conteneur flex
  chaque enfant devient un bloc, et le même texte se coupe en trois lignes. Le
  mot-marque est donc un simple flux en ligne, où l'icône s'insère comme une
  lettre (`inline-block align-middle`).
- **Tout est en `em`** — graisse et alignement (`stroke-[2.4]`, `align-middle`) :
  la finesse du dessin suit la boîte de l'icône, et non la taille du texte à
  côté. La couleur vient du parent : seul « Times » porte `text-brand-strong`,
  comme avant. L'icône est décorative (`aria-hidden`) : une lettre dessinée, pas
  une information.

La **taille** fait exception, et c'est un choix du commanditaire : l'icône est
figée à `28px`, en `relative` avec `top: -5px` (valeurs demandées à l'œil, après
comparaison sur le tableau de bord). Elle ne suit donc pas la taille du texte :
proportionnée sur les écrans publics (`text-2xl`), nettement plus grande que les
lettres dans la barre du haut du téléphone (`text-base`) — constaté sur captures,
et jugé acceptable ainsi.

L'icône **clignote par intervalles** : `--animate-temoin` (`globals.css`) donne un
bref éclat toutes les cinq secondes — opacité `1 → 0,45 → 1,12` en échelle sur
les premiers 12 % du cycle, repos le reste du temps. Un voyant plutôt qu'une
pulsation continue : une animation permanente attire l'œil sans rien dire, et
c'est le contenu qui doit le retenir. Mesuré dans le navigateur : opacité
descendant à `0,46` sur un cycle de 6 s. Avec `prefers-reduced-motion: reduce`,
la règle globale du fichier de thème ramène l'animation à `0,01 ms` et une seule
itération — l'icône reste alors parfaitement immobile (opacité constante à 1).

Historique utile pour la suite : mesurée d'abord à `0.85em`, l'icône se lisait
comme un tréma sur un « o » (« GeröTimes ») — le bouton du chronomètre ne se
distinguait pas du cercle. À `1.05em` puis à `28px`, il se reconnaît. Le repère
de dimensionnement : le cercle occupe les deux tiers de la boîte de l'icône
(`circle r=8` sur un viewBox de 24), il fait donc ~19 px de diamètre à `28px`.

Mesures de contrôle (Chromium, `ariaSnapshot` et `innerText`) : le texte rendu
comme le texte du DOM sont exactement « GereoTimes » aux trois tailles. Le nom
accessible calculé, lui, ressort en « Gereo Times » — Chromium sépare les nœuds
de texte par une espace — et c'était déjà le cas avec le balisage précédent
(`Gereo` + `<span>Times</span>`) : rien n'a régressé de ce côté.

---

## 4. Règles à respecter

1. **Jamais de couleur codée en dur.** Utiliser les tokens. Une classe
   `text-slate-900` ne s'adapte pas au thème sombre — c'est exactement ce qui a
   rendu le tableau de bord illisible lors de la mise en place.
2. **Pas de `dark:` sur les couleurs sémantiques.** Si un token existe, la
   variante sombre est déjà dedans. `dark:` ne sert qu'aux cas particuliers,
   comme `dark:bg-white/5` pour un aplat translucide.
3. **Un seul `<h1>` par page**, fourni par `PageHeader`. Le titre de l'onglet
   passe par `export const metadata`.
4. **Toute liste vide passe par `EmptyState`**, avec un titre qui dit ce qui
   manque et une description qui dit quoi faire.
5. **Toute action sensible passe par `Dialog`** plutôt qu'une confirmation
   native du navigateur.
6. **Un contraste se vérifie par le calcul, pas à l'œil.** Une paire de couleurs
   qui « semble » lisible peut être à 4,2:1.

---

## 5. Ajouter un écran

```tsx
export const metadata: Metadata = { title: "Mon écran" };
export const instant = false; // dès qu'on lit la session ou les searchParams

export default async function Page({ searchParams }) {
  const session = await requireSession();     // + contrôle de rôle
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Mon écran" description="…" />

      <FilterBar>
        <FilterField label="Recherche">
          <SearchInput initial={q ?? ""} />
        </FilterField>
      </FilterBar>

      <Card>
        <CardContent>
          <DataTable
            columns={colonnes}
            rows={lignes}
            rowKey={(r) => r.id}
            empty={<EmptyState title="Aucun élément" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

Le contrôle de rôle se fait **côté serveur**, avant toute lecture de données.
Masquer une entrée de navigation n'est pas une protection.

### Rail de navigation et responsive

Le seuil est celui de Tailwind : `lg`, soit 1024 px. Au-dessus, le rail est une
colonne permanente de 256 px à gauche, **collée en haut de la fenêtre et haute
d'un écran** (`sticky top-0 h-dvh`). Il ne prend donc pas la hauteur du contenu :
sur une page longue — pointage du mois, rapport — le rail reste en place pendant
que la page défile, et les commandes du bas (compte, bascule de thème, « Se
déconnecter ») restent à l'écran sans qu'il faille descendre au bout de la page.
Quand la fenêtre est plus courte que le rail, c'est le rail qui défile
(`overflow-y-auto`), pas la page. En dessous — téléphone et tablette — la
navigation est un **tiroir** : un panneau fixe de 320 px (jamais
plus de 85 % de l'écran) qui glisse depuis la gauche **par-dessus** le contenu,
sous une barre collante de 56 px portant la marque, le nom de l'organisation et
un bouton `Menu` de 44 px de haut.

Le contenu ne réserve donc plus une seule ligne : replié, l'écran commence
directement sous la barre. C'est la raison d'être du tiroir — la version
précédente, dans le flux, consommait 663 px avant le contenu sur un téléphone.

Quatre décisions à connaître avant de toucher à `AppShell` :

- **Le contenu est inerte tant que le tiroir est ouvert** (`inert` sur `main`).
  Recouvert par le voile, il ne doit plus prendre le focus : sans cela, la
  tabulation sortirait du panneau pour aller derrière le voile, où rien n'est
  visible. C'est le prix d'une couche, et il est payé autrement que par un
  piégeage du focus écrit à la main.
- **Le focus entre dans le panneau à l'ouverture** et revient sur le bouton à la
  fermeture par Échap — le seul chemin de fermeture qui ne soit pas suivi d'une
  navigation ou d'un clic de souris.
- **La barre du haut reste au-dessus du tiroir** : le panneau et le voile
  commencent sous elle, donc le bouton `Fermer` demeure visible et cliquable, et
  le voile n'occulte jamais la commande qui l'a ouvert.
- **Le nom accessible du bouton est stable** (`Menu` / `Fermer`, par
  `aria-label`) : le compteur de notifications qu'il porte est décoratif, sinon
  le bouton s'appellerait « Menu 3 non lue(s) » et tout ce qui s'appuie sur son
  nom deviendrait fragile.

Deux points d'implémentation :

- **La fermeture est événementielle** : le clic dans le panneau, le clic sur le
  voile et la touche Échap replient, sans effet qui recopierait l'URL dans l'état
  (règle `react-hooks/set-state-in-effect` du compilateur React — voir la fiche
  correspondante). Le panneau n'a pas à être refermé au changement de page : il
  l'est déjà au clic sur l'entrée.
- **Le seuil est lu côté client** (`useSyncExternalStore` sur `matchMedia`), pour
  que l'inertie du contenu se lève si la fenêtre repasse au-dessus de 1024 px
  avec le tiroir ouvert. Le serveur et le premier rendu répondent « petit
  écran », c'est-à-dire l'état replié que décrit le HTML statique.

Le voile utilise le jeton `--scrim` : une couleur codée en dur ne suivrait pas le
thème sombre.

Vérification : `tests/e2e/responsive.spec.ts`, joué par trois projets Playwright
— `telephone` (390 px), `tablette` (834 px), `bureau` (1440 px). Chaque test
lit la largeur réelle pour décider de ce qui est attendu, de sorte qu'il affirme
quelque chose aux trois largeurs plutôt que de s'ignorer là où il ne s'applique
pas. Il vérifie notamment que le contenu ne bouge pas d'un pixel à l'ouverture :
c'est la preuve que la navigation ne réserve plus d'espace. Au bureau, un
contrôle supplémentaire fixe sa propre fenêtre (1440 × 900), ouvre le pointage du
mois, fait défiler la page et exige que le rail ne bouge pas d'un pixel et que
« Se déconnecter » reste dans la fenêtre : c'est la preuve qu'il ne suit plus la
hauteur du contenu.
`tests/e2e/mobile.spec.ts` couvre la cible tactile, la fermeture par le voile,
les deux autres fermetures, et le fait que le focus n'entre jamais dans le
contenu recouvert.

---

## Revue visuelle

```bash
npm run captures        # 20 captures dans docs/captures/ (1440 px et 390 px)
```

L'application doit tourner (`npm run dev`) et les sessions de test être
préparées (`npm run e2e:auth`). Le script retire l'indicateur Next.js Devtools,
qui n'existe qu'en développement et apparaîtrait sinon sur chaque image.

La comparaison avec la maquette de référence, les valeurs mesurées et les écarts
résiduels sont consignés dans `docs/REVUE-COMPARATIVE.md`.

