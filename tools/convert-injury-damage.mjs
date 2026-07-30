// ==================================================================
// ===== INJURY DAMAGE CONVERSION (tools/convert-injury-damage.mjs) ==
// ==================================================================
// One-shot migration: flat HP damage -> percentage of max HP.
//
// Flat damage could not be right at both ends of the level range. An
// average major injury was 10.5 HP: lethal to a level-1 wizard with 8 max
// HP, and 7% of a level-15 fighter. A percentage is the same wound at
// every level.
//
// The mapping preserves each injury's RELATIVE position inside its
// severity band, so the balance pass that produced the flat numbers is
// not thrown away — a 12 stays the hardest major, a 9 stays the softest.
//
//   node tools/convert-injury-damage.mjs --from-flat           report
//   node tools/convert-injury-damage.mjs --from-flat --write   apply
//
// RUN THIS EXACTLY ONCE. It CANNOT detect its own output: a converted
// minor injury reads 3%, which is indistinguishable from the 3 HP it used
// to be, so a second run would quietly inflate every value again. The
// explicit --from-flat flag exists so that can't happen by reflex, and a
// stamp file refuses a repeat. Both are belt and braces around the real
// safety net, which is that resources/injuries.json is in git.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAMAGE_BANDS } from './injury-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const STAMP = path.join(ROOT, 'tools', '.injury-damage-converted');
const WRITE = process.argv.includes('--write');
const FROM_FLAT = process.argv.includes('--from-flat');
const FORCE = process.argv.includes('--force');

if (!FROM_FLAT) {
    console.error('Refusing to run without --from-flat.');
    console.error('This is a ONE-SHOT migration from flat HP to percent of max HP, and it');
    console.error('cannot recognise its own output. Running it twice inflates every value.');
    process.exit(1);
}
if (fs.existsSync(STAMP) && !FORCE) {
    console.error(`Already converted (${STAMP} exists). Pass --force only if you have`);
    console.error('reverted resources/injuries.json to its flat-HP state first.');
    process.exit(1);
}

/** The flat bands this migration is coming FROM. */
const FLAT_BANDS = {
    minor: [1, 4],
    moderate: [5, 8],
    major: [9, 12]
};

/**
 * Where each flat band lands. NOT simply DAMAGE_BANDS: minor validates
 * as 0-5%, but 0 has to stay reserved for an injury authored to do no
 * damage at all. Mapping the softest minor onto 0 would silently turn
 * "loses a little blood" into "loses nothing".
 */
const TARGET_BANDS = {
    minor: [2, 5],
    moderate: [6, 10],
    major: [11, 18]
};

/** Map a flat value onto the percentage band, keeping its relative position. */
function toPercent(flat, severity) {
    if (flat === 0) return 0;               // authored "no damage" stays that way
    const from = FLAT_BANDS[severity];
    const to = TARGET_BANDS[severity];
    if (!from || !to) return flat;
    const [flo, fhi] = from;
    const [tlo, thi] = to;
    if (fhi === flo) return tlo;
    const clamped = Math.min(Math.max(flat, flo), fhi);
    const ratio = (clamped - flo) / (fhi - flo);
    return Math.round(tlo + ratio * (thi - tlo));
}

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const records = Array.isArray(raw) ? raw : (raw.injuries ?? []);

let moved = 0;         // the number itself changed
let sameNumber = 0;    // mapped onto its own value (2 HP -> 2%)
let alreadyDone = 0;   // a prior run already converted this one
const sample = [];

for (const rec of records) {
    const severity = String(rec.severity ?? '');
    const from = FLAT_BANDS[severity];
    const target = TARGET_BANDS[severity];
    const flat = Number(rec.damage) || 0;
    if (!from || !target) continue;

    // Above the old flat ceiling can only be a value this migration
    // already produced. Not a general safety net — see the header — but
    // it catches the obvious half-converted file.
    if (flat > from[1]) { alreadyDone++; continue; }

    const pct = toPercent(flat, severity);
    if (pct === flat) { sameNumber++; continue; }
    if (sample.length < 10) sample.push(`${rec.title}: ${severity} ${flat} HP -> ${pct}%`);
    rec.damage = pct;
    moved++;
}

console.log(`Injury damage -> percent of max HP`);
console.log(`  renumbered: ${moved}   same number, new meaning: ${sameNumber}   already converted: ${alreadyDone}   total: ${records.length}`);
for (const line of sample) console.log(`    ${line}`);

// What the new numbers actually mean at the table.
const EXAMPLES = [['level 1 wizard', 8], ['level 5 rogue', 38], ['level 15 fighter', 140]];
console.log(`\n  Resulting damage by severity (before the "never below 1 HP" floor):`);
for (const sev of ['minor', 'moderate', 'major']) {
    const [lo, hi] = DAMAGE_BANDS[sev];
    const cols = EXAMPLES.map(([label, max]) =>
        `${label}: ${Math.round(max * lo / 100)}-${Math.round(max * hi / 100)} HP`).join('   ');
    console.log(`    ${sev.padEnd(9)} ${String(lo).padStart(2)}-${String(hi).padStart(2)}%   ${cols}`);
}

if (WRITE) {
    fs.writeFileSync(SOURCE, `${JSON.stringify(raw, null, 4)}\n`, 'utf8');
    fs.writeFileSync(STAMP, `converted ${moved} records from flat HP to percent of max HP\n`, 'utf8');
    console.log(`\n  WROTE ${SOURCE}`);
    console.log(`  STAMPED ${STAMP} — reruns will refuse`);
} else {
    console.log(`\n  (dry run — pass --write to apply)`);
}
