# GereoTimes

Application web de gestion du temps de travail et des congés.
Suivi du pointage, demandes de congés, validations managériales et soldes RH,
en SaaS multi-organisations avec isolation stricte des données.

Référence produit : `../prd/PRD_GereoTimes_Gestion_Temps_Conges.md`

---

## Pile technique

| Couche | Choix |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Server Actions Next.js + fonctions PostgreSQL `SECURITY DEFINER` |
| Données | Supabase PostgreSQL, RLS sur les 16 tables |
| Identité | Supabase Auth |
| Vérification | PGlite (PostgreSQL 18 en WASM) + harnais de bout en bout |

---

## Démarrage

### 1. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseigner, depuis Supabase → Project Settings → API :

- `NEXT_PUBLIC_SUPABASE_URL` — URL du projet
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clé publique (protégée par la RLS)
- `SUPABASE_SERVICE_ROLE_KEY` — clé secrète, **serveur uniquement**

Puis, depuis Project Settings → Database → Connection string :

- `SUPABASE_DB_URL` — nécessaire pour appliquer les migrations

`.env.local` est exclu du dépôt par `.gitignore`. Ne jamais exposer
`SUPABASE_SERVICE_ROLE_KEY` côté client : elle contourne intégralement la RLS.

### 2. Appliquer les migrations

```bash
npm run db:apply    # applique les migrations manquantes
npm run db:check    # affiche l'état du schéma sans modifier
```

Le suivi est assuré par la table `public.schema_migrations` : chaque fichier
n'est appliqué qu'une fois, et chaque migration s'exécute dans une transaction
(échec = annulation complète).

### 3. Lancer

```bash
npm run dev
```

Ouvrir http://localhost:3000 — vous serez redirigé vers `/connexion`.

Créez un compte via `/inscription` : votre organisation, un calendrier de
travail standard, cinq types de congés, leurs politiques et les jours fériés
sont créés automatiquement.

---

## Architecture

```
supabase/migrations/
  0001_schema.sql           16 tables, contraintes, index, vue des soldes
  0002_rls.sql              helpers + policies RLS + garde-fous
  0003_business_logic.sql   RPC transactionnelles métier

src/
  app/
    (app)/                  zone authentifiée (tableau de bord, pointage, congés, validations)
    connexion/  inscription/  organisation/nouvelle/
  lib/
    supabase/               clients navigateur / serveur / admin, rafraîchissement de session
    auth/                   contexte de session, actions d'authentification
    actions/                actions serveur métier (pointage, congés)
  components/ui/            primitives visuelles
  types/database.ts         types de la base

scripts/apply-migrations.mjs
```

### Choix structurants

**Toute écriture sensible passe par une fonction PostgreSQL `SECURITY DEFINER`,
jamais par le client.** Le client ne dispose d'aucune policy d'écriture sur
`leave_ledger`, `leave_approvals` ou `audit_logs` : ces tables ne sont
modifiables que par les RPC métier, qui portent la logique de validation.

**Le journal des soldes est en ajout seul.** Une annulation n'écrase jamais une
ligne : elle produit une écriture inverse (`release` pour clôturer une
réservation, `restitution` pour annuler une consommation). Le solde est
reconstruit par somme signée, ce qui rend l'historique auditable et rend
impossible une double déduction — y compris sous validations concurrentes.

**Une seule session de pointage ouverte par employé**, garanti par un index
unique partiel, et non par du code applicatif.

**Anti-chevauchement des congés** garanti par une contrainte d'exclusion GiST
sur la plage de dates, limitée aux demandes actives.

---

## Vérification

Les migrations ont été exécutées contre un vrai PostgreSQL 18 (PGlite/WASM avec
`btree_gist` et `pgcrypto`), suivi d'un scénario métier complet : 47 contrôles,
0 échec. Couverture :

- exécution des 3 migrations, 16 tables, RLS active sur les 16
- amorçage d'organisation (calendrier, types de congés, politiques, fériés)
- pointage : session unique, pauses, minutes effectives et écarts
- correction d'un pointage clôturé par validation obligatoire
- calcul des jours ouvrés avec week-ends, fériés et demi-journées
- soldes : refus si insuffisant, réservation, consommation, restitution
- **double validation concurrente impossible sur un même solde**
- anti-escalade de privilèges, isolation entre organisations, journal d'audit

L'application compile et se construit sans erreur (`npm run build`), et les
pages publiques ont été vérifiées dans un navigateur.

---

## Périmètre

**Livré (MVP, sprints 1 à 3 du PRD)**

- authentification, création d'organisation, rôles
- pointage entrée/sortie, pauses, historique, corrections justifiées
- demandes de congés, validation, refus motivé, annulation avec restitution
- soldes de congés reconstruits depuis le journal des mouvements
- tableau de bord et écran de validations manager

**À venir (phase 2, sprints 4 à 6)**

- calendrier d'équipe, tableaux de bord RH et exports
- notifications par email (Resend)
- administration RH complète (horaires, politiques, circuits de validation)
- invitations de collaborateurs
- tests Playwright, déploiement Vercel

---

## Sécurité

- RLS activée sur les 16 tables, avec isolation par organisation vérifiée par test
- permissions contrôlées côté serveur, jamais dans l'interface
- garde-fous en base : anti-escalade de rôle, gel des demandes décidées,
  protection des pointages clôturés
- journal d'audit sur toutes les opérations sensibles
- `SUPABASE_SERVICE_ROLE_KEY` isolée dans un module serveur dédié
