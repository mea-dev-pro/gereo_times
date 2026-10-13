#!/usr/bin/env node
/**
 * Prépare les sessions Playwright (fichiers storageState).
 *
 *   E2E_ADMIN_PASSWORD='…' E2E_EMPLOYE_PASSWORD='…' npm run e2e:auth
 *
 * Les emails sont configurables via E2E_ADMIN_EMAIL / E2E_EMPLOYE_EMAIL.
 * Les fichiers produits contiennent des jetons de session : ils sont exclus
 * du dépôt par .gitignore (tests/.auth/).
 *
 * Aucun mot de passe n'est saisi dans un formulaire : la session est obtenue
 * par l'API d'authentification, puis injectée sous forme de cookie — exactement
 * ce que fait le navigateur après une connexion réussie.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const host = new URL(BASE_URL).hostname;

const ACCOUNTS = [
  {
    file: "admin.json",
    email: process.env.E2E_ADMIN_EMAIL ?? "recette@demo.test",
    password: process.env.E2E_ADMIN_PASSWORD,
  },
  {
    file: "employe.json",
    email: process.env.E2E_EMPLOYE_EMAIL ?? "employe4@demo.test",
    password: process.env.E2E_EMPLOYE_PASSWORD,
  },
];

const outDir = join(root, "tests", ".auth");

async function storageStateFor(email, password) {
  const jar = new Map();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (list) => {
          for (const { name, value } of list) jar.set(name, value);
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`${email} : ${error.message}`);

  return {
    cookies: Array.from(jar, ([name, value]) => ({
      name,
      value,
      domain: host,
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    })),
    origins: [],
  };
}

mkdirSync(outDir, { recursive: true });

let created = 0;
for (const account of ACCOUNTS) {
  if (!account.password) {
    console.log(`  ${account.file.padEnd(14)} ignoré (mot de passe non fourni)`);
    continue;
  }
  try {
    const state = await storageStateFor(account.email, account.password);
    writeFileSync(join(outDir, account.file), JSON.stringify(state, null, 2));
    console.log(`  ${account.file.padEnd(14)} prêt — ${account.email}`);
    created++;
  } catch (e) {
    console.log(`  ${account.file.padEnd(14)} ÉCHEC — ${e.message}`);
  }
}

console.log(
  `\n  ${created} session(s) écrite(s) dans tests/.auth/ (exclu du dépôt)\n`
);
process.exit(created > 0 ? 0 : 1);
