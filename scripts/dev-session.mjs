#!/usr/bin/env node
/**
 * Outil de développement : produit les cookies de session @supabase/ssr pour un
 * compte donné, sans passer par un formulaire de connexion.
 *
 *   DEV_PASSWORD='…' node scripts/dev-session.mjs utilisateur@exemple.test
 *
 * Utile pour les tests automatisés et la vérification manuelle. Le mot de passe
 * est lu dans l'environnement, jamais en argument (il apparaîtrait dans la
 * liste des processus).
 *
 * Sortie : JSON { email, userId, cookies: [{ name, value }] } sur stdout.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const email = process.argv[2];
const password = process.env.DEV_PASSWORD;

if (!email || !password) {
  console.error(
    "usage: DEV_PASSWORD='…' node scripts/dev-session.mjs <email>"
  );
  process.exit(1);
}

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

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  console.error("ERREUR:", error.message);
  process.exit(1);
}

console.log(
  JSON.stringify({
    email: data.user.email,
    userId: data.user.id,
    cookies: Array.from(jar, ([name, value]) => ({ name, value })),
  })
);
