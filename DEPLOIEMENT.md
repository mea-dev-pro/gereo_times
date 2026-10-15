# Déploiement

Guide de mise en production de GereoTimes (Vercel + Supabase).

---

## 1. Préparer Supabase

### Variables à relever

Supabase → **Project Settings → API** :

| Variable | Où | Portée |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` | publique |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` `secret` | **serveur uniquement** |

Project Settings → **Database → Connection string** :

| Variable | Format |
| --- | --- |
| `SUPABASE_DB_URL` | `postgresql://postgres.<ref>:<motdepasse>@aws-0-<région>.pooler.supabase.com:5432/postgres` |

> **Prenez l'onglet « Session pooler », pas « Direct connection ».** Le nom
> `db.<ref>.supabase.co` ne publie qu'un enregistrement IPv6 : il est
> injoignable depuis la plupart des réseaux et depuis les builders Vercel.
> C'est la panne à laquelle on se heurte en premier.

Le pooler exige l'utilisateur `postgres.<référence-du-projet>`, pas `postgres`.

### URL de redirection des liens d'activation

Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://votre-domaine.mg`
- **Redirect URLs** : ajoutez `https://votre-domaine.mg/auth/confirmer`, puis
  `https://votre-domaine.mg/auth/reinitialiser` **et** les deux mêmes adresses en
  `http://localhost:3000/…` (pour le développement)

Sans cette entrée, les liens d'invitation retombent sur la page d'accueil et le
collaborateur n'est jamais rattaché à son organisation ; un lien de
réinitialisation retombe de la même façon sur l'accueil, sans que l'utilisateur
puisse choisir un nouveau mot de passe.

**Configuration du projet de production, relevée le 15/10** (elle sert de
référence si un jour un lien retombe au mauvais endroit) :

```
Site URL        https://gereotimes.vercel.app
Redirect URLs   https://gereotimes.vercel.app/auth/confirmer
                https://gereotimes.vercel.app/auth/reinitialiser
                http://localhost:3000/auth/confirmer
                http://localhost:3000/auth/reinitialiser
```

Deux comportements à connaître, mesurés en sondant l'API :

- **toute adresse sous l'origine de la Site URL est acceptée sans être listée** —
  c'est pourquoi les essais locaux fonctionnaient alors que la Site URL valait
  encore `http://localhost:3000`, et pourquoi le lien de production retombait
  sur localhost, sans jeton, avant le changement ;
- une adresse hors liste est remplacée par la Site URL **sans les jetons** :
  l'utilisateur atterrit sur une page qui ne peut rien faire, sans message
  d'erreur.

La configuration se pose aussi par l'API de gestion, avec un jeton personnel
(`sbp_…`, à créer sur https://supabase.com/dashboard/account/tokens, puis à
déposer dans `.env.local` — jamais en argument de commande) :

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/<référence>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"site_url":"https://votre-domaine.mg","uri_allow_list":"…"}'
```

Relire la réponse avant de conclure : `uri_allow_list` est une chaîne, séparée
par des virgules, et l'écriture remplace la liste entière — la fusionner avec
l'existante plutôt que de l'écraser.

Vérification, sans boîte aux lettres : le script ci-dessous demande un lien à
l'API d'administration, suit la redirection et dit si l'adresse de retour est
acceptée par le projet.

```bash
node scripts/verify-reset-mot-de-passe.mjs [url]     # défaut : http://localhost:3000
```

### Confirmation des emails

Authentication → **Sign In / Providers → Email** : selon votre choix,
« Confirm email » activé ou non. Si vous l'activez, configurez un serveur SMTP
personnalisé — le service d'email par défaut de Supabase est limité en volume et
réservé aux essais.

C'est aussi lui qui expédie les liens de réinitialisation : avec le service
intégré, quelques demandes suffisent à épuiser le quota de l'heure, et l'écran
affiche alors « Trop de tentatives. Réessayez dans quelques minutes. » — un
message de limite, non une absence de compte.

---

## 2. Appliquer les migrations

```bash
npm run db:apply     # applique les migrations manquantes
npm run db:check     # vérifie l'état du schéma
```

Chaque migration s'exécute dans une transaction et n'est appliquée qu'une fois
(suivi par `public.schema_migrations`). Rejouer la commande est sans danger.

À exécuter **avant** le premier déploiement, puis à chaque nouvelle migration.

---

## 3. Déployer sur Vercel

1. Importer le dépôt dans Vercel ; le framework est détecté (Next.js).
2. Renseigner les variables d'environnement — **pour Production, Preview et
   Development** :

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL          (utile seulement aux migrations, peut être omise en production)
CRON_SECRET              (obligatoire : sans lui, la tâche planifiée refuse tout appel)
RESEND_API_KEY           (facultatif)
EMAIL_FROM               (facultatif)
```

Ne marquez **jamais** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
`CRON_SECRET`, `RESEND_API_KEY` comme exposées au navigateur : elles contournent
la RLS, donnent accès à la base ou déclenchent des écritures.

3. Déployer, puis mettre à jour **Redirect URLs** dans Supabase avec le domaine
   réel si ce n'est pas déjà fait.

---

## 3 bis. Déploiement effectué

État réel, vérifié au navigateur et par la CLI :

- Projet Vercel : `devp-roject/gereotimes` (équipe DEVProject), framework détecté seul.
- URL de production : https://gereotimes.vercel.app — déploiement `READY`,
  build de 31 s, Node choisi d'après `engines` de `package.json`.
- Variables posées pour **Production et Preview** : `NEXT_PUBLIC_SUPABASE_URL`
  et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (type *Config*), puis
  `SUPABASE_SERVICE_ROLE_KEY` (type *Secret*). Les deux valeurs publiques ont
  été relues depuis Vercel et comparées à `.env.local` : identiques. La clé
  secrète n'est volontairement pas relisible.
- `RESEND_API_KEY` et `EMAIL_FROM` ne sont pas posées : la messagerie reste
  interne, comme prévu sans elles. La chaîne d'envoi est en revanche vérifiée
  de bout en bout (voir plus bas) : il ne manque que la clé.
- `CRON_SECRET` est posée pour **Production et Preview** (type *Secret*) : sans
  elle, `/api/cron/quotidien` refuse tout appel. La valeur vit dans `.env.local`
  et sur Vercel, jamais ailleurs.

Contrôles passés sur la production :

```bash
E2E_BASE_URL=https://gereotimes.vercel.app npx playwright test --project=public   # 9/9
```

### Mise en ligne du 14/10/2026

Déploiement `gereotimes-5xcqgxnd3-devp-roject.vercel.app` promu en production
(commit `25abcfb`), après application de la migration 0008 :

```bash
vercel crons ls              # /api/cron/quotidien   0 4 * * *
vercel inspect gereotimes-5xcqgxnd3-devp-roject.vercel.app   # ● Ready
```

La tâche planifiée a été appelée sur la production, avec puis sans le secret :

| Appel | Résultat |
| --- | --- |
| sans en-tête `Authorization` | `401 {"error":"Non autorisé."}` |
| avec un mauvais secret | `401` — le même message, aucune indication sur la cause |
| avec `CRON_SECRET` | `200` — 3 organisations, période `2026-09-01 → 2026-09-30`, 0 écriture |

Les 0 écritures sont le résultat attendu : les politiques des trois
organisations prennent effet le 12 ou le 13 octobre, donc le mois de septembre
les précède — rien à créditer. Le premier crédit réel aura lieu au premier
passage de novembre, sur la période d'octobre. Une politique postérieure à la
période est ignorée, ce que la vérification hors ligne contrôle aussi.

Et une tentative de connexion avec un compte inexistant renvoie
« Email ou mot de passe incorrect. » — la réponse de Supabase Auth, donc les
clés de production sont acceptées et la base est joignable depuis Vercel.

Deux points restent à faire, hors CLI :

1. **Auto-déploiement.** `vercel git connect` répond `You need admin or write
   access to the repository "gereo_times" to link it. (400)` : l'application
   Vercel n'est pas autorisée sur le dépôt. Sur GitHub, autoriser Vercel sur
   `mea-dev-pro/gereo_times` (Settings → GitHub Apps → Vercel → Repository
   access), puis relancer `vercel git connect`. En attendant, publier se fait
   par `vercel deploy --prod`.
2. **Clé Resend.** `RESEND_API_KEY` et `EMAIL_FROM` : sans elles la file
   d'envoi reste pleine. Les créer sur resend.com, puis les poser sur Vercel
   (`vercel env add` en collant la valeur sur l'entrée standard — jamais dans
   `argv`). Une fois posées, la vérification se fait avec le serveur local
   démarré :

```bash
npm run build && npm run start        # puis, dans un autre terminal :
node scripts/verify-email-chain.mjs http://localhost:3000
```

Le point « Redirect URL Supabase » est levé : le filtre a été interrogé
directement sur `/auth/v1/verify` avec un jeton invalide et
`redirect_to=https://gereotimes.vercel.app/auth/confirmer` — le domaine passe
(l'échec porte sur le jeton), tandis qu'un domaine inventé est refusé par la
liste blanche. L'appel `/auth/v1/admin/generate_link`, lui, ne prouve rien : il
accepte n'importe quel domaine.

Les 52 scénarios E2E complets (`employe`, `admin`, `mobile`) ne sont pas encore
rejoués contre la production : leurs sessions sont liées à `localhost:3000` et
les mots de passe des comptes de recette ne sont pas stockés. Il faut les
fournir une fois pour régénérer `tests/.auth/` contre le domaine public

```bash
E2E_BASE_URL=https://gereotimes.vercel.app \
E2E_ADMIN_PASSWORD='…' E2E_EMPLOYE_PASSWORD='…' \
npm run e2e:auth && npm run e2e
```

---

## 4. Vérifications après déploiement

La suite complète se rejoue contre le domaine public, en deux variables
d'environnement : `E2E_BASE_URL` pour l'adresse, `E2E_ETAT` pour le dossier des
sessions — les cookies sont liés à une origine, donc les sessions de
`tests/.auth` (localhost) ne valent pas pour le domaine public.

```bash
E2E_BASE_URL=https://gereotimes.vercel.app \
E2E_ETAT=tests/.auth-prod \
npx playwright test --project=telephone --project=tablette --project=bureau --project=mobile
```

`tests/.auth-prod` s'obtient en recopiant `tests/.auth/*.json` en remplaçant le
champ `domain` des cookies par `.gereotimes.vercel.app` et `secure` par `true` ;
le dossier est hors du dépôt (`.gitignore` couvre `/tests/.auth*/`).

**Quels projets rejouer en production.** `telephone`, `tablette`, `bureau`,
`mobile` et `public` ne font que lire : ils se rejouent sans risque. `admin`,
`employe` et `clavier` écrivent en base (pointage, demandes de congé) — les
rejouer en production y laisse des traces, à ne faire qu'en connaissance de
cause.

Pour rejouer la suite complète contre un domaine, il faut en plus fournir les
mots de passe des comptes de recette, ce qui régénère les sessions :

```bash
E2E_BASE_URL=https://votre-domaine.mg \
E2E_ADMIN_PASSWORD='…' E2E_EMPLOYE_PASSWORD='…' \
npm run e2e:auth && npm run e2e
```

Puis, à la main :

1. `/inscription` crée une organisation et ses données d'amorçage
2. `/equipe` génère un lien d'activation ; l'ouvrir rattache le collaborateur
   avec le rôle prévu
3. Un pointage aller-retour apparaît dans l'historique avec l'écart calculé
4. Une demande de congé est visible par le manager et validable
5. `/rapports` télécharge les trois exports CSV

---

## 4 bis. Performance de navigation

Le ressenti se joue là : entre le clic sur un lien du rail et l'écran suivant,
puis entre l'arrivée de l'écran et celle de son contenu.

### Comment mesurer

```bash
npm run build && npm run start          # jamais en développement : la
                                        # compilation à la demande fausse tout
npm run perf:nav -- http://localhost:3000        # écran par écran, contexte neuf
npm run perf:parcours -- http://localhost:3000   # dix écrans enchaînés, même session
npm run perf:nav -- https://gereotimes.vercel.app /conges /equipe   # production
```

`scripts/perf-navigation.mjs` ouvre un contexte neuf par passage, clique sur le
lien du rail et relève, dans la page : le clic, l'apparition de la silhouette
d'attente (`data-chargement`) et l'affichage du titre de destination. Trois
passages par cible, médiane publiée. Il compte aussi les requêtes RSC et le
nombre de requêtes réseau déclenchées par la navigation.

`scripts/perf-parcours.mjs` fait l'inverse : une seule session, dix écrans
enchaînés, 1,2 s entre deux clics — c'est la seule façon de voir ce que rendent
les caches du navigateur, un contexte neuf ne les ayant jamais remplis.

Deux variables d'environnement :

- `PERF_STATE` — chemin d'un jeu de cookies autre que `tests/.auth/admin.json`,
  pour viser un domaine différent de localhost. Un fichier
  `tests/.auth/admin-prod.json` s'obtient en recopiant la session d'admin en
  remplaçant le champ `domain` par `.gereotimes.vercel.app` et `secure` par
  `true` ;
- `PERF_ATTENTE` — délai laissé au préchargement avant de cliquer (0 par
  défaut, soit le cas le plus défavorable : clic immédiat).

### Mesures relevées le 14/10/2026

Production (`clic → titre affiché`, médiane de 3, clic immédiat — le cas le plus
défavorable, la coquille préchargée n'est pas encore arrivée) :

| Cible | Avant travaux | Après les trois lots |
| --- | --- | --- |
| `/` | — | 1609 ms |
| `/pointage` | 2851 ms | 2019 ms |
| `/conges` | 2077 ms | 1721 ms |
| `/calendrier` | — | 1482 ms |
| `/notifications` | — | 1492 ms |
| `/validations` | — | 1427 ms |
| `/equipe` | 3351 ms | 1455 ms |
| `/rapports` | — | 5172 ms (isolé, voir plus bas) |
| `/parametres` | — | 1452 ms |
| **moyenne** | **2760 ms** | **1981 ms** |

Parcours réel (`npm run perf:parcours` — dix écrans enchaînés dans une même
session, 1,2 s entre deux clics) : 1 154 à 1 844 ms par écran, **silhouette
d'attente affichée en 30 à 70 ms**. Avant travaux, l'écran précédent restait en
place pendant les 2,8 s : rien ne bougeait.

Local (`npm run start`, aucun réseau vers Vercel), neuf écrans, clic immédiat :
moyenne **835 ms**, silhouette en 24 à 286 ms.

**Sur l'instrument de mesure.** Le relevé de l'affichage se faisait d'abord par
un minuteur (`setInterval`), qui ne reprend la main qu'une fois le rendu
terminé : il gonflait la mesure de 200 à 300 ms. Les scripts sondent désormais à
chaque image (`requestAnimationFrame`). Les valeurs publiées ci-dessus viennent
toutes de l'instrument corrigé ; un chiffre intermédiaire (1 938 ms) avait été
relevé avec le minuteur et n'est pas comparable.

### Ce qui a été fait

1. `getSession()` : quatre allers-retours (`getUser()` puis profil, appartenance,
   organisation en cascade) remplacés par une vérification locale du jeton
   (`getClaims()`) et une requête jointe. Idem dans le rafraîchissement de
   session du middleware, donc à chaque préchargement de lien.
2. Requêtes groupées : `/pointage` passe de cinq vagues d'appels à deux,
   `/equipe` et `/validations` ramènent le profil avec la liste des membres.
3. `src/app/(app)/loading.tsx` : silhouette aux dimensions des écrans réels,
   affichée dès le clic.
4. Référentiels d'organisation en cache (`src/lib/data/referentiel.ts`) : types
   de congés, départements, jours fériés. Le profil `days` porte un `stale` de
   5 minutes, seuil en dessous duquel Next exclut le contenu de la coquille de
   la route — donc du préchargement. Effet mesuré au passage :
   `x-nextjs-stale-time: 300` sur les réponses, là où le cache navigateur était
   auparavant de quelques dizaines de secondes.
5. Calendrier et rapports servis par le cache navigateur
   (`src/lib/data/calendrier.ts`, `src/lib/data/rapports.ts`,
   `"use cache: private"`) : la session de l'utilisateur est conservée, donc la
   RLS continue de décider de ce qui est lisible, mais revenir sur un écran déjà
   visité coûte 150 à 200 ms au lieu de 1,2 s tant que l'entrée est fraîche.
   Ces deux écrans sont des écrans de consultation, où cinq minutes de retard ne
   changent rien à une décision. Les écrans de décision — soldes, pointage —
   gardent leur lecture directe.

À noter : après un tour complet des dix écrans, le routeur ne ressert plus les
entrées et la navigation repaie son rendu. La limite est du côté de la taille du
cache navigateur, pas d'un réglage à oublier.

### Ce qui reste lent, et pourquoi

La réponse du serveur arrive en ~250-350 ms (premier octet), puis le contenu
continue d'arriver pendant ~1 s. Cette seconde restante n'est pas du rendu : ce
sont les allers-retours vers Supabase. Les fonctions Vercel s'exécutent au Cap
(`x-vercel-id: cpt1`) et la base est en Irlande (`eu-west-1`) : chaque
aller-retour coûte ~200 ms, et il en reste un ou deux par écran (session, puis
données de la page), en série.

S'y ajoutent des à-coups : `/rapports` a été relevé à 5 172 ms et `/pointage` à
6 129 ms une fois chacun, alors que leur médiane est de 1,4 à 2,0 s. Un
démarrage à froid d'instance de fonction explique ce genre de pic, pas le code
de la page — à surveiller, mais ils sont rares et non reproductibles à la
demande.

Les leviers restants, par ordre de rendement :

| Levier | Gain estimé | Ce qu'il coûte |
| --- | --- | --- |
| Mettre les données par personne en cache (`"use cache: private"`, `stale` 5 min) | le plus fort : les visites répétées d'un écran ne coûteraient plus d'aller-retour | une modification faite par quelqu'un d'autre peut rester invisible jusqu'à 5 minutes ; les actions de l'utilisateur, elles, invalident déjà tout le cache client (`revalidatePath`) |
| Déplacer la région des fonctions Vercel vers l'Europe | ~300-400 ms | ajoute ~100-150 ms sur le trajet du navigateur ; à confirmer par une mesure depuis le lieu d'usage réel |
| Rapatrier la base près des fonctions | dépend de l'offre Supabase | changement d'infrastructure |

Le premier levier est un choix de fraîcheur des données, pas une optimisation
technique : à décider écran par écran (un calendrier d'équipe peut se permettre
5 minutes, un solde de congés sans doute pas).

---

## 5. Points de vigilance

**Cache CDN et pages personnalisées.** Les écrans authentifiés sortent en
`Cache-Control: public, max-age=0, must-revalidate`. Vérifié le 14/10/2026 avec
deux comptes réels sur la même URL : la page d'un administrateur n'est jamais
servie à un employé ni à un visiteur sans session (307 vers `/connexion`), et
l'en-tête `Vary` porte bien les paramètres de routeur. À revérifier après toute
évolution de la mise en cache — c'est le genre de réglage qui se casse
silencieusement, et la conséquence serait une fuite entre utilisateurs.

**RLS.** Elle est active sur les 17 tables. Vérifiez après chaque évolution du
schéma :

```bash
npm run db:check    # « Tables sans RLS : aucune »
npm run db:verify   # 71 contrôles, en rôle non privilégié
```

**Clés compromises.** Si `SUPABASE_SERVICE_ROLE_KEY` ou le mot de passe de la
base a circulé en clair (transcript, ticket, capture), régénérez-les :
Project Settings → API → *Reset service_role key*, et Database → *Reset database
password*. Pensez à reporter les nouvelles valeurs dans `.env.local` et sur
Vercel.

**Sauvegardes.** Supabase sauvegarde quotidiennement selon votre offre.
Vérifiez la rétention (Database → Backups) et testez une restauration.

**Envois email.** Sans `RESEND_API_KEY` ni `EMAIL_FROM`, aucune notification
n'est expédiée : l'application reste fonctionnelle, les messages restent
internes. Avec elles, les envois partent de deux façons : immédiatement après
l'action qui les déclenche (demande de congé, validation), et au plus tard par
la tâche planifiée quotidienne, qui dépile ce qui reste. Les envois en attente
et les échecs sont visibles dans `public.notifications` (`email_sent_at`,
`email_error` — une erreur sort la ligne de la file pour qu'elle reste
examinable).

**Chaîne d'envoi déjà éprouvée.** Avec une clé volontairement invalide, la tâche
planifiée a été appelée contre la base réelle : Resend a répondu
`401 — API key is invalid`, l'erreur a été consignée dans `email_error` et la
ligne est sortie de la file. Autrement dit, il ne manque que la clé — et non du
code. La notification jetable du test a été supprimée et les notifications déjà
en file ont été remises en attente.

**Tâches planifiées.** `vercel.json` déclare une tâche quotidienne
(`0 4 * * *`) sur `/api/cron/quotidien` : elle crédite l'acquisition des congés
du mois écoulé pour chaque organisation, dans son propre fuseau horaire, puis
expédie les notifications en attente. Vercel joint
`Authorization: Bearer $CRON_SECRET` ; **sans `CRON_SECRET`, la route répond
401 à tout le monde** (échec fermé).

L'acquisition est idempotente en base (référence déterministe par organisation,
membre, type et période, plus l'index unique `leave_ledger_one_accrual_per_ref_idx`) :
la tâche peut donc passer tous les jours, ce qui rattrape une journée manquée
sans jamais créditer deux fois le même mois. Pour la déclencher à la main :

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://gereotimes.vercel.app/api/cron/quotidien
```

Deux remarques utiles :

- le plan Hobby de Vercel n'accepte qu'une exécution par jour et par tâche :
  c'est la raison d'un passage quotidien plutôt que d'un passage mensuel, la
  logique métier restant mensuelle ;
- une politique `quarterly` n'est créditée que sur un mois qui clôt un
  trimestre, une politique `yearly` qu'en décembre. À l'inverse,
  `accrue_leave(...)`, appelée à la main depuis l'application, crédite la
  période demandée telle quelle : les règles d'acquisition et de proratisation
  restent une question ouverte du PRD (section 11).

---

## 6. Ce qui n'est pas couvert

- Montée en charge : aucune limitation de débit ni cache de bord
- Observabilité : pas de suivi d'erreurs (Sentry ou équivalent)
- Reprise après sinistre : procédure de restauration non testée
- Conformité : les règles de congés et de temps de travail restent à valider
  selon le pays et la convention collective applicable (cf. section 11 du PRD)
