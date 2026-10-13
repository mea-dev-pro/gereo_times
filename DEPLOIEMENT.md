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
RESEND_API_KEY           (facultatif)
EMAIL_FROM               (facultatif)
```

Ne marquez **jamais** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
`RESEND_API_KEY` comme exposées au navigateur : elles contournent la RLS ou
donnent accès à la base.

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
  interne, comme prévu sans elles.

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
2. **Redirect URL Supabase.** Ajouter `https://gereotimes.vercel.app/auth/confirmer`
   dans Authentication → URL Configuration. Sans cela, les liens d'activation
   envoyés aux collaborateurs retombent sur l'accueil.

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
npm run db:verify   # 65 contrôles, en rôle non privilégié
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
internes. Les envois en attente et les échecs sont visibles dans
`public.notifications` (`email_sent_at`, `email_error`).

**Tâches planifiées.** Aucun ordre du jour automatique n'est encore branché :
l'acquisition mensuelle des congés se déclenche via `accrue_leave(...)`. Sur
Vercel, un *Cron Job* peut l'appeler chaque début de mois.

---

## 6. Ce qui n'est pas couvert

- Montée en charge : aucune limitation de débit ni cache de bord
- Observabilité : pas de suivi d'erreurs (Sentry ou équivalent)
- Reprise après sinistre : procédure de restauration non testée
- Conformité : les règles de congés et de temps de travail restent à valider
  selon le pays et la convention collective applicable (cf. section 11 du PRD)
