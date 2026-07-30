// ==================================================================
// ===== INJURY FLAVOUR (tools/restore-injury-flavor.mjs) ============
// ==================================================================
// The 2026-07-28 migration tightened `statuseffect` to a strict enum of
// real dnd5e condition ids. Six injuries had carried flavour text there
// instead — "Confused", "Disoriented", "Clumsy Fingers" — and were
// flattened to "none", losing colour the prose only half carries.
//
// The `flavor` field gives that text a home where it cannot be mistaken
// for a mechanical condition. Values below are the ORIGINALS, recovered
// from resources/injuries.json as it stood at d712175^ — not reinvented.
//
//   node tools/restore-injury-flavor.mjs           report only
//   node tools/restore-injury-flavor.mjs --write   apply
//
// Idempotent: an injury that already has flavour is left alone.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const WRITE = process.argv.includes('--write');

/** title -> the flavour string it used to carry in `statuseffect`. */
const RECOVERED = {
    'Frostbitten Fingertips': 'Clumsy Fingers',
    'Brain Fizzle': 'Confused',
    'Cerebral Backfire': 'Disoriented',
    "Mindbender's Migraine": 'Confused',
    'Mindquake Madness': 'Confused',
    'Psionic Feedback': 'Disoriented'
};

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const records = Array.isArray(raw) ? raw : (raw.injuries ?? []);

let restored = 0;
let skipped = 0;
const missing = [];

for (const [title, flavor] of Object.entries(RECOVERED)) {
    const rec = records.find((r) => r.title === title);
    if (!rec) { missing.push(title); continue; }
    if (rec.flavor) { skipped++; continue; }
    // A real condition always wins on the card, so flavour on top of one
    // would be dead text. None of these six have one, but say so loudly
    // if that ever changes.
    if (rec.statuseffect && rec.statuseffect !== 'none') {
        console.log(`  SKIP ${title}: now carries the real condition "${rec.statuseffect}"`);
        skipped++;
        continue;
    }
    rec.flavor = flavor;
    restored++;
    console.log(`  ${title.padEnd(30)} flavor = "${flavor}"`);
}

console.log(`\nFlavour restored: ${restored}   already set: ${skipped}${missing.length ? `   MISSING: ${missing.join(', ')}` : ''}`);

if (WRITE) {
    fs.writeFileSync(SOURCE, `${JSON.stringify(raw, null, 4)}\n`, 'utf8');
    console.log(`  WROTE ${SOURCE}`);
} else {
    console.log('  (dry run — pass --write to apply)');
}
