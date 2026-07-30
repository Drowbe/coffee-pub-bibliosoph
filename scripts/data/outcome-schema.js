// ==================================================================
// ===== OUTCOME SCHEMA (scripts/data/outcome-schema.js) =============
// ==================================================================
// Criticals and fumbles as typed journal content — the "lite" sibling
// of the injury schema (scripts/data/injury-schema.js).
//
// What differs from injuries, and why:
//   - No `treatment` / `treatmentdc`. You do not treat a critical; it
//     lands, it resolves, and it is over.
//   - `duration: 0` means INSTANT (nothing lingers), not permanent.
//     Most outcomes are a single moment. An injury that never ends is
//     normal; a critical that never ends is a curse.
//   - Adds `appliesto` — a critical lands on the victim, a fumble lands
//     on the one who fumbled, and a few do the opposite for comedy.
//   - Adds `modifiers` — the machine-readable teeth. "-2 to attacks for
//     2 rounds" stops being prose a GM has to remember.
//
// Dependency-free so both the Foundry runtime and the Node build tools
// import the same definition.
// ==================================================================

/** The two kinds of outcome. Each becomes one journal in the pack. */
export const KINDS = ['crit', 'fumble'];

/**
 * Each kind ships its own compendium. Journals INSIDE a compendium are
 * the severity buckets — but only for browsing: the picker scans every
 * journal and reads `severity` off the page itself. A journal name is
 * never mechanical, so a GM can rename one, add a "Homebrew" journal, or
 * drag pages between buckets without silently changing anything.
 */
export const KIND_PACKS = {
    crit: 'coffee-pub-bibliosoph.criticals',
    fumble: 'coffee-pub-bibliosoph.fumbles'
};

/** Which setting names the compendium for each kind. */
export const KIND_SETTINGS = { crit: 'critCompendium', fumble: 'fumbleCompendium' };

/** How hard it hits. Drives damage bands and how often it comes up. */
export const SEVERITIES = ['minor', 'moderate', 'major'];

/**
 * The severity buckets by their real names. The data stays uniform
 * (minor/moderate/major) so one validator and one set of bands covers
 * both kinds, but nobody says "a moderate critical" at the table — they
 * say Carnage. These are the labels shown on sheets and cards.
 */
export const SEVERITY_LABELS = {
    crit: { minor: 'Butchery', moderate: 'Carnage', major: 'Slaughter' },
    fumble: { minor: 'Meek', moderate: 'Nasty', major: 'Devastating' }
};

/** "moderate" + "crit" -> "Carnage". */
export const severityLabel = (kind, severity) =>
    SEVERITY_LABELS[kind]?.[severity] ?? String(severity ?? '').charAt(0).toUpperCase() + String(severity ?? '').slice(1);

/**
 * Who the outcome lands on. Deliberately richer than target/self,
 * because real crit and fumble tables scatter effects everywhere: a
 * fumble that hits the party member next to you, a critical that buffs
 * the whole party, a stink that poisons everyone nearby.
 *
 * This is DOCUMENTATION, not automation — the card says who to pick and
 * the GM selects them. Anything that tried to auto-resolve "an ally of
 * your choice" would be guessing at a decision the table should make.
 * For effects that split across several targets, choose the primary one
 * and let the prose carry the rest.
 */
export const TARGETS = ['target', 'self', 'ally', 'party', 'nearby'];

export const TARGET_LABELS = {
    target: 'The creature hit',
    self: 'The roller',
    ally: 'A party member',
    party: 'The whole party',
    nearby: 'Everyone nearby'
};

/** Who the GM should have selected before clicking Apply. */
export const TARGET_HINTS = {
    target: 'Select the creature that was hit.',
    self: 'Select the character who rolled.',
    ally: 'Select the affected party member.',
    party: 'Select the party members it affects.',
    nearby: 'Select everyone in range.'
};

export const targetLabel = (t) => TARGET_LABELS[t] ?? TARGET_LABELS.target;

/**
 * Conditions an outcome may convey. Same curated list the injury schema
 * uses, so one validator rule covers both. 'none' is common here: most
 * outcomes are damage and drama rather than a status.
 */
export const CONDITIONS = [
    'none',
    'blinded', 'deafened', 'silenced',
    'poisoned', 'diseased', 'bleeding', 'burning',
    'prone', 'grappled', 'restrained',
    'stunned', 'paralyzed', 'incapacitated', 'unconscious',
    'exhaustion', 'frightened', 'charmed', 'petrified'
];

/** Turn-denying conditions: major outcomes only. */
export const MAJOR_ONLY_CONDITIONS = ['paralyzed', 'incapacitated', 'unconscious', 'petrified'];

/** Serious but survivable: moderate and up. */
export const MODERATE_PLUS_CONDITIONS = ['stunned'];

/**
 * What a modifier can touch. Each maps to a real dnd5e data path so the
 * effect actually bites; anything not listed here would be display-only,
 * which is why the list is deliberately short and boring.
 */
export const MODIFIER_STATS = {
    attack: { label: 'attack rolls', path: 'system.bonuses.All.attack', mode: 'ADD', formula: true },
    damage: { label: 'damage rolls', path: 'system.bonuses.All.damage', mode: 'ADD', formula: true },
    ac: { label: 'AC', path: 'system.attributes.ac.bonus', mode: 'ADD', formula: false },
    checks: { label: 'ability checks', path: 'system.bonuses.abilities.check', mode: 'ADD', formula: true },
    saves: { label: 'saving throws', path: 'system.bonuses.abilities.save', mode: 'ADD', formula: true }
};

/** One-time HP change bands by severity (damage dealt where it lands). */
export const DAMAGE_BANDS = {
    minor: [0, 5],
    moderate: [4, 12],
    major: [8, 25]
};

/**
 * Duration guidance in seconds. 0 = instant. Outcomes are short by
 * nature: a round is 6 seconds, a minute is 10 rounds.
 */
export const DURATION_BANDS = {
    minor: [0, 60],
    moderate: [0, 600],
    major: [0, 3600]
};

/** Odds guidance by severity — the same 4:2:1 rarity ladder as injuries. */
export const ODDS_BANDS = {
    minor: [20, 75],
    moderate: [10, 50],
    major: [1, 25]
};

export const REQUIRED_FIELDS = [
    'kind', 'title', 'image', 'description',
    'severity', 'appliesto', 'damage', 'duration', 'statuseffect', 'odds'
];

// `imagetitle` is optional here, unlike injuries: an outcome's prose is
// the flavour, and a caption on top of a punchline is one beat too many.
export const OPTIONAL_FIELDS = ['imagetitle', 'modifiers', 'gmnotes', 'dealscard'];

/**
 * `dealscard: true` means this outcome hands someone an inspiration card
 * from the deck. It is the one place the three content families connect:
 * a critical hit that says "that was pretty bad-ass" should actually put
 * a card in the player's hands, not link a macro that only exists in the
 * author's world.
 *
 * WHO gets it comes from `appliesto`, so no second targeting concept is
 * needed — `self` deals to the roller, `ally` offers the party picker.
 */
export const DEALS_CARD_FIELD = 'dealscard';

/** Rounds -> seconds, the unit outcomes are actually authored in. */
export const roundsToSeconds = (rounds) => Math.max(0, Math.round(Number(rounds) || 0) * 6);
export const secondsToRounds = (seconds) => Math.max(0, Math.round((Number(seconds) || 0) / 6));

/** "crit" -> "Critical", for display. */
export const kindLabel = (kind) => (kind === 'crit' ? 'Critical' : 'Fumble');

export const titleCase = (s) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);

/**
 * Human phrasing for one modifier: { stat: 'attack', value: -2, rounds: 2 }
 * becomes "-2 to attack rolls for 2 rounds".
 */
export function describeModifier(mod) {
    if (!mod?.stat) return '';
    const stat = MODIFIER_STATS[mod.stat];
    const value = Number(mod.value) || 0;
    const signed = value > 0 ? `+${value}` : `${value}`;
    const label = stat?.label ?? mod.stat;
    const rounds = Number(mod.rounds) || 0;
    const forHowLong = rounds > 0 ? ` for ${rounds} round${rounds === 1 ? '' : 's'}` : '';
    return `${signed} to ${label}${forHowLong}`;
}

/**
 * Build the ActiveEffect `changes` array for a set of modifiers, so the
 * numbers are real rather than a note the table has to remember.
 */
export function modifiersToChanges(modifiers = []) {
    const changes = [];
    for (const mod of modifiers) {
        const stat = MODIFIER_STATS[mod?.stat];
        if (!stat) continue;
        const value = Number(mod.value) || 0;
        if (!value) continue;
        changes.push({
            key: stat.path,
            mode: CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2,
            value: stat.formula ? (value > 0 ? `+${value}` : `${value}`) : String(value),
            priority: 20
        });
    }
    return changes;
}
