// ==================================================================
// ===== INSPIRATION PAGE MODEL =====================================
// ===== (scripts/data/inspiration-page-model.js) ===================
// ==================================================================
// Typed journal pages for homebrew inspiration cards. Third in the
// family after injuries and outcomes, and the simplest of the three —
// a card is art, prose, and (sometimes) one automatable action.
// ==================================================================

import { MODULE } from '../const.js';
import { ACTION_KEYS, actionLabel, actionButton, actionHint, actionNeedsTarget } from './inspiration-schema.js';

export const INSPIRATION_PAGE_TYPE = `${MODULE.ID}.inspiration`;

const choicesFrom = (values) => Object.fromEntries(values.map((v) => [v, v]));

export class InspirationPageModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            image: new fields.StringField({ required: false, blank: true, initial: '' }),
            imagetitle: new fields.StringField({ required: false, blank: true, initial: '' }),
            description: new fields.StringField({ required: false, blank: true, initial: '' }),
            /** Relative likelihood when a card is drawn at random. */
            odds: new fields.NumberField({ required: true, integer: true, min: 1, max: 100, initial: 10, nullable: false }),
            /** The automatable state change, if this card has one. */
            action: new fields.StringField({
                required: false, blank: false, initial: 'none', choices: choicesFrom(ACTION_KEYS)
            }),
            /** Parameter for setHp. */
            actionamount: new fields.NumberField({ required: false, integer: true, min: 0, initial: null, nullable: true }),
            /** Parameter for percentDamage, e.g. "1d10*10". */
            actionformula: new fields.StringField({ required: false, blank: true, initial: '' }),
            /** Shipped "how to run it" guidance. */
            gmnotes: new fields.StringField({ required: false, blank: true, initial: '' })
        };
    }

    get title() { return this.parent?.name ?? ''; }
    get actionLabel() { return actionLabel(this.action); }
    get actionButton() { return actionButton(this.action); }
    get actionHint() { return actionHint(this.action); }
    get needsTarget() { return actionNeedsTarget(this.action); }

    /** Whether this card can do anything on its own. */
    get isAutomated() { return this.action && this.action !== 'none'; }

    /** The flat record, matching one entry of resources/inspiration.json. */
    get record() {
        return {
            title: this.title,
            image: this.image,
            imagetitle: this.imagetitle,
            description: this.description,
            odds: this.odds,
            action: this.action || 'none',
            ...(this.actionamount != null ? { actionamount: this.actionamount } : {}),
            ...(this.actionformula ? { actionformula: this.actionformula } : {}),
            ...(this.gmnotes ? { gmnotes: this.gmnotes } : {})
        };
    }

    get warnings() {
        const out = [];
        if (!this.image) out.push('No image set — the card will have no art.');
        if (this.action === 'setHp' && this.actionamount == null) {
            out.push('Action is "Set hit points" but no amount is set.');
        }
        if (this.action === 'percentDamage' && !this.actionformula) {
            out.push('Action is "Reduce health by a percentage" but no formula is set.');
        }
        return out;
    }
}
