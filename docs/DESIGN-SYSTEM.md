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
