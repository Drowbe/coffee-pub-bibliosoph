// ==================================================================
// ===== INSPIRATION SCHEMA (scripts/data/inspiration-schema.js) =====
// ==================================================================
// Homebrew inspiration cards — the third typed content family, after
// injuries and outcomes.
//
// The lifecycle differs from both:
//   DRAW  — GM discretion, or a critical that grants access. Drawing a
//           card GIVES the character an inspiration point.
//   USE   — spending that point resolves the card.
// So a card is held between the two, and the point is the currency.
//
// What is genuinely new here is `action`: several of these cards are
// pure state changes ("heal one creature to full", "instantly long
// rest") rather than rulings, so the card can just do them. The rest
// stay narrative — a button that guessed at "distribute 5 points among
// your attributes" would be worse than no button.
// ==================================================================

/**
 * Automatable actions. Deliberately few and boring: each is a state
 * change with no judgement in it. Anything requiring a decision belongs
 * in the prose, not here.
 */
export const ACTIONS = {
    none: {
        label: 'None — narrative only',
        hint: 'The table resolves this one.',
        needsTarget: false
    },
    healFull: {
        label: 'Heal to full',
        button: 'Heal to Full',
        hint: 'Select the creature to heal.',
        needsTarget: true
    },
    setHp: {
        label: 'Set hit points',
        button: 'Restore',
        hint: 'Select the creature.',
        needsTarget: true,
        params: ['amount']
    },
    percentDamage: {
        label: 'Reduce health by a percentage',
        button: 'Smite',
        hint: 'Select the creature to smite.',
        needsTarget: true,
        params: ['formula']
    },
    swapHp: {
        label: 'Swap hit points with another character',
        button: 'Swap Health',
        hint: 'Select BOTH characters — yours and theirs.',
        needsTarget: true
    },
    longRest: {
        label: 'Take a long rest',
        button: 'Long Rest',
        hint: 'Select the character resting.',
        needsTarget: true
    },
    grantInspiration: {
        label: 'Grant an inspiration point',
        button: 'Grant Inspiration',
        hint: 'Select the character.',
        needsTarget: true
    }
};

export const ACTION_KEYS = Object.keys(ACTIONS);

export const REQUIRED_FIELDS = ['title', 'image', 'description', 'odds'];
export const OPTIONAL_FIELDS = ['imagetitle', 'action', 'actionamount', 'actionformula', 'gmnotes', 'sourceUuid'];

/** dnd5e stores inspiration as a boolean on the actor. */
export const INSPIRATION_PATH = 'system.attributes.inspiration';

export const actionLabel = (a) => ACTIONS[a]?.label ?? ACTIONS.none.label;
export const actionButton = (a) => ACTIONS[a]?.button ?? '';
export const actionHint = (a) => ACTIONS[a]?.hint ?? '';
export const actionNeedsTarget = (a) => !!ACTIONS[a]?.needsTarget;
