// ==================================================================
// ===== INJURY SCHEMA (tools/injury-schema.mjs) =====================
// ==================================================================
// The single machine-readable copy of documentation/spec-injury-schema.md.
// Shared by the validator and the journal generator so neither can drift
// from the other.
// ==================================================================

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
 *
 * The Foundry-side audit in the test harness re-checks these against the
 * live CONFIG.statusEffects, which is the ultimate authority; this list is
 * the build-time gate.
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

/** One-time HP damage bands by severity (inclusive). */
export const DAMAGE_BANDS = {
    minor: [0, 4],
    moderate: [5, 8],
    major: [9, 12]
};

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
 * clean 4:2:1 rarity ladder — minor 40, moderate 20, major 10 — and
 * these bands bracket it.
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

export const OPTIONAL_FIELDS = ['treatmentdc'];

/** Treatment DC by severity, when no explicit treatmentdc is authored. */
export const SEVERITY_DCS = { minor: 10, moderate: 15, major: 20 };

/** Title case a category for display ("acid" -> "Acid"). */
export const displayCategory = (c) => String(c).charAt(0).toUpperCase() + String(c).slice(1);
