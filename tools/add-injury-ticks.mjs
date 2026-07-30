// ==================================================================
// ===== INJURY TICKS (tools/add-injury-ticks.mjs) ===================
// ==================================================================
// Recurring damage for the injuries whose own prose says the wound is
// still open — bleeding, burning, poison working through you.
//
//   node tools/add-injury-ticks.mjs           report only
//   node tools/add-injury-ticks.mjs --write   apply
//
// Idempotent: an injury that already has a tick is never touched.
//
// DELIBERATELY NARROW. Recurring damage is the strongest thing in the
// schema — it compounds every turn, and it is the one field that can turn
// a flavour injury into a death sentence. Only wounds that explicitly
// keep losing blood, keep burning, or carry a working poison get one.
// "It hurts" is not a tick; it is a modifier, and it already has one.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TICK_BANDS } from './injury-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const WRITE = process.argv.includes('--write');

/**
 * Only these. Each is an ongoing physical process, not a lasting
 * consequence — the difference between "you are still bleeding" and
 * "your arm is broken".
 */
const RULES = [
    {
        why: 'still bleeding',
        test: /\b(won'?t stop bleeding|keeps? bleeding|still bleeding|bleeding (out|freely|profusely)|h(a)?emorrhag|trail of (blood|crimson|drips)|blood (spills|pours|streams))/i
    },
    {
        why: 'still burning',
        test: /\b(still burning|keeps? burning|continues? to burn|smoulder|smolder|embers|flames? (lick|cling)|searing away)/i
    },
    {
        why: 'poison at work',
        test: /\b(venom (courses|spreads|works)|poison (courses|spreads|works)|toxin (courses|spreads)|spreading (through|poison|venom)|coursing through your veins)/i
    },
    {
        why: 'acid still eating',
        test: /\b(acid (continues|keeps|still)|eating (away|through)|dissolv|corrod)/i
    },
    {
        why: 'necrosis spreading',
        test: /\b(rot(ting)?|necrosis|withering|decay(ing)?|spreading blackness|flesh (dies|dying))/i
    }
];

/** Tick size by severity — the low end of each band, never the cap. */
const SIZE = { minor: 1, moderate: 2, major: 3 };

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const records = Array.isArray(raw) ? raw : (raw.injuries ?? []);

let added = 0;
let kept = 0;
const byRule = {};
const rows = [];

for (const rec of records) {
    if (Number(rec.tick) > 0) { kept++; continue; }

    const text = `${rec.title ?? ''} ${rec.description ?? ''} ${rec.treatment ?? ''}`;
    const rule = RULES.find((r) => r.test.test(text));
    if (!rule) continue;

    const severity = String(rec.severity ?? 'minor');
    const cap = TICK_BANDS[severity]?.[1] ?? 2;
    const tick = Math.min(SIZE[severity] ?? 1, cap);

    rec.tick = tick;
    // A wound that keeps bleeding does not quietly stop being a wound when
    // the timer ends — it stops bleeding and still wants treating.
    if (rec.duration > 0) rec.expiry = 'linger';

    added++;
    byRule[rule.why] = (byRule[rule.why] ?? 0) + 1;
    rows.push(`${severity.padEnd(9)} ${String(rec.title).padEnd(30)} ${rule.why.padEnd(20)} ${tick}%/turn${rec.expiry === 'linger' ? ' · lingers' : ''}`);
}

console.log('Injury recurring damage');
console.log(`  authored: ${added}   already had one: ${kept}   untouched: ${records.length - added - kept}   total: ${records.length}`);
if (Object.keys(byRule).length) {
    console.log('\n  by rule:');
    for (const [why, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(n).padStart(3)}  ${why}`);
    }
}
console.log('\n  ' + rows.join('\n  '));

if (WRITE) {
    fs.writeFileSync(SOURCE, `${JSON.stringify(raw, null, 4)}\n`, 'utf8');
    console.log(`\n  WROTE ${SOURCE}`);
} else {
    console.log('\n  (dry run — pass --write to apply)');
}
