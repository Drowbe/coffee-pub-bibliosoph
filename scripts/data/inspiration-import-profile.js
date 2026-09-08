// ==================================================================
// ===== INSPIRATION IMPORT PROFILE =================================
// ===== (data/inspiration-import-profile.js) =======================
// ==================================================================
// The declaration Blacksmith's JSON importer uses to build our
// inspiration card pages. Registered through
// api.importer.registerDeclaration; the machine shape is DERIVED from
// InspirationPageModel by declarationFromModel, and this file supplies
// only what a schema cannot express.
//
// A CONSTANT CONTAINER, not a derived one. Injuries file into one
// journal per damage type and outcomes into one per bucket, so both name
// a field to read. The whole deck lives in a single journal called
// "Inspiration Cards", and the model has no category-like field at all
// -- so `containerName` states the name outright. Without it
// `containerNameFrom` would be required and there is nothing to point it
// at, which is what made this profile unwritable before Blacksmith
// added the constant form.
//
// See documentation/architecture/architecture-inspiration.md.
// ==================================================================

import { MODULE } from '../const.js';
import { ACTIONS, ACTION_KEYS } from './inspiration-schema.js';
import { INSPIRATION_PAGE_TYPE, InspirationPageModel } from './inspiration-page-model.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INSPIRATION IMPORT | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INSPIRATION IMPORT | ${message}`, data);
    }
}

/** The journal the whole deck lives in. One deck, one container. */
export const INSPIRATION_CONTAINER = 'Inspiration Cards';

const actionList = ACTION_KEYS.map((k) => `${k} (${ACTIONS[k]?.label ?? k})`).join(', ');

/**
 * One sentence per field, keyed by dotted path. By contract this is ONE
 * sentence: it feeds the template comment, the guide line and the
 * generation prompt alike.
 */
export const INSPIRATION_GUIDANCE = {
    imagetitle: 'A short evocative caption shown beneath the art.',
    description: 'What the card does, written for the player who holds it and read aloud when it is played.',
    odds: 'Relative likelihood when a card is drawn at random, higher being more common.',
    action: `The automatable state change this card performs, or \`none\` for a card the table resolves by talking (${actionList}).`,
    actionamount: 'The number the action needs, such as the hit points setHp restores, and null for actions that take none.',
    actionformula: 'The dice expression an action needs, such as "1d10*10" for percentDamage, and empty for actions that take none.',
    gmnotes: 'Shipped guidance on running the card at the table, which versions with the card rather than belonging to one GM.'
};

export const INSPIRATION_EXAMPLES = {
    image: 'icons/magic/life/heart-glowing-red.webp',
    odds: 10,
    action: 'none'
};

/**
 * Fields with no counterpart in InspirationPageModel.
 *
 * `foldername` is here for the same reason it is on the other profiles:
 * without it every import lands at the root of the journal directory,
 * beside whatever the GM has organised, because destination matching is
 * on name AND folder together.
 */
export const INSPIRATION_EXTRA_FIELDS = [
    {
        name: 'journaltype',
        role: 'selector',
        type: 'string',
        values: ['inspiration'],
        example: 'inspiration',
        guidance: 'Identifies the profile, and must be exactly "inspiration".'
    },
    {
        name: 'foldername',
        role: 'input',
        type: 'string',
        default: '',
        example: 'Inspiration',
        guidance: 'The Journal folder to file the deck under, created if it does not exist, and root if omitted.'
    },
    {
        name: 'title',
        path: 'name',
        type: 'string',
        required: true,
        example: 'Second Wind',
        guidance: 'The name of the card, which becomes the page title.'
    },
    {
        // RESOLVED, NOT TRUSTED. See the injury profile for why. The deck spans
        // the most directories of the three for ten records, because the cards are
        // deliberately varied rather than themed on one kind of harm.
        name: 'image',
        path: 'system.image',
        type: 'string',
        transform: 'resolveImage',
        imageRoots: ['icons/skills', 'icons/magic', 'icons/consumables', 'icons/commodities', 'icons/sundries'],
        imageFallback: 'icons/svg/card-joker.svg',
        example: 'icons/magic/life/heart-glowing-red.webp',
        guidance: 'Always set this to a Foundry core icon path matching the card, such as icons/magic/life/heart-glowing-red.webp, since an empty value ships a card with no art on the chat card or the inventory item.'
    },
];

/**
 * What the prompt asks the author. There is no category or severity to
 * narrow by here, so a count is the only answer that changes the output.
 */
export const INSPIRATION_PROMPT_FIELDS = [
    {
        id: 'count',
        label: 'How many',
        value: '10',
        hint: 'How many cards to generate in one pass.'
    },
    {
        id: 'action',
        label: 'Automation',
        inputType: 'select',
        options: [
            { value: 'any', label: 'Any, including narrative cards' },
            ...ACTION_KEYS.map((value) => ({ value, label: ACTIONS[value]?.label ?? value }))
        ],
        value: 'any',
        hint: 'Restrict generated cards to one automatable action, or allow any.'
    }
];

/**
 * Build the declaration.
 *
 * `declarationFromModel` is INJECTED rather than imported, because this
 * module is loaded by Foundry at runtime and by the build gate in Node.
 *
 * @param {Function} declarationFromModel Blacksmith's schema walk
 * @returns {object} the declaration to register
 */
export function buildInspirationDeclaration(declarationFromModel) {
    if (typeof declarationFromModel !== 'function') {
        throw new TypeError('buildInspirationDeclaration requires Blacksmith\'s declarationFromModel');
    }
    return declarationFromModel((() => { const { image: _derived, ...rest } = InspirationPageModel.defineSchema(); return rest; })(), {
        kind: 'journal',
        id: 'inspiration',
        label: 'Inspiration Card',
        module: MODULE.ID,
        document: {
            documentName: 'JournalEntryPage',
            type: INSPIRATION_PAGE_TYPE,
            // No field to read: the deck is one journal, so the name is
            // stated rather than derived.
            containerName: INSPIRATION_CONTAINER
        },
        guidance: INSPIRATION_GUIDANCE,
        examples: INSPIRATION_EXAMPLES,
        extraFields: INSPIRATION_EXTRA_FIELDS,
        promptFields: INSPIRATION_PROMPT_FIELDS,
        derive: [],
        rules: []
    });
}

/**
 * Register with Blacksmith's importer, guarded so an older Blacksmith
 * simply does not offer inspiration cards in its import tool.
 *
 * @returns {boolean} true when registered
 */
export function registerInspirationImportProfile() {
    const importer = game.modules.get('coffee-pub-blacksmith')?.api?.importer;
    if (typeof importer?.registerDeclaration !== 'function' || typeof importer?.declarationFromModel !== 'function') {
        log('Blacksmith importer API not available; inspiration import profile not registered', '', true, false);
        return false;
    }
    try {
        importer.registerDeclaration(buildInspirationDeclaration(importer.declarationFromModel));
        log('Inspiration import profile registered with Blacksmith', '', false, false);
        return true;
    } catch (error) {
        log('Inspiration import profile rejected by Blacksmith', error, false, true);
        return false;
    }
}
