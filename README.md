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
npm run db:apply      # applique les migrations manquantes
npm run db:check      # affiche l'état du schéma sans modifier
npm run db:verify     # 56 contrôles hors ligne (PGlite), RLS réellement appliquée
npm run db:clean-test # purge des données de recette (simulation par défaut)
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
  0004_invitations.sql      invitations de collaborateurs
  0005_config_audit.sql     journalisation des modifications de configuration

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

```bash
npm run db:verify    # aucune dépendance externe : ni Docker, ni serveur PostgreSQL
```

Le script exécute les migrations contre un vrai PostgreSQL 18 (PGlite / WASM,
avec `btree_gist` et `pgcrypto`), puis déroule un scénario complet **en rôle non
privilégié** — condition indispensable pour que les policies RLS soient
réellement appliquées et non contournées. 46 contrôles, 0 échec. Couverture :

- exécution des 3 migrations, 16 tables, RLS active sur les 16
- **isolation RLS** : un employé ne voit ni les pointages ni les demandes d'un
  collègue ; un admin d'une autre organisation ne voit rien ; écriture directe
  dans `leave_ledger`, `leave_approvals` ou `audit_logs` refusée au client
- amorçage d'organisation (calendrier, types de congés, politiques, fériés)
- pointage : session unique, pauses, minutes effectives et écarts
- correction d'un pointage clôturé par validation obligatoire
- calcul des jours ouvrés avec week-ends, fériés et demi-journées
- soldes : refus si insuffisant, réservation, consommation, restitution
- **double validation concurrente impossible sur un même solde**
- anti-escalade de privilèges, journal d'audit alimenté

L'application compile et se construit sans erreur (`npm run build`), et les
pages publiques ont été vérifiées dans un navigateur.

---

## Périmètre

**Livré**

- authentification, création d'organisation, rôles
- pointage entrée/sortie, pauses, historique, corrections justifiées
- demandes de congés, validation, refus motivé, annulation avec restitution
- soldes de congés reconstruits depuis le journal des mouvements
- tableau de bord et écran de validations manager
- **invitations de collaborateurs** : lien d'activation sans mot de passe,
  acceptation automatique à la première connexion, révocation
- **gestion de l'équipe** : rôles, rattachement hiérarchique, désactivation
- **administration RH** : départements, jours fériés, types de congés,
  politiques versionnées (acquisition, préavis, niveaux de validation),
  calendriers de travail — chaque modification journalisée automatiquement

**À venir (phase 2, sprints 4 à 6)**

- calendrier d'équipe (vues mensuelle et hebdomadaire des disponibilités)
- tableaux de bord RH agrégés et exports
- notifications internes et par email (Resend)
- tests Playwright, déploiement Vercel

---

## Sécurité

- RLS activée sur les 16 tables, avec isolation par organisation vérifiée par test
- permissions contrôlées côté serveur, jamais dans l'interface
- garde-fous en base : anti-escalade de rôle, gel des demandes décidées,
  protection des pointages clôturés
- journal d'audit sur toutes les opérations sensibles
- `SUPABASE_SERVICE_ROLE_KEY` isolée dans un module serveur dédié
