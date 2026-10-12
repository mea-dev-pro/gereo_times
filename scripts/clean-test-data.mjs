#!/usr/bin/env node
/**
 * Purge des données de test.
 *
 *   npm run db:clean-test -- --slug acme-test-sarl --email-domain acme.test
 *
 * Supprime, dans l'ordre :
 *   1. les organisations (la cascade emporte toutes leurs données métier)
 *   2. les comptes d'authentification correspondant au domaine indiqué
 *      (la cascade emporte profils et appartenances)
 *
 * Par défaut, cible le slug et le domaine utilisés pendant la mise au point.
 * Sans --yes, se contente d'afficher ce qui serait supprimé.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const SLUG = arg("slug", "acme-test-sarl");
const EMAIL_DOMAIN = arg("email-domain", "acme.test");
const CONFIRM = process.argv.includes("--yes");

// --- Environnement -----------------------------------------------------------
const env = {};
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  /* on se rabat sur l'environnement */
}

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = env.SUPABASE_DB_URL;

if (!URL_BASE || !SERVICE_KEY || !DB_URL) {
  console.error(
    "\n  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et SUPABASE_DB_URL\n" +
      "  sont requis dans .env.local.\n"
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// --- Inventaire --------------------------------------------------------------
const orgs = await client.query(
  `select id, name, slug from public.organizations where slug = $1`,
  [SLUG]
);

async function listTestUsers() {
  const res = await fetch(
    `${URL_BASE}/auth/v1/admin/users?per_page=200`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!res.ok) throw new Error(`liste des utilisateurs : HTTP ${res.status}`);
  const body = await res.json();
  return (body.users ?? []).filter((u) => (u.email ?? "").endsWith(`@${EMAIL_DOMAIN}`));
}

const users = await listTestUsers();

console.log(`\n  Cible : organisation « ${SLUG} » et comptes @${EMAIL_DOMAIN}\n`);
console.log(`  Organisations trouvées : ${orgs.rowCount}`);
for (const o of orgs.rows) console.log(`    - ${o.name} (${o.id})`);
console.log(`  Comptes trouvés        : ${users.length}`);
for (const u of users) console.log(`    - ${u.email} (${u.id})`);

if (orgs.rowCount === 0 && users.length === 0) {
  console.log("\n  Rien à supprimer.\n");
  await client.end();
  process.exit(0);
}

if (!CONFIRM) {
  console.log("\n  Mode simulation. Relancez avec --yes pour supprimer.\n");
  await client.end();
  process.exit(0);
}

// --- Suppression -------------------------------------------------------------
console.log("\n  Suppression…");

for (const o of orgs.rows) {
  const counts = await client.query(
    `select
       (select count(*) from public.time_entries      where organization_id = $1) as pointages,
       (select count(*) from public.leave_requests    where organization_id = $1) as conges,
       (select count(*) from public.leave_ledger      where organization_id = $1) as mouvements,
       (select count(*) from public.organization_members where organization_id = $1) as membres`,
    [o.id]
  );
  const c = counts.rows[0];
  await client.query(`delete from public.organizations where id = $1`, [o.id]);
  console.log(
    `    organisation « ${o.name} » supprimée ` +
      `(${c.membres} membres, ${c.pointages} pointages, ${c.conges} demandes, ${c.mouvements} mouvements)`
  );
}

for (const u of users) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${u.id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  console.log(`    compte ${u.email} — HTTP ${res.status}`);
}

// --- Contrôle ----------------------------------------------------------------
const after = await client.query(
  `select
     (select count(*) from public.organizations)        as organizations,
     (select count(*) from public.organization_members) as members,
     (select count(*) from public.time_entries)         as time_entries,
     (select count(*) from public.leave_requests)       as leave_requests,
     (select count(*) from public.leave_ledger)         as leave_ledger,
     (select count(*) from public.audit_logs)           as audit_logs`
);

const remainingUsers = await listTestUsers();

console.log("\n  ÉTAT APRÈS NETTOYAGE");
for (const [k, v] of Object.entries(after.rows[0])) {
  console.log(`    ${k.padEnd(16)}: ${v}`);
}
console.log(`    comptes @${EMAIL_DOMAIN} : ${remainingUsers.length}`);

const clean =
  remainingUsers.length === 0 &&
  Number(after.rows[0].organizations) === 0 &&
  Number(after.rows[0].members) === 0 &&
  Number(after.rows[0].time_entries) === 0 &&
  Number(after.rows[0].leave_requests) === 0 &&
  Number(after.rows[0].leave_ledger) === 0;

console.log(clean ? "\n  Nettoyage complet ✓\n" : "\n  ⚠ Des données subsistent\n");

await client.end();
process.exit(clean ? 0 : 1);
