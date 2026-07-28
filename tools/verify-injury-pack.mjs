// ==================================================================
// ===== PACK VERIFIER (tools/verify-injury-pack.mjs) ================
// ==================================================================
// Reads the COMPILED compendium back out to a temp directory and checks
// it against resources/injuries.json — proving what Foundry will
// actually load, not merely what we wrote to packs/_source.
//
//   node tools/verify-injury-pack.mjs
//
// Read-only: extracts to the OS temp dir, never touches packs/_source.
// Foundry must be closed (LevelDB allows a single process).
// ==================================================================

import { extractPack } from '@foundryvtt/foundryvtt-cli';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'packs', 'injuries');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const MODULE_ID = 'coffee-pub-bibliosoph';
const TMP = path.join(os.tmpdir(), `bibliosoph-pack-verify-${process.pid}`);

if (!fs.existsSync(path.join(PACK, 'CURRENT'))) {
    console.error('No compiled pack found at packs/injuries — run npm run packs:build first.');
    process.exit(1);
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
await extractPack(PACK, TMP, { log: false });

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const byKey = new Map(records.map((r) => [`${r.category}::${r.title}`, r]));

const files = fs.readdirSync(TMP).filter((f) => f.endsWith('.json'));
const problems = [];
const seen = new Set();
let pages = 0;
let flagged = 0;

for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(TMP, file), 'utf8'));
    for (const page of doc.pages ?? []) {
        pages++;
        const rec = page.flags?.[MODULE_ID]?.injury;
        if (!rec) { problems.push(`${doc.name}/${page.name}: no injury flag in the compiled pack`); continue; }
        flagged++;

        const key = `${rec.category}::${rec.title}`;
        seen.add(key);
        const source = byKey.get(key);
        if (!source) { problems.push(`${doc.name}/${page.name}: flag matches no source record`); continue; }
        for (const [field, value] of Object.entries(source)) {
            if (String(rec[field]) !== String(value)) {
                problems.push(`${doc.name}/${page.name}: "${field}" is "${rec[field]}" in the pack, "${value}" in source`);
            }
        }
        if (page.name !== source.title) problems.push(`${doc.name}: page named "${page.name}" but record says "${source.title}"`);
        if (!String(page.text?.content ?? '').includes('<h2>Metadata</h2>')) {
            problems.push(`${doc.name}/${page.name}: metadata block missing from the compiled page`);
        }
    }
}

for (const key of byKey.keys()) {
    if (!seen.has(key)) problems.push(`source record "${key}" is missing from the compiled pack`);
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log(`Compiled pack: ${files.length} journals, ${pages} pages, ${flagged} carrying the injury flag`);
console.log(`Source: ${records.length} records`);

if (problems.length) {
    console.log(`\n--- ${problems.length} problem(s) ---`);
    for (const p of problems.slice(0, 30)) console.log(`  x ${p}`);
    if (problems.length > 30) console.log(`  ... and ${problems.length - 30} more`);
    process.exit(1);
}
console.log('\nOK — the compendium Foundry will load matches resources/injuries.json exactly.');
