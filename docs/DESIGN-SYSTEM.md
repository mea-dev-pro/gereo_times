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
| `PageHeader` | `page-header` | serveur |
| `SearchInput` | `search-input` | client — filtre par l'URL |
| `ThemeToggle` | `theme-toggle` | client |
| `Dialog` | `ui/dialog` | client — `<dialog>` natif |
| `RailNavigation` | `rail-navigation` | client — rail permanent au-dessus de 1024 px, panneau escamotable en dessous |
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

Le seuil est celui de Tailwind : `lg`, soit 1024 px. Au-dessus, le rail est
affiché en permanence (256 px, colonne de gauche) et rien ne change. En dessous —
téléphone et tablette — il est replié derrière un bouton `Menu` de 44 px de haut
dans une barre collante en haut d'écran, qui porte aussi la marque et le nom de
l'organisation.

Trois décisions à connaître avant de toucher à ce composant :

- **Le panneau reste dans le flux**, sous la barre, et n'est pas une fenêtre
  par-dessus le contenu. Aucun piégeage du focus n'est donc nécessaire, rien
  n'est masqué derrière une couche, et le reste de la page demeure atteignable au
  clavier. Une modale pour une navigation coûterait ces garanties-là.
- **Le nom accessible du bouton est stable** (`Menu` / `Fermer`, par
  `aria-label`) : le compteur de notifications qu'il porte est décoratif, sinon
  le bouton s'appellerait « Menu 3 non lue(s) » et tout ce qui s'appuie sur son
  nom deviendrait fragile.
- **La fermeture est événementielle** : le clic dans le panneau et la touche
  Échap replient, sans effet qui recopierait l'URL dans l'état (règle
  `react-hooks/set-state-in-effect` du compilateur React — voir la fiche
  correspondante). Le panneau n'a pas à être refermé au changement de page : il
  l'est déjà au clic sur l'entrée.

Vérification : `tests/e2e/responsive.spec.ts`, joué par trois projets Playwright
— `telephone` (390 px), `tablette` (834 px), `bureau` (1440 px). Chaque test
lit la largeur réelle pour décider de ce qui est attendu, de sorte qu'il affirme
quelque chose aux trois largeurs plutôt que de s'ignorer là où il ne s'applique
pas. `tests/e2e/mobile.spec.ts` couvre la cible tactile et les deux fermetures.

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

