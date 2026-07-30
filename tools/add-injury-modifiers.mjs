// ==================================================================
// ===== INJURY MODIFIERS (tools/add-injury-modifiers.mjs) ===========
// ==================================================================
// Give injuries mechanical teeth: roll modifiers that apply as real
// ActiveEffect changes, so a mangled hand actually costs you the attack
// roll instead of only saying so in prose.
//
//   node tools/add-injury-modifiers.mjs           report only
//   node tools/add-injury-modifiers.mjs --write   apply
//
// Idempotent: an injury that already has modifiers is never touched, so
// hand-authored values survive every rerun. Delete an injury's modifiers
// array to have it re-derived.
//
// HOW THE RULES WORK
// Each rule matches the injury's own words and proposes the penalty that
// wound would actually impose. Order matters: the FIRST rule that matches
// wins, so specific body parts beat generic pain. Size comes from the
// severity cap, never from the rule, so a scratch can never carry a -5.
//
// Deliberately conservative. An injury whose prose implies no mechanical
// penalty — a scar, a smell, a bad dream — correctly gets nothing, and
// the "story only" count in the report is a feature rather than a miss.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODIFIER_LIMITS } from './injury-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const WRITE = process.argv.includes('--write');

/**
 * stats: which rolls this wound touches, in priority order.
 * A rule may name several; each becomes its own modifier, capped by
 * severity and trimmed to MODIFIER_LIMITS.maxCount.
 */
const RULES = [
    {
        // First, because a severed limb must never fall through to
        // "distracting pain" and come out as -1 to checks.
        why: 'severed / amputated',
        test: /\b(sever|severed|amputat|ligament|tendon|dismember|gaping void|lost (a |your )?(limb|arm|hand|leg))/i,
        stats: ['attack', 'ac', 'checks']
    },
    {
        why: 'blood loss',
        test: /\b(bleed|bleeding|blood|h(a)?emorrhag|crimson|exsanguin|won'?t stop bleeding)/i,
        stats: ['checks', 'saves']
    },
    {
        why: 'psychic / mental',
        test: /\b(psychic|psionic|mental|thoughts|scrambled|lapse|mind reels|telepath|cerebral)/i,
        stats: ['saves', 'checks']
    },
    {
        why: 'soul / vitality drained',
        test: /\b(soul|spirit|vitality|life force|drain|eroded|erosion|withering|necrotic)/i,
        stats: ['saves', 'checks']
    },
    {
        why: 'fragile / vulnerable',
        test: /\b(fragile|brittle|vulnerab|thin as|easily (hurt|broken)|defenceless|defenseless)/i,
        stats: ['ac']
    },
    {
        why: 'weapon hand / grip',
        test: /\b(hand|finger|thumb|grip|gripping|wrist|palm|knuckle|hold(ing)? onto|drop(ping)? (your|things))/i,
        stats: ['attack', 'damage']
    },
    {
        why: 'arm / shoulder',
        test: /\b(arm|shoulder|elbow|bicep|forearm)/i,
        stats: ['attack', 'damage']
    },
    {
        why: 'sight',
        test: /\b(blind|blinded|blurr|vision|eyesight|can'?t see|cannot see|sight)/i,
        stats: ['attack', 'checks']
    },
    {
        why: 'hearing',
        test: /\b(deaf|hearing|ringing|tinnitus|muffled)/i,
        stats: ['checks']
    },
    {
        why: 'head / concussion',
        test: /\b(concuss|skull|cranial|dizz|vertigo|disorient|reel|woozy|addl|foggy|fog\b)/i,
        stats: ['checks', 'saves']
    },
    {
        why: 'mind / fear',
        test: /\b(terror|panic|dread|halluc|nightmare|paranoi|despair|madness)/i,
        stats: ['saves', 'checks']
    },
    {
        why: 'legs / footing',
        test: /\b(leg|knee|ankle|foot|feet|hip|thigh|shin|limp|hobbl|stagger)/i,
        stats: ['ac', 'checks']
    },
    {
        why: 'ribs / breathing',
        test: /\b(rib|lung|breath|breathing|winded|wheez|gasp|chest|diaphragm)/i,
        stats: ['checks', 'saves']
    },
    {
        why: 'nerve / tremor / weakness',
        test: /\b(tremor|twitch|spasm|shak(e|ing|y)|numb|weaken|weakness|palsy|convuls)/i,
        stats: ['attack', 'checks']
    },
    {
        why: 'burn / raw skin',
        test: /\b(burn|burnt|blister|scald|sear|charred|raw skin|flay)/i,
        stats: ['checks']
    },
    {
        why: 'poison / sickness',
        test: /\b(nause|vomit|sick|fever|venom|toxin|poison|queas)/i,
        stats: ['saves', 'checks']
    },
    {
        why: 'balance / unsteady',
        test: /\b(balance|off-?balance|unsteady|stumbl|wobbl|lean(ing)? to|totter|sway|topple|trip|stand up straight|standing up|jittery)/i,
        stats: ['ac', 'checks']
    },
    {
        why: 'concentration / distraction',
        test: /\b(concentrat|focus|distract|irritat|itch|preoccup|can'?t think|cannot think)/i,
        stats: ['checks', 'saves']
    },
    {
        why: 'sluggish / stiff',
        test: /\b(sluggish|slow(er|ed)?\b|stiff|rigid|leaden|heavy limbs|frozen|frigid|chill)/i,
        stats: ['ac', 'checks']
    },
    {
        why: 'voice / speech',
        test: /\b(voice|speak|speech|hoarse|throat|croak|stammer|mute)/i,
        stats: ['checks']
    },
    {
        why: 'unpredictable outburst',
        test: /\b(sneeze|hiccup|uncontroll|random(ly)?|involuntar|spontaneous|at awkward|unexpected moments)/i,
        stats: ['checks']
    },
    {
        why: 'distracting pain',
        test: /\b(agon|excruciat|searing pain|stabbing pain|unbearable|throb|ache|aching|sore|discomfort|tender|pain|hurts?|joint|muscle|welt)/i,
        stats: ['checks']
    }
];

/**
 * Prose that explicitly says the injury does nothing mechanical. A rule
 * further down should not be allowed to contradict the author, so these
 * short-circuit to no modifiers regardless of what else matches.
 */
const HARMLESS = /\b(harmless|purely cosmetic|no lasting|no real (harm|effect)|only cosmetic|cosmetic only)/i;

/** Penalty size for a severity — never bigger than the schema allows. */
const SIZE = { minor: 1, moderate: 2, major: 3 };

function deriveModifiers(rec) {
    const text = `${rec.title ?? ''} ${rec.description ?? ''} ${rec.treatment ?? ''}`;
    const severity = String(rec.severity ?? 'minor');
    const cap = MODIFIER_LIMITS.bySeverity[severity] ?? 1;
    const size = Math.min(SIZE[severity] ?? 1, cap);

    if (HARMLESS.test(text)) return { modifiers: [], why: 'author says harmless' };

    const rule = RULES.find((r) => r.test.test(text));
    if (!rule) return { modifiers: [], why: null };

    // The primary stat takes the full penalty; a secondary one takes half
    // (rounded down, minimum 1) so a single wound does not read as two
    // separate ones stacked.
    const modifiers = rule.stats.slice(0, MODIFIER_LIMITS.maxCount).map((stat, index) => ({
        stat,
        value: -(index === 0 ? size : Math.max(1, Math.floor(size / 2))),
        rounds: 0          // lasts as long as the injury does
    }));
    // A minor injury gets ONE penalty. Two small ones is bookkeeping
    // without weight, and minor injuries are the common case.
    return { modifiers: severity === 'minor' ? modifiers.slice(0, 1) : modifiers, why: rule.why };
}

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const records = Array.isArray(raw) ? raw : (raw.injuries ?? []);

let added = 0;
let kept = 0;
let storyOnly = 0;
const byRule = {};
const bySeverity = { minor: 0, moderate: 0, major: 0 };
const samples = [];

for (const rec of records) {
    if (Array.isArray(rec.modifiers) && rec.modifiers.length) { kept++; continue; }

    const { modifiers, why } = deriveModifiers(rec);
    if (!modifiers.length) { storyOnly++; continue; }

    rec.modifiers = modifiers;
    added++;
    byRule[why] = (byRule[why] ?? 0) + 1;
    bySeverity[rec.severity] = (bySeverity[rec.severity] ?? 0) + 1;
    if (samples.length < 14) {
        samples.push(`${rec.severity.padEnd(9)} ${rec.title.padEnd(30)} ${why.padEnd(24)} ${modifiers.map((m) => `${m.value} ${m.stat}`).join(', ')}`);
    }
}

console.log('Injury roll modifiers');
console.log(`  authored: ${added}   already had some: ${kept}   story only (no penalty implied): ${storyOnly}   total: ${records.length}`);
console.log(`  by severity: ${Object.entries(bySeverity).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log('\n  by rule:');
for (const [why, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${why}`);
}
console.log('\n  samples:');
for (const line of samples) console.log(`    ${line}`);

if (WRITE) {
    fs.writeFileSync(SOURCE, `${JSON.stringify(raw, null, 4)}\n`, 'utf8');
    console.log(`\n  WROTE ${SOURCE}`);
} else {
    console.log('\n  (dry run — pass --write to apply)');
}
