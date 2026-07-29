// ==================================================================
// ===== INJURY PAGE MODEL (scripts/data/injury-page-model.js) =======
// ==================================================================
// Structure mirrors Squire's CODEX page model (scripts/data/
// codex-page-model.js) deliberately — same approach, different schema —
// so the two can later be diffed and their common scaffolding extracted
// into a shared Coffee Pub toolkit. See documentation/spec-injury-schema.md.
// ==================================================================

import { MODULE } from '../const.js';
import {
    CATEGORIES, SEVERITIES, CONDITIONS, DAMAGE_BANDS,
    displayCategory, treatmentDcFor
} from './injury-schema.js';

/**
 * The fully-qualified page subtype string ("coffee-pub-bibliosoph.injury").
 * Declared in module.json documentTypes; Foundry auto-prefixes with the module id.
 */
export const INJURY_PAGE_TYPE = `${MODULE.ID}.injury`;

const choicesFrom = (values) => Object.fromEntries(values.map((v) => [v, v]));

/**
 * Data model for injury journal pages. Every mechanical field lives here
 * (page.system) with schema validation — nothing is parsed out of HTML,
 * which is what the old metadata-block format required and what let the
 * displayed values drift from the real ones.
 *
 * The page's own `name` is the injury title; the page's native
 * text.content is free-form GM notes, edited with ProseMirror through
 * the standard journal machinery.
 */
export class InjuryPageModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            // Which journal (damage type) this injury belongs to. `general`
            // is the fallback for untyped or evenly-mixed damage.
            category: new fields.StringField({
                required: true, blank: false, initial: 'general', choices: choicesFrom(CATEGORIES)
            }),
            // Drives the treatment DC and bounds `damage`.
            severity: new fields.StringField({
                required: true, blank: false, initial: 'minor', choices: choicesFrom(SEVERITIES)
            }),
            // Art is chosen per injury — there is no category default.
            image: new fields.StringField({ required: false, blank: true, initial: '' }),
            // Short evocative caption shown under the art on the chat card.
            imagetitle: new fields.StringField({ required: false, blank: true, initial: '' }),
            // The narrative, second person. Shown on the card and stored on
            // the applied effect so the table can re-read it later.
            description: new fields.StringField({ required: false, blank: true, initial: '' }),
            // How it may be treated — the GM's adjudication text.
            treatment: new fields.StringField({ required: false, blank: true, initial: '' }),
            // One-time real HP lost the moment the injury is applied.
            // Not ongoing, not a max-HP reduction.
            damage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0, nullable: false }),
            // Seconds the effect lasts; 0 = permanent (until treated).
            duration: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0, nullable: false }),
            // Exactly one condition id, or 'none'.
            statuseffect: new fields.StringField({
                required: true, blank: false, initial: 'none', choices: choicesFrom(CONDITIONS)
            }),
            // Relative likelihood within the category; higher is more common.
            odds: new fields.NumberField({ required: true, integer: true, min: 1, max: 100, initial: 50, nullable: false }),
            // Optional override for the severity-derived treatment DC.
            // Null (the norm) means "use the ladder".
            treatmentdc: new fields.NumberField({ required: false, integer: true, min: 1, initial: null, nullable: true }),
            // SHIPPED guidance on running the injury at the table — combat
            // and movement rulings, narrative stingers. This is module
            // content: it versions with the injury and updates when the
            // injury does. Distinct from Blacksmith's GM Notes, which is
            // the GM's own private layer and is never module-authored.
            gmnotes: new fields.StringField({ required: false, blank: true, initial: '' })
        };
    }

    /** The injury's title is the page name — never stored twice. */
    get title() {
        return this.parent?.name ?? '';
    }

    /** "Acid", "Bludgeoning", … for display. */
    get categoryLabel() {
        return displayCategory(this.category);
    }

    /** The DC a Medicine check must beat: authored override, else the severity ladder. */
    get treatmentDC() {
        return treatmentDcFor(this);
    }

    /** The apply-button label; always derived, never authored. */
    get actionLabel() {
        return this.category && this.category !== 'general'
            ? `Apply the ${this.categoryLabel} Injury`
            : 'Apply Injury to Token';
    }

    /**
     * Whether this page carries free-form Expanded Details below the
     * fields. This is authored, page-visible content — private notes live
     * in Blacksmith's GM Notes layer, never here. Tags are stripped first:
     * opening the editor leaves an empty paragraph behind, and `<p></p>`
     * is markup, not content.
     */
    get hasDetails() {
        const content = this.parent?.text?.content;
        if (typeof content !== 'string') return false;
        return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
    }

    /**
     * The flat record the rest of the module consumes — identical in shape
     * to one entry of resources/injuries.json, with the title folded back
     * in from the page name.
     */
    get record() {
        return {
            category: this.category,
            title: this.title,
            image: this.image,
            imagetitle: this.imagetitle,
            description: this.description,
            treatment: this.treatment,
            severity: this.severity,
            damage: this.damage,
            duration: this.duration,
            statuseffect: this.statuseffect,
            odds: this.odds,
            ...(this.treatmentdc ? { treatmentdc: this.treatmentdc } : {}),
            ...(this.gmnotes ? { gmnotes: this.gmnotes } : {})
        };
    }

    /**
     * Advisory checks the schema cannot express. Foundry guarantees types
     * and legal values; this catches an injury whose numbers fight its own
     * severity. Surfaced on the sheet rather than blocking a save, so a
     * GM mid-edit is never trapped.
     */
    get warnings() {
        const out = [];
        const band = DAMAGE_BANDS[this.severity];
        if (band && (this.damage < band[0] || this.damage > band[1])) {
            out.push(`Damage ${this.damage} is outside the ${this.severity} range ${band[0]}–${band[1]}.`);
        }
        if (!this.image) out.push('No image set — the card and token effect will have no art.');
        return out;
    }
}
