#!/usr/bin/env node
/**
 * Vérification hors ligne des migrations GereoTimes.
 *
 *   npm run db:verify
 *
 * Exécute les migrations contre un vrai PostgreSQL 18 (PGlite / WASM) avec les
 * extensions contrib utilisées par Supabase, puis déroule un scénario métier
 * complet **en rôle non privilégié**, de sorte que les policies RLS soient
 * réellement appliquées et non contournées.
 *
 * Ne nécessite ni Docker, ni serveur PostgreSQL, ni accès réseau.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

const db = new PGlite({ extensions: { btree_gist, pgcrypto } });

let checks = 0;
let failures = 0;

process.on("uncaughtException", (e) => {
  console.log(`\nERREUR FATALE : ${e.message}\n`);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.log(`\nERREUR FATALE : ${e?.message ?? e}\n`);
  process.exit(1);
});

async function q(sql, params) {
  const r = await db.query(sql, params);
  return r.rows;
}

function check(label, condition, detail = "") {
  checks++;
  if (condition) {
    console.log(`  OK    ${label}${detail ? " — " + detail : ""}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
    failures++;
  }
}

async function run(label, sql) {
  try {
    await db.exec(sql);
    console.log(`  OK    ${label}`);
    return true;
  } catch (e) {
    console.log(`  FAIL  ${label}\n        ${e.message}`);
    failures++;
    return false;
  }
}

/** Vérifie qu'une opération échoue bien, avec le motif attendu. */
async function expectError(label, fn, needle) {
  checks++;
  try {
    await fn();
    console.log(`  FAIL  ${label} — aucune erreur levée`);
    failures++;
  } catch (e) {
    const message = e.message.split("\n")[0];
    const matches = !needle || e.message.includes(needle);
    if (matches) {
      console.log(`  OK    ${label} — ${message.slice(0, 88)}`);
    } else {
      console.log(`  FAIL  ${label} — erreur inattendue : ${message}`);
      failures++;
    }
  }
}

/** Exécute une opération hors RLS (rôle propriétaire). */
async function asOwner(fn) {
  await q("reset role");
  try {
    return await fn();
  } finally {
    await q("set role authenticated");
  }
}

/** Crée un utilisateur auth : hors RLS, la table auth n'appartient pas au client. */
async function createUser(email, fullName) {
  return asOwner(async () => {
    const [u] = await q(
      `insert into auth.users (email, raw_user_meta_data)
       values ($1, $2::jsonb) returning id`,
      [email, JSON.stringify({ full_name: fullName })]
    );
    return u.id;
  });
}

async function setUser(userId) {
  await q(`select set_config('app.current_user', $1, false)`, [userId]);
}

// =============================================================================
console.log("\n=== 0. Stubs de l'environnement Supabase ===");

await run("rôles anon / authenticated / service_role", `
  do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
`);

await run("schéma auth + table auth.users", `
  create schema if not exists auth;
  create table if not exists auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
`);

await run("auth.uid() adossée à un GUC de session", `
  create or replace function auth.uid() returns uuid
  language sql stable as $f$
    select nullif(current_setting('app.current_user', true), '')::uuid
  $f$;
`);

// =============================================================================
console.log("\n=== 1. Exécution des migrations ===");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  await run(file, readFileSync(join(migrationsDir, file), "utf8"));
}

// Supabase accorde par défaut les privilèges de table à authenticated ;
// la RLS fait ensuite le tri. Sans cette étape le test serait faussé.
await run("privilèges de table accordés à authenticated (comme Supabase)", `
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
`);

const ext = await q("select extname from pg_extension order by 1");
const tables = await q(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1
`);
const policies = await q(`
  select tablename, count(*)::int as n from pg_policies
  where schemaname = 'public' group by 1 order by 1
`);
const noRls = await q(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`);

console.log(`  Extensions    : ${ext.map((r) => r.extname).join(", ")}`);
console.log(`  Tables (${tables.length})     : ${tables.map((r) => r.table_name).join(", ")}`);
check("RLS activée sur les 16 tables", tables.length === 16 && noRls.length === 0,
  `${policies.length} tables avec policies`);
check("Toutes les tables ont au moins une policy",
  policies.length === 16, `${policies.length}/16`);

// =============================================================================
console.log("\n=== 2. Bascule en rôle non privilégié (la RLS s'applique) ===");
await q("set role authenticated");
const role = await q("select current_user, current_setting('is_superuser') as su");
console.log(`  Rôle courant : ${role[0].current_user} (superuser = ${role[0].su})`);
check("Le scénario s'exécute sans privilège superutilisateur",
  role[0].current_user === "authenticated" && role[0].su === "off");

// =============================================================================
console.log("\n=== 3. Amorçage d'une organisation ===");

const adminId = await createUser("admin@acme.mg", "Rakoto Admin");
const empId = await createUser("employe@acme.mg", "Rasoa Employée");
const strangerId = await createUser("autre@beta.mg", "Autre Admin");

await asOwner(async () => {
  const [p] = await q("select count(*)::int as n from public.profiles");
  check("Trigger handle_new_user : profils créés automatiquement", p.n === 3, `${p.n} profils`);
});

await setUser(adminId);
const [orgRow] = await q(`select public.create_organization('Acme SARL','acme-sarl') as org_id`);
const org = orgRow.org_id;
check("create_organization retourne un identifiant", Boolean(org), org);

check("Amorçage : 5 types de congés",
  (await q(`select count(*)::int as n from public.leave_types where organization_id = $1`, [org]))[0].n === 5);
check("Amorçage : calendrier de travail par défaut",
  (await q(`select count(*)::int as n from public.work_schedules where organization_id = $1`, [org]))[0].n === 1);
check("Amorçage : jours fériés posés",
  (await q(`select count(*)::int as n from public.holidays where organization_id = $1`, [org]))[0].n === 5);

const [adminMember] = await q(
  `select id, role from public.organization_members where organization_id = $1`, [org]);
check("L'administrateur est rattaché avec le rôle admin", adminMember.role === "admin");

// Embauche d'un employé, par l'administrateur (policy om_insert)
const [empMember] = await q(
  `insert into public.organization_members
     (organization_id, user_id, role, status, manager_id, work_schedule_id)
   select $1, $2, 'employee', 'active', $3, ws.id
   from public.work_schedules ws
   where ws.organization_id = $1 and ws.is_default
   returning id`, [org, empId, adminMember.id]);
check("L'admin peut rattacher un employé (RLS om_insert)", Boolean(empMember.id));

// =============================================================================
console.log("\n=== 4. ISOLEMENT RLS (rôle non privilégié) ===");

await setUser(empId);

const ownEntries = await q(
  `select count(*)::int as n from public.time_entries where member_id = $1`, [empMember.id]);
check("Un employé voit ses propres pointages", ownEntries[0].n === 0,
  "0 avant tout pointage (la requête n'est pas filtrée par erreur)");

const othersEntries = await q(
  `select count(*)::int as n from public.time_entries where member_id = $1`, [adminMember.id]);
check("Un employé ne voit pas les pointages d'un collègue", othersEntries[0].n === 0);

const allMembers = await q(
  `select count(*)::int as n from public.organization_members where organization_id = $1`, [org]);
check("Un employé voit les membres de son organisation (annuaire)", allMembers[0].n === 2,
  `${allMembers[0].n} membres`);

const foreignOrgs = await q(`select count(*)::int as n from public.organizations`);
check("Un employé ne voit que son organisation", foreignOrgs[0].n === 1,
  `${foreignOrgs[0].n} organisation(s) visible(s)`);

await expectError(
  "Écriture directe dans le journal des soldes interdite au client",
  () => q(`insert into public.leave_ledger
            (organization_id, member_id, leave_type_id, movement, amount, effective_date)
          select $1, $2, lt.id, 'accrual', 99, current_date
          from public.leave_types lt
          where lt.organization_id = $1 and lt.code = 'ANNUAL'`, [org, empMember.id]),
  "row-level security");

await expectError(
  "Écriture directe dans leave_approvals interdite au client",
  () => q(`insert into public.leave_approvals
            (organization_id, leave_request_id, level, status)
          values ($1, gen_random_uuid(), 1, 'approved')`, [org]),
  "row-level security");

await expectError(
  "Écriture directe dans le journal d'audit interdite au client",
  () => q(`insert into public.audit_logs (organization_id, action, entity_type)
          values ($1, 'falsification', 'manual')`, [org]),
  "row-level security");

await expectError(
  "Un employé ne peut pas se promouvoir manager",
  () => q(`update public.organization_members set role = 'manager' where id = $1`, [empMember.id]),
  "Modification non autorisée");

// Un UPDATE bloqué par RLS ne lève pas d'erreur : il ne touche simplement
// aucune ligne. On vérifie donc l'effet réel, pas le message.
const attemptPromote = await q(
  `update public.organization_members set role = 'admin' where id = $1 returning id`,
  [adminMember.id]);
const [adminRoleAfter] = await q(
  `select role from public.organization_members where id = $1`, [adminMember.id]);
check("Un employé ne peut pas modifier le rôle d'un collègue",
  attemptPromote.length === 0 && adminRoleAfter.role === "admin",
  `0 ligne modifiée, rôle toujours « ${adminRoleAfter.role} »`);

// Isolation entre deux organisations distinctes
await setUser(strangerId);
const [org2Row] = await q(`select public.create_organization('Beta SA','beta-sa') as org_id`);
const org2 = org2Row.org_id;
check("Deuxième organisation créée, distincte", org2 !== org);

const crossMembers = await q(
  `select count(*)::int as n from public.organization_members where organization_id = $1`, [org]);
check("Un admin d'une autre organisation ne voit aucun membre d'Acme",
  crossMembers[0].n === 0, `${crossMembers[0].n} membre(s) d'Acme visible(s) depuis Beta`);

const crossLedger = await q(
  `select count(*)::int as n from public.leave_ledger where organization_id = $1`, [org]);
check("Aucun mouvement de solde d'Acme n'est visible depuis Beta",
  crossLedger[0].n === 0);

// =============================================================================
console.log("\n=== 5. Scénario métier complet ===");
await setUser(empId);

console.log("\n  -- Pointage --");
const [entry] = await q(`select public.clock_in($1) as id`, [org]);
check("clock_in ouvre une session", Boolean(entry.id));

await expectError("Une seule session active par employé",
  () => q(`select public.clock_in($1)`, [org]), "déjà ouverte");

await q(`select public.start_break($1)`, [org]);
check("Pause démarrée",
  (await q(`select count(*)::int as n from public.break_entries
            where time_entry_id = $1 and ended_at is null`, [entry.id]))[0].n === 1);

await q(`select public.end_break($1)`, [org]);
await q(`select public.clock_out($1)`, [org]);

const [te] = await q(`select * from public.time_entries where id = $1`, [entry.id]);
check("clock_out clôture la session", te.status === "closed");
check("Écart calculé par rapport au temps planifié", te.variance_minutes !== null,
  `${te.variance_minutes} min vs ${te.planned_minutes} planifiées`);

await expectError("clock_out sans session ouverte échoue",
  () => q(`select public.clock_out($1)`, [org]), "Aucune session");

await expectError("Une session clôturée ne peut être modifiée directement",
  () => q(`update public.time_entries set clock_in = clock_in - interval '2 hours' where id = $1`, [entry.id]),
  "correction justifiée");

const [adj] = await q(
  `select public.request_time_adjustment($1, $2, now() - interval '9 hours', now(),
     'Oubli de pointage à l''arrivée') as id`, [org, entry.id]);
check("Correction de pointage demandée", Boolean(adj.id));

await setUser(adminId);
await q(`select public.decide_time_adjustment($1, true, 'Vérifié sur badge')`, [adj.id]);
const [te2] = await q(`select status, worked_minutes from public.time_entries where id = $1`, [entry.id]);
check("Correction appliquée", te2.status === "corrected", `${te2.worked_minutes} min`);

console.log("\n  -- Soldes de congés --");
const [accrued] = await q(`select public.accrue_leave($1, '2026-10-01', '2026-10-31') as n`, [org]);
check("accrue_leave crée les mouvements", accrued.n > 0, `${accrued.n} écritures`);
const [accrued2] = await q(`select public.accrue_leave($1, '2026-10-01', '2026-10-31') as n`, [org]);
check("accrue_leave idempotent", accrued2.n === 0);

const [annual] = await q(
  `select id from public.leave_types where organization_id = $1 and code = 'ANNUAL'`, [org]);

await setUser(empId);
const [balBefore] = await q(
  `select available_days from public.leave_balances where member_id = $1 and leave_type_id = $2`,
  [empMember.id, annual.id]);
check("Solde annuel acquis = 2,5 j", Number(balBefore.available_days) === 2.5,
  `${balBefore.available_days} j`);

console.log("\n  -- Demandes de congés --");
await expectError("Solde insuffisant refusé",
  () => q(`select public.submit_leave_request($1, $2, '2026-11-02', '2026-11-06')`, [org, annual.id]),
  "Solde insuffisant");

const [req1] = await q(
  `select public.submit_leave_request($1, $2, '2026-11-02', '2026-11-03', 'pm'::half_day, null,
     'Rendez-vous familial') as id`, [org, annual.id]);
const [lr] = await q(`select * from public.leave_requests where id = $1`, [req1.id]);
check("Jours ouvrés avec demi-journée = 1,5", Number(lr.business_days) === 1.5,
  `${lr.business_days} j`);

const [balAfter] = await q(
  `select available_days, reserved_days from public.leave_balances
   where member_id = $1 and leave_type_id = $2`, [empMember.id, annual.id]);
check("Solde réservé dès la soumission", Number(balAfter.reserved_days) === 1.5,
  `disponible ${balAfter.available_days} j`);

await expectError("Chevauchement de deux demandes actives bloqué",
  () => q(`select public.submit_leave_request($1, $2, '2026-11-03', '2026-11-03')`, [org, annual.id]),
  "overlap");

await expectError("Un employé ne peut pas approuver sa propre demande",
  () => q(`select public.decide_leave_request($1, true, 'auto')`, [req1.id]), "autorisé");

await setUser(adminId);
await q(`select public.decide_leave_request($1, true, 'Bon repos')`, [req1.id]);

const [balFinal] = await q(
  `select available_days, reserved_days, used_days from public.leave_balances
   where member_id = $1 and leave_type_id = $2`, [empMember.id, annual.id]);
check("Réservation convertie en consommation", Number(balFinal.used_days) === 1.5,
  `utilisé ${balFinal.used_days}, disponible ${balFinal.available_days}`);

await expectError(
  "CRITÈRE PRD : une 2e validation ne consomme pas le solde deux fois",
  () => q(`select public.decide_leave_request($1, true, 'doublon')`, [req1.id]),
  "déjà été traitée");

const ledgerReq1 = await q(
  `select movement, count(*)::int as n from public.leave_ledger
   where reference_type = 'leave_request' and reference_id = $1 group by 1 order by 1`, [req1.id]);
check("Journal en ajout seul : 1 réservation, 1 clôture, 1 consommation",
  ledgerReq1.length === 3 &&
    ledgerReq1.every((r) => r.n === 1),
  JSON.stringify(ledgerReq1));

const [netEffect] = await q(
  `select coalesce(sum(amount),0)::numeric as net from public.leave_ledger
   where reference_type = 'leave_request' and reference_id = $1`, [req1.id]);
check("Effet net = -1,5 j exactement", Number(netEffect.net) === -1.5, `${netEffect.net} j`);

console.log("\n  -- Annulation et restitution --");
await setUser(empId);
await q(`select public.cancel_leave_request($1, 'Changement de planning')`, [req1.id]);
const [balCancelled] = await q(
  `select available_days, used_days from public.leave_balances
   where member_id = $1 and leave_type_id = $2`, [empMember.id, annual.id]);
check("Annulation d'un congé approuvé restitue les droits",
  Number(balCancelled.available_days) === 2.5 && Number(balCancelled.used_days) === 0,
  `disponible ${balCancelled.available_days} j`);

const [req2] = await q(
  `select public.submit_leave_request($1, $2, '2026-12-07', '2026-12-07', null, null,
     'Démarche administrative') as id`, [org, annual.id]);
await q(`select public.cancel_leave_request($1, 'Reporté')`, [req2.id]);
const [balReleased] = await q(
  `select available_days, reserved_days from public.leave_balances
   where member_id = $1 and leave_type_id = $2`, [empMember.id, annual.id]);
check("Annulation d'une demande en attente libère la réservation",
  Number(balReleased.available_days) === 2.5 && Number(balReleased.reserved_days) === 0,
  `disponible ${balReleased.available_days} j`);

// =============================================================================
console.log("\n=== 6. Journal des mouvements ===");
await asOwner(async () => {
  const ledger = await q(
    `select movement, amount, note from public.leave_ledger
     where organization_id = $1 order by created_at`, [org]);
  for (const row of ledger) {
    console.log(`   ${row.movement.padEnd(12)} ${String(row.amount).padStart(6)}  ${row.note ?? ""}`);
  }
  const balances = await q(
    `select lt.code, b.accrued_days, b.used_days, b.reserved_days, b.available_days
     from public.leave_balances b
     join public.leave_types lt on lt.id = b.leave_type_id
     where b.organization_id = $1 order by lt.code`, [org]);
  console.log("\n   Soldes finaux :");
  for (const b of balances) {
    console.log(
      `   ${b.code.padEnd(9)} acquis ${String(b.accrued_days).padStart(5)}` +
      ` | utilisé ${String(b.used_days).padStart(5)}` +
      ` | réservé ${String(b.reserved_days).padStart(5)}` +
      ` | disponible ${b.available_days}`
    );
  }
  const [audit] = await q(
    `select count(*)::int as n from public.audit_logs where organization_id = $1`, [org]);
  check("Journal d'audit alimenté", audit.n >= 5, `${audit.n} entrées`);
});

// =============================================================================
console.log(`\n=== RÉSULTAT : ${checks} vérifications, ${failures} échec(s) ===\n`);
process.exit(failures === 0 ? 0 : 1);
