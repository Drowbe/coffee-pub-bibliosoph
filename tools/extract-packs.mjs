// Extracts every compendium pack's LevelDB (packs/<name>) into committed JSON
// sources (packs/_source/<name>/*.json). Run this after editing pack content in
// Foundry so the content lands in git — the LevelDB itself is gitignored.
// Close Foundry (or at least the world) first: LevelDB allows one process only.
//
// Usage: npm run packs:extract
import { extractPack } from '@foundryvtt/foundryvtt-cli';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(ROOT, 'packs');
const SOURCE = join(PACKS, '_source');

const packNames = readdirSync(PACKS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_source')
    .map((d) => d.name);

if (!packNames.length) {
    console.log('No pack directories found under packs/.');
    process.exit(0);
}

for (const name of packNames) {
    const src = join(PACKS, name);
    const dest = join(SOURCE, name);
    if (!existsSync(join(src, 'CURRENT'))) {
        console.log(`${name}: no LevelDB data yet — skipped`);
        continue;
    }
    // Rebuild the source dir from scratch so documents deleted in Foundry
    // don't linger as stale JSON.
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    await extractPack(src, dest, { log: false });
    const count = readdirSync(dest).filter((f) => f.endsWith('.json')).length;
    console.log(`${name}: extracted ${count} documents -> packs/_source/${name}/`);
}
