// ==================================================================
// ===== RUN GUIDANCE AUTHORING (tools/add-injury-guidance.mjs) ======
// ==================================================================
// Adds the shipped `gmnotes` field — "how to run this injury at the
// table" — to records in resources/injuries.json.
//
// House style for the field: one short paragraph, second person to the
// GM, covering (a) what it actually costs in play, (b) anything worth
// ruling on, and (c) a stinger the GM can say out loud.
//
// Idempotent and additive: a record that already has guidance is left
// alone, so this can be re-run as more entries get written.
//
//   node tools/add-injury-guidance.mjs
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');

const GUIDANCE = {
    // ---- general (the untyped / mixed fallback — most-rolled) -------
    'Everything Hurts': 'No mechanical teeth, so let it cost time rather than actions: they are slow to stand, slow to mount, last out of the room. Lean on it during downtime scenes rather than combat. Stinger: "You get up. It takes you a moment longer than it used to."',
    'Wobbly Knees': 'Prone is the whole cost — standing eats half their movement, and that is enough. Consider asking for a check if they try to sprint, jump, or take stairs at speed. Stinger: "Your knee holds. Then it doesn\'t."',
    'Ringing Silence': 'Deafened means no hearing-based Perception and trouble with any spoken command or verbal plan. Play it socially: have them mishear an order at the worst moment. Stinger: "Someone is shouting your name. You can tell that much."',
    'Winded Wreck': 'Exhaustion 1 is disadvantage on ability checks — quietly brutal for a skill scene. Have them unable to speak and move in the same breath. Stinger: "You have the air for running or for talking. Choose."',
    'Cracked Rib Chorus': 'No condition, so make it situational: a check to do anything requiring a deep breath — shouting, swimming, holding a note, laughing. Stinger: "Something in your chest clicks when you breathe in. Only when you breathe in."',
    'Split Lip Saga': 'Pure flavour, and the fun is in the roleplay tax: verbal spellcasting, negotiation, and anything requiring dignity. Stinger: "You taste copper every time you open your mouth to speak."',
    'Bruised To The Bone': 'Nothing mechanical, so charge it in positioning — they favour one side, they cannot carry on that shoulder, they flinch from a shove. Stinger: "The colour of it has gotten worse since you last looked."',
    'Concussive Confusion': 'Stunned is turn-ending; use it once and let the aftermath carry the scene. Afterwards, have them ask a question they already asked. Stinger: "You know these people. Give it a second. You know these people."',
    'Wrenched Everything': 'Rule on grip: dropping a weapon on a hard hit, disadvantage to climb or hold a rope. Stinger: "Everything above your waist has an opinion about that."',
    'Total System Failure': 'Unconscious and permanent until treated — this is a scene-ender, not a combat modifier. Make the table decide who stops fighting to reach them. Stinger: "You hear your name from very far away, and then not."',

    // ---- slashing --------------------------------------------------
    'Crimson Gash Of Carnage': 'Bleeding does the mechanical work; your job is to make it visible. They are marking the floor, the saddle, the water. Trackers get advantage; predators take an interest. Stinger: "You are leaving a trail. Whatever is behind you will not need to guess."',
    'Severed Strands': 'The conveyed condition is the cost; the horror is cosmetic and worth a sentence. Anyone with Medicine should be able to see this needs real attention, not a bandage. Stinger: "It does not hurt yet. That is the part that worries you."',
    'Slashed Eye': 'Blinded is enormous — consider ruling it as one eye: disadvantage on ranged attacks and sight Perception rather than full blindness, if that suits your table. Say so out loud before the next roll. Stinger: "Half the room is simply gone, and you keep turning your head to find it."',
    'Disembowelment Delight': 'Permanent until treated and unconscious-adjacent in tone: this ends someone\'s fight. Do not let it become a numbers discussion. Stinger: "Hold it in. That is the whole plan right now — hold it in."',

    // ---- piercing --------------------------------------------------
    'Beastly Puncture Wound': 'A clean hole that closes badly. Worth a complication later — infection, stiffness the next morning — rather than a combat penalty now. Stinger: "It is a small wound. It goes a very long way in."',
    'Impaled Appendage': 'Rule the limb unusable rather than reaching for a condition: no two-handed weapons, no climbing, no shield. Stinger: "Whatever went through is still in there, and it moves when you do."',

    // ---- fire ------------------------------------------------------
    'Charred To The Quick': 'Permanent until treated, and the numbness is the tell — deep burns do not hurt at the centre. Anyone with Medicine should read that as serious. Stinger: "You press it and feel nothing. You press around it and nearly fall over."',
    'Marshmallow Fingers': 'Charmed is a strange fit mechanically, so play the fingers: fumbles on fine work, dropped components, failed sleight of hand. Stinger: "Your hands answer about half a second late, and not always with what you asked for."',
    'Smoke-Scoured Lungs': 'Verbal spellcasting and shouting are the pressure points. Ask for a check to speak a full sentence under exertion. Stinger: "Your own voice comes back a stranger\'s — lower, and shorter of road."',

    // ---- bludgeoning -----------------------------------------------
    'Cranial Cacophony': 'Stunned once, then let the concussion linger as fiction: slow answers, repeated questions, light hurts. Do not stack more penalties. Stinger: "Everyone is speaking normally. You are certain they are not."',
    'Skin Canvas': 'Cosmetic and cumulative — a good one to reference in later scenes as the party\'s shared history. Stinger: "You are running out of skin that is still the right colour."',

    // ---- cold / necrotic / poison / psychic ------------------------
    'Frozen Heartbeat': 'Exhaustion 1 with a cold flavour: they cannot get warm, and rest is poor until treated. Stinger: "The shivering stopped an hour ago. That is worse."',
    'Frostbite Fingers': 'The tissue is dying, not merely cold — that is why it is necrotic. Ruling it as lost feeling in the hand is fair and scary. Stinger: "The colour is wrong, and it is not coming back on its own."',
    'Soul Erosion': 'Permanent until treated, and the point is dread rather than numbers. Have the character forget something small and true about themselves. Stinger: "There was a name you used to say when you were frightened. It is not there now."',
    'Serpentine Sibilant Speaking': 'Verbal components and any social scene are where this bites. Let a botched sentence cost them a negotiation rather than hit points. Stinger: "You meant to say her name. Something else came out."',
    'Cerebral Overload': 'Stunned once, then play the migraine: light, noise, and concentration all cost something. Good candidate for losing spell concentration on the next hit. Stinger: "Thinking about it makes it worse. So does not thinking about it."'
};

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
let added = 0;
let skipped = 0;

for (const rec of records) {
    const guidance = GUIDANCE[rec.title];
    if (!guidance) continue;
    if (rec.gmnotes) { skipped++; continue; }
    rec.gmnotes = guidance;
    added++;
}

fs.writeFileSync(SOURCE, JSON.stringify(records, null, '\t') + '\n', 'utf8');

const authored = records.filter((r) => r.gmnotes).length;
console.log(`Run guidance: ${added} added, ${skipped} already present`);
console.log(`Coverage: ${authored}/${records.length} injuries carry gmnotes`);
const missing = records.filter((r) => !r.gmnotes);
const byCat = {};
for (const r of missing) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
console.log('Still to author, by category: ' + Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join('  '));
