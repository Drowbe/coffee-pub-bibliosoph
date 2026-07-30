// ==================================================================
// ===== INJURY VALIDATOR (tools/validate-injuries.mjs) ==============
// ==================================================================
// Gate for resources/injuries.json — the authoring source of truth.
// Enforces documentation/spec-injury-schema.md Part 6.
//
//   node tools/validate-injuries.mjs            validate
//   node tools/validate-injuries.mjs --quiet    errors only, no warnings
//
// Exits 1 on any error so it can gate the pack build.
//
// Icon existence is checked against Foundry's core icon directory when it
// can be found (override with FOUNDRY_PUBLIC=<path to .../app/public>);
// otherwise that one check is skipped with a notice.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CATEGORIES, SEVERITIES, CONDITIONS, MAJOR_ONLY_CONDITIONS, MODERATE_PLUS_CONDITIONS,
    DAMAGE_BANDS, DURATION_BANDS, ODDS_BANDS,
    MODIFIER_LIMITS, MODIFIER_STAT_KEYS,
    REQUIRED_FIELDS, OPTIONAL_FIELDS
} from './injury-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
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

function validate(records) {
    if (!Array.isArray(records)) {
        errors.push('Root of injuries.json must be an array of injury records.');
        return;
    }

    const titlesByCategory = new Map();
    const known = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

    records.forEach((rec, i) => {
        // Shape
        for (const field of REQUIRED_FIELDS) {
            const v = rec?.[field];
            if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
                err(rec, i, `missing required field "${field}"`);
            }
        }
        for (const field of Object.keys(rec ?? {})) {
            if (!known.has(field)) err(rec, i, `unknown field "${field}" (dropped fields: journaltype, foldername, action)`);
        }

        // Category / severity
        const category = String(rec?.category ?? '');
        if (!CATEGORIES.includes(category)) {
            err(rec, i, `category "${category}" is not one of the canonical 14 (lowercase)`);
        }
        const severity = String(rec?.severity ?? '');
        if (!SEVERITIES.includes(severity)) {
            err(rec, i, `severity "${severity}" must be minor, moderate, or major (lowercase)`);
        }

        // Numerics
        for (const field of ['damage', 'duration', 'odds']) {
            if (!isInt(rec?.[field])) err(rec, i, `${field} must be an integer, got ${JSON.stringify(rec?.[field])}`);
        }
        // Damage is a PERCENTAGE of max HP, not flat hit points.
        if (isInt(rec?.damage) && (rec.damage < 0 || rec.damage > 100)) {
            err(rec, i, `damage ${rec.damage} must be a percentage of max HP (0-100)`);
        }
        if (isInt(rec?.damage) && DAMAGE_BANDS[severity]) {
            const [lo, hi] = DAMAGE_BANDS[severity];
            if (rec.damage < lo || rec.damage > hi) {
                err(rec, i, `damage ${rec.damage}% is outside the ${severity} band ${lo}-${hi}%`);
            }
        }
        if (isInt(rec?.duration) && rec.duration < 0) err(rec, i, 'duration cannot be negative (0 = permanent)');
        if (isInt(rec?.odds) && (rec.odds < 1 || rec.odds > 100)) err(rec, i, `odds ${rec.odds} must be 1-100`);
        if (rec?.treatmentdc !== undefined && (!isInt(rec.treatmentdc) || rec.treatmentdc <= 0)) {
            err(rec, i, `treatmentdc must be a positive integer when present, got ${JSON.stringify(rec.treatmentdc)}`);
        }

        // Condition
        const status = String(rec?.statuseffect ?? '');
        if (!CONDITIONS.includes(status)) {
            err(rec, i, `statuseffect "${status}" is not a legal condition id (lowercase, or "none")`);
        } else if (MAJOR_ONLY_CONDITIONS.includes(status) && severity !== 'major') {
            err(rec, i, `condition "${status}" takes the whole turn away and is reserved for major injuries (this one is ${severity})`);
        } else if (MODERATE_PLUS_CONDITIONS.includes(status) && severity === 'minor') {
            warn(rec, i, `condition "${status}" is heavy for a minor injury`);
        }

        // Roll modifiers — optional, but if present they have to be real.
        if (rec?.modifiers !== undefined) {
            if (!Array.isArray(rec.modifiers)) {
                err(rec, i, 'modifiers must be an array when present');
            } else {
                if (rec.modifiers.length > MODIFIER_LIMITS.maxCount) {
                    warn(rec, i, `${rec.modifiers.length} modifiers is a lot to track at the table (${MODIFIER_LIMITS.maxCount} is the practical ceiling)`);
                }
                const cap = MODIFIER_LIMITS.bySeverity[severity];
                for (const mod of rec.modifiers) {
                    if (!MODIFIER_STAT_KEYS.includes(String(mod?.stat))) {
                        err(rec, i, `modifier stat "${mod?.stat}" is not one of: ${MODIFIER_STAT_KEYS.join(', ')}`);
                    }
                    if (!isInt(mod?.value) || mod.value === 0) {
                        err(rec, i, `modifier value must be a non-zero integer, got ${JSON.stringify(mod?.value)}`);
                    } else if (mod.value < MODIFIER_LIMITS.minValue || mod.value > MODIFIER_LIMITS.maxValue) {
                        err(rec, i, `modifier value ${mod.value} is outside ${MODIFIER_LIMITS.minValue}..${MODIFIER_LIMITS.maxValue}`);
                    } else if (cap && Math.abs(mod.value) > cap) {
                        warn(rec, i, `${mod.value} to ${mod.stat} is heavy for a ${severity} injury (cap ±${cap})`);
                    }
                    if (mod?.rounds !== undefined && (!isInt(mod.rounds) || mod.rounds < 0)) {
                        err(rec, i, `modifier rounds must be a non-negative integer, got ${JSON.stringify(mod?.rounds)}`);
                    }
                }
            }
        }

        // Flavour status text, for injuries whose "condition" is not a real one.
        if (rec?.flavor !== undefined) {
            if (typeof rec.flavor !== 'string') {
                err(rec, i, 'flavor must be a string when present');
            } else if (rec.flavor && status !== 'none') {
                warn(rec, i, `flavor "${rec.flavor}" is ignored because statuseffect is "${status}"`);
            }
        }

        // Art
        const image = String(rec?.image ?? '');
        if (image && iconRoot && image.startsWith('icons/')) {
            if (!fs.existsSync(path.join(iconRoot, image))) {
                err(rec, i, `image not found in Foundry's icon library: ${image}`);
            }
        }
        const captionWords = String(rec?.imagetitle ?? '').trim().split(/\s+/).filter(Boolean);
        if (captionWords.length > 5) warn(rec, i, `imagetitle is ${captionWords.length} words (aim for under 5)`);

        // Title
        const title = String(rec?.title ?? '');
        if (title.length >= 25) warn(rec, i, `title is ${title.length} characters (aim for under 25)`);
        const key = `${category}::${title.toLowerCase()}`;
        if (titlesByCategory.has(key)) {
            err(rec, i, `duplicate title "${title}" within category ${category} (also record ${titlesByCategory.get(key)})`);
        } else {
            titlesByCategory.set(key, i);
        }

        // Guidance warnings
        if (isInt(rec?.odds) && ODDS_BANDS[severity]) {
            const [lo, hi] = ODDS_BANDS[severity];
            if (rec.odds < lo || rec.odds > hi) warn(rec, i, `odds ${rec.odds} is outside the ${severity} guidance ${lo}-${hi}`);
        }
        if (isInt(rec?.duration) && rec.duration !== 0 && DURATION_BANDS[severity]) {
            const [lo, hi] = DURATION_BANDS[severity];
            if (rec.duration < lo || rec.duration > hi) warn(rec, i, `duration ${rec.duration}s is outside the ${severity} guidance ${lo}-${hi}s`);
        }
    });

    // Coverage: every category should have injuries to roll
    for (const category of CATEGORIES) {
        const count = records.filter((r) => r?.category === category).length;
        if (count === 0) errors.push(`category "${category}" has no injuries — rolling it would fail`);
        else if (count < 5) warnings.push(`category "${category}" has only ${count} injuries (thin — repeats quickly)`);
    }
}

// ---- run ----------------------------------------------------------
let records;
try {
    records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
} catch (error) {
    console.error(`FATAL: could not read ${SOURCE}\n${error.message}`);
    process.exit(1);
}

validate(records);

console.log(`Validating ${Array.isArray(records) ? records.length : 0} injuries from resources/injuries.json`);
console.log(iconRoot ? `Icon check against: ${iconRoot}` : 'Icon existence check SKIPPED (Foundry icons not found; set FOUNDRY_PUBLIC)');

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
