# Écran de connexion — analyse de la maquette `ui login.webp`

**Date :** 15 octobre 2026
**Référence :** `img/ui login.webp` (1600 × 1200, WebP, 31 Ko)
**Portée :** les cinq écrans publics (connexion, inscription, mot de passe
oublié, réinitialisation, activation). Ils partagent un seul habillage,
`components/auth-shell.tsx`.

---

## 1. Ce que montre la maquette

Une page de connexion « plein écran » : fond crème, décor de croquis réparti
autour du contenu, barre du haut avec la marque à gauche et deux actions à
droite, et une carte blanche centrée.

De haut en bas, dans la carte :

| Élément | Détail |
| --- | --- |
| Titre | « Agent Login », centré, gras |
| Sous-titre | deux lignes, centrées, gris |
| Champ identifiant | bordé, arrondi, icône à droite |
| Champ mot de passe | bordé, avec « Hide » dans le champ |
| Lien d'aide | « Having trouble in sign in? », aligné à gauche |
| Action principale | bouton pleine largeur, fond ambre, texte sombre |
| Séparateur | « — Or Sign in with — » |
| Actions tierces | trois boutons : Google, Apple ID, Facebook |
| Pied de carte | « Don't have an account? Request Now » |

Le décor est fait de traits fins : fenêtres de navigateur stylisées, flèche
courbe, trait ondulé, rectangles remplis de pointillés, petits cercles.

## 2. Palette mesurée

L'image a été chargée dans Chromium, dessinée dans un canevas, puis
échantillonnée au pixel (les fichiers WebP ne se décodent pas en Node sans
dépendance). Chaque valeur ci-dessous est **mesurée**, pas estimée.

| Rôle | Mesuré | Part de la zone |
| --- | --- | --- |
| Fond de page | `#f5f2ea` | 92 % |
| Carte | `#ffffff` | 82 % |
| Action principale | `#fdc886` | 68 % |
| Motif pointillé | `#fdde92` | 21 % |
| Encre du titre | `#000000` | — |
| Encre du sous-titre | `#353535` | — |
| Texte indicatif des champs | `#909090` | — |
| « Hide » | `#afafaf` | — |

Autrement dit : une identité **crème et ambre**, texte noir, tracés noirs.

## 3. Ce qui est repris

Composition, uniquement :

- **barre du haut** : marque à gauche, action de changement de parcours à
  droite (« Créer une organisation » sur la connexion, « Se connecter »
  ailleurs) ;
- **carte centrée**, titre et sous-titre centrés, champs libellés, action
  principale pleine largeur ;
- **mot de passe affichable** (« Hide ») : nouveau composant
  `ui/password-input`, avec un nom accessible qui décrit l'action disponible ;
- **lien d'aide** « Mot de passe oublié ? » placé entre le champ et le bouton,
  aligné à gauche comme dans la maquette ;
- **décor de traits** : fenêtres stylisées, flèche, ondulation, rectangles
  pointillés, éclats — redessinés en SVG, réservés aux écrans ≥ 1024 px.

## 4. Ce qui n'est pas repris, et pourquoi

| Élément de la maquette | Décision | Raison |
| --- | --- | --- |
| Fond crème `#f5f2ea`, action ambre `#fdc886` | **écarté** | L'identité du projet est mesurée sur l'autre maquette : violet, cinq teintes **sémantiques**. L'ambre y signifie « attention » (échéances, jours fériés) et ne peut pas devenir décoratif sans perdre son sens. Le crème, lui, remplacerait le fond `#f8f9fb` de toute l'application. |
| Boutons Google / Apple / Facebook | **repris, à l'état réel du projet** | Un fournisseur sans configuration ne s'affiche pas : un bouton sans effet est pire qu'un bouton absent. Google est activé depuis le 15/10, son bouton apparaît ; Apple et Facebook attendent leurs identifiants. La **marque officielle** (le « G » de Google, la pomme, le « f ») est reprise dans le bouton, conformément à la charte de ces fournisseurs — exception assumée à la règle « aucune ressource tierce recopiée », qui vise les marques décoratives comme le rail d'icônes de la maquette. Leurs couleurs de marque ne suivent pas le thème : les repeindre serait contraire à ces chartes. |
| Illustration d'une personne | **écarté** | Dessin sous licence, sans équivalent dans le projet. Le décor de traits en reprend l'esprit sans rien copier. |
| Champs sans libellé (texte indicatif seul) | **écarté** | Le libellé est nécessaire dès que le texte indicatif disparaît à la saisie ; les tests d'accessibilité du projet s'appuient sur les noms accessibles. |
| Pied de carte « Don't have an account? » | **écarté** | Doublon de l'action déjà présente dans la barre du haut. |
| Rayon de carte (≈ 24 px sur la maquette) | **écarté** | Le jeton `--radius-card` vaut 16 px et sert les quinze écrans ; une exception pour l'entrée créerait une incohérence visible au premier changement d'écran. |

## 5. Décisions demandées

1. **Palette d'entrée.** Faut-il adopter le crème et l'ambre, au moins sur les
   écrans publics, ou conserver l'identité violette ? *Recommandation :
   conserver* — c'est une variable à changer si vous préférez l'autre voie, mais
   elle fait basculer l'application entière, pas seulement la connexion.
2. **Fournisseurs d'identité tiers.** Souhaitez-vous Google (ou un autre) comme
   moyen de connexion ? Cela se configure dans Supabase, puis dans l'interface.
   *Recommandation : plus tard* — cela ajoute une dépendance externe et une
   vérification à chaque connexion.
3. **Décor.** Le garder seulement au-delà de 1024 px (aujourd'hui), ou
   l'étendre aux tablettes ? *Recommandation : le garder ainsi* — sous
   1024 px, la place appartient au formulaire.
