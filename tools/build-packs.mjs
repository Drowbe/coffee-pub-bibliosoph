// Compiles committed JSON sources (packs/_source/<name>/*.json) into LevelDB
// compendium packs (packs/<name>). The release workflow runs this before
// zipping; the LevelDB output is gitignored.
//
// CAUTION when running locally: this overwrites packs/<name> from _source.
// If you changed pack content in Foundry, run packs:extract FIRST or those
// changes are lost. Close Foundry before running.
//
// Usage: npm run packs:build
import { compilePack } from '@foundryvtt/foundryvtt-cli';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(ROOT, 'packs');
const SOURCE = join(PACKS, '_source');

if (!existsSync(SOURCE)) {
    console.error('packs/_source/ not found — nothing to build.');
    process.exit(1);
}

const packNames = readdirSync(SOURCE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

for (const name of packNames) {
    const src = join(SOURCE, name);
    const dest = join(PACKS, name);
    const count = readdirSync(src).filter((f) => f.endsWith('.json')).length;
    // Build from scratch so removed source documents don't survive in the db.
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    if (!count) {
        console.log(`${name}: no source documents — built empty pack`);
        continue;
    }
    await compilePack(src, dest, { log: false });
    console.log(`${name}: compiled ${count} documents -> packs/${name}/`);
}
