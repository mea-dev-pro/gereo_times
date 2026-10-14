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
- **Redirect URLs** : ajoutez `https://votre-domaine.mg/auth/confirmer` **et**
  `http://localhost:3000/auth/confirmer` (pour le développement)

Sans cette entrée, les liens d'invitation retombent sur la page d'accueil et le
collaborateur n'est jamais rattaché à son organisation.

### Confirmation des emails

Authentication → **Sign In / Providers → Email** : selon votre choix,
« Confirm email » activé ou non. Si vous l'activez, configurez un serveur SMTP
personnalisé — le service d'email par défaut de Supabase est limité en volume et
réservé aux essais.

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

## 5. Points de vigilance

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
