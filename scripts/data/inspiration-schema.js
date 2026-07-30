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
        needsTarget: false,
        icon: 'fa-comments',
        effect: 'Resolved at the table — no automatic effect.'
    },
    healFull: {
        label: 'Heal to full',
        button: 'Heal to Full',
        hint: 'Select the creature to heal.',
        lands: 'Lands on any one creature — yourself, an ally, anyone.',
        needsTarget: true,
        icon: 'fa-heart',
        effect: 'Restores them to full hit points.'
    },
    setHp: {
        label: 'Set hit points',
        button: 'Restore',
        hint: 'Select the creature.',
        lands: 'Lands on any one creature.',
        needsTarget: true,
        params: ['amount'],
        icon: 'fa-heart-pulse',
        effect: 'Sets them to {amount} hit points.'
    },
    percentDamage: {
        label: 'Reduce health by a percentage',
        button: 'Smite',
        hint: 'Select the creature to smite.',
        lands: 'Lands on the creature you target.',
        needsTarget: true,
        params: ['formula'],
        icon: 'fa-bolt',
        effect: 'Rolls {formula} for a percentage — they lose that share of their current hit points.'
    },
    swapHp: {
        label: 'Swap hit points with another character',
        button: 'Swap Health',
        hint: 'Select BOTH characters — yours and theirs.',
        lands: 'Lands on another party member.',
        needsTarget: true,
        icon: 'fa-right-left',
        effect: 'Swaps your current hit points with theirs. Anything over a character\'s own maximum arrives as temporary hit points.'
    },
    longRest: {
        label: 'Take a long rest',
        button: 'Long Rest',
        hint: 'Select the character resting.',
        lands: 'Lands on you.',
        needsTarget: true,
        icon: 'fa-bed',
        effect: 'Grants the benefits of a full long rest.'
    },
    grantInspiration: {
        label: 'Grant an inspiration point',
        button: 'Grant Inspiration',
        hint: 'Select the character.',
        lands: 'Lands on any one character.',
        needsTarget: true,
        icon: 'fa-lightbulb',
        effect: 'Grants an inspiration point.'
    }
};

/**
 * Dice formulas are authored for the roller (`1d10*10`) and read by
 * players, so the asterisk becomes a multiplication sign. Nobody should
 * have to wonder whether that was a typo.
 */
const prettyFormula = (formula) => String(formula || '1d10*10')
    .replace(/\s*\*\s*/g, '×')
    .replace(/\s*\/\s*/g, '÷');

/**
 * The card's mechanics, as icon + text lines. ONE describer shared by
 * every place a player reads this card, which had better not disagree
 * with itself. The context only changes emphasis, never the facts:
 *
 *   draw — they just gained the point, so the cost is not news. Say what
 *          the card does and what it will need aimed at.
 *   item — sitting in inventory, possibly for weeks. Spell out the whole
 *          bargain: what it does, what it costs, that it is one-shot.
 *   play — the card is on the table and a button is about to be clicked.
 *          The buttons handle targeting, so drop the aiming hint and be
 *          explicit that this click spends the point and burns the card.
 *
 * Narrative cards say so out loud everywhere except the draw card, where
 * the surrounding text already explains it. An empty mechanics block on a
 * card someone is about to play reads as broken.
 *
 * @param {object} card
 * @param {object} [options]
 * @param {'draw'|'item'|'play'} [options.context]
 * @returns {Array<{icon: string, text: string}>}
 */
export function describeInspirationCard(card, { context = 'draw' } = {}) {
    const action = card?.action ?? 'none';
    const config = ACTIONS[action] ?? ACTIONS.none;
    const lines = [];

    if (action !== 'none') {
        lines.push({
            icon: config.icon,
            text: String(config.effect ?? '')
                .replace('{amount}', String(card?.actionamount ?? 0))
                .replace('{formula}', prettyFormula(card?.actionformula))
        });
        // On the play card the buttons ARE the targeting, so naming who it
        // could land on would just describe the list underneath it.
        if (config.needsTarget && context !== 'play' && config.lands) {
            lines.push({ icon: 'fa-crosshairs', text: config.lands });
        }
    } else if (context !== 'draw') {
        lines.push({ icon: config.icon, text: config.effect });
    }

    // The card IS the cost. Holding it is the right to play it, playing it
    // spends it, and there is no separate point in the ledger to explain.
    if (context === 'item') {
        lines.push({ icon: 'fa-clock', text: 'Use it any time. One use only — playing it discards the card.' });
    } else if (context === 'play') {
        lines.push({ icon: 'fa-clock', text: 'Playing this discards the card.' });
    }
    return lines;
}

/** The same lines as HTML, for the places that take a description blob. */
export function describeInspirationCardHtml(card, options = {}) {
    const lines = describeInspirationCard(card, options);
    if (!lines.length) return '';
    return `<ul>${lines.map((l) => `<li>${l.text}</li>`).join('')}</ul>`;
}

export const ACTION_KEYS = Object.keys(ACTIONS);

/**
 * WHO a card can land on, which decides what buttons its play card shows.
 * Derived from the action rather than authored per card, because the
 * action already tells us: you cannot swap health with yourself, and
 * "reduce their health by 80%" is not aimed at a party member.
 *
 *   none   — nothing to aim. One button, and the table takes it from there.
 *   self   — the holder, and only the holder.
 *   ally   — another party member, chosen out loud or by the dice.
 *   target — whatever creature they have targeted on the canvas.
 *   any    — could be any of the above; offer all of them.
 *
 * A card may override this with an `appliesto` field if a future one
 * needs to disagree with its action.
 */
export const TARGET_MODES = ['none', 'self', 'ally', 'target', 'any'];

export const ACTION_TARGET_MODE = {
    none: 'none',
    healFull: 'any',            // "heal one creature" — themselves, an ally, anyone
    setHp: 'any',               // Raise the Dead: "a dead creature of your choice"
    percentDamage: 'target',    // Smite: "make eye contact with a creature"
    swapHp: 'ally',             // Life Swap: "a character within sight, call out their name"
    longRest: 'self',
    grantInspiration: 'any'
};

export const targetModeFor = (card) => {
    const override = card?.appliesto;
    if (override && TARGET_MODES.includes(override)) return override;
    return ACTION_TARGET_MODE[card?.action ?? 'none'] ?? 'none';
};

export const REQUIRED_FIELDS = ['title', 'image', 'description', 'odds'];
export const OPTIONAL_FIELDS = ['imagetitle', 'action', 'actionamount', 'actionformula', 'gmnotes', 'sourceUuid'];

/** dnd5e stores inspiration as a boolean on the actor. */
export const INSPIRATION_PATH = 'system.attributes.inspiration';

export const actionLabel = (a) => ACTIONS[a]?.label ?? ACTIONS.none.label;
export const actionButton = (a) => ACTIONS[a]?.button ?? '';
export const actionHint = (a) => ACTIONS[a]?.hint ?? '';
export const actionNeedsTarget = (a) => !!ACTIONS[a]?.needsTarget;
