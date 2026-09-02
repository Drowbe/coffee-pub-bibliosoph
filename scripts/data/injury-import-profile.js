// ==================================================================
// ===== INJURY IMPORT PROFILE (data/injury-import-profile.js) =======
// ==================================================================
// The declaration Blacksmith's JSON importer uses to build our injury
// pages. Registered through api.importer.registerDeclaration; Blacksmith
// constructs the document and stamps the subtype, we own the schema.
//
// THE MACHINE SHAPE IS NOT WRITTEN HERE. Field names, types, bounds,
// enums, defaults and nullability are DERIVED from InjuryPageModel by
// Blacksmith's `declarationFromModel`, which walks defineSchema(). This
// file supplies only what a schema cannot express: the human layer
// (guidance and examples), the page name mapping, and the document block.
//
// WHY THE WALK RATHER THAN A HAND LIST. Foundry runs the model's schema
// against whatever the importer creates, so the model is the validator
// and a declaration is only a description of it. A hand list can fall
// behind the model, and the failure is silent in the worst way: a
// seventeenth model field that never appears in the declaration imports
// silently defaulted, and nobody knows it is missing. Enums were never
// the risk here -- they were already imported from injury-schema.js --
// but the field SET cannot self-heal, and that is the part the walk fixes.
//
// WHAT STILL NEEDS WATCHING. The walk makes the machine shape free, which
// makes the human layer the only thing left to forget: a new model field
// now appears automatically carrying no guidance. tools/verify-injury-
// profile.mjs fails the build on exactly that, so a field added to the
// model goes from silently absent to loudly undocumented.
//
// See documentation/architecture/architecture-injuries.md.
// ==================================================================

import { MODULE } from '../const.js';
import {
    SEVERITIES, DAMAGE_BANDS, TICK_BANDS, ODDS_BANDS,
    MODIFIER_LIMITS, MODIFIER_STAT_KEYS, SEVERITY_DCS, MODIFIER_STATS
} from './injury-schema.js';
import { INJURY_PAGE_TYPE, InjuryPageModel } from './injury-page-model.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INJURY IMPORT | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INJURY IMPORT | ${message}`, data);
    }
}

/** Render a band as prose for the guidance line: [0, 5] -> "0–5". */
const band = (b) => (b ? `${b[0]}–${b[1]}` : '');

/** Every severity's band for one field: "0–5 for minor, 6–10 for moderate, 11–18 for major". */
const bandsBySeverity = (bands) => SEVERITIES.map((s) => `${band(bands[s])} for ${s}`).join(', ');

/**
 * ONE SENTENCE PER FIELD, keyed by dotted path within the model.
 *
 * By contract this is one sentence: it feeds the template comment, the
 * guide line and the generation prompt alike, so a paragraph in any of
 * them is a Blacksmith-side change rather than something to smuggle past
 * with semicolons.
 *
 * The severity-scoped bands live HERE rather than as declared bounds.
 * They are advisory by design -- InjuryPageModel surfaces them through
 * its `warnings` getter without blocking a save -- so declaring them as
 * hard import bounds would reject data our own sheet accepts, which is
 * the import path and the editing path disagreeing over identical data.
 * The warnings still fire on an imported page, because they are computed
 * on the model rather than at import.
 */
export const INJURY_GUIDANCE = {
    category: 'The damage type this injury belongs to, where `general` is the fallback for untyped or evenly mixed damage.',
    severity: `How bad the wound is, which sets the treatment DC (${SEVERITIES.map((s) => `${s} ${SEVERITY_DCS[s]}`).join(', ')}) and the sensible range for damage, tick and modifiers.`,
    image: "Path to the injury's art, shown on the chat card and the token effect.",
    imagetitle: 'A short evocative caption shown beneath the art on the chat card.',
    description: 'The narrative of the wound, written in second person.',
    treatment: 'How the injury may be treated, written as the GM will adjudicate it.',
    damage: `One-time HP lost when the injury lands, as a PERCENTAGE of maximum HP rather than flat HP, and normally ${bandsBySeverity(DAMAGE_BANDS)}.`,
    duration: 'How long the injury lasts in seconds, where 0 means permanent until treated.',
    statuseffect: 'The single condition the injury conveys, or `none` when it is purely narrative — the empty string is not a legal value.',
    odds: `Relative likelihood within the category when an injury is drawn at random, higher being more common, and normally ${bandsBySeverity(ODDS_BANDS)}.`,
    treatmentdc: 'Overrides the severity-derived treatment DC, and should be left null so the severity ladder applies.',
    modifiers: `Roll penalties applied as real active-effect changes, at most ${MODIFIER_LIMITS.maxCount} of them, and no larger than ${SEVERITIES.map((s) => `±${MODIFIER_LIMITS.bySeverity[s]} for ${s}`).join(', ')}.`,
    'modifiers.stat': `Which roll the modifier applies to (${MODIFIER_STAT_KEYS.map((k) => MODIFIER_STATS[k]?.label ?? k).join(', ')}).`,
    'modifiers.value': 'The bonus or penalty applied to that roll, negative for a penalty.',
    'modifiers.rounds': 'How many rounds the modifier lasts, where 0 means it lasts as long as the injury does.',
    tick: `Recurring damage at the start of each of the victim's turns as a PERCENTAGE of maximum HP, 0 for the vast majority, and normally ${bandsBySeverity(TICK_BANDS)}.`,
    expiry: 'What happens when the duration runs out, where `heal` removes the injury and `linger` stops the ticking and penalties but leaves it to be treated.',
    flavor: 'Flavour-only status text for a wound whose condition is not a real dnd5e condition, ignored whenever statuseffect is anything other than `none`.',
    gmnotes: 'Shipped guidance on running the injury at the table, which versions with the injury rather than belonging to one GM.'
};

/**
 * Template values, keyed by dotted path.
 *
 * Deliberately nothing for `modifiers`: an explicit example on an array
 * field overrides the worked element derived from its nested shape, which
 * is worse for an author than the derived one.
 */
export const INJURY_EXAMPLES = {
    image: `modules/${MODULE.ID}/images/injuries/burn-severe.webp`,
    damage: 4,
    duration: 3600
};

/**
 * What the model cannot express: the injury's title is the page NAME, and
 * is never stored twice. `path: 'name'` is a page-level path rather than a
 * system one, which is why it cannot come from a schema walk.
 */
export const INJURY_EXTRA_FIELDS = [
    {
        // HOW A PAYLOAD REACHES THIS PROFILE AT ALL. The journal kind routes
        // on a `role: 'selector'` field: `declaredProfileFor` lowercases the
        // payload's `journaltype` and looks up the registered profile by it.
        // Without this field the key is undeclared -- absent from the
        // template, the guide and the generation prompt, and reported as
        // unknown on import.
        //
        // Registration does NOT catch its absence. It rejects two selectors,
        // and rejects a `values` list that omits the profile's own id, but a
        // profile with no selector registers clean and fails at import. So
        // `values` must stay in step with the declaration's `id` below, and
        // tools/verify-injury-profile.mjs asserts both.
        //
        // Not derivable: `journaltype` is an import-payload discriminator and
        // is deliberately absent from InjuryPageModel and from
        // resources/injuries.json, which validate-injuries.mjs would reject
        // it in. Required at the import boundary, forbidden at the authoring
        // boundary, for the same data.
        name: 'journaltype',
        role: 'selector',
        type: 'string',
        values: ['injury'],
        example: 'injury',
        guidance: 'Identifies the profile, and must be exactly "injury".'
    },
    {
        name: 'title',
        path: 'name',
        type: 'string',
        required: true,
        example: 'Seared Corneas',
        guidance: 'The name of the injury, which becomes the page title.'
    }
];

/**
 * This profile builds a PAGE, not an entry: the declared fields ARE the
 * page. Declaring `JournalEntry` instead produces an entry named after the
 * injury, carrying a stray `system` object, and NO PAGES AT ALL -- which
 * imports "successfully" and yields nothing the picker can see.
 */
export const INJURY_DOCUMENT = {
    documentName: 'JournalEntryPage',
    type: INJURY_PAGE_TYPE,
    // Required on a page-building profile: a page with nowhere to go is
    // built correctly, lands nowhere, and reports success.
    containerNameFrom: 'category',
    // The page's `system.category` stays lowercase `fire` -- that is the
    // enum and nothing may touch it. The journal NAME is a display string.
    // One vocabulary, two representations; untransformed would give a world
    // two journals per category, the shipped `Fire` and an imported `fire`.
    //
    // `sentenceCase` uppercases the first character and leaves the rest
    // UNTOUCHED, which is `displayCategory` exactly. `titleCase` would agree
    // on all fourteen categories today and diverge on the first value with
    // an interior capital -- agreement by one-word luck, not construction.
    containerNameTransform: 'sentenceCase'
};

/**
 * Build the declaration.
 *
 * `declarationFromModel` is INJECTED rather than imported, because this
 * module is loaded two ways: by Foundry at runtime, where Blacksmith is a
 * live module, and by tools/verify-injury-profile.mjs in Node, where it is
 * a sibling directory on disk. An import would have to be one or the
 * other, and a build gate that cannot run without the runtime it is
 * gating is not much of a gate.
 *
 * @param {Function} declarationFromModel Blacksmith's schema walk
 * @returns {object} the declaration to register
 */
export function buildInjuryDeclaration(declarationFromModel) {
    if (typeof declarationFromModel !== 'function') {
        throw new TypeError('buildInjuryDeclaration requires Blacksmith\'s declarationFromModel');
    }
    return declarationFromModel(InjuryPageModel.defineSchema(), {
        kind: 'journal',
        id: 'injury',
        label: 'Injury',
        module: MODULE.ID,
        document: INJURY_DOCUMENT,
        guidance: INJURY_GUIDANCE,
        examples: INJURY_EXAMPLES,
        extraFields: INJURY_EXTRA_FIELDS,
        derive: [],
        rules: []
    });
}

/**
 * Register with Blacksmith's importer. Guarded at every level because the
 * importer API is newer than this module's minimum Blacksmith: an older
 * Blacksmith simply does not offer injuries in its import tool, which is
 * the correct degradation rather than an error.
 */
export function registerInjuryImportProfile() {
    const importer = game.modules.get('coffee-pub-blacksmith')?.api?.importer;
    if (typeof importer?.registerDeclaration !== 'function' || typeof importer?.declarationFromModel !== 'function') {
        log('Blacksmith importer API not available; injury import profile not registered', '', true, false);
        return false;
    }
    try {
        importer.registerDeclaration(buildInjuryDeclaration(importer.declarationFromModel));
        log('Injury import profile registered with Blacksmith', '', false, false);
        return true;
    } catch (error) {
        // registerDeclaration throws at REGISTRATION naming the offending
        // field, so this message is actionable rather than a mystery.
        log('Injury import profile rejected by Blacksmith', error, false, true);
        return false;
    }
}
