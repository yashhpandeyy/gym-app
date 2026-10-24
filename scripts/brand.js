#!/usr/bin/env node
/**
 * Switch the active gym brand.
 *
 *   npm run brand                 # list presets
 *   npm run brand -- ironclad     # make brands/ironclad.json the active brand
 *
 * Then run `npm run icons` and restart Expo with `npx expo start --clear`.
 * To onboard a new gym, copy a preset in /brands, edit it, and switch to it.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'brands');
const target = path.join(root, 'src', 'config', 'brand.json');
const presets = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const name = process.argv[2];

if (!name) {
  const active = JSON.parse(fs.readFileSync(target, 'utf8')).id;
  console.log('Brand presets:');
  for (const p of presets) console.log(`  ${p === active ? '*' : ' '} ${p}`);
  console.log('\nUsage: npm run brand -- <preset>');
  process.exit(0);
}

if (!presets.includes(name)) {
  console.error(`No preset called "${name}". Available: ${presets.join(', ')}`);
  process.exit(1);
}

const brand = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
const required = ['id', 'name', 'shortName', 'monogram', 'slug', 'colors', 'contact', 'address', 'hours', 'features'];
const missing = required.filter((k) => !(k in brand));
if (missing.length) {
  console.error(`brands/${name}.json is missing: ${missing.join(', ')}`);
  process.exit(1);
}

fs.writeFileSync(target, `${JSON.stringify(brand, null, 2)}\n`);
console.log(`Active brand is now ${brand.name} (${brand.colors.primary}).`);
console.log('Next: npm run icons, then npx expo start --clear');
