// ==================================================================
// ===== RUN GUIDANCE, BATCH 3 (tools/add-injury-guidance-3.mjs) =====
// ==================================================================
// Final 22 entries, completing gmnotes coverage for all 144 injuries.
// Same house style; idempotent and additive.
//
//   node tools/add-injury-guidance-3.mjs
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');

const GUIDANCE = {
    // ---- bludgeoning -----------------------------------------------
    'Battered and Bruised Ballet': 'No condition, so make it a movement tax: difficult terrain, ladders, and anything requiring grace. Stinger: "You move like someone doing an impression of yourself."',
    'Clobbered Conundrum': 'Stunned once, then play the concussive noise — they mishear one instruction and act on it. Stinger: "Somebody said go. You are fairly sure somebody said go."',
    'Pummeling Painscape': 'Stunned once; afterwards let every new hit land on somewhere already hurt. Stinger: "There is nowhere left on you that is not already sore."',
    'Thump and Tumble': 'Prone repeatedly — the slapstick is the point, so let them fall at the funniest available moment. Stinger: "Up, then down. Up, then down. The floor is winning."',

    // ---- fire ------------------------------------------------------
    'Blistered Palms': 'No condition: rule grip instead — dropped weapons on a failed check, no climbing, no rope. Stinger: "You close your hand and feel every one of them let go."',

    // ---- force -----------------------------------------------------
    'Compressed Ribs': 'Nothing mechanical, so charge deep breaths: shouting, swimming, running, verbal spells. Stinger: "Your ribs ache in a circle, like something very large hugged you once."',
    'Concussive Ring': 'Flavour only — spend it on concentration checks and missed quiet sounds. Stinger: "Nothing touched you. Everything still rang."',
    'Kinetic Whiplash': 'No condition; rule against turning quickly — flanking and rear attacks get easier on them. Stinger: "Looking behind you is now a decision, not a reflex."',
    'Shoved Sideways': 'Prone and displaced. Good on a ledge, a bridge, or beside anything they would rather not fall into. Stinger: "You are standing somewhere you did not choose."',

    // ---- piercing --------------------------------------------------
    "Dragon's Pointed Reminder": 'Exhaustion 1 and permanent until treated — a dragon-scale souvenir lodged in them. Removing it should cost something. Stinger: "It is still warm. It has been days and it is still warm."',
    'Stabbed Flesh': 'No condition, so rule the cavity: it reopens under exertion and stitching is a scene. Stinger: "It is deeper than it looks, and it looks bad."',
    'Stabbing Pain': 'Exhaustion 1 from a wound that will not let them rest. Stinger: "It pulses. You have started counting along with it."',

    // ---- radiant ---------------------------------------------------
    'Radiant Overload': 'Poisoned and glowing brightly for the better part of an hour — stealth is gone and everything nearby knows where they are. Stinger: "You are throwing light on the walls. You cannot dim it."',

    // ---- slashing --------------------------------------------------
    'Bleeding Edge': 'Bleeding is the mechanic; the trail is the drama. Anything that hunts by blood now has a road to follow. Stinger: "It is going through the bandage faster than you can replace it."',
    'Jagged Gash': 'Bleeding, and the ragged edges mean it closes badly — worth a scar and a complication later. Stinger: "It is not a clean cut. It will not be a clean scar."',
    'Rending Rift': 'Bleeding from something wide open — the horror is how much of it there is. Stinger: "You can see more of yourself than anyone should."',
    'Sashimi Slice': 'Bleeding plus fragility: rule that the next hit lands harder, or simply describe them as thinner than before. Stinger: "The cut is so clean you did not notice until you moved."',
    'Severed Limb': 'Permanent, prone, and campaign-changing — pause and make sure the player wants this before it stands. Offer regeneration as a quest. Stinger: "Somebody needs to pick that up, and nobody is moving."',

    // ---- thunder ---------------------------------------------------
    'Electric Shockwave': 'Stunned once, then let the muscles twitch through the next hour — no fine work, no steady aim. Stinger: "Your hands have not stopped since. You have tried sitting on them."',
    'Lightning Tickles': 'Flavour only: rule against concentration and delicate work for fifteen minutes. Stinger: "Something under your skin is still fizzing quietly."',
    'Static Shock': 'No condition — every metal object and every handshake is a small event. Stinger: "You reach for the door handle and think better of it."',
    'Thunderous Migraine': 'Deafened for three quarters of an hour, with a headache to match — no plans, no lore, no torch-side. Stinger: "The thunder stopped outside and kept going inside."'
};

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
let added = 0;
const unmatched = [];

for (const [title, text] of Object.entries(GUIDANCE)) {
    const rec = records.find((r) => r.title === title);
    if (!rec) { unmatched.push(title); continue; }
    if (rec.gmnotes) continue;
    rec.gmnotes = text;
    added++;
}

fs.writeFileSync(SOURCE, JSON.stringify(records, null, '\t') + '\n', 'utf8');

const authored = records.filter((r) => r.gmnotes).length;
console.log(`Run guidance batch 3: ${added} added`);
if (unmatched.length) console.log(`  ! no record matched: ${unmatched.join(', ')}`);
console.log(`Coverage: ${authored}/${records.length}`);
const missing = records.filter((r) => !r.gmnotes).map((r) => `${r.category}/${r.title}`);
console.log(missing.length ? `Still missing:\n  ${missing.join('\n  ')}` : 'Every injury now ships run guidance.');
