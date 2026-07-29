// ==================================================================
// ===== TABLE -> OUTCOME MIGRATION =================================
// ===== (tools/migrate-tables-to-outcomes.mjs) =====================
// ==================================================================
// Reads the world's crit/fumble RollTables and rewrites
// resources/outcomes.json from them.
//
// The source tables are a TIERED ROUTER:
//   Critical Hits  1-10 Butchery | 11-95 Carnage | 96-100 Slaughter
//   Fumbles        1-20 Meek     | 21-95 Nasty   | 96-100 Devastating
// which maps onto severity (minor / moderate / major) and gives the
// odds weighting the author already intended.
//
// The PROSE IS THE POINT and is copied verbatim — jokes, voice, inline
// [[1d6]] roll macros and all. What this adds is the machine-readable
// half: condition, duration, damage, and roll modifiers, hand-mapped
// per entry below where the text states them unambiguously. Entries
// whose effect cannot be expressed as data stay narrative, which is
// exactly how they are run today.
//
//   node tools/migrate-tables-to-outcomes.mjs [--db <path>]
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClassicLevel } from 'classic-level';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'resources', 'outcomes.json');
const dbArg = process.argv.indexOf('--db');
const DB = dbArg > -1 ? process.argv[dbArg + 1]
    : String.raw`C:\Users\drowb\AppData\Local\FoundryVTT\Data\worlds\burden-of-knowledge\data\tables`;

/** Source table -> kind + severity + share of its kind's rolls (from the router). */
const TIERS = {
    'Critical Butchery': { kind: 'crit', severity: 'minor', share: 10 },
    'Critical Carnage': { kind: 'crit', severity: 'moderate', share: 85 },
    'Critical Slaughter': { kind: 'crit', severity: 'major', share: 5 },
    'Meek Fumble': { kind: 'fumble', severity: 'minor', share: 20 },
    'Nasty Fumble': { kind: 'fumble', severity: 'moderate', share: 75 },
    'Devastating Fumble': { kind: 'fumble', severity: 'major', share: 5 }
};

const R = (rounds) => rounds * 6;

/**
 * Mechanics, keyed by title. Only what the text states outright — no
 * invention.
 *
 * `to` names who it lands on when that is not the default (the creature
 * hit for crits, the roller for fumbles): 'ally' for "one of your party
 * members", 'party' for effects that sweep the whole group, 'nearby' for
 * anything measured in feet. Effects that split across several targets
 * take their PRIMARY one and let the prose carry the rest.
 */
const MECHANICS = {
    // ---- Critical Butchery (minor) ----
    'You Have My Attention': { self: true, modifiers: [{ stat: 'attack', value: 2, rounds: 1 }], duration: R(1) },
    "Good Job, Here's a Treat": { self: true },
    'Stay Down': { statuseffect: 'prone', duration: R(1) },
    'Jazz Hands': { to: 'nearby' },

    // ---- Critical Carnage (moderate) ----
    'Knockdown': { statuseffect: 'prone', duration: R(1) },
    'Hamstring': { duration: R(1) },
    'Poopy Pants': { statuseffect: 'stunned', duration: R(1) },
    'Eye Gouge': { statuseffect: 'blinded', duration: R(1) },
    'Slow-Mo': { duration: R(2) },
    'Stunning Blow': { statuseffect: 'stunned', duration: R(1) },
    'Parry': { self: true, modifiers: [{ stat: 'ac', value: 2, rounds: 1 }], duration: R(1) },
    'Gaping Wound': { statuseffect: 'bleeding', duration: R(10), damage: 5 },
    'Pressure Point': { duration: R(2) },
    'Opportunity': { self: true },
    'Need a Hug': { self: true },
    'See Ya': { damage: 3 },
    'Where Did You Go?': { statuseffect: 'blinded', duration: R(1) },
    'Appendage Blow': { modifiers: [{ stat: 'checks', value: -2, rounds: 100 }], duration: R(100) },
    "You're a Hottie": { damage: 3 },
    'Mighty Blow': {},
    'Head Blow': { damage: 3, duration: R(100) },
    'Restack': {},
    'Body Blow': { statuseffect: 'stunned', duration: R(2), modifiers: [{ stat: 'attack', value: -1, rounds: 2 }] },
    'Shoulder Blow': { statuseffect: 'stunned', duration: R(2), modifiers: [{ stat: 'checks', value: -2, rounds: 2 }] },
    'Apple Core': { to: 'ally' },
    'Knockout Blow': { statuseffect: 'unconscious', duration: R(10) },
    'Knee Hit': { duration: R(100) },
    'Puppet Master': { statuseffect: 'charmed', duration: R(10) },
    'Turn the Tide': { self: true, to: 'party', duration: R(1) },
    'Forceful Blow': { duration: R(1) },
    'Feeling the Love': { self: true },
    'Wrist Blow': { duration: R(100) },
    'Party Animal': { statuseffect: 'poisoned', duration: R(4) },
    'Spell Slot Mojo': { self: true, to: 'ally' },
    'Play Date': { to: 'party', duration: R(1) },
    'Shields Up': { self: true, modifiers: [{ stat: 'ac', value: 2, rounds: 4 }], duration: R(4) },
    'El Ka-Bong': { damage: 5 },
    'You Seem Familiar': { self: true },
    'Inspired': { self: true },
    'Inspirational': { to: 'ally' },
    'Freeze Frame': { statuseffect: 'paralyzed', duration: R(4) },
    'Stop Hitting Yourself': {},
    "It's Not You It's Me": { statuseffect: 'frightened', duration: R(10) },
    'Total Perspective Vortex': { statuseffect: 'prone', duration: R(1), damage: 7 },

    // ---- Critical Slaughter (major) ----
    'Obliterate': { statuseffect: 'restrained', duration: R(100) },
    'Eviscerate': { damage: 10 },
    'Decapitate': { damage: 20 },

    // ---- Meek Fumble (minor, self) ----
    'Too Many Tacos': { duration: R(4) },
    'Gaseous Maximus': { to: 'nearby', statuseffect: 'poisoned', duration: R(4) },
    'Chicken Hat': { modifiers: [{ stat: 'attack', value: -2, rounds: 2 }], duration: R(2) },
    'Health': { to: 'ally' },

    // ---- Nasty Fumble (moderate, self) ----
    'Balance Lost': { statuseffect: 'prone', duration: R(1) },
    'Crappy Neighbor': { to: 'ally' },
    'Butterfingers': {},
    "Doesn't Keep Going and Going": { duration: R(100) },
    'Embarassed': { modifiers: [{ stat: 'attack', value: -2, rounds: 10 }], duration: R(10) },
    'McGyver Time': { duration: R(1) },
    'Pulled Muscle': { duration: R(1) },
    'Floor is Lava': { damage: 5 },
    'Fatigued': { duration: R(1) },
    'Saturday Night Fever': { statuseffect: 'exhaustion', duration: R(2) },
    'Tough Situation': { damage: 4 },
    'Done Broke it': { modifiers: [{ stat: 'attack', value: -5, rounds: 100 }], duration: R(100) },
    'Turnabout': {},
    'Counter Attack': {},
    'Fifty-Fifty': {},
    'Bad Aim': { to: 'ally' },
    'Love is in the Air': { to: 'ally', statuseffect: 'grappled', duration: R(10) },
    'Critical Counter': {},
    'Stinky Pete': { duration: R(100) },
    'Friendly Fire': { to: 'ally' },
    'Ranger Danger': { to: 'ally' },
    'Suicide Strike': {},
    'Coping Mechanism': { statuseffect: 'poisoned', duration: R(4) },
    'Ankle Twist': { duration: R(4) },
    'Life Force': { to: 'party', damage: 2 },
    'Dislocation': { statuseffect: 'incapacitated', duration: R(8) },
    'Madvantage': { duration: R(4) },
    'Knee Pop': { duration: R(8) },
    'Shut Up': { statuseffect: 'silenced', duration: R(10) },
    'Wrong Strap': { modifiers: [{ stat: 'ac', value: -5, rounds: 10 }], duration: R(10) },
    'God Empathy': {},
    'Staggering in Pain': { statuseffect: 'blinded', duration: R(8), modifiers: [{ stat: 'attack', value: -4, rounds: 8 }, { stat: 'checks', value: -4, rounds: 8 }] },
    'Lit Up': { damage: 4 },
    'Spell Backlash': {},
    'Your Bad Side': { damage: 5 },
    'Ground Zero': { damage: 6 },
    'Generous': { to: 'ally' },
    'Blinded By Your Own Blood': { statuseffect: 'blinded', duration: R(4), damage: 4 },
    "That Ain't Booze": { statuseffect: 'poisoned', duration: R(10) },
    'Overextended': { statuseffect: 'stunned', duration: R(1) },

    // ---- Devastating Fumble (major, self) ----
    "It's Not Me It's You": { to: 'ally' },
    'Double Trouble': { damage: 10 },
    'I Need a Doctor': { statuseffect: 'bleeding', duration: R(4), damage: 12 }
};

/** Art pools per kind + severity. Every path verified present in Foundry core. */
const ART = {
    'crit:minor': ['icons/skills/melee/strike-blade-blood-red.webp', 'icons/skills/melee/weapons-crossed-swords-yellow.webp', 'icons/magic/light/explosion-star-glow-blue-purple.webp'],
    'crit:moderate': ['icons/skills/melee/strike-sword-blood-red.webp', 'icons/skills/wounds/blood-spurt-spray-red.webp', 'icons/skills/melee/strike-dagger-blood-red.webp', 'icons/skills/wounds/injury-face-impact-orange.webp', 'icons/skills/melee/strike-hammer-destructive-orange.webp'],
    'crit:major': ['icons/skills/melee/strike-axe-blood-red.webp', 'icons/skills/wounds/blood-cells-red.webp', 'icons/magic/death/skull-energy-light-purple.webp'],
    'fumble:minor': ['icons/skills/social/intimidation-impressing.webp', 'icons/magic/air/weather-wind-gust.webp', 'icons/skills/wounds/injury-body-pain-gray.webp'],
    'fumble:moderate': ['icons/skills/melee/sword-damaged-broken-orange.webp', 'icons/skills/wounds/injury-pain-body-orange.webp', 'icons/skills/movement/figure-running-gray.webp', 'icons/skills/wounds/blood-drip-droplet-red.webp', 'icons/magic/control/fear-fright-shadow-monster-red.webp'],
    'fumble:major': ['icons/skills/wounds/blood-spurt-spray-red.webp', 'icons/magic/fire/explosion-fireball-medium-orange.webp', 'icons/skills/wounds/anatomy-organ-heart-red.webp']
};

// ---- read the world tables ----------------------------------------
const db = new ClassicLevel(DB, { valueEncoding: 'json', createIfMissing: false });
await db.open();
const tables = new Map();
const results = new Map();
for await (const [key, value] of db.iterator()) {
    const k = String(key);
    if (k.startsWith('!tables!')) tables.set(value._id, value);
    else if (k.startsWith('!tables.results!')) {
        const tid = k.split('!')[2]?.split('.')[0];
        if (!results.has(tid)) results.set(tid, []);
        results.get(tid).push(value);
    }
}
await db.close();

/**
 * Clean the source text for display.
 *
 * KEPT deliberately: `[[1d6]]` inline rolls (Foundry renders them as
 * clickable dice) and `@UUID[…]{…}` content links (they resolve).
 * REMOVED: HTML tags, `**bold**` markers, and the `##…##` wrappers the
 * old cards used around links — those are authoring shorthand that was
 * never meant to reach a reader.
 */
const stripTags = (s) => String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/##/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const records = [];
const unmapped = [];

for (const [tableName, tier] of Object.entries(TIERS)) {
    const table = [...tables.values()].find((t) => t.name === tableName);
    if (!table) { console.warn(`! table not found: ${tableName}`); continue; }
    const rs = (results.get(table._id) ?? []).sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
    const art = ART[`${tier.kind}:${tier.severity}`] ?? ART['crit:moderate'];

    // Each entry's share of its kind: the tier's router share spread evenly.
    const odds = Math.max(1, Math.min(100, Math.round((tier.share / rs.length) * 10)));

    rs.forEach((r, i) => {
        const raw = stripTags(r.description ?? r.text ?? '');
        // Entries are authored as "**Title** body"
        const m = raw.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        const title = (m ? m[1] : (r.name || `${tableName} ${i + 1}`)).trim();
        const description = (m ? m[2] : raw).trim();

        const mech = MECHANICS[title];
        if (!mech) unmapped.push(`${tableName}: ${title}`);

        const rec = {
            kind: tier.kind,
            title,
            image: art[i % art.length],
            imagetitle: '',
            description,
            severity: tier.severity,
            appliesto: mech?.to ?? ((mech?.self ?? (tier.kind === 'fumble')) ? 'self' : 'target'),
            damage: mech?.damage ?? 0,
            duration: mech?.duration ?? 0,
            statuseffect: mech?.statuseffect ?? 'none',
            odds
        };
        if (mech?.modifiers?.length) rec.modifiers = mech.modifiers;
        records.push(rec);
    });
}

records.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
fs.writeFileSync(OUT, JSON.stringify(records, null, '\t') + '\n', 'utf8');

const crits = records.filter((r) => r.kind === 'crit').length;
const fumbles = records.length - crits;
console.log(`Migrated ${records.length} outcomes (${crits} criticals, ${fumbles} fumbles) -> resources/outcomes.json`);
console.log(`  with mechanics: ${records.filter((r) => r.statuseffect !== 'none' || r.damage || r.modifiers).length}`);
console.log(`  narrative only: ${records.filter((r) => r.statuseffect === 'none' && !r.damage && !r.modifiers).length}`);
if (unmapped.length) console.log(`\nNo mechanical mapping (narrative only):\n  ${unmapped.join('\n  ')}`);
