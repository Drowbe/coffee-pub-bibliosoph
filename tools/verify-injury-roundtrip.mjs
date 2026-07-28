// ==================================================================
// ===== ROUND-TRIP VERIFIER (tools/verify-injury-roundtrip.mjs) =====
// ==================================================================
// Proves that what the generator wrote is what the runtime will read:
// every generated page must be the typed injury subtype, carry each
// field in `system`, and match its source record exactly.
//
//   node tools/verify-injury-roundtrip.mjs
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const OUT_DIR = path.join(ROOT, 'packs', '_source', 'injuries');
const MODULE_ID = 'coffee-pub-bibliosoph';
const PAGE_TYPE = `${MODULE_ID}.injury`;

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const byKey = new Map(records.map((r) => [`${r.category}::${r.title}`, r]));

let checked = 0;
const seen = new Set();
const problems = [];

for (const file of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'));
    for (const page of doc.pages ?? []) {
        if (page.type !== PAGE_TYPE) {
            problems.push(`${doc.name}/${page.name}: page type is "${page.type}", expected "${PAGE_TYPE}"`);
            continue;
        }
        const system = page.system ?? {};
        const key = `${system.category}::${page.name}`;
        seen.add(key);
        const rec = byKey.get(key);
        if (!rec) { problems.push(`${doc.name}/${page.name}: matches no source record`); continue; }

        for (const [field, value] of Object.entries(rec)) {
            if (field === 'title') continue;                 // carried by page.name
            if (String(system[field]) !== String(value)) {
                problems.push(`${doc.name}/${page.name}: "${field}" is ${JSON.stringify(system[field])} in the page, ${JSON.stringify(value)} in source`);
            }
        }
        if (rec.treatmentdc === undefined && system.treatmentdc !== null) {
            problems.push(`${doc.name}/${page.name}: treatmentdc should be null when unauthored, got ${JSON.stringify(system.treatmentdc)}`);
        }
        if (page._key !== `!journal.pages!${doc._id}.${page._id}`) {
            problems.push(`${doc.name}/${page.name}: _key does not match ids`);
        }
        checked++;
    }
}

for (const key of byKey.keys()) {
    if (!seen.has(key)) problems.push(`source record "${key}" produced no page`);
}

console.log(`Round-tripped ${checked} typed pages against ${records.length} source records`);
if (problems.length) {
    console.log(`\n--- ${problems.length} problem(s) ---`);
    for (const p of problems.slice(0, 40)) console.log(`  x ${p}`);
    if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
    process.exit(1);
}
console.log('OK — every page is the typed injury subtype and matches its source record.');
