// ==================================================================
// ===== OUTCOME IMPORT PROFILES (data/outcome-import-profile.js) ====
// ==================================================================
// The declarations Blacksmith's JSON importer uses to build our critical
// and fumble pages. Registered through api.importer.registerDeclaration;
// Blacksmith constructs the document and stamps the subtype, we own the
// schema. Same seam as injuries, and the same rules apply: the machine
// shape is DERIVED from OutcomePageModel by declarationFromModel, and
// this file supplies only what a schema cannot express.
//
// TWO PROFILES, ONE MODEL. Criticals and fumbles share
// `coffee-pub-bibliosoph.outcome`, and they register separately rather
// than as one profile with an authored `kind`. Three reasons, in order
// of how much they matter:
//
//   1. `kind` becomes a `const` per profile, so it cannot be authored or
//      mistyped. One profile would leave it ordinary data, and a payload
//      could say `crit` while carrying fumble semantics with nothing to
//      catch it.
//   2. It halves the container problem. With `kind` fixed, the journal
//      name depends on `severity` alone, which is one field and one
//      lookup rather than a function of two.
//   3. Guidance is one sentence by contract. A single profile would have
//      to name all six bucket labels in it; two profiles name three each,
//      in the author's own vocabulary.
//
// THE CONTAINER NAMES ARE NOT STORED ANYWHERE. `system.severity` is
// minor/moderate/major and the journals are Butchery, Carnage, Slaughter
// and Meek, Nasty, Devastating. That mapping lives in SEVERITY_LABELS
// and reaches Blacksmith as `containerNameMap` -- module-owned data
// carried by a Blacksmith-owned mechanism, so it stays ignorant of what
// a crit is while still being able to check the map is complete.
//
// See documentation/architecture/architecture-outcomes.md.
// ==================================================================

import { MODULE } from '../const.js';
import {
    KINDS, SEVERITIES, SEVERITY_LABELS, TARGETS, TARGET_LABELS,
    MODIFIER_STATS, PICKS_MAX,
    DAMAGE_BANDS, DURATION_BANDS, ODDS_BANDS
} from './outcome-schema.js';
import { OUTCOME_PAGE_TYPE, OutcomePageModel } from './outcome-page-model.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `OUTCOME IMPORT | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | OUTCOME IMPORT | ${message}`, data);
    }
}

const band = (b) => (b ? `${b[0]}-${b[1]}` : '');
const bandsBySeverity = (bands) => SEVERITIES.map((s) => `${band(bands[s])} for ${s}`).join(', ');
const statList = Object.keys(MODIFIER_STATS).map((k) => MODIFIER_STATS[k]?.label ?? k).join(', ');
const targetList = TARGETS.map((t) => `${t} (${TARGET_LABELS[t]})`).join(', ');

/**
 * One sentence per field, keyed by dotted path.
 *
 * By contract this is ONE sentence: it feeds the template comment, the
 * guide line and the generation prompt alike. `kind` is absent because
 * each profile declares it as a const the author never writes.
 *
 * Shared by both profiles except for `severity`, which names the bucket
 * labels of the kind it belongs to and is built per profile below.
 */
const SHARED_GUIDANCE = {
    appliesto: `Who the outcome lands on, one of ${targetList}.`,
    picks: `How many separate people the card asks the GM to choose, which only means anything for ally and is at most ${PICKS_MAX}.`,
    image: 'Always set this to a Foundry core icon path matching the outcome, such as icons/skills/melee/strike-sword-blood-red.webp, since an empty value ships a card with no art.',
    imagetitle: 'A short evocative caption shown beneath the art.',
    description: 'What happens, written in second person and read aloud at the table.',
    damage: `Flat hit points gained or lost when the outcome is applied, normally ${bandsBySeverity(DAMAGE_BANDS)}.`,
    duration: `How long any condition and modifiers last in seconds, where 0 is instantaneous, normally ${bandsBySeverity(DURATION_BANDS)}.`,
    statuseffect: `The single condition the outcome conveys, or \`none\` when it is purely narrative, since the empty string is not a legal value.`,
    odds: `Relative likelihood within the bucket when one is drawn at random, higher being more common, normally ${bandsBySeverity(ODDS_BANDS)}.`,
    modifiers: 'Roll modifiers applied as real active-effect changes, kept to a couple of small ones so the card stays readable at the table.',
    'modifiers.stat': `Which roll the modifier applies to (${statList}).`,
    'modifiers.value': 'The bonus or penalty applied to that roll, negative for a penalty.',
    'modifiers.rounds': 'How many rounds the modifier lasts, where 0 means it lasts as long as the outcome does.',
    dealscard: 'True when the outcome hands somebody a card from the inspiration deck instead of applying a status.',
    gmnotes: 'Shipped guidance on running the outcome at the table, which versions with the outcome rather than belonging to one GM.'
};

const SHARED_EXAMPLES = {
    image: 'icons/skills/melee/strike-sword-blood-red.webp',
    damage: 0,
    duration: 12,
    odds: 20
};

/** The bucket labels for one kind, as a "Butchery, Carnage or Slaughter" phrase. */
const labelPhrase = (kind) => {
    const names = SEVERITIES.map((s) => SEVERITY_LABELS[kind][s]);
    return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
};

/** severity -> journal name, for one kind. This is the whole container rule. */
const containerMap = (kind) =>
    Object.fromEntries(SEVERITIES.map((s) => [s, SEVERITY_LABELS[kind][s]]));

/**
 * Fields with no counterpart in OutcomePageModel.
 *
 * Each registers cleanly and then fails quietly if omitted, which is why
 * they are spelled out rather than left to be rediscovered: no selector
 * and the profile is unreachable, no foldername and every import lands at
 * the root of the journal directory, no title mapping and pages import
 * untitled.
 */
const extraFields = (profileId, kind) => [
    {
        // How a payload reaches this profile at all: the journal kind
        // routes on `role: 'selector'`, matching the lowercased value
        // against the registered profile id.
        name: 'journaltype',
        role: 'selector',
        type: 'string',
        values: [profileId],
        example: profileId,
        guidance: `Identifies the profile, and must be exactly "${profileId}".`
    },
    {
        // NOT AUTHORED. A const is stamped after construction and the
        // author never writes it, which is the point: one profile with an
        // authored `kind` would let a payload claim to be a crit while
        // carrying fumble semantics, and nothing would catch it.
        name: 'kind',
        const: kind,
        path: 'system.kind',
        type: 'string',
        guidance: `Always "${kind}" for this profile, stamped rather than authored.`
    },
    {
        name: 'foldername',
        role: 'input',
        type: 'string',
        default: '',
        example: profileId === 'critical' ? 'Criticals' : 'Fumbles',
        guidance: 'The Journal folder to file this outcome under, created if it does not exist, and root if omitted.'
    },
    {
        name: 'title',
        path: 'name',
        type: 'string',
        required: true,
        example: profileId === 'critical' ? 'Carnage Incarnate' : 'Gaseous Maximus',
        guidance: 'The name of the outcome, which becomes the page title.'
    }
];

/**
 * What the prompt asks the author, keyed by `id`; answers reach
 * `onBuildPrompt` in `promptOptions`.
 *
 * Options derive from the schema rather than being listed, so a value
 * added to SEVERITIES appears here without anyone remembering to.
 */
const promptFields = (kind) => [
    {
        id: 'severity',
        label: 'Bucket',
        inputType: 'select',
        options: SEVERITIES.map((value) => ({ value, label: SEVERITY_LABELS[kind][value] })),
        value: 'moderate',
        // Fixing it collapses every band above from a conditional range
        // into one the generator can actually hit, and it decides which
        // journal the pages are filed into.
        hint: 'Which bucket the generated outcomes belong to, which also decides the journal they are filed into.'
    },
    {
        id: 'count',
        label: 'How many',
        value: '10',
        hint: 'How many outcomes to generate in one pass.'
    }
];

/**
 * Build one outcome declaration.
 *
 * `declarationFromModel` is INJECTED rather than imported for the same
 * reason the injury profile injects it: this module is loaded by Foundry
 * at runtime, where Blacksmith is a live module, and by the build gate in
 * Node, where it is a sibling directory on disk.
 *
 * @param {Function} declarationFromModel Blacksmith's schema walk
 * @param {'critical'|'fumble'} profileId
 * @returns {object} the declaration to register
 */
export function buildOutcomeDeclaration(declarationFromModel, profileId) {
    if (typeof declarationFromModel !== 'function') {
        throw new TypeError('buildOutcomeDeclaration requires Blacksmith\'s declarationFromModel');
    }
    const kind = profileId === 'critical' ? 'crit' : 'fumble';
    if (!KINDS.includes(kind)) throw new Error(`Unknown outcome profile "${profileId}"`);

    // `kind` IS WITHHELD FROM THE WALK, not overridden after it. Blacksmith
    // concatenates extraFields onto the derived ones and rejects a duplicate
    // name at registration, so declaring the const while the walk also emits
    // the model's authored `kind` fails with "duplicate field name". Taking it
    // out of the schema first is what makes the const the only declaration of
    // it, which is the whole point: the author never writes this field.
    const { kind: _authoredKind, ...schema } = OutcomePageModel.defineSchema();

    return declarationFromModel(schema, {
        kind: 'journal',
        id: profileId,
        label: profileId === 'critical' ? 'Critical Hit' : 'Fumble',
        module: MODULE.ID,
        document: {
            documentName: 'JournalEntryPage',
            type: OUTCOME_PAGE_TYPE,
            containerNameFrom: 'severity',
            // A LOOKUP, not a transform. The journal names are not a
            // casing of the stored value and are not derivable from it:
            // `minor` is Butchery for a crit and Meek for a fumble.
            containerNameMap: containerMap(kind)
        },
        guidance: {
            ...SHARED_GUIDANCE,
            severity: `How severe the outcome is, which decides the journal it is filed under (${labelPhrase(kind)}) and bounds its damage, duration and odds.`
        },
        examples: SHARED_EXAMPLES,
        extraFields: extraFields(profileId, kind),
        promptFields: promptFields(kind),
        derive: [],
        rules: []
    });
}

/**
 * Register both outcome profiles with Blacksmith's importer.
 *
 * Guarded the same way injuries are: an older Blacksmith simply does not
 * offer criticals and fumbles in its import tool, which is the correct
 * degradation rather than an error.
 *
 * @returns {boolean} true when both registered
 */
export function registerOutcomeImportProfiles() {
    const importer = game.modules.get('coffee-pub-blacksmith')?.api?.importer;
    if (typeof importer?.registerDeclaration !== 'function' || typeof importer?.declarationFromModel !== 'function') {
        log('Blacksmith importer API not available; outcome import profiles not registered', '', true, false);
        return false;
    }
    let ok = true;
    for (const profileId of ['critical', 'fumble']) {
        try {
            importer.registerDeclaration(buildOutcomeDeclaration(importer.declarationFromModel, profileId));
            log(`${profileId} import profile registered with Blacksmith`, '', false, false);
        } catch (error) {
            // registerDeclaration throws naming the offending field, so
            // this message is actionable rather than a mystery.
            log(`${profileId} import profile rejected by Blacksmith`, error, false, true);
            ok = false;
        }
    }
    return ok;
}
