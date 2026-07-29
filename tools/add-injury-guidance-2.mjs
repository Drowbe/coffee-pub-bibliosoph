// ==================================================================
// ===== RUN GUIDANCE, BATCH 2 (tools/add-injury-guidance-2.mjs) =====
// ==================================================================
// Completes the `gmnotes` coverage begun in add-injury-guidance.mjs.
// Same house style: what it costs in play, anything worth ruling on,
// and a stinger the GM can say out loud. Idempotent and additive.
//
//   node tools/add-injury-guidance-2.mjs
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');

const GUIDANCE = {
    // ---- acid ------------------------------------------------------
    'Acidic Aftershock': 'No condition, so charge it in concentration: a check to hold still, aim, or keep a spell going. Stinger: "It stopped burning an hour ago. It has not stopped reminding you."',
    'Corrosive Consequences': 'Stunned once, then let the etched skin be the story — it does not close cleanly and anyone examining it can tell. Stinger: "The shape of the splash is still there, and it will be tomorrow."',
    'Fizzbang Fiasco': 'Permanent prone until treated is severe — rule that they can crawl and fight from the ground, not that they are helpless. Stinger: "Every time you get your feet under you, something pops."',
    "Fizzler's Folly": 'Poisoned is disadvantage on attacks and checks; the harmless light show is pure comedy. Let stealth be impossible. Stinger: "You are glowing faintly. Intermittently. Audibly."',
    'Hissing Haze': 'Flavour only, so spend it on atmosphere — the sound follows them into quiet rooms and gives away hiding places. Stinger: "Everyone else has stopped talking to listen to you."',
    'Melting Misery': 'Poisoned covers the mechanical cost. Play the sensation: they keep checking whether skin is still where they left it. Stinger: "It feels like it is running. You look. It is not."',
    'Pickle Puddle Pains': 'Grappled for an hour is a movement sentence, not a combat one — let them fight, not chase. Lean into the absurdity. Stinger: "You crunch when you walk. Everything within earshot now knows where you are."',
    'Sizzling Surprise': 'Nothing mechanical; make it a heat problem — armour is unbearable, cold water is a temptation, sleep is poor. Stinger: "You are the warmest thing in the room and you can feel everyone noticing."',
    'Sour Grapes Syndrome': 'Permanent and poisoned: a real problem that wants a real cure, and the violet skin makes social scenes hostile. Stinger: "The colour has not faded. If anything, it has deepened."',
    'Sour Note Symphony': 'Verbal spellcasting and any attempt at subtlety are the casualties. Ask for a check to say anything quietly. Stinger: "You open your mouth to whisper and produce a chord."',
    'Spicy Surprise': 'Poisoned for the better part of an hour — treat it as a fever they are fighting through. Stinger: "Your own blood feels like it is running hot enough to notice."',

    // ---- bludgeoning -----------------------------------------------
    'Bone Rattle': 'Permanent restrained until treated is dire — rule it as movement halved rather than immobile if that fits better, and say so. Stinger: "You can hear yourself moving. From the inside."',
    'Bruised Ego': 'Frightened is unusually apt here: the fear is of trying. Aim it at social scenes rather than combat. Stinger: "You know exactly what to say. You also know exactly how it will land."',
    'Dented Armor': 'Rule the AC loss explicitly (−1 is fair) and let them keep the dent as a badge. Stinger: "It saved your life and it will never sit right again."',
    'Pulpy Palm': 'The hand is the point: no two-handed weapons, no shield, disadvantage on anything needing grip. Stinger: "You can make a fist. You just cannot make it twice."',
    'Squishy Ears': 'Deafened plus balance — combine with difficult terrain or heights for real jeopardy. Stinger: "The room tilts a little every time you turn your head."',
    'The Leaning Warrior': 'Prone is the cost; play the lean for comedy between fights. Stinger: "You have been listing to the left for an hour and nobody has told you."',
    'The Lopsided Lifter': 'Prone plus a walking sway — good for a chase or a rooftop, harmless on flat ground. Stinger: "Your legs are no longer having the same conversation."',
    'Whacky Whiplash': 'One minute of slapstick. Ask for a check on any move that needs a straight line. Stinger: "You aimed for the door. You are near the door."',

    // ---- cold ------------------------------------------------------
    'Arctic Awakening': 'Paralyzed and permanent until treated — this removes a player from the fight entirely, so make the rescue the scene. Stinger: "You are awake. That is the only part of you that still is."',
    'Frostbitten Fingertips': 'No condition: rule fine motor work instead — lockpicking, components, knots. Stinger: "You touch the blade and feel nothing at all. That is the frightening part."',
    'Frosty Fingers': 'Restrained is a heavy read for numb hands; if it suits your table, rule dropped items on a failed check instead. Say which before they roll. Stinger: "Your grip lets go a half-second before you tell it to."',
    'Frozen Fingers': 'Prone and blue fingers — the fumbling is the flavour, the falling is the cost. Stinger: "They have gone a colour that hands should not be."',
    'Frozen Noggin': 'Pure brain freeze with no condition: rule it as no concentration and no complex plans for two minutes. Stinger: "You had it. You had the whole plan. It is gone."',
    'Icy Heart': 'Charmed and permanent — play it as emotional flatness rather than mind control, and let allies notice. Stinger: "Someone you love is speaking to you and you are simply waiting for them to finish."',
    'Slippery Slope Syndrome': 'Exhaustion 1: disadvantage on checks, and the chill makes rest poor. Stinger: "The cold got in and made itself comfortable."',
    'Slippery Slopes': 'Prone, briefly — perfect for ice, stairs, or a ship deck. Stinger: "Your feet arrive somewhere your body did not agree to."',

    // ---- fire ------------------------------------------------------
    'Fiery Footsies': 'Burning deals ongoing damage — real teeth for a minor, so keep the duration short and let them stamp it out. Stinger: "Stopping does not help. Stopping is worse."',
    'Flaming Feathered Fiasco': 'Charmed by a bird is a gift to roleplay: they will defend it, feed it, and argue for it. Stinger: "It looks at you. You have never felt so understood."',
    'Roasted Rump Injury': 'Exhaustion 1, and sitting is out of the question — good for a long ride or a formal dinner. Stinger: "You will be standing for this conversation, thank you."',
    'Singed Beard Syndrome': 'Cosmetic and charmed: the vanity is the mechanic. Let NPCs comment. Stinger: "It will grow back. Most of it. Probably."',
    'Singed Socks Syndrome': 'Blinded for half an hour is severe — consider ruling it as watering eyes with disadvantage on sight checks instead. Stinger: "The smell of your own boots is making your eyes stream."',

    // ---- force -----------------------------------------------------
    'Boop Nose': 'Deafened is a strange fit; play the distraction — concentration checks and nothing else. Stinger: "Something taps your nose. There is nothing there."',
    'Dancing Limbs': 'Stunned once, then let the limbs be a running joke that ruins one careful action. Stinger: "Your arm has plans and it did not share them."',
    'Gravity Defiance': 'Poisoned covers the mechanics; the fun is in describing rooms wrongly. Ask for checks on ledges and ladders. Stinger: "Down is somewhere over there now. It will move again shortly."',
    'Tickle Fingers': 'Prone from dropped items and flailing — target anything they try to carry carefully. Stinger: "You drop it. Nothing touched you, and you drop it."',

    // ---- general ---------------------------------------------------
    'Absurd Attraction Aura': 'Grappled by clutter: rule that objects cling, so stealth and fine work suffer. Stinger: "The cutlery on the next table is leaning towards you."',
    'Dizzying Dance Dilemma': 'Charmed by vertigo — play it as being unable to trust their own footing or judgement. Stinger: "The room finishes turning a moment after you do."',

    // ---- lightning -------------------------------------------------
    'Fried Fringe': 'Cosmetic and crackling: no stealth, and metal is a hazard. Stinger: "You keep shocking people who try to shake your hand."',
    'Shocking Bad Hair Day': 'Two minutes of static — comedy, plus advantage for anyone trying to spot them. Stinger: "You can hear yourself crackling in the quiet."',
    'Shockwave Symphony': 'Unconscious for an hour is a scene-remover. Make reaching them the encounter. Stinger: "You are still ringing, somewhere far below hearing."',
    'The Lightning Conductor': 'Permanent and stunned — this is a curse, not a wound, and it should worry the whole party in a storm. Stinger: "The air over you has started to feel interested."',
    'Thunderous Tingle': 'Stunned once, then leave the tingle as flavour. Stinger: "Your fingers have not stopped buzzing and you have started to like it."',
    'Thunderous Tinnitus': 'Deafened: no hearing-based Perception, and whispered plans do not reach them. Stinger: "Under everything, a note you cannot make stop."',
    'Zap Zap Fingers': 'No condition — rule dropped metal or fumbled components on a failed check. Stinger: "Everything metal has opinions about you now."',
    'Zapped Zest': 'No condition, deliberately: this is a comic buff-that-is-not. Let them act impulsively and pay for it socially. Stinger: "You feel fantastic. That should worry you."',

    // ---- necrotic --------------------------------------------------
    'Curse Of The Lich': 'Exhaustion 1 with a ninety-minute clock, and the laughter is the point. Repeat it, quietly, at bad moments. Stinger: "Somebody found that funny. Not you."',
    'Decaying Limb': 'Diseased and visible rot — this should frighten the party into acting. Rule the limb weak, not useless. Stinger: "The smell arrives before you do."',
    "Goblin's Gloom": 'Flavour only: play it as low spirits and heavy limbs, good for a bleak travel scene. Stinger: "Nothing hurts. Nothing much interests you either."',
    'Skeletal Sneeze': 'Harmless, loud, and terrible for hiding. Stinger: "It echoes. In a tomb, everything echoes."',
    'Soul Shredder': 'Poisoned for two hours and genuinely dark — this is the one that should make the party consider retreating. Stinger: "Something took a piece and did not eat it."',
    "Wight's Weakness": 'Exhaustion 1 — the life-drain classic. Let rest fail to fix it until treated. Stinger: "You slept eight hours and woke up owing more."',

    // ---- piercing --------------------------------------------------
    'Impaled Misery': 'Restrained and permanent until treated: they are pinned or carrying the object. Removing it is its own scene. Stinger: "Nobody wants to be the one to pull it out."',
    'Penetrating Trauma': 'No condition, so rule the depth: heavy exertion reopens it. Stinger: "It has stopped bleeding. You would not bet on that lasting."',
    'Piercing Wound': 'Small, clean, and mostly narrative. Good for a complication later rather than now. Stinger: "A neat little hole. Neat little holes are how infections start."',
    'Pinprick Of Pain': 'Poisoned covers it; the hundred-needles image is worth repeating whenever they move fast. Stinger: "It comes in waves, and the waves are getting closer together."',
    'Rogue Needle Prick': 'Deafened is an odd fit — play the absurdity straight and let it be the party\'s favourite story. Stinger: "You are bleeding cherry syrup. It even smells right."',
    'Spear In The Side': 'Prone for two hours: they cannot stay upright long. Make them choose between fighting and standing. Stinger: "You can straighten up. You will not enjoy it and you will not stay there."',
    'Stuck Like A Thistle': 'Minor and naggy — perfect for a check to sleep, ride, or wear armour. Stinger: "You have found it with your fingers three times now and it is still there."',
    "Tortle's Unlucky Jab": 'Prone for two hours, and the stretched-arm absurdity is the whole joke. Let them try to use it. Stinger: "It goes further than it used to. That is not a good thing."',

    // ---- poison ----------------------------------------------------
    'Chromatic Conundrum': 'Permanent and poisoned — the colour-shifting makes disguise and diplomacy hard until cured. Stinger: "You have gone a shade nobody has a name for."',
    'Mystical Mosquito Bites': 'No condition; play the itch — disadvantage on anything needing stillness. Stinger: "They are not healing. It has been days."',
    'Sneaky Sneeze Syndrome': 'Blinded for three minutes, triggered by sneezing — a gift for ruining stealth at the worst moment. Stinger: "You feel it building. There is nothing you can do about it."',
    'Toadstool Toenails': 'Comedy with a boot problem: rule against long marches. Stinger: "Something is growing down there and it is doing well."',
    'Toxic Toenail Trouble': 'Two minutes of nonsense — spend it during a tense moment for maximum damage. Stinger: "Your foot has started keeping time. To what, nobody knows."',
    'Venomous Hiccup Syndrom': 'Poisoned, and each hiccup is a small hazard for whoever is standing close. Stinger: "Everyone has quietly taken a step back."',
    'Venomous Vision Vertigo': 'Poisoned plus hallucination — describe rooms as crawling and let them doubt what they saw. Stinger: "The wall is moving. You are almost certain the wall is not moving."',

    // ---- psychic ---------------------------------------------------
    'Brain Fizzle': 'Flavour only: rule no concentration for three minutes. Stinger: "Your thoughts arrive out of order and slightly damp."',
    'Cerebral Backfire': 'No condition — memory is the cost. Have them forget something small and recent. Stinger: "You were about to say something important. It was right there."',
    'Cogitation Cramp': 'Two minutes of sharp pain: no planning, no lore recall. Stinger: "Thinking hurts, so you stop, and then it hurts anyway."',
    "Mindbender's Migraine": 'Light and noise are unbearable — deny them torch-side or the front rank. Stinger: "Someone lights a lamp and you feel it behind your eyes."',
    'Mindquake Madness': 'Three minutes of scrambled thinking; let them mishear an instruction with consequences. Stinger: "Everything you know is still there. It is just not in order."',
    'Psionic Echoes': 'Ninety seconds of distance from their own mind — good for a creepy beat, not a fight. Stinger: "Your thoughts sound like someone else saying them in the next room."',
    'Psionic Feedback': 'Sharp pain behind the eyes: rule against concentration and reading. Stinger: "Every time you focus on something, it pushes back."',
    'Psionic Meltdown': 'Stunned and permanent until treated — the most serious psychic result. Play it as a mind that needs rebuilding. Stinger: "The lights are on. Nobody has come to the door in a while."',
    'Spiritual Static': 'Two minutes of interference — perfect for interrupting a ritual or a telepathic ally. Stinger: "Somewhere under your own thoughts, something else is almost audible."',

    // ---- radiant ---------------------------------------------------
    'Blinding Euphoria': 'Blinded for a minute, and the euphoria makes them enjoy it — which is its own problem. Stinger: "You cannot see a thing and you have never felt better about it."',
    'Celestial Bruising': 'Cosmetic and glowing: no stealth, and everyone can see where they were hit. Stinger: "The bruises pulse, slowly, like something inside is keeping time."',
    'Celestial Shimmer': 'They are a light source for fifteen minutes. Rule out hiding entirely. Stinger: "You are the brightest thing in the room and you cannot turn it off."',
    'Celestial Sunburn': 'Prone plus tender skin — armour becomes miserable. Stinger: "Everything you wear is now an argument."',
    'Cherubic Sunburn': 'A minute of harmless glow; pure comedy. Stinger: "You are pink, radiant, and faintly holy. It is not a good look."',
    'Heavenly Glare': 'Charmed by the light itself — play it as reverence they cannot shake. Stinger: "You keep turning back towards it, and you could not say why."',
    'Lightburn': 'Deafened is an odd pairing; lean on the warm glow instead and rule out stealth. Stinger: "The skin there is hot to the touch and getting brighter."',
    'Luminous Wrath': 'Exhaustion 1 for an hour, with a glow that gives away the whole party. Stinger: "You are lit up like a signal fire, and something is looking for you."',

    // ---- slashing --------------------------------------------------
    'Gnash Wound': 'Bleeding does the damage; the trail does the drama — trackers and predators find them easily. Stinger: "It keeps opening. Every time you think it has stopped, it opens."',
    'Lacerating Wound': 'Exhaustion 1 from blood loss — a slow, grinding cost rather than a spike. Stinger: "You are getting tired in a way that sleep will not fix."',
    'Paper Cut From Hell': 'Trivially small and disproportionately awful. Pure comedy; use it for a failed check at a dignified moment. Stinger: "It is barely a line. You have never felt anything like it."',
    'Partially Severed Ligament': 'Restrained reads as a leg that will not answer — rule movement halved if that suits better. Stinger: "It holds. Then it does not, and you learn which one you are getting."',
    'Tickle Of The Blade': 'Prone from flinching — harmless, undignified, and good for a duel. Stinger: "Something drew a line across you and you did not feel it cut."',
    'Whistle Wound': 'A minute of noise: stealth is impossible and speech is comic. Stinger: "You take a breath and the wound takes one with you."',

    // ---- thunder ---------------------------------------------------
    'Ear-ringer': 'Deafened for five minutes — enough to miss the plan and act on the wrong one. Stinger: "Everyone else heard it. You watch them react and guess."',
    'Ear-ringing Shockwave': 'Deafened for ten: coordinate nothing, hear no warnings. Stinger: "The world has gone underwater and stayed there."',
    'Ear-shattering Boom': 'Deafened, and the resonance makes them slow to react. Stinger: "You feel the next one in your teeth before you hear it."',
    'Eardrum Rupture': 'Deafened with real injury behind it — this one wants treatment, not time. Stinger: "There is warmth running out of your ear and you know what that means."',
    'Roaring Thunderclap': 'Blinded and permanent until treated: the most severe thunder result, and it removes them from ranged combat entirely. Stinger: "The flash is still there when you close your eyes. It has not faded once."',
    'Thunderstruck': 'No condition — play the ten minutes as jangled nerves and unsteady hands. Stinger: "Your whole body is still humming with somebody else\'s energy."'
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
console.log(`Run guidance batch 2: ${added} added`);
if (unmatched.length) console.log(`  ! no record matched: ${unmatched.join(', ')}`);
console.log(`Coverage: ${authored}/${records.length}`);
const missing = records.filter((r) => !r.gmnotes).map((r) => `${r.category}/${r.title}`);
if (missing.length) console.log(`Still missing:\n  ${missing.join('\n  ')}`);
