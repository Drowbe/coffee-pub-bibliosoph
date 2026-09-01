// ==================================================================
// ===== INJURY SCHEMA (scripts/data/injury-schema.js) ===============
// ==================================================================
// The single machine-readable definition of the injury record.
// Described in documentation/architecture/architecture-injuries.md.
//
// Deliberately dependency-free so BOTH sides can import it: the Foundry
// runtime (data model, sheet, card) and the Node build tools
// (validator, generator) — tools/injury-schema.mjs re-exports this file
// rather than keeping a second copy that could drift.
// ==================================================================

// Roll modifiers are defined ONCE, in the outcome schema, and shared.
// A −2 to attack rolls is the same mechanic whether a fumble or a broken
// arm caused it, and two copies of MODIFIER_STATS would drift the first
// time either one gained a stat. (Nothing here runs at import time, so
// the Node tools can import this file safely.)
export {
    MODIFIER_STATS,
    describeModifier,
    modifiersToChanges,
    roundsToSeconds,
    secondsToRounds
} from './outcome-schema.js';

import { MODIFIER_STATS as STATS } from './outcome-schema.js';

/** The 14 canonical categories: dnd5e damage types plus the general fallback. */
export const CATEGORIES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'general', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
];

export const SEVERITIES = ['minor', 'moderate', 'major'];

/**
 * Condition ids an injury may convey — curated from dnd5e's registry to
 * those that make sense as a wound. `bleeding`, `burning`, and `diseased`
 * are pseudo-conditions: they cannot be toggled and ride on the injury
 * effect's own statuses array (the applier handles that difference).
 * 'none' means the injury is purely narrative.
 */
export const CONDITIONS = [
    'none',
    'blinded', 'deafened', 'silenced',
    'poisoned', 'diseased', 'bleeding', 'burning',
    'prone', 'grappled', 'restrained',
    'stunned', 'paralyzed', 'incapacitated', 'unconscious',
    'exhaustion', 'frightened', 'charmed', 'petrified'
];

/**
 * Conditions that take a creature's whole turn away. Reserved for major
 * injuries — losing every action to a scratch is not a fun surprise.
 */
export const MAJOR_ONLY_CONDITIONS = ['paralyzed', 'incapacitated', 'unconscious', 'petrified'];

/**
 * Serious but survivable: allowed from moderate up. A solid blow that
 * stuns you is squarely moderate territory in 5e terms.
 */
export const MODERATE_PLUS_CONDITIONS = ['stunned'];

/**
 * One-time damage bands by severity, as a PERCENTAGE OF MAX HP.
 *
 * Flat HP could not be right at both ends of the level range: an average
 * major injury was 10.5 HP, which kills a level-1 wizard outright and is
 * 7% of a level-15 fighter. A percentage is the same wound at every
 * level. `damageFor()` applies it with a floor so an injury maims and
 * never kills — dying is what the death saves are for.
 */
export const DAMAGE_BANDS = {
    minor: [0, 5],
    moderate: [6, 10],
    major: [11, 18]
};

/**
 * An injury must never be the thing that drops a character. It can take
 * them to 1, and the fight can take them the rest of the way.
 */
export const DAMAGE_LEAVES_AT_LEAST = 1;

/**
 * Resolve an injury's one-time damage against a specific creature.
 *
 * @param {number} percent  the authored `damage`, a percent of max HP
 * @param {object} hp       the actor's hp object ({ value, max })
 * @returns {number} HP to remove; 0 when there is nothing to take
 */
export function damageFor(percent, hp) {
    const pct = Number(percent) || 0;
    const max = Number(hp?.max) || 0;
    const current = Number(hp?.value) || 0;
    if (pct <= 0 || max <= 0 || current <= 0) return 0;
    const raw = Math.round(max * (pct / 100));
    // At least 1 if the injury does anything at all, and never enough to
    // take the last point of health.
    return Math.max(0, Math.min(Math.max(1, raw), current - DAMAGE_LEAVES_AT_LEAST));
}

/**
 * Duration guidance in seconds (warning only; 0 = permanent, always
 * allowed). Calibrated to the authored corpus after the 2026-07-28
 * balance pass rather than invented, so a warning means a record is a
 * genuine outlier instead of merely unusual.
 */
export const DURATION_BANDS = {
    minor: [60, 1800],
    moderate: [60, 7200],
    major: [1800, 86400]
};

/**
 * Odds guidance by severity (warning only). The authored medians form a
 * clean 4:2:1 rarity ladder — minor 40, moderate 20, major 10.
 */
export const ODDS_BANDS = {
    minor: [5, 75],
    moderate: [5, 40],
    major: [1, 20]
};

export const REQUIRED_FIELDS = [
    'category', 'title', 'image', 'imagetitle', 'description',
    'treatment', 'severity', 'damage', 'duration', 'statuseffect', 'odds'
];

export const OPTIONAL_FIELDS = ['treatmentdc', 'gmnotes', 'modifiers', 'flavor', 'tick', 'expiry'];

/**
 * RECURRING DAMAGE — a percentage of max HP lost at the start of each of
 * the victim's turns while the injury lasts. Same unit as `damage`, for
 * the same reason: a bleed that takes 2 HP a round is a death sentence at
 * level 1 and a rounding error at level 15.
 *
 * Kept deliberately small. `damage` is the blow; the tick is the wound
 * refusing to close, and it should worry a player rather than kill them.
 */
export const TICK_BANDS = {
    minor: [0, 2],
    moderate: [0, 3],
    major: [0, 5]
};

/**
 * WHAT HAPPENS WHEN THE CLOCK RUNS OUT.
 *
 *   heal   — it is over. The effect is removed and its condition unwinds.
 *            The right default: most wounds close on their own.
 *   linger — the duration only governs the ticking and the roll penalties.
 *            The injury itself stays until somebody treats it, which is
 *            what a "permanent until treated" wound with a bleed phase
 *            actually wants.
 *
 * A duration of 0 is permanent and never expires, so `expiry` does not
 * apply to it either way.
 */
export const EXPIRIES = ['heal', 'linger'];
export const EXPIRY_LABELS = {
    heal: 'Heals on its own when the duration ends',
    linger: 'Stops ticking, but stays until treated'
};

/** Damage from one tick, floored the same way the initial blow is. */
export function tickDamageFor(percent, hp) {
    return damageFor(percent, hp);
}

/**
 * How many roll modifiers an injury may sensibly carry, and how big they
 * may get. A wound that stacks four penalties is a spreadsheet, not a
 * story, and 5e's own maths falls apart past about −5.
 */
export const MODIFIER_LIMITS = {
    maxCount: 3,
    minValue: -5,
    maxValue: 5,
    /** Penalty ceilings by severity — a scratch should not cost you −4. */
    bySeverity: { minor: 1, moderate: 2, major: 5 }
};

export const MODIFIER_STAT_KEYS = Object.keys(STATS);

/** Treatment DC by severity, when no explicit treatmentdc is authored. */
export const SEVERITY_DCS = { minor: 10, moderate: 15, major: 20 };

/** Title case a category for display ("acid" -> "Acid"). */
export const displayCategory = (c) => String(c ?? '').charAt(0).toUpperCase() + String(c ?? '').slice(1);

/** Resolve an injury's treatment DC: authored value, else severity ladder, else 15. */
export function treatmentDcFor({ treatmentdc, severity } = {}) {
    const authored = Number(treatmentdc);
    if (Number.isFinite(authored) && authored > 0) return authored;
    return SEVERITY_DCS[String(severity ?? '').toLowerCase()] ?? 15;
}
