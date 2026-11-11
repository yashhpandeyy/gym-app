// Publishes an over-the-air update: new JavaScript, screens and images reach every installed app
// with the same `version` (app.json) without a new install.
//
//   npm run update -- "Fix the booking screen"             store builds (production channel)
//   npm run update -- "Try the new home" --preview         test APKs only (preview channel)
//   npm run update -- "Fix check-in crash" --urgent        phones restart into it as soon as it downloads
//
// Changes that touch native code (a new library with native code, a permission, the icon or splash)
// can't go out this way: bump `version` in app.json and make a new build instead.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
// GitHub Actions passes the message and the urgent flag as variables (see .github/workflows/update-app.yml).
const urgent = args.includes('--urgent') || process.env.URGENT_UPDATE === '1';
const message = (args.filter((a) => !a.startsWith('--')).join(' ') || process.env.UPDATE_MESSAGE || '').split('\n')[0].trim();
if (!message) {
  console.error('Say what changed, for example: npm run update -- "Fix the booking screen"');
  process.exit(1);
}

const profile = preview ? 'preview' : 'production';
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
const apiUrl = eas.build?.[profile]?.env?.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  console.error(`eas.json has no EXPO_PUBLIC_API_URL for the ${profile} profile.`);
  process.exit(1);
}
if (existsSync('.env.local')) console.log('Ignoring .env.local: updates always use the live server from eas.json.');

// Windows needs a shell to find npx; elsewhere the message goes straight to the process, so nothing in it is run.
const windows = process.platform === 'win32';
const run = (cmd, cmdArgs, env = {}) => spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: windows, env: { ...process.env, ...env } }).status ?? 1;

// A broken update would reach every phone, so it has to typecheck first.
if (run('npx', ['tsc', '--noEmit']) !== 0) {
  console.error('Typecheck failed. Nothing was published.');
  process.exit(1);
}

const quoted = windows ? `"${message.replace(/["%^&|<>]/g, '')}"` : message;
console.log(`Publishing to the ${profile} channel${urgent ? ' as urgent' : ''}: ${message}`);
const status = run('npx', ['eas-cli@latest', 'update', '--channel', profile, '--environment', profile, '--message', quoted, '--non-interactive'], {
  // Process variables win over .env files, so the update can't pick up a local server address.
  EXPO_PUBLIC_API_URL: apiUrl,
  URGENT_UPDATE: urgent ? '1' : '0',
});
process.exit(status);
