# Revue comparative — application livrée face à la référence visuelle

**Statut :** à valider. Document de revue, aucune ligne de code applicatif n'a été
modifiée pour l'écrire.
**Date :** 13 octobre 2026
**Références :** `prd/PRD_GereoTimes_UI_UX.md` (§4, §7, §12 — livrables 1, 2 et 7),
`docs/REFONTE-UI-PHASE0.md`, `docs/DESIGN-SYSTEM.md`

---

## 1. Ce qui a réellement été examiné

Le PRD demande de distinguer les observations confirmées des hypothèses (§4.5).
Voici donc la liste de ce qui a été ouvert, mesuré ou simplement supposé.

| Élément | État |
| --- | --- |
| `img/design app.jfif` — 4587 × 3440, 429 Ko | **ouverte et lue** (JPEG, pas JFIF exotique) — vue entière, détails des tuiles et du calendrier |
| Captures de l'application | **20 images** dans `docs/captures/`, produites par `npm run captures` (9 écrans authentifiés + 2 publics, en 1440 et en 390 px) |
| Styles réellement peints | **mesurés** au navigateur (`getComputedStyle`) sur les écrans, pas estimés |
| Tokens | lus dans `src/app/globals.css` (source, pas capture) |
| Responsive mobile | **mesuré** à 390 × 844 (positions et hauteurs en pixels) |
| Typographie de la référence | **non déterminée** — police non identifiable sur un rendu en perspective |
| Densité verticale de la référence | **appréciée à l'œil** — la perspective interdit la mesure |
| Captures « avant » | **absentes de ce document** — voir §6 |

Les deux captures `calendrier-avec-absences.jpg` sont particulières : le calendrier
n'affiche de barres que s'il existe des absences approuvées, et la base de
démonstration n'en contient aucune. Deux absences temporaires ont donc été
posées en base, capturées, puis **supprimées** (contrôle après suppression :
0 absence approuvée, 4 demandes restantes, inchangé). Sans cela, la fonction la
plus visible de la référence — les barres multi-jours — n'aurait pas été
vérifiable, et la revue l'aurait déclarée conforme sans preuve.

---

## 2. Correspondance point par point

### 2.1 Palette et surfaces

Mesures de la référence : `docs/REFONTE-UI-PHASE0.md` §2.3. Mesures de
l'application : valeurs réellement peintes, relevées au navigateur.

| Élément de la référence | Référence (mesuré) | Application (mesuré) | Verdict |
| --- | --- | --- | --- |
| Accent violet | `#8b61eb` ≈ `violet-500` | `--brand` `#8b5cf6` ; texte et boutons en `--brand-strong` `#7c3aed` | **conforme**, avec un écart assumé sur le contraste |
| Fond de page | `#f8f9fb` | `rgb(248, 249, 251)` = `#f8f9fb` | **identique** |
| Fond des cartes | `#ffffff` | `rgb(255, 255, 255)` | **identique** |
| Filet de séparation | `#e3e4e8` | `rgb(227, 228, 232)` = `#e3e4e8` | **identique** |
| Fond de la barre latérale | `#f8f9fb` — même valeur que le fond de page | `rgb(255, 255, 255)`, avec filet `#e3e4e8` | **écart assumé** : la référence ne séparait pas le rail du fond, ce qui rendait la limite invisible |
| Tuile 1 — solde disponible | fond `#e5e1fa` (`violet-100`), pastille `#8b61eb` | `bg-violet-100` + pastille `bg-violet-500` | **conforme** |
| Tuile 2 — en attente | fond `#e0ebff` (`blue-100`), pastille `#2db9ee` (`sky-400`) | `bg-blue-100` + pastille `bg-sky-400` | **conforme** |
| Tuile 3 — consommé | fond `#ffeadd` (`orange-100`), pastille `#e35e35` (`orange-600`) | `bg-orange-100` (`conges`, « Jours consommés ») | **conforme** |
| Tuile 4 — acquis | fond `#cff6f1` (`teal-100`), pastille `#36dfc8` (`teal-400`) | `bg-teal-100` + pastille `bg-teal-400` | **conforme** |
| Tuile 5 — attention | fond `#feebca` (`amber-100`), pastille `#efaa43` (`amber-500`) | `bg-amber-100` + pastille `bg-amber-500` | **conforme** |

Le navigateur sérialise ces couleurs en `lab(...)` (Tailwind 4 déclare en
`oklch`) : `bg-violet-100` se lit `lab(93.08 4.35 -9.88)`. C'est la même
couleur, rendue par une autre notation.

**Le point qui compte :** les cinq teintes ne sont pas décoratives, elles
portent un sens constant (disponible / en attente / consommé / acquis /
attention) et se retrouvent à l'identique sur le tableau de bord et sur
« Mes congés ». C'est ce qui distingue une refonte d'un habillage.

### 2.2 Structure et composants

| Élément de la référence | Application | Verdict |
| --- | --- | --- |
| Barre latérale groupée, intitulés en petites capitales espacées (`MAIN`, `MANAGEMENT`, `COMPANY`) | `MON ESPACE`, `MANAGEMENT`, `ADMINISTRATION`, filtrés par rôle | **conforme** |
| Entrée active : pastille blanche bordée | pastille blanche, bordure et texte **violets** (`#7c3aed`) | **écart** — voir §4.b |
| Logo + bascule de panneau | logo, nom de l'organisation, bascule de thème à trois états en pied | **étendu** : la bascule de thème n'existe pas dans la référence (décision validée n° 2) |
| Rail d'icônes coloré (5 pastilles + « + ») | absent | **écarté volontairement** (phase 0 §2.4 : icônes d'applications tierces) |
| Salutation « Good morning, Tahsan! » avec icône soleil | « Bonjour » / « Bon après-midi » / « Bonsoir » selon l'heure locale de l'organisation, avec icône soleil, coucher de soleil ou lune | **conforme** |
| Champ « Search anything » | absent | **décidé** : aucune recherche côté serveur ; filtrage local sur Équipe et Rapports |
| Onglets internes (`Calender` / `Leave and balances`) | onglets d'ancrage sur Paramètres RH (5 sections) ; « Mes congés » empile ses sections sans onglets | **divergence de mise en page assumée** |
| Bouton « Today » | bouton « Aujourd'hui » + navigation précédent/suivant | **conforme** |
| Sélecteur `Day | Week | Month` | `Mois | Semaine` (pas de vue jour) | **écart assumé** : la vue jour n'existe pas |
| Tuiles empilées dans une carte « About your time off » | tuiles en grille (1 colonne en mobile, 4 en desktop) | **conforme sur le langage, différent sur la disposition** |
| Carte « Annoncements / Stay updated » | badge de notifications non lues + écran Notifications | **écart** : pas de carte d'annonces |
| Barres d'événements multi-jours (`Sick`, `Paid time off`, `Paid time`) | barres colorées par type de congé, avec le nom du collaborateur, qui se poursuivent d'une semaine à l'autre | **conforme**, voir §2.3 |
| Case du jour sélectionné : carré violet plein | cercle violet plein, numéro en blanc | **écart mineur de forme** |

### 2.3 Le calendrier, seul écran réellement comparable

C'est le seul écran de la référence qui a un équivalent direct dans
l'application, puisque la référence ne montre **qu'un seul écran** — celui des
congés. Comparaison faite sur la capture `calendrier-avec-absences.jpg` :

| Point | Référence | Application |
| --- | --- | --- |
| Barres multi-jours | oui, une par absence | oui, colorées d'après le type de congé, avec le nom du collaborateur |
| Poursuite sur la semaine suivante | visible (`Paid time…` tronquée) | visible : la barre du 15–20 octobre se coupe et reprend sur la ligne suivante |
| Grille | continue, filets fins `#f1f0f8` | **bandes hebdomadaires** encadrées et arrondies |
| Absence de données | sans objet | état vide explicite, grille conservée pour se situer |
| Détail textuel | note sous les tuiles | liste « Détail des absences » : pastille, nom, type, dates, jours décomptés, **sans le motif** |

La contrainte de confidentialité du PRD (§5) est tenue à l'écran : le motif
n'apparaît nulle part dans le calendrier, seule la vue `team_absences` alimente
la page, et cette vue ne projette jamais `reason`.

### 2.4 Le point de mesure le plus utile : la navigation mobile

Le PRD (§8) demande une « navigation compacte sur mobile ». Mesure faite à
390 × 844 sur le tableau de bord :

| Mesure | Valeur |
| --- | --- |
| Hauteur de la barre latérale | **663,5 px** sur 844 px de haut |
| Position du titre de page | y = **687,5 px** — sous la ligne de flottaison |
| Liens de navigation affichés | 9, tous développés |

Autrement dit : sur un téléphone, le premier écran est presque entièrement
occupé par le menu, et le contenu commence en dessous. Le critère UX-05 est
respecté au sens strict (aucun débordement horizontal — vérifié par 14 tests),
mais l'intention du PRD ne l'est pas. C'est l'écart le plus important de cette
revue, voir §4.a.

---

## 3. Mesures de l'application (preuves)

Relevées au navigateur sur la page d'accueil, session administrateur :

| Élément | Valeur peinte |
| --- | --- |
| `body` | fond `#f8f9fb`, `Geist`, 16 px |
| Barre latérale | fond `#ffffff`, bordure droite `#e3e4e8` |
| Carte | fond `#ffffff`, bordure `#e3e4e8`, rayon **16 px**, ombre `0 1px 2px /0.04 + 0 4px 16px /0.06` |
| Titre `h1` | 24 px, graisse 600, `#0f172a` |
| Sous-titre de page | 14 px, `#64748b` |
| Bouton principal (« Pointer ») | fond `#7c3aed`, texte blanc, rayon 8 px |
| Entrée de navigation active | fond blanc, bordure `#7c3aed`, texte `#7c3aed`, rayon 8 px |
| Tuiles du tableau de bord | `teal-100` (heures), `violet-100` (soldes), `blue-100` (statut), `amber-100` (à traiter) |
| Pastilles d'icônes | `teal-400`, `violet-500`, `sky-400`, `amber-500` |
| Anneau de focus | `outline: 2px solid #7c3aed`, décalage 2 px |

Le rayon de 16 px sur les cartes est celui proposé en phase 0 §6.2, qui était
une **hypothèse** faute de pouvoir mesurer la perspective. Il est ici confirmé
comme valeur appliquée, pas comme valeur mesurée sur la référence.

---

## 4. Écarts résiduels

| # | Écart | Ampleur | Proposition |
| --- | --- | --- | --- |
| a | Navigation mobile non compacte — 663 px avant le contenu | élevée | **corrigé** : rail permanent au-dessus de 1024 px, tiroir coulissant par-dessus le contenu en dessous (voir `DESIGN-SYSTEM.md`, « Rail de navigation et responsive ») |
| b | Entrée active violette (bordure + texte) là où la référence reste neutre | faible | À trancher : neutre comme la référence, ou violet comme aujourd'hui (plus lisible pour « où suis-je ») |
| c | Salutation non horodatée (« Bonjour » seul, sans icône) | faible | **corrigé** : trois moments (matin / après-midi / soir), calculés dans le fuseau de l'organisation, avec l'icône correspondante (`PageHeader icon`) |
| d | Pas de recherche globale | moyenne | **Tranché en phase 0** : filtrage local uniquement. À ne rouvrir que si une recherche serveur est approuvée |
| e | Grille du calendrier en bandes hebdomadaires au lieu d'une grille continue | faible | Assumé : les bandes rendent les semaines lisibles et les barres s'y accrochent proprement |
| f | Indicateur Next.js Devtools présent en développement sur les captures | nulle | **corrigé** : le script de capture le retire ; les 20 images livrées sont propres |
| g | Base de démonstration pauvre (0 absence, soldes à 0) | moyenne | Fournir un jeu de démonstration (absences, soldes, historique) sinon chaque revue visuelle devra poser puis retirer des données, comme ici |

---

## 5. Ce que cette revue ne prouve pas

- **La fidélité à la référence est partielle par construction** : la maquette ne
  montre qu'un écran, en perspective, sans typographie mesurable. Six des neuf
  écrans de l'application n'ont aucune contrepartie dans la référence ; ils
  partagent les tokens, pas une mise en page de référence.
- **Les rayons, ombres et densités** de la référence restent des hypothèses
  validées à l'œil, non mesurées.
- **Les couleurs du thème sombre** sont déduites, comme le documente la phase 0.
- **Aucune comparaison à un « avant »** : ce document compare la référence et
  l'état livré. Les captures avant/après relèvent du rapport de tests.

---

## 6. Décisions prises

| # | Décision | Origine |
| --- | --- | --- |
| 1 | Palette violette, cinq teintes sémantiques conservées à l'identique | phase 0, validée |
| 2 | Violet d'identité `#8b5cf6`, violet d'action `#7c3aed` pour tenir AA | calcul de contraste, phase 0 §10 |
| 3 | Rail d'icônes tierces non repris | phase 0 §2.4 |
| 4 | Recherche locale seulement, pas de champ global | phase 0, validée |
| 5 | Fond de la barre latérale en blanc avec filet, et non `#f8f9fb` | cette revue — la référence rendait la limite invisible |
| 6 | Indicateur de développement retiré des captures | cette revue |
| 7 | Écarts mineurs de forme (cercle du jour, pastille active, grille) assumés | cette revue |
| 8 | Salutation horodatée dans le fuseau de l'organisation (matin / après-midi / soir) et icône correspondante | écart résiduel §4.c |
| 9 | Écart §4.a résolu : rail permanent au-dessus de 1024 px, barre repliable en dessous | navigation mobile, 14/10 |

## 7. Question à trancher

**L'entrée de navigation active** (§4.b). La référence la laisse neutre ; elle est
ici blanche, bordée et écrite en violet `#7c3aed`. La question est de savoir si
« où suis-je » doit être signalé par la couleur.

1. garder le violet — c'est plus lisible, et c'est la seule marque de position
   dans un rail qui porte déjà des icônes ;
2. revenir au neutre de la référence — plus fidèle, l'icône et le fond blanc
   bordé suffisant à distinguer l'entrée active.

Les deux tiennent AA : la bordure et le texte violets sur blanc sont à 5,70:1.

Le reste de la liste des écarts §4 est soit corrigé (a, c, f), soit tranché
(d, e), soit assumé et documenté.
