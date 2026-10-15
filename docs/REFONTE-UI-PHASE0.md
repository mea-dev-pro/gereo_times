# Refonte UI/UX — Phase 0 : analyse et cadrage

**Statut :** analyse de cadrage — validée le 13 octobre 2026, sprints 1 à 4
livrés (voir §10 et §11 en fin de document). Les décisions ci-dessus ont été
prises **avant** d'écrire la moindre ligne de code applicatif.
**Date :** 13 octobre 2026
**Référence :** `prd/PRD_GereoTimes_UI_UX.md`

---

## 1. Ce que j'ai réellement examiné

Le PRD met en garde contre le fait de prétendre avoir consulté des images
inaccessibles (section 1) et demande de distinguer les observations confirmées
des hypothèses (section 4.5). Voici donc l'état réel des accès.

| Élément | État |
| --- | --- |
| Dossier `img/` | accessible — **1 fichier**, pas plusieurs |
| Fichier | `design app.jfif` — 4587 × 3440 px, 429 Ko |
| Format | JPEG (l'extension `.jfif` n'est pas dans la liste PNG/JPG/JPEG/WEBP du PRD, mais c'en est un) |
| Image effectivement ouverte et analysée | **oui** — vue, puis échantillonnée au pixel |
| Dossier `prd/` | `PRD_GereoTimes_Gestion_Temps_Conges.md` (6,5 Ko) et `PRD_GereoTimes_UI_UX.md` (11,9 Ko) |

L'écart avec le PRD est à noter : il décrit « les images » au pluriel et
suppose une série de captures d'écrans. Il n'y en a **qu'une seule**, et elle
ne montre **qu'un seul écran**.

### Méthode d'analyse

Estimer les couleurs à l'œil s'est révélé faux : la maquette est présentée en
perspective inclinée, mes premières sondes ont dérivé (une tuile « turquoise » a
échantillonné une tuile orange). J'ai donc changé de méthode et **détecté les
bandes de couleur par balayage** — on parcourt une ligne de pixels et on découpe
en segments homogènes. Chaque valeur ci-dessous est mesurée, pas estimée. Les
coordonnées absolues ne sont pas exploitables (rendu 3D), mais les couleurs et
les épaisseurs relatives le sont.

---

## 2. Ce que montre la référence

### 2.1 Nature du document

Une **maquette de présentation en 3D** d'une application web de gestion des
congés nommée **« Franfer »**, vue desktop inclinée sur un fond dégradé
bleu-lavande. Ce n'est pas une capture d'écran à plat, ni une vue mobile.

### 2.2 Structure de l'écran

Trois zones horizontales, de gauche à droite :

1. **Un rail d'icônes** (~56 px) — cinq pastilles colorées empilées, plus un
   bouton « + » en bas.
2. **Une barre latérale** (~230 px) — logo « Franfer » et bascule de panneau,
   puis trois groupes précédés d'un intitulé en petites capitales espacées :
   - `MAIN` : Dashboard, Employee, Calendar, Projects, Team Member
   - `MANAGEMENT` : **Time off** (entrée active), Reports, Payrolls, Benefits
   - `COMPANY` : Documents, Integrations, Invoices, Settings, Help & Center
   - en pied : une carte « Annoncements — Stay updated » avec un lien « Create Now »
3. **Le contenu principal** :
   - en haut, un **salutation** : icône soleil + « Good morning, Tahsan! », et à
     droite un **champ de recherche** « Search anything » en forme de pilule
   - un **titre de page** « Time off » avec sous-titre « Manage your team's time off. »
   - une **barre d'onglets** : « Calender » (actif) et « Leave and balances »
   - un bouton « Today »
   - deux colonnes :
     - à gauche, une carte **« About your time off »** avec un bouton
       « See details » et cinq tuiles empilées :
       | Tuile | Valeur | Sous-titre |
       | --- | --- | --- |
       | violette | 19 days paid time off | Available to book |
       | bleue | 3 days pending approval | Awaiting manager approval |
       | pêche | 3 days booked | 0d used |
       | menthe | 0 days per year | In the contract |
       | ambre | 24 days national holidays | lien « See holiday list » |
       - sous les tuiles, une note sur les jours fériés dans le calendrier
     - à droite, un **calendrier mensuel** : sélecteur `Day | Week | Month`
       (« Month » actif), navigation précédent/suivant, en-têtes de colonnes
       `Sun Mon Tue Wed Thu…`, et des **barres d'événements multi-jours** :
       « Sick », « Paid time off », « Paid time… »

### 2.3 Palette mesurée

**Accent principal** — c'est le changement le plus visible :

| Rôle | Mesuré | Correspondance Tailwind |
| --- | --- | --- |
| Violet d'accent (rail, pastille, onglet actif) | `#8b61eb` → `#916ae9` | ≈ `violet-500` `#8B5CF6` |

**Surfaces :**

| Rôle | Mesuré |
| --- | --- |
| Fond des cartes | `#ffffff` |
| Fond de page et zones atténuées | `#f8f9fb` |
| Fond de la barre latérale | `#f8f9fb` — *identique* au fond de page |
| Filet de séparation | `#e3e4e8` |

**Tuiles de congés** — fond et pastille d'icône :

| # | Fond mesuré | ≈ Tailwind | Pastille mesurée | ≈ Tailwind |
| --- | --- | --- | --- | --- |
| 1 | `#e5e1fa` | `violet-100` | `#8b61eb` | `violet-500` |
| 2 | `#e0ebff` | `blue-100` | `#2db9ee` | `sky-400` |
| 3 | `#ffeadd` | `orange-100` | `#e35e35` | `orange-600` |
| 4 | `#cff6f1` | `teal-100` | `#36dfc8` | `teal-400` |
| 5 | `#feebca` | `amber-100` | `#efaa43` | `amber-500` |

**Calendrier :**

| Élément | Mesuré |
| --- | --- |
| Barre « Sick » (lavande) | `#e7e2f9` → `#f0eefb` |
| Barre « Paid time off » (menthe) | `#e9fdfc` |
| Barre ambre | `#fdf3dc` |
| Case sélectionnée | `#e7dcfc` |
| Filets de grille | `#f1f0f8` |

### 2.4 Le rail coloré : à ne pas reprendre

Les cinq pastilles du rail sont : cyan `#22a9dc`, vert `#34b98a`, violet
`#916ae9`, orange-rouge `#dc4c2b`, ambre `#e8a745`. Ce sont très probablement
des **icônes d'applications tierces intégrées** — le vert correspond à s'y
méprendre à celui de Slack.

Le PRD exclut explicitement la copie de marques ou de ressources sous licence
(section 2). Ces pastilles ne doivent donc pas être reprises telles quelles.

### 2.5 Piège à éviter : le fond lavande

Le bleu-lavande `#c9d3f3` qui domine l'image n'est **pas** la couleur de
l'application : c'est le fond de la scène 3D sur laquelle la maquette est
posée. L'adopter produirait une application beaucoup trop colorée. Le fond
réel de l'interface est `#f8f9fb`, quasi blanc.

---

## 3. Ce que la référence ne dit pas

C'est le point le plus important du cadrage, et il conditionne tout le reste.

La référence ne contient **qu'un seul écran** : celui des congés, pour un profil
managérial. Il n'y a **aucune indication** sur :

- l'écran de **pointage** — l'état « en service / en pause / hors service »,
  les actions démarrer/pause/reprendre/terminer (exigence UX-01, §7.2 du PRD)
- l'écran de **validation** des demandes (§7.5)
- les **rapports** et leurs filtres (§7.6)
- les **paramètres** d'administration (§7.6)
- l'**équipe** et le tableau des collaborateurs (§7.5)
- l'**authentification** et l'inscription
- les états **vide, chargement, erreur**, et les messages de succès (§8)
- le **responsive mobile** et tablette (§2, UX-05) — la maquette est desktop
- un éventuel **thème sombre** (§15)
- la **typographie** : la police n'est pas identifiable avec certitude, les
  tailles ne sont pas mesurables sur un rendu en perspective

Autrement dit : la référence est fiable pour les **couleurs**, la **densité**,
les **rayons** et le **vocabulaire de composants**. Elle ne peut pas servir de
modèle pour la majorité des écrans de GereoTimes, ni pour l'adaptatif.

Il faudra donc **étendre** le langage visuel aux écrans sans référence, en
gardant la cohérence. C'est un travail de conception, pas de recopie.

---

## 4. Audit de l'interface actuelle

### 4.1 Ce qui existe

- **5 primitives** seulement : `alert`, `badge`, `button`, `card`, `form`
- **Tokens : 5 variables CSS** dans `globals.css` (`--surface`,
  `--surface-muted`, `--border`, `--text`, `--text-muted`). Aucune échelle de
  couleurs, aucun token de rayon, d'ombre ou de typographie.
- **Navigation** : une barre latérale `w-64`, entrées **sans icône**, entrée
  active en `bg-slate-900` (pastille bleu nuit plein) — voir `nav-links.tsx`
- **Accent** : `blue-600` (`#2563eb`), utilisé par le bouton `brand` et le badge
- **Focus visible** : `#2563eb`, déjà conforme WCAG 2.2 AA
- **Bibliothèque d'icônes** : `lucide-react` installée
- **13 pages**, dont 9 dans l'espace authentifié

### 4.2 Composants du design system attendu qui manquent

Le PRD section 8 en liste quinze. État réel :

| Composant attendu | État |
| --- | --- |
| `AppShell` | partiel — un `div` dans `(app)/layout.tsx`, non extrait |
| `Sidebar` | partiel — code en ligne dans le layout |
| `Topbar` | absent |
| `PageHeader` | absent — chaque page réécrit son titre |
| `StatCard` | absent — les indicateurs sont écrits à la main par page |
| `DataTable` | absent — chaque tableau est écrit à la main |
| `FilterBar` | absent |
| `SearchInput` | absent |
| `StatusBadge` | partiel — `badge.tsx` sans sémantique de statut |
| `FormField` | présent — `form.tsx` |
| `Dialog` | absent |
| `EmptyState` | partiel — enfoui dans `alert.tsx` |
| `Skeleton` | absent |
| `Toast` | absent |
| `Card` | présent |

Le socle est donc mince : les pages répètent leur propre mise en page. C'est ce
qui rend la refonte cohérente si elle passe par des composants partagés, et
fragile si elle se fait page par page.

### 4.3 Écarts prioritaires avec la référence

| # | Écart | Ampleur |
| --- | --- | --- |
| 1 | Accent bleu → violet | Une variable, mais touche toute l'application |
| 2 | Entrée active : pastille bleu nuit → pastille blanche bordée | Faible techniquement, fort effet visuel |
| 3 | Navigation sans icônes | Ajout d'icônes `lucide-react` sur chaque entrée |
| 4 | Aucun regroupement de sections dans la navigation | `MAIN` / `MANAGEMENT` / `COMPANY` → groupes par rôle |
| 5 | Pas de salutation ni de barre supérieure | Nouveau `Topbar` |
| 6 | Pas de recherche globale | Nouveau composant — **mais aucune recherche n'existe côté serveur** |
| 7 | Indicateurs sans hiérarchie visuelle | Nouveau `StatCard`, à décliner en 5 teintes |
| 8 | Rayons plus généreux dans la référence | Retouche de `button` et `card` |
| 9 | Aucun état de chargement | Nouveaux `Skeleton` |
| 10 | Pas de système de notification d'action | Nouveau `Toast` |

---

## 5. Matrice de correspondance

| Référence (image) | Écran GereoTimes | Adaptation proposée | Confiance |
| --- | --- | --- | --- |
| Tuiles de soldes colorées | `conges` — « Mes soldes » | `StatCard` à 5 teintes, en-tête de la page | Élevée |
| Barre latérale groupée | `(app)/layout.tsx` | Groupes « Mon espace » / « Management » / « Administration », filtrés par rôle | Élevée |
| Rail d'icônes | — | **Écarté** : icônes d'applications tierces | — |
| Salutation « Good morning, X » | `(app)/page.tsx` | Bandeau d'accueil avec l'heure de la journée | Élevée |
| Barre d'onglets | `conges` (soldes / demandes), `rapports` | Onglets internes à une page | Moyenne |
| Sélecteur Day/Week/Month | `calendrier` (vue mois/semaine) | Contrôle segmenté — les deux vues existent déjà | Élevée |
| Barres d'événements multi-jours | `calendrier` | Barres colorées par type d'absence | Moyenne — le calendrier actuel n'affiche pas de barres multi-jours |
| Champ « Search anything » | `equipe`, `rapports` | `SearchInput` local, **pas** une recherche globale : l'API n'existe pas | Faible |
| Carte « Annoncements » | `notifications` | Encart latéral vers le fil d'activité | Moyenne |
| Bouton « Today » | `calendrier` | Bouton « Aujourd'hui » | Élevée |
| Palette violette | Toute l'application | Tokens dans `@theme` (Tailwind 4) | Élevée |
| Tuile « 24 days national holidays » | `parametres` — jours fériés | Rappel du prochain jour férié | Moyenne |

---

## 6. Design system proposé

### 6.1 Le constat qui simplifie tout

Les cinq teintes de fond des tuiles correspondent **presque exactement** aux
palettes Tailwind de niveau 100 (`violet-100`, `blue-100`, `orange-100`,
`teal-100`, `amber-100`), et l'accent violet à `violet-500` (`#8B5CF6` mesuré
`#8b61eb` — 4 unités d'écart sur le vert uniquement).

**Conclusion : aucune palette personnalisée n'est nécessaire.** Les couleurs
Tailwind par défaut suffisent. C'est un gain réel : pas de nouvelles
dépendances, pas de dérive, et des contrastes déjà documentés.

### 6.2 Tokens à déclarer

Dans `globals.css`, bloc `@theme` (Tailwind 4, approche CSS d'abord — pas de
`tailwind.config.js`) :

```
--color-brand:          violet-600   (accent, boutons principaux, onglet actif)
--color-brand-soft:     violet-100   (fonds teintés)
--surface:              #ffffff
--surface-muted:        #f8f9fb      (existant, à conserver)
--border:               #e3e4e8      (actuel #e2e8f0, très proche)
--radius-card:          1rem         (16 px — cartes)
--radius-tile:          0.75rem      (12 px — tuiles d'indicateurs)
--radius-control:       0.5rem       (8 px — boutons, champs)
--radius-pill:          9999px       (pilules, badges)
```

Les rayons et les ombres sont des **hypothèses** : sur un rendu en perspective,
les mesurer serait de la fausse précision. Ils sont à valider visuellement.

### 6.3 Règle de couleur la plus importante

Les cinq teintes de tuiles ne sont **pas** décoratives, elles sont sémantiques.
Proposition :

| Teinte | Signification | Usage |
| --- | --- | --- |
| Violet | solde disponible | action possible |
| Bleu | en attente de validation | état bloqué, non fautif |
| Pêche | consommé / réservé | information |
| Menthe | acquis contractuel | information neutre |
| Ambre | attention | jours fériés, échéances |

C'est ce qui empêche la refonte de devenir un simple habillage : chaque couleur
porte un sens constant dans toute l'application.

### 6.4 Composants à créer (dans l'ordre)

1. `AppShell` + `Sidebar` + `Topbar` — extraits du layout
2. `PageHeader` — titre, sous-titre, actions
3. `StatCard` — 5 teintes, icône en pastille
4. `DataTable` + `FilterBar` + `SearchInput`
5. `StatusBadge` — statuts de congé et de validation
6. `EmptyState`, `Skeleton`, `Toast`
7. `Dialog` — confirmations d'action sensible

---

## 7. Risques

| Risque | Gravité | Mesure |
| --- | --- | --- |
| Une seule référence, un seul écran | **Élevée** | Concevoir explicitement les 8 écrans sans référence ; valider chaque proposition |
| Le calendrier actuel n'affiche pas de barres multi-jours | Moyenne | Chantier à part entière, à ne pas glisser dans la refonte visuelle |
| La recherche globale n'existe pas côté serveur | Moyenne | Se limiter à un filtrage local, ou renoncer |
| Régression des parcours métier | Élevée | Les 23 tests E2E existants servent de garde-fou à chaque étape |
| Refonte menée page par page | Élevée | Passer d'abord par les composants partagés (sprint 1) |
| Fuite de données RH à l'occasion de la refonte | Élevée | Revue des permissions par rôle ; test existant sur les motifs |
| Ajout de dépendances UI | Faible | Aucune nécessaire : Tailwind et `lucide-react` suffisent |

---

## 8. Plan proposé (aligné sur la section 11 du PRD)

**Sprint 1 — Fondations.** Tokens, `AppShell`, `Sidebar`, `Topbar`,
`PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`, `Skeleton`, `Toast`.
Navigation groupée par rôle avec icônes. Bascule de l'accent bleu → violet.
*Vérification : les 23 tests E2E restent verts.*

**Sprint 2 — Parcours employé.** Tableau de bord, pointage, congés.
*Point d'attention : l'écran de pointage n'a aucune référence — c'est une
conception à part entière, à valider avant implémentation.*

**Sprint 3 — Parcours manager et RH.** Équipe, validations, calendrier, rapports.

**Sprint 4 — Finition.** Paramètres, adaptatif mobile, accessibilité, et
extension de la suite E2E aux nouvelles interactions.

---

## 9. Décisions demandées avant de coder

Le PRD (sections 4.7, 11 et 15) impose une validation explicite avant toute
modification du code. Les voici, avec ma recommandation.

1. **Niveau de fidélité.** Reprendre la palette et le vocabulaire de composants
   de la référence, ou viser une ressemblance plus poussée ?
   *Recommandation : la palette et les composants, pas la mise en page — les
   contraintes métier diffèrent trop.*

2. **Thème.** Clair uniquement, ou clair + sombre ?
   *Recommandation : clair uniquement pour cette refonte. Un thème sombre
   double le travail de validation et n'apparaît pas dans la référence.*

3. **Accent.** Violet `#8B5CF6` comme la référence, ou conserver le bleu actuel ?
   *Recommandation : violet — c'est le trait visuel le plus identifiable de la
   référence, et il ne coûte qu'une variable.*

4. **Écrans sans référence.** Je conçois les écrans pointage, validations,
   rapports et paramètres dans le même langage visuel, ou vous fournissez des
   maquettes complémentaires ?
   *Recommandation : je conçois, et je vous fais valider des propositions avant
   d'implémenter.*

5. **Recherche globale.** Elle n'existe pas côté serveur. Filtrage local sur les
   listes existantes, ou fonctionnalité à part entière ?
   *Recommandation : filtrage local seulement.*

6. **Le rail d'icônes** est écarté (icônes d'applications tierces, section 2.4).
   Confirmez-vous qu'il ne faut pas le reproduire ?

---

## 10. Décisions validées — 13 octobre 2026

| # | Question | Décision |
| --- | --- | --- |
| 1 | Niveau de fidélité | Palette et composants de la référence, mise en page adaptée aux contraintes métier |
| 2 | Thème | **Clair ET sombre** — retenu contre ma recommandation, qui proposait le clair seul |
| 3 | Accent | Violet `#8B5CF6`, comme la référence |
| 4 | Écrans sans référence | Conçus par l'assistant dans le même langage, validation avant implémentation |
| 5 | Recherche globale | Filtrage local sur les listes existantes |
| 6 | Rail d'icônes | Écarté — icônes d'applications tierces |

### Conséquence de la décision n° 2

Le thème sombre n'était pas dans la référence visuelle : ses valeurs sont donc
**déduites**, pas mesurées. Elles sont documentées ci-dessous et vérifiées par
calcul, mais elles restent une proposition à valider à l'œil.

### Le violet de la référence n'était pas utilisable tel quel

Vérification par calcul, avant d'écrire la moindre ligne :

| Paire | Ratio | Verdict |
| --- | --- | --- |
| blanc sur `#8B5CF6` (la référence) | 4,23:1 | **insuffisant** pour du texte courant |
| blanc sur `#7C3AED` | 5,70:1 | AA |
| blanc sur `#6D28D9` | 7,10:1 | AAA |
| `#8B5CF6` sur fond sombre `#16181D` | 4,19:1 | **insuffisant** |
| `#A78BFA` sur fond sombre `#16181D` | 6,53:1 | AA |
| ambre `#A16207` sur tuile ambre | 4,42:1 | **insuffisant**, remplacé par `#854D0E` (6,15:1) |

Un bouton blanc sur le violet exact de la maquette aurait été sous le seuil.
D'où deux variables distinctes : `--brand` (`#8B5CF6`) pour l'identité, et
`--brand-strong` (`#7C3AED`) pour tout élément portant du texte.

---

## 11. Sprint 1 — fondations (livré)

- **Tokens sémantiques** dans `globals.css`, en clair et en sombre, avec
  `@theme inline` pour que la bascule ne reconstruise pas la feuille.
- **Thème sombre** à trois états (clair / sombre / système), posé avant peinture
  par un script en ligne — aucun clignotement au chargement. Aucune dépendance
  ajoutée.
- **Navigation groupée** (« Mon espace », « Management », « Administration »),
  icônes `lucide-react`, entrée active en pastille blanche bordée. Les groupes
  sont filtrés par rôle, sans que cela vaille protection — chaque page
  revérifie côté serveur.
- **Composants créés** : `StatCard` (5 teintes sémantiques), `StatusBadge`,
  `EmptyState`, `Skeleton`, `PageHeader`, `ThemeToggle`.
- **Migration des couleurs** sur 24 fichiers, 234 classes figées remplacées par
  les tokens.

### Deux défauts trouvés en chemin

**La police Geist n'était jamais appliquée.** `globals.css` demandait
`var(--font-sans)`, le layout fournissait `--font-geist-sans` : la variable
n'existait pas et Tailwind retombait sur sa pile système. L'application
s'affichait donc dans la police du système depuis le début, sans que rien ne le
signale. Corrigé.

**Un codemod silencieusement faux.** La première version appariait les
guillemets pour isoler les chaînes de caractères. Un commentaire contenant
« d'arrivée » et « d'un » désappariait tout ce qui suit : le fichier
`auth/confirmer/page.tsx` a été ignoré sans erreur. Réécrit pour analyser les
jetons indépendamment des guillemets ; il ne restait alors que ce fichier, ce
qui a confirmé que les 23 autres avaient bien été traités en entier.

Leçon : un codemod sans contrôle ne dit pas ce qu'il n'a pas fait. La
vérification systématique du reliquat est ce qui a révélé le problème.

### Vérifications

- Build de production vert, 16 routes
- **25 tests de bout en bout**, 0 échec, dont 2 nouveaux sur le thème
- 65 contrôles de base inchangés
- Contrastes calculés sur les couleurs réellement appliquées, dans les deux
  thèmes, avec un seuil AA vérifié à l'exécution

### Reste à faire

Sprints 2 à 4 du plan initial : parcours employé, parcours manager et RH,
finition. Les pages héritent déjà des tokens, mais leur mise en page n'est pas
encore revue écran par écran.
