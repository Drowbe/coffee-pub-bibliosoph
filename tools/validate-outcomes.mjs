// ==================================================================
// ===== OUTCOME VALIDATOR (tools/validate-outcomes.mjs) =============
// ==================================================================
// Gate for resources/outcomes.json — criticals and fumbles.
// Mirrors tools/validate-injuries.mjs.
//
//   node tools/validate-outcomes.mjs [--quiet]
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    KINDS, SEVERITIES, TARGETS, CONDITIONS, MAJOR_ONLY_CONDITIONS, MODERATE_PLUS_CONDITIONS,
    MODIFIER_STATS, DAMAGE_BANDS, DURATION_BANDS, ODDS_BANDS,
    REQUIRED_FIELDS, OPTIONAL_FIELDS, secondsToRounds
} from '../scripts/data/outcome-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'outcomes.json');
const QUIET = process.argv.includes('--quiet');

const FOUNDRY_PUBLIC_CANDIDATES = [
    process.env.FOUNDRY_PUBLIC,
    'C:/Program Files/Foundry Virtual Tabletop/resources/app/public',
    'C:/Program Files/FoundryVTT/resources/app/public',
    '/Applications/FoundryVTT.app/Contents/Resources/app/public'
].filter(Boolean);

const iconRoot = FOUNDRY_PUBLIC_CANDIDATES.find((p) => {
    try { return fs.existsSync(path.join(p, 'icons')); } catch { return false; }
});

const errors = [];
const warnings = [];
const err = (rec, i, msg) => errors.push(`[${i}] ${rec?.title ?? '(untitled)'}: ${msg}`);
const warn = (rec, i, msg) => warnings.push(`[${i}] ${rec?.title ?? '(untitled)'}: ${msg}`);
const isInt = (v) => Number.isInteger(v);

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const known = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
const titlesByKind = new Map();

records.forEach((rec, i) => {
    for (const field of REQUIRED_FIELDS) {
        const v = rec?.[field];
        if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
            err(rec, i, `missing required field "${field}"`);
        }
    }
    for (const field of Object.keys(rec ?? {})) {
        if (!known.has(field)) err(rec, i, `unknown field "${field}"`);
    }

    const kind = String(rec?.kind ?? '');
    if (!KINDS.includes(kind)) err(rec, i, `kind "${kind}" must be crit or fumble`);
    const severity = String(rec?.severity ?? '');
    if (!SEVERITIES.includes(severity)) err(rec, i, `severity "${severity}" must be minor, moderate, or major`);
    if (!TARGETS.includes(String(rec?.appliesto ?? ''))) err(rec, i, `appliesto "${rec?.appliesto}" must be target or self`);

    for (const field of ['damage', 'duration', 'odds']) {
        if (!isInt(rec?.[field])) err(rec, i, `${field} must be an integer, got ${JSON.stringify(rec?.[field])}`);
    }
    // Only an EXCESS of damage is an error. Unlike an injury, an outcome's
    // severity measures total impact, not hit points — a major fumble that
    // snaps your weapon for an hour is legitimately major at 2 damage.
    if (isInt(rec?.damage) && DAMAGE_BANDS[severity]) {
        const [lo, hi] = DAMAGE_BANDS[severity];
        if (rec.damage > hi) err(rec, i, `damage ${rec.damage} exceeds the ${severity} ceiling of ${hi}`);
        // Only worth flagging in the top bucket: plenty of good outcomes
        // are pure narrative ("your target attacks itself"), and that is
        // not a defect — it is a GM ruling the text already describes.
        else if (severity === 'major' && rec.damage < lo && !(rec.modifiers?.length) && rec.statuseffect === 'none') {
            warn(rec, i, `no damage, condition, or modifier in the top bucket — is it really ${severity}?`);
        }
    }
    if (isInt(rec?.duration) && rec.duration % 6 !== 0) {
        warn(rec, i, `duration ${rec.duration}s is not a whole number of 6-second rounds`);
    }
    if (isInt(rec?.odds) && (rec.odds < 1 || rec.odds > 100)) err(rec, i, `odds ${rec.odds} must be 1-100`);

    const status = String(rec?.statuseffect ?? '');
    if (!CONDITIONS.includes(status)) {
        err(rec, i, `statuseffect "${status}" is not a legal condition id`);
    } else if (MAJOR_ONLY_CONDITIONS.includes(status) && severity !== 'major') {
        // A WARNING here, not an error as it is for injuries. A crit table
        // that knocks someone out in its middle tier is a legitimate design
        // choice — losing a turn to a spectacular hit is the genre. The
        // injury rule exists because a papercut should not paralyse you.
        warn(rec, i, `condition "${status}" takes a whole turn away in the ${severity} bucket — intended?`);
    } else if (MODERATE_PLUS_CONDITIONS.includes(status) && severity === 'minor') {
        warn(rec, i, `condition "${status}" is heavy for the ${severity} bucket`);
    }

    for (const mod of rec?.modifiers ?? []) {
        if (!MODIFIER_STATS[mod?.stat]) err(rec, i, `modifier stat "${mod?.stat}" is not one of ${Object.keys(MODIFIER_STATS).join(', ')}`);
        if (!isInt(mod?.value) || mod.value === 0) err(rec, i, `modifier value must be a non-zero integer, got ${JSON.stringify(mod?.value)}`);
        if (mod?.rounds !== undefined && (!isInt(mod.rounds) || mod.rounds < 0)) err(rec, i, `modifier rounds must be a non-negative integer`);
        // A modifier with nowhere to live never applies
        if (isInt(rec?.duration) && rec.duration === 0) {
            err(rec, i, `has modifiers but duration is 0 (instant) — the modifier would never apply`);
        }
    }
    if (rec?.statuseffect && rec.statuseffect !== 'none' && rec.duration === 0) {
        err(rec, i, `conveys "${rec.statuseffect}" but duration is 0 (instant) — the condition would linger forever`);
    }

    const image = String(rec?.image ?? '');
    if (image && iconRoot && image.startsWith('icons/') && !fs.existsSync(path.join(iconRoot, image))) {
        err(rec, i, `image not found in Foundry's icon library: ${image}`);
    }

    const title = String(rec?.title ?? '');
    if (title.length >= 25) warn(rec, i, `title is ${title.length} characters (aim for under 25)`);
    const key = `${kind}::${title.toLowerCase()}`;
    if (titlesByKind.has(key)) err(rec, i, `duplicate title "${title}" within ${kind}`);
    else titlesByKind.set(key, i);

    if (isInt(rec?.odds) && ODDS_BANDS[severity]) {
        const [lo, hi] = ODDS_BANDS[severity];
        if (rec.odds < lo || rec.odds > hi) warn(rec, i, `odds ${rec.odds} is outside the ${severity} guidance ${lo}-${hi}`);
    }
    if (isInt(rec?.duration) && rec.duration > 0 && DURATION_BANDS[severity]) {
        const [, hi] = DURATION_BANDS[severity];
        if (rec.duration > hi) warn(rec, i, `duration ${secondsToRounds(rec.duration)} rounds is long for a ${severity} outcome`);
    }
});

for (const kind of KINDS) {
    const count = records.filter((r) => r?.kind === kind).length;
    if (count === 0) errors.push(`kind "${kind}" has no entries — rolling it would fail`);
    else if (count < 8) warnings.push(`kind "${kind}" has only ${count} entries (thin — repeats quickly)`);
}

console.log(`Validating ${records.length} outcomes from resources/outcomes.json`);
console.log(iconRoot ? `Icon check against: ${iconRoot}` : 'Icon existence check SKIPPED (set FOUNDRY_PUBLIC)');

if (!QUIET && warnings.length) {
    console.log(`\n--- ${warnings.length} warning(s) ---`);
    for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
    console.log(`\n--- ${errors.length} ERROR(s) ---`);
    for (const e of errors) console.log(`  x ${e}`);
    console.log('\nFAILED');
    process.exit(1);
}
console.log(`\nOK — no errors${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
