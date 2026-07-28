// ==================================================================
// ===== BALANCE PASS (tools/balance-injuries.mjs) ===================
// ==================================================================
// A one-time rebalance of resources/injuries.json, run after `odds`
// began actually driving which injury you get.
//
// The authored medians were already a clean rarity ladder — minor 40,
// moderate 20, major 10 — so this does NOT rescale the corpus. It only
// corrects entries whose values fought their own severity:
//
//   - majors that were more common than a typical minor
//   - a moderate more common than a typical minor
//   - "major" wounds that expired in under 15 minutes
//   - "minor" scratches that lingered for hours
//
// It also adds injuries to the two thinnest categories (force, fire).
//
// Run once:  node tools/balance-injuries.mjs
// Idempotent: values already at target are left alone.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');

/**
 * Rarity corrections. Every one of these was a major (or one moderate)
 * showing up more often than injuries far less serious than itself.
 */
const ODDS_FIXES = {
    'Electric Shockwave': 8,          // major, was 75 — 18% of all thunder rolls
    'Cerebral Overload': 10,          // major, was 50 — 12% of all psychic rolls
    "Dragon's Pointed Reminder": 12,  // major, was 30
    'Disembowelment Delight': 6,      // major, was 25 — a signature disaster, should be rare
    'Thunderous Migraine': 30,        // moderate, was 75 — beat every minor in its category
    'Psionic Feedback': 25,           // moderate, was 50
    'Sashimi Slice': 30,              // moderate, was 50
    'Bruised Ego': 35,                // moderate, was 50
    'Cerebral Backfire': 25           // moderate, was 40 alongside a 50 sibling
};

/**
 * Duration corrections. Severity should be felt in how long a wound
 * lasts; a "major" that clears in thirty seconds is not major.
 */
const DURATION_FIXES = {
    // majors that expired far too quickly
    'Pickle Puddle Pains': 3600,
    'Spicy Surprise': 2700,
    'Gravity Defiance': 1800,          // was 30 seconds
    'Soul Erosion': 0,                 // permanent — the name promises it
    'Serpentine Sibilant Speaking': 3600,
    'Radiant Overload': 2700,
    'Crimson Gash Of Carnage': 3600,
    'Disembowelment Delight': 0,       // permanent until treated
    'Shockwave Symphony': 3600,
    // minors that overstayed
    'Beastly Puncture Wound': 1800,    // was 4 hours
    'Rogue Needle Prick': 900,         // was 2 hours
    'Marshmallow Fingers': 600,
    'Goblin’s Gloom': 900,
    "Goblin's Gloom": 900,
    'Skeletal Sneeze': 900,
    'Toadstool Toenails': 900,
    'Lightning Tickles': 900,
    'Stuck Like A Thistle': 900,
    'Pinprick Of Pain': 600,
    'Celestial Shimmer': 900,
    'Lightburn': 900,
    'Venomous Hiccup Syndrom': 900,
    "Tortle's Unlucky Jab": 7200        // was 8 hours for a moderate
};

/**
 * Condition corrections. Action-denying conditions (paralyzed,
 * incapacitated) on a *minor* scratch take a player's whole turn away
 * for a papercut. Each replacement was chosen to match what the injury's
 * own prose actually describes.
 */
const CONDITION_FIXES = {
    // minor + incapacitated: loses you every action, for a light burn
    'Hissing Haze': 'none',            // prose is eerie noise and pain, no incapacity
    'Melting Misery': 'poisoned',      // "each movement feels…" — hampered, not helpless
    // minor + stunned
    'Frozen Noggin': 'none',           // prose is broken concentration, which has no condition
    'Zapped Zest': 'none',             // prose is comic over-energising — the opposite of stunned
    // minor + paralyzed: the harshest condition in the game, on a minor
    'Static Shock': 'none',            // prose is twitching muscles
    // moderate + paralyzed
    'Thunderous Tingle': 'stunned'     // still serious, no longer turn-ending
};

/** New injuries for the two thinnest categories. */
const NEW_INJURIES = [
    // ---- force (had 4) ----
    {
        category: 'force', title: 'Concussive Ring', image: 'icons/magic/sonic/explosion-impact-shock-wave.webp',
        imagetitle: 'The Air Struck Back',
        description: 'The blow never touched you and still it landed. A wall of pressure rang through your chest and left everything humming at a pitch just below hearing. You keep swallowing to clear ears that were never blocked.',
        treatment: 'Sit somewhere still until the humming fades. There is nothing to bandage, which patients find deeply unsatisfying.',
        severity: 'minor', damage: 2, duration: 300, statuseffect: 'none', odds: 55
    },
    {
        category: 'force', title: 'Shoved Sideways', image: 'icons/magic/earth/strike-fist-stone-gray.webp',
        imagetitle: 'An Argument With Physics',
        description: 'Something invisible disagreed with where you were standing and resolved the matter directly. You arrived somewhere else, mostly intact, with your sense of balance still in transit. Every few steps your body braces for a second shove that never comes.',
        treatment: 'Check for the bruises the landing left rather than the blow itself. Balance returns within the hour.',
        severity: 'minor', damage: 3, duration: 420, statuseffect: 'prone', odds: 45
    },
    {
        category: 'force', title: 'Compressed Ribs', image: 'icons/magic/earth/barrier-stone-explosion-debris.webp',
        imagetitle: 'Squeezed From All Sides',
        description: 'For one long moment the air around you decided to be somewhere else, and took your breath with it. Your ribs ache in a ring rather than a spot, as though you had been briefly and firmly hugged by a building. Deep breaths are now a project rather than a reflex.',
        treatment: 'Rest, shallow breathing, and no heavy lifting. Watch for worsening pain, which suggests something cracked rather than compressed.',
        severity: 'moderate', damage: 6, duration: 1800, statuseffect: 'none', odds: 25
    },
    {
        category: 'force', title: 'Kinetic Whiplash', image: 'icons/magic/sonic/projectile-shock-wave-blue.webp',
        imagetitle: 'Stopped Too Suddenly',
        description: 'You were moving, then very much not, and your body is still filing complaints about the transition. Your neck turns in one direction reluctantly and the other not at all. Looking behind you has become a whole-body manoeuvre.',
        treatment: 'Warmth, gentle movement, and no sudden turns. It stiffens considerably before it eases.',
        severity: 'moderate', damage: 5, duration: 2400, statuseffect: 'none', odds: 20
    },
    // ---- fire (had 6) ----
    {
        category: 'fire', title: 'Blistered Palms', image: 'icons/magic/fire/blast-jet-stream-embers-orange.webp',
        imagetitle: 'A Grip Best Avoided',
        description: 'Your palms have risen in protest, each blister a small tight dome of regret. Closing your hand is possible but unwise, and gripping anything reminds you of the exact moment you reached for it. You have begun carrying things in the crooks of your arms like a person hiding evidence.',
        treatment: 'Cool water, clean wrapping, and do not open the blisters. Grip strength returns as they settle.',
        severity: 'minor', damage: 3, duration: 600, statuseffect: 'none', odds: 50
    },
    {
        category: 'fire', title: 'Smoke-Scoured Lungs', image: 'icons/magic/fire/flame-burning-campfire-smoke.webp',
        imagetitle: 'Breathing Through Ash',
        description: 'You breathed when you should not have, and the air took something with it on the way out. Every inhale rasps, every exhale tastes faintly of the fire, and your voice has dropped an octave you never asked for. Speaking more than a sentence sets off a cough that takes a while to negotiate with.',
        treatment: 'Clean air, water, and silence. Do not let the patient near smoke again today.',
        severity: 'moderate', damage: 6, duration: 2700, statuseffect: 'none', odds: 25
    },
    {
        category: 'fire', title: 'Charred To The Quick', image: 'icons/magic/fire/flame-burning-creature-skeleton.webp',
        imagetitle: 'Burned Past Feeling',
        description: 'The burn went deeper than pain, into the strange numb country underneath it. The skin has gone tight and pale at the centre where it should hurt most, ringed by everything that still does. You find yourself checking the wound repeatedly, unsettled by how little it has to say.',
        treatment: 'Serious, immediate care: cool the wound, cover it loosely, and get proper healing. Deep burns do not mend on their own and invite infection.',
        severity: 'major', damage: 10, duration: 0, statuseffect: 'none', odds: 8
    }
];

// ---- apply ---------------------------------------------------------
const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const notes = [];

for (const rec of records) {
    if (ODDS_FIXES[rec.title] !== undefined && rec.odds !== ODDS_FIXES[rec.title]) {
        notes.push(`odds     ${rec.title}: ${rec.odds} -> ${ODDS_FIXES[rec.title]} (${rec.severity})`);
        rec.odds = ODDS_FIXES[rec.title];
    }
    if (DURATION_FIXES[rec.title] !== undefined && rec.duration !== DURATION_FIXES[rec.title]) {
        const to = DURATION_FIXES[rec.title];
        notes.push(`duration ${rec.title}: ${rec.duration}s -> ${to === 0 ? 'permanent' : to + 's'} (${rec.severity})`);
        rec.duration = to;
    }
    if (CONDITION_FIXES[rec.title] !== undefined && rec.statuseffect !== CONDITION_FIXES[rec.title]) {
        notes.push(`status   ${rec.title}: ${rec.statuseffect} -> ${CONDITION_FIXES[rec.title]} (${rec.severity})`);
        rec.statuseffect = CONDITION_FIXES[rec.title];
    }
}

const existing = new Set(records.map((r) => `${r.category}::${r.title.toLowerCase()}`));
for (const rec of NEW_INJURIES) {
    const key = `${rec.category}::${rec.title.toLowerCase()}`;
    if (existing.has(key)) continue;
    records.push({ ...rec });
    notes.push(`added    ${rec.category}: ${rec.title} (${rec.severity})`);
}

records.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
fs.writeFileSync(SOURCE, JSON.stringify(records, null, '\t') + '\n', 'utf8');

console.log(`Balanced ${records.length} injuries`);
for (const n of notes) console.log(`  - ${n}`);
if (!notes.length) console.log('  (nothing to change)');
