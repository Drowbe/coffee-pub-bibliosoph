// ==================================================================
// ===== ONE-TIME NORMALIZER (tools/normalize-injuries.mjs) ==========
// ==================================================================
// Brings resources/injuries.json onto the schema in
// documentation/architecture/architecture-injuries.md:
//
//   - drops journaltype / foldername / action (constants or derivable)
//   - damage, duration, odds become real integers
//   - category, severity, statuseffect become lowercase ids
//   - flavor-only statuses ("Confused", "Disoriented", "Clumsy Fingers")
//     become "none" — that colour lives in the description prose
//   - fills the 25 missing imagetitle captions (authored below)
//   - corrects two thematically wrong images
//   - appends 10 new `general` injuries (the untyped/mixed fallback
//     category had only 2)
//
// Run once:  node tools/normalize-injuries.mjs
// Idempotent: re-running on normalized data is a no-op.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');

/** Flavor-only status text with no dnd5e equivalent — the prose carries it. */
const FLAVOR_STATUSES = new Set(['confused', 'disoriented', 'clumsy fingers', '']);

/** Captions authored for the 25 records that had none. Keyed by title. */
const CAPTIONS = {
    'Acidic Aftershock': 'Lingering Sting',
    'Corrosive Consequences': 'Slow Unmaking',
    'Hissing Haze': 'Whispering Vapors',
    'Melting Misery': 'Softening Resolve',
    'Sizzling Surprise': 'Unwelcome Warmth',
    'Battered and Bruised Ballet': 'Graceless Choreography',
    'Clobbered Conundrum': 'Ringing Confusion',
    'Pummeling Painscape': 'A Map Of Aches',
    'Skin Canvas': 'Painted In Bruises',
    'Thump and Tumble': 'Gravity Wins Again',
    'Frozen Fingers': 'Ten Blue Strangers',
    'Absurd Attraction Aura': 'Everything Comes Closer',
    'Dizzying Dance Dilemma': 'The World Tilts',
    'Impaled Appendage': 'Something Went Through',
    'Penetrating Trauma': 'Depths Best Unreached',
    'Piercing Wound': 'A Small Red Door',
    'Stabbed Flesh': 'Hollow Where Flesh Was',
    'Stabbing Pain': 'Rhythm Of Its Own',
    'Bleeding Edge': 'Crimson Keeps Coming',
    'Jagged Gash': 'Torn Along The Way',
    'Lacerating Wound': 'The Blade Remembered',
    'Rending Rift': 'A Gaping Argument',
    'Severed Limb': 'What Is No Longer',
    'Severed Strands': 'Loose Threads Of Self',
    'Slashed Eye': 'Half The World Gone'
};

/** Art corrected where the icon fought the category. */
const IMAGE_FIXES = {
    // a fire injury wearing a broken-bone icon
    'Flaming Feathered Fiasco': 'icons/magic/fire/flame-burning-creature-skeleton.webp',
    // a necrotic injury wearing a snowstorm; withered flesh suits rotting frostbite
    'Frostbite Fingers': 'icons/magic/death/hand-withered-gray.webp'
};

/** New general injuries — the untyped / evenly-mixed damage fallback. */
const NEW_GENERAL = [
    {
        category: 'general', title: 'Everything Hurts', image: 'icons/skills/wounds/injury-pain-body-orange.webp',
        imagetitle: 'A Comprehensive Ache',
        description: 'Nothing in particular is broken, which somehow makes it worse. Every joint files its own complaint, every muscle answers with a second one, and standing up becomes a negotiation. You have reached the stage of adventuring where the whole body simply sends one unified invoice.',
        treatment: 'Rest, warm compresses, and someone willing to hear about it at length. A day of light activity resolves most of the complaint.',
        severity: 'minor', damage: 2, duration: 600, statuseffect: 'none', odds: 70
    },
    {
        category: 'general', title: 'Wobbly Knees', image: 'icons/skills/wounds/bone-broken-knee-beam.webp',
        imagetitle: 'Unreliable Architecture',
        description: 'Your knees have developed opinions and none of them involve holding you up. They buckle at inconvenient moments, usually while something is watching. Every step is a small wager on whether the ground will stay where you left it.',
        treatment: 'Bind the joint, keep weight off it, and avoid stairs, ladders, and dramatic entrances until the swelling subsides.',
        severity: 'minor', damage: 3, duration: 480, statuseffect: 'prone', odds: 55
    },
    {
        category: 'general', title: 'Ringing Silence', image: 'icons/skills/wounds/anatomy-organ-brain-pink-red.webp',
        imagetitle: 'A Bell Still Sounding',
        description: 'Something struck you hard enough that the world went quiet and then refused to come back. A single clear tone hangs behind your eyes, patient and unwelcome. Voices arrive as shapes rather than words, and you find yourself nodding at people who have not finished speaking.',
        treatment: 'Quiet and dark for several hours. Do not let the patient take another blow to the head before the ringing stops.',
        severity: 'moderate', damage: 5, duration: 1800, statuseffect: 'deafened', odds: 30
    },
    {
        category: 'general', title: 'Winded Wreck', image: 'icons/skills/wounds/anatomy-organ-heart-red.webp',
        imagetitle: 'Borrowed Breath',
        description: 'Your lungs have decided to work part-time. Each breath comes shallow and late, arriving just after you needed it, and your vision narrows whenever you move with purpose. Talking and walking have become mutually exclusive activities.',
        treatment: 'Sit upright, breathe slowly, and stop doing whatever caused this. Recovery is a matter of patience rather than medicine.',
        severity: 'minor', damage: 2, duration: 300, statuseffect: 'exhaustion', odds: 60
    },
    {
        category: 'general', title: 'Cracked Rib Chorus', image: 'icons/skills/wounds/anatomy-bone-joint.webp',
        imagetitle: 'Music On Every Breath',
        description: 'A rib or three have shifted from structural to decorative. Every inhale produces a small private sound that only you can hear, and laughing has become an act of genuine courage. You have started breathing in careful halves, as though the air might notice.',
        treatment: 'Wrap the chest firmly but not tightly, and keep the patient still. Ribs mend on their own schedule and resent being rushed.',
        severity: 'moderate', damage: 6, duration: 3600, statuseffect: 'none', odds: 35
    },
    {
        category: 'general', title: 'Split Lip Saga', image: 'icons/skills/wounds/bone-broken-tooth-fang-red.webp',
        imagetitle: 'The Taste Of Copper',
        description: 'Your mouth has become an unreliable narrator. The split reopens whenever you speak, eat, or smile, which rules out most of the pleasant things in life. You have developed a lopsided way of talking that everyone has politely agreed not to mention.',
        treatment: 'Cold pressure, clean water, and a few hours of not talking. The last part proves hardest for most patients.',
        severity: 'minor', damage: 1, duration: 420, statuseffect: 'none', odds: 65
    },
    {
        category: 'general', title: 'Bruised To The Bone', image: 'icons/skills/wounds/injury-body-pain-gray.webp',
        imagetitle: 'Deep And Patient',
        description: 'The bruise has gone somewhere bruises are not supposed to reach. It aches beneath the muscle, in a place you cannot press or rub or reason with, and it deepens in colour each time you check on it. You have begun moving in a way that avoids one entire side of yourself.',
        treatment: 'Cold first, warmth later, and no weight on the limb for a day. Deep bruising fades slowly and dramatically.',
        severity: 'moderate', damage: 5, duration: 2400, statuseffect: 'none', odds: 40
    },
    {
        category: 'general', title: 'Concussive Confusion', image: 'icons/skills/wounds/injury-face-impact-orange.webp',
        imagetitle: 'The Room Rearranged',
        description: 'The blow landed and the world has not fully reassembled since. Names arrive a beat late, the floor keeps adjusting its angle, and you have asked the same question twice without noticing either time. Somewhere behind your eyes a light is flickering and nobody can reach the switch.',
        treatment: 'Complete rest in a dark, quiet place, watched by someone who will notice if things worsen. Under no circumstances should the patient return to the fight.',
        severity: 'major', damage: 9, duration: 7200, statuseffect: 'stunned', odds: 12
    },
    {
        category: 'general', title: 'Wrenched Everything', image: 'icons/skills/wounds/injury-hand-blood-red.webp',
        imagetitle: 'Wrung Out Entirely',
        description: 'Something twisted you in a direction the design never allowed for. Shoulders, wrists, and hips all report the same grievance in slightly different words, and gripping anything smaller than a doorframe has become theoretical. You feel like laundry that was wrung out and hung up wrong.',
        treatment: 'Immobilise the worst joint, rest the rest, and expect a long day of small indignities. Massage helps once the swelling settles.',
        severity: 'moderate', damage: 7, duration: 2700, statuseffect: 'none', odds: 25
    },
    {
        category: 'general', title: 'Total System Failure', image: 'icons/skills/wounds/blood-drip-droplet-red.webp',
        imagetitle: 'The Body Resigns',
        description: 'Your body has reviewed the day\'s events and elected to stop participating. Legs first, then everything else, in a slow cascade of departments closing early. You are dimly aware of the ground arriving and of someone shouting your name from what sounds like the far end of a hallway.',
        treatment: 'Immediate and serious attention: stabilise, keep them warm, and do not move them further than necessary. This one does not resolve on stubbornness alone.',
        severity: 'major', damage: 11, duration: 0, statuseffect: 'unconscious', odds: 4
    }
];

// ---- normalize ----------------------------------------------------
const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const notes = [];

const toInt = (v, fallback = 0) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) ? Math.round(n) : fallback;
};

const normalized = records.map((rec) => {
    const title = String(rec.title ?? '').trim();

    let statuseffect = String(rec.statuseffect ?? '').trim().toLowerCase();
    if (FLAVOR_STATUSES.has(statuseffect)) {
        if (statuseffect && statuseffect !== 'none') notes.push(`flavor status "${rec.statuseffect}" -> none on "${title}"`);
        statuseffect = 'none';
    }

    let imagetitle = String(rec.imagetitle ?? '').trim();
    if (!imagetitle && CAPTIONS[title]) {
        imagetitle = CAPTIONS[title];
        notes.push(`authored caption for "${title}": ${imagetitle}`);
    }

    let image = String(rec.image ?? '').trim();
    if (IMAGE_FIXES[title]) {
        if (image !== IMAGE_FIXES[title]) notes.push(`image corrected on "${title}": ${image} -> ${IMAGE_FIXES[title]}`);
        image = IMAGE_FIXES[title];
    }

    // Field order matches the spec table
    return {
        category: String(rec.category ?? '').trim().toLowerCase(),
        title,
        image,
        imagetitle,
        description: String(rec.description ?? '').trim(),
        treatment: String(rec.treatment ?? '').trim(),
        severity: String(rec.severity ?? '').trim().toLowerCase(),
        damage: toInt(rec.damage),
        duration: toInt(rec.duration),
        statuseffect,
        odds: Math.min(100, Math.max(1, toInt(rec.odds, 50)))
    };
});

// Append the new general injuries, skipping any already present
const existingTitles = new Set(normalized.map((r) => `${r.category}::${r.title.toLowerCase()}`));
for (const rec of NEW_GENERAL) {
    const key = `${rec.category}::${rec.title.toLowerCase()}`;
    if (existingTitles.has(key)) continue;
    normalized.push({ ...rec });
    notes.push(`added general injury: ${rec.title}`);
}

// Stable order: category, then title
normalized.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

fs.writeFileSync(SOURCE, JSON.stringify(normalized, null, '\t') + '\n', 'utf8');

console.log(`Normalized ${records.length} -> ${normalized.length} injuries`);
for (const n of notes) console.log(`  - ${n}`);
console.log('\nWrote resources/injuries.json');
