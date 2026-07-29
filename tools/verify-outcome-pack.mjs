// ==================================================================
// ===== OUTCOME PACK VERIFIER (tools/verify-outcome-pack.mjs) =======
// ==================================================================
// Reads the COMPILED criticals and fumbles compendiums back out and
// checks them against resources/outcomes.json — proving what Foundry
// will actually load. Read-only; Foundry must be closed.
//
// Also asserts the structural rule the design depends on: a page's
// severity comes from its own data, and its bucket journal is only
// where it happens to sit. They should agree in shipped content, but a
// mismatch is a warning, not a failure — a GM is free to reorganise.
// ==================================================================

import { extractPack } from '@foundryvtt/foundryvtt-cli';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEVERITY_LABELS } from '../scripts/data/outcome-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'outcomes.json');
const PAGE_TYPE = 'coffee-pub-bibliosoph.outcome';
const PACKS = [['crit', 'criticals'], ['fumble', 'fumbles']];

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const byKey = new Map(records.map((r) => [`${r.kind}::${r.title}`, r]));

const problems = [];
const notes = [];
const seen = new Set();
let pages = 0;
let withModifiers = 0;

for (const [kind, dir] of PACKS) {
    const pack = path.join(ROOT, 'packs', dir);
    if (!fs.existsSync(path.join(pack, 'CURRENT'))) {
        console.error(`No compiled pack at packs/${dir} — run npm run packs:build first.`);
        process.exit(1);
    }
    const tmp = path.join(os.tmpdir(), `bibliosoph-${dir}-verify-${process.pid}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    await extractPack(pack, tmp, { log: false });

    for (const file of fs.readdirSync(tmp).filter((f) => f.endsWith('.json'))) {
        const doc = JSON.parse(fs.readFileSync(path.join(tmp, file), 'utf8'));
        for (const page of doc.pages ?? []) {
            pages++;
            if (page.type !== PAGE_TYPE) { problems.push(`${doc.name}/${page.name}: type is "${page.type}"`); continue; }
            const system = page.system;
            if (!system?.kind) { problems.push(`${doc.name}/${page.name}: no system data`); continue; }
            if (system.kind !== kind) problems.push(`${doc.name}/${page.name}: is a ${system.kind} inside the ${kind} pack`);
            if (system.modifiers?.length) withModifiers++;

            const key = `${system.kind}::${page.name}`;
            seen.add(key);
            const source = byKey.get(key);
            if (!source) { problems.push(`${doc.name}/${page.name}: matches no source record`); continue; }
            for (const [field, value] of Object.entries(source)) {
                if (field === 'title') continue;
                if (JSON.stringify(system[field]) !== JSON.stringify(value)) {
                    problems.push(`${doc.name}/${page.name}: "${field}" is ${JSON.stringify(system[field])} in the pack, ${JSON.stringify(value)} in source`);
                }
            }
            // Journal placement is organisational; note drift, do not fail on it.
            const expected = SEVERITY_LABELS[kind]?.[system.severity];
            if (expected && doc.name !== expected) {
                notes.push(`${doc.name}/${page.name}: severity "${system.severity}" would normally live in "${expected}"`);
            }
        }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
}

for (const key of byKey.keys()) if (!seen.has(key)) problems.push(`source record "${key}" is missing from the compiled packs`);

console.log(`Compiled outcomes: ${pages} pages across 2 packs, ${withModifiers} carrying roll modifiers`);
console.log(`Source: ${records.length} records`);
if (notes.length) {
    console.log(`\n--- ${notes.length} placement note(s) ---`);
    for (const n of notes.slice(0, 10)) console.log(`  ! ${n}`);
}
if (problems.length) {
    console.log(`\n--- ${problems.length} problem(s) ---`);
    for (const p of problems.slice(0, 30)) console.log(`  x ${p}`);
    process.exit(1);
}
console.log('\nOK — the criticals and fumbles Foundry will load match resources/outcomes.json exactly.');
