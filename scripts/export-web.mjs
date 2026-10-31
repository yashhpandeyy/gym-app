// Builds the owner dashboard into dist/ ready for Cloudflare Pages.
//
// Expo writes fonts and icon fonts to dist/assets/node_modules/..., and Cloudflare's uploader skips every
// folder named node_modules. The site then answers those font URLs with the home page, so text falls back
// to a serif face and every icon shows as an empty box. Renaming the folder (and the URLs that point at it)
// before upload fixes both.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const from = '/assets/node_modules/';
const to = '/assets/vendor/';

rmSync(dist, { recursive: true, force: true });
const run = spawnSync('npx', ['expo', 'export', '--platform', 'web'], { stdio: 'inherit', shell: true });
if (run.status !== 0) process.exit(run.status ?? 1);

if (!existsSync(join(dist, 'assets', 'node_modules'))) {
  console.log('No assets/node_modules folder in the export, nothing to rename.');
  process.exit(0);
}
renameSync(join(dist, 'assets', 'node_modules'), join(dist, 'assets', 'vendor'));

let files = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|css|map)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      if (text.includes(from)) {
        writeFileSync(p, text.split(from).join(to));
        files++;
      }
    }
  }
};
walk(dist);

// Anything left over would 404 on the live site.
let leftover = 0;
const scan = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (/\.(js|html|json|css)$/.test(name) && readFileSync(p, 'utf8').includes('node_modules/')) leftover++;
  }
};
scan(dist);
console.log(`Renamed assets/node_modules to assets/vendor and updated ${files} files.${leftover ? ` ${leftover} files still mention node_modules.` : ''}`);
