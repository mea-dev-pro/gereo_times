#!/usr/bin/env node
/**
 * Vérifie la chaîne d'envoi des notifications, de bout en bout.
 *
 *   node scripts/verify-email-chain.mjs [url]     (défaut : http://localhost:3000)
 *
 * À lancer serveur démarré (`npm run build && npm run start`), avec
 * `RESEND_API_KEY` et `EMAIL_FROM` dans `.env.local` :
 *
 *   1. dépose une notification jetable pour un membre actif ;
 *   2. appelle `/api/cron/quotidien`, qui dépile la file d'envoi ;
 *   3. relit la ligne : soit expédiée (`email_sent_at`), soit en échec
 *      (`email_error`, avec le message d'erreur de Resend) ;
 *   4. supprime la ligne et remet en file les notifications déjà en attente
 *      avant le test — sans quoi elles resteraient marquées en échec.
 *
 * Sans clé valide, l'échec attendu est `401 — API key is invalid` : le code est
 * bon, la clé manque. Avec une clé valide, un email réel part vers le membre
 * choisi (premier membre actif avec adresse, organisé par nom d'organisation).
 *
 * Refuse de tourner si `CRON_SECRET` est absente : la route répondrait 401 et
 * le test ne dirait rien.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const root = process.cwd();
const env = {};
for (const line of readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const cible = process.argv[2] ?? "http://localhost:3000";

if (!env.CRON_SECRET) {
  console.log("  ARRÊT : CRON_SECRET absente de .env.local — la route répondrait 401");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: membres } = await client.query(`
  select om.id, om.organization_id, o.name as org, p.email
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles p on p.id = om.user_id
  where om.status = 'active' and p.email is not null
  order by o.name, p.email
  limit 1
`);

if (!membres.length) {
  console.log("  ARRÊT : aucun membre actif avec email — rien à tester");
  await client.end();
  process.exit(1);
}

const m = membres[0];

// La file d'attente peut contenir de vraies notifications : l'appel de la route
// les marquerait en échec (clé invalide). On note leur identifiant pour les
// remettre en file après le test.
const { rows: fileAvant } = await client.query(
  `select id from public.notifications where email_sent_at is null and email_error is null`
);
console.log(`  File d'attente avant le test : ${fileAvant.length} notification(s) — état noté pour restauration`);

const { rows: [notif] } = await client.query(
  `insert into public.notifications (organization_id, member_id, kind, title, body, link)
   values ($1, $2, 'probe', 'Sonde technique', 'Vérification de la chaîne d''envoi.', '/notifications')
   returning id`,
  [m.organization_id, m.id]
);

console.log(`  Notification jetable ${notif.id.slice(0, 8)}… pour ${m.email} (${m.org})`);

// --- Appel de la tâche planifiée ---------------------------------------------
const reponse = await fetch(`${cible}/api/cron/quotidien`, {
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const corps = await reponse.json();

const acquisition = corps.acquisition?.organizations ?? [];
console.log(`  HTTP ${reponse.status} — acquisition : ${acquisition.length} organisation(s)`);
for (const o of acquisition) {
  console.log(`     ${o.organization} : ${o.error ? "ERREUR " + o.error : o.entries + " écriture(s) sur " + o.period_start + " → " + o.period_end}`);
}
console.log(`  Emails : ${JSON.stringify(corps.emails)}`);

// --- Contrôle de la ligne ----------------------------------------------------
const { rows: [apres] } = await client.query(
  `select email_sent_at, email_error from public.notifications where id = $1`,
  [notif.id]
);

const consigne = Boolean(apres.email_error) && apres.email_sent_at === null;
console.log(`  email_error : ${apres.email_error ?? "(vide)"}`);
console.log(`  ${consigne ? "OK   " : "FAIL "} l'échec d'envoi est consigné et la ligne sort de la file`);

// --- Nettoyage ---------------------------------------------------------------
await client.query(`delete from public.notifications where id = $1`, [notif.id]);
const { rows: [reste] } = await client.query(
  `select count(*)::int as n from public.notifications where id = $1`,
  [notif.id]
);
console.log(`  ${reste.n === 0 ? "OK   " : "FAIL "} ligne jetable supprimée (résidu : ${reste.n})`);

// Les notifications déjà en file avant le test n'ont pas été écrites par lui :
// on leur rend leur place, sinon elles ne seraient plus jamais expédiées.
const idsAvant = fileAvant.map((r) => r.id);
if (idsAvant.length) {
  await client.query(
    `update public.notifications set email_error = null
     where id = any($1::uuid[]) and email_sent_at is null`,
    [idsAvant]
  );
}
const { rows: [fileApres] } = await client.query(
  `select count(*)::int as n from public.notifications where email_sent_at is null and email_error is null`
);
console.log(`  ${fileApres.n === fileAvant.length ? "OK   " : "FAIL "} file d'attente restaurée : ${fileApres.n} notification(s) (avant le test : ${fileAvant.length})`);

await client.end();
process.exit(consigne && reste.n === 0 && fileApres.n === fileAvant.length ? 0 : 1);
