# Rapport de tests — refonte UI/UX

**Révision testée :** `f44ccff` (revue comparative) plus les ajouts de cette
passe : tests d'activation, `scripts/perf.mjs`, commande `npm run captures`.
**Date :** 13 octobre 2026
**Livrables couverts :** PRD §12 (stratégie de test) et §13.6 (rapport de tests
et captures avant/après)

---

## 1. Conditions d'exécution

| Élément | Valeur |
| --- | --- |
| Machine | Windows 11, une seule machine — ni CI, ni mise en réseau |
| Application testée | **build de production** (`npm run build && npm run start`) sur `:3000` |
| État « avant » comparé | worktree sur `b327584` (socle, avant refonte), port `:3001`, même base |
| Base | Supabase de recette, organisation « Demo Recette » (2 organisations, 5 membres) |
| Sessions | `tests/.auth/admin.json` et `employe.json`, obtenues par l'API d'authentification |
| Navigateur | Chromium (Playwright 1.64), 1 worker, exécution en série |

Deux serveurs ont tourné en parallèle sur des ports distincts pour la
comparaison avant/après : les mesures de performance et les captures se font
dans les mêmes conditions matérielles et réseau, à quelques minutes d'écart.

---

## 2. Ce qui a été exécuté

| Commande | Résultat |
| --- | --- |
| `npm run lint` | **0 problème** (8 erreurs et 2 avertissements au départ, tous corrigés par motif — voir §4.2) |
| `npm run build` | **succès**, TypeScript inclus, 16 routes générées |
| `npm run db:check` | 18 tables, 17 protégées par RLS, 2 vues, **19/19 fonctions**, aucune table sans RLS |
| `npm run e2e` | **52 / 52 en 5 min 12**, contre le build de production |
| Contrôle de mutation | 2 échecs obtenus **volontairement** sur le libellé du lien d'évitement, puis restauré |
| `npm run captures` | 20 images (`docs/captures/`) + 4 images de l'état antérieur (`docs/captures/avant/`) |
| `node scripts/perf.mjs` | deux séries de mesures, voir §5 |

---

## 3. Résultats détaillés de la suite

| Projet | Scénarios | Passage | Ce qu'il couvre |
| --- | --- | --- | --- |
| `public` | 9 | ✔ | redirections, formulaires publics, exports refusés sans session, **écrans d'activation** (lien expiré, fragment d'erreur, lien sans jeton) |
| `employe` | 11 | ✔ | cloisonnement des écrans RH, cycle de pointage complet, estimation des jours ouvrés, calendrier d'équipe, **absence de fuite du motif** |
| `admin` | 13 | ✔ | navigation RH, équipe, paramètres, rapports et filtres, trois exports CSV (contenu vérifié), file de validations, thème clair/sombre et contraste calculé |
| `clavier` | 5 | ✔ | lien d'évitement, ordre de tabulation, anneau de focus au clavier et son absence à la souris, action de pointage atteignable, sortie confirmée au clavier |
| `mobile` | 14 | ✔ | débordement horizontal sur les 9 écrans authentifiés et 2 publics, action de pointage dans l'écran, tableau large défilant dans son conteneur |
| **Total** | **52** | **✔** | |

Les trois tests d'activation ont été ajoutés dans cette passe : le point
d'arrivée des liens par courriel n'était couvert par aucun test, alors que c'est
précisément le fichier dont la logique de lecture d'erreur a été réécrite pour
satisfaire les règles du compilateur React.

---

## 4. Incidents rencontrés, et ce qu'ils ont appris

### 4.1 Une exécution à 43/44 qui n'était pas une régression

Le premier passage complet a échoué sur `/validations` avec
`net::ERR_NETWORK_IO_SUSPENDED`, et la suite a duré 10,7 min au lieu de ~5. La
machine s'était mise en veille pendant l'exécution. Relancée à l'identique :
52/52. Leçon : une panne réseau se reconnaît à sa durée et à sa forme — elle ne
doit ni être ignorée, ni être prise pour un défaut.

### 4.2 Huit erreurs de lint préexistantes

Elles n'étaient pas dans les fichiers touchés et existaient depuis le socle. Ce
n'était pas du bruit : chacune signalait un rendu en cascade ou un écart
d'hydratation. Corrigées par motif, sans une seule directive de désactivation
sauf un cas justifié (`<a>` de téléchargement, où `<Link>` casserait le
téléchargement).

### 4.3 Une file d'attente vide rendait une fonction invérifiable

Le calendrier n'affiche ses barres multi-jours que s'il existe des absences
approuvées ; la base de recette n'en contenait aucune. Deux absences temporaires
ont été posées, capturées, puis supprimées — contrôle après suppression à
l'appui. Sans cette précaution, la revue aurait déclaré conforme la fonction la
plus visible de la maquette **sans l'avoir vue fonctionner**.

### 4.4 Deux obstacles purement outillage

- Turbopack refuse un `node_modules` en lien symbolique hors de la racine du
  projet (`Symlink node_modules could not be resolved`) : l'état antérieur a été
  installé avec `npm ci` dans son worktree.
- L'indicateur Next.js Devtools apparaissait sur chaque capture : le script le
  retire désormais, puisque le défaut n'existe qu'en développement.

---

## 5. Captures avant / après

Produites par le même script, même viewport (1440 px), mêmes données :

| Écran | Avant (`b327584`) | Après (`f44ccff`) |
| --- | --- | --- |
| Tableau de bord | `docs/captures/avant/accueil.jpg` | `docs/captures/1440/accueil.jpg` |
| Pointage | `docs/captures/avant/pointage.jpg` | `docs/captures/1440/pointage.jpg` |
| Mes congés | `docs/captures/avant/conges.jpg` | `docs/captures/1440/conges.jpg` |
| Validations | `docs/captures/avant/validations.jpg` | `docs/captures/1440/validations.jpg` |

Ce qui change, à la lecture des quatre paires :

| Point | Avant | Après |
| --- | --- | --- |
| Couleur d'action | bleu `#2563eb` | violet `#7c3aed` (identité `#8b5cf6`) |
| Navigation | 4 entrées, sans icône, sans regroupement | 9 entrées, icônes, groupes « Mon espace / Management / Administration » filtrés par rôle |
| Entrée active | pastille bleu nuit pleine | pastille blanche bordée |
| Soldes de congés | 5 cartes séparées avec une puce de couleur | 5 tuiles teintées avec pastille d'icône, plus une ligne de synthèse |
| Titres de page | écrits au cas par cas | `PageHeader` homogène (titre + sous-titre + période) |
| États vides | simple cadre pointillé avec un texte | `EmptyState` avec icône, titre et explication |
| Retours d'action | aucun | notifications de succès et d'échec |
| Pied de page (dev) | indicateur Next.js visible | retiré, l'image montre l'application réelle |

---

## 6. Performance

Méthode : `node scripts/perf.mjs`, trois passages par écran dans trois contextes
neufs (sinon le cache fausse les tailles transférées), valeur publiée = médiane.
Les deux versions sont des **builds de production**, servis localement.

### Avant (`b327584`, port 3001)

| Écran | TTFB | DCL | load | LCP | transféré | dont JS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 754 ms | 2663 ms | 2733 ms | 2680 ms | 214 Ko | 145 Ko |
| `/pointage` | 624 ms | 2143 ms | 2211 ms | 2160 ms | 220 Ko | 148 Ko |
| `/conges` | 566 ms | 1986 ms | 2055 ms | 2004 ms | 219 Ko | 148 Ko |
| `/validations` | 563 ms | 2234 ms | 2333 ms | 2260 ms | 216 Ko | 147 Ko |

### Après (`f44ccff`, port 3000)

| Écran | TTFB | DCL | load | LCP | transféré | dont JS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 557 ms | 2052 ms | 2132 ms | 2068 ms | 227 Ko | 149 Ko |
| `/pointage` | 542 ms | 2720 ms | 2801 ms | 2736 ms | 236 Ko | 155 Ko |
| `/conges` | 540 ms | 1987 ms | 2085 ms | 2008 ms | 234 Ko | 153 Ko |
| `/validations` | 552 ms | 2446 ms | 2526 ms | 2476 ms | 230 Ko | 153 Ko |

### Lecture

- **Le poids augmente de façon reproductible** : +13 Ko par page (≈ +6 %), dont
  4 à 7 Ko de JavaScript. C'est le prix, assumé, de composants partagés qui
  n'existaient pas (`StatCard`, `DataTable`, `PageHeader`, `Dialog`, `Toast`,
  bascule de thème). Aucune dépendance n'a été ajoutée depuis le socle.
- **Les temps ne départagent pas les deux versions.** L'accueil est plus rapide
  après (−600 ms de `load`) et le pointage plus lent (+590 ms) : le sens de
  l'écart change d'un écran à l'autre, ce qui est la signature du bruit et non
  d'un effet. Le TTFB local (≈ 550 ms) domine le `load` et dépend des
  allers-retours vers Supabase, pas du rendu.
- **Limites de la mesure** : une seule machine, un seul navigateur, un serveur
  local, base distante unique, aucune simulation de réseau lent ni de CPU
  bridé. Ces chiffres comparent deux révisions entre elles ; ils ne constituent
  pas une mesure absolue et ne remplacent pas un audit Lighthouse sur
  l'environnement de production.
- Le point d'optimisation le plus évident, si le poids devient un sujet :
  l'accueil charge les mêmes composants que les autres écrans, dont une partie
  n'y sert qu'aux états vides.

---

## 7. Ce que la suite ne couvre pas

À lire comme le périmètre de confiance, pas comme une liste de défauts :

| Non couvert | Pourquoi, et ce qu'il faudrait |
| --- | --- |
| Acceptation réelle d'une invitation | le test vérifie les chemins d'échec ; le chemin de succès demande un jeton envoyé par courriel et une boîte de réception |
| Firefox et WebKit | seuls les projets Chromium sont configurés ; `<dialog>` et `:focus-visible` y sont plus récents |
| Tests de charge et de concurrence | `npm run db:verify` couvre la double validation concurrente en base ; rien ne stresse l'application HTTP |
| Comparaison visuelle automatique | aucune référence d'image de base (pas de `toHaveScreenshot`) : la comparaison avec la maquette reste une lecture humaine, documentée dans `docs/REVUE-COMPARATIVE.md` |
| Thème sombre en capture | vérifié par calcul de contraste dans `theme.spec.ts`, jamais figé en image |
| Optimisation (bundle splitting) | mesurée ici, non optimisée : voir §6 |

---

## 8. Verdict

La refonte est **acceptée sur le plan technique** : 52 scénarios verts contre un
build de production, lint sans erreur, build et TypeScript propres, schéma
conforme à 19/19 fonctions, et les huit parcours du PRD (§7) ont un test ou une
capture qui les atteste.

Deux points ne sont pas des tests mais des **décisions** :

1. **La navigation mobile** (663 px occupés avant le contenu, mesuré) — c'est
   l'écart le plus important, détaillé dans `docs/REVUE-COMPARATIVE.md` §4.a.
2. **Le poids transféré** (+13 Ko par page) — assumé en l'état, avec la piste
   d'optimisation ci-dessus.
