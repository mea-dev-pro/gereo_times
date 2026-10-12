#!/usr/bin/env node
/**
 * Applique les migrations GereoTimes sur Supabase.
 *
 *   npm run db:apply    applique les migrations manquantes
 *   npm run db:check    affiche l'état du schéma sans rien modifier
 *
 * La chaîne de connexion est lue dans SUPABASE_DB_URL (.env.local).
 * Elle se trouve dans Supabase → Project Settings → Database → Connection string
 * (mode « Session pooler » ou « Direct connection »).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const checkOnly = process.argv.includes("--check");

// --- Chargement de .env.local -------------------------------------------------
function loadEnv() {
  try {
    const text = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* .env.local absent : on se rabat sur l'environnement */
  }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "\n  SUPABASE_DB_URL est absente.\n" +
      "  Renseignez-la dans .env.local, par exemple :\n" +
      "  SUPABASE_DB_URL=postgresql://postgres:MOT_DE_PASSE@db.qvopcsqabvqnjcfpxlut.supabase.co:5432/postgres\n"
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`\n  Connecté à ${new URL(url).host}\n`);

// La table de suivi vit dans le schéma public, donc exposé par PostgREST.
// RLS activée sans aucune policy : inaccessible au client, seul le rôle
// propriétaire (utilisé par ce script) peut la lire.
await client.query(`
  create table if not exists public.schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
  )
`);
await client.query(
  `alter table public.schema_migrations enable row level security`
);
await client.query(
  `revoke all on public.schema_migrations from anon, authenticated`
);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const { rows } = await client.query(
  "select version from public.schema_migrations"
);
const applied = new Set(rows.map((r) => r.version));

// --- Application --------------------------------------------------------------
if (!checkOnly) {
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  = ${file}  (déjà appliquée)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`  → ${file}  … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (version) values ($1)",
        [file]
      );
      await client.query("commit");
      console.log("OK");
      count++;
    } catch (error) {
      await client.query("rollback");
      console.log("ÉCHEC");
      console.error(`\n    ${error.message}\n`);
      await client.end();
      process.exit(1);
    }
  }
  console.log(
    `\n  ${count} migration(s) appliquée(s), ${files.length - count} déjà en place.\n`
  );
}

// --- Vérification -------------------------------------------------------------
const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by 1
`);

const policies = await client.query(`
  select tablename, count(*)::int as n
  from pg_policies where schemaname = 'public'
  group by 1 order by 1
`);

const noRls = await client.query(`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`);

const functions = await client.query(`
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_organization','clock_in','clock_out','start_break','end_break',
      'submit_leave_request','decide_leave_request','cancel_leave_request',
      'accrue_leave','adjust_leave_balance','compute_leave_days',
      'is_working_day','leave_available_days','request_time_adjustment',
      'decide_time_adjustment','recalc_time_entry'
    )
  order by 1
`);

const views = await client.query(`
  select table_name from information_schema.views
  where table_schema = 'public' order by 1
`);

console.log("  ÉTAT DU SCHÉMA");
console.log(`    Tables        : ${tables.rowCount}`);
console.log(`    Vues          : ${views.rows.map((r) => r.table_name).join(", ") || "aucune"}`);
console.log(`    Tables RLS    : ${policies.rowCount}/16`);
console.log(
  `    Fonctions     : ${functions.rowCount}/16 ` +
    `${functions.rowCount < 16 ? "⚠ incomplet" : "✓"}`
);
console.log(
  `    Tables sans RLS : ${noRls.rowCount === 0 ? "aucune ✓" : noRls.rows.map((r) => r.relname).join(", ") + " ⚠"}\n`
);

await client.end();
process.exit(0);
