// Makes a one-time link that creates a platform admin account in the developer console (/admin).
// It writes straight to the D1 database through wrangler, so only someone signed in to the
// Cloudflare account (`npx wrangler login`) can make one. The link works once, for 24 hours.
//
//   node scripts/admin-link.mjs           the live server (address from EXPO_PUBLIC_API_URL in the app's .env)
//   node scripts/admin-link.mjs --local   your `npm run dev` server
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOURS = 24;
const local = process.argv.includes('--local');
const serverDir = fileURLToPath(new URL('..', import.meta.url));

function wrangler(args) {
  const r = spawnSync('npx', ['wrangler', ...args], { cwd: serverDir, shell: true, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  return r.stdout;
}

function apiAddress() {
  if (local) return 'http://127.0.0.1:8787';
  if (process.env.API) return process.env.API.replace(/\/$/, '');
  const env = join(serverDir, '..', '.env');
  const line = existsSync(env) && readFileSync(env, 'utf8').split(/\r?\n/).find((l) => l.startsWith('EXPO_PUBLIC_API_URL='));
  if (!line) {
    console.error('Set API=https://your-worker.workers.dev, or EXPO_PUBLIC_API_URL in the app’s .env.');
    process.exit(1);
  }
  return line.slice('EXPO_PUBLIC_API_URL='.length).trim().replace(/\/$/, '');
}

const token = randomBytes(32).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const sql = `DELETE FROM admin_invites WHERE expires_at < ${now}; INSERT INTO admin_invites (token_hash, expires_at, created_at) VALUES ('${createHash('sha256').update(token).digest('hex')}', ${now + HOURS * 3600}, '${new Date().toISOString()}')`;

if (local) {
  wrangler(['d1', 'execute', 'gym-db', '--local', '--command', `"${sql}"`]);
} else {
  // wrangler.toml keeps a placeholder database id (the deploy workflow fills it in), so look the real one up.
  const db = JSON.parse(wrangler(['d1', 'list', '--json'])).find((d) => d.name === 'gym-db');
  if (!db) {
    console.error('No D1 database named gym-db on this Cloudflare account. Run `npx wrangler login` with the right account.');
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), 'gym-admin-link-'));
  const config = join(dir, 'wrangler.toml');
  writeFileSync(config, `name = "gym-api"\ncompatibility_date = "2026-01-01"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "gym-db"\ndatabase_id = "${db.uuid}"\n`);
  try {
    wrangler(['d1', 'execute', 'gym-db', '--remote', '--config', `"${config}"`, '--command', `"${sql}"`]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\nOpen this link within ${HOURS} hours to create an admin account. It works once:\n\n  ${apiAddress()}/admin#setup=${token}\n`);
