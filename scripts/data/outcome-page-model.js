// ==================================================================
// ===== OUTCOME PAGE MODEL (scripts/data/outcome-page-model.js) =====
// ==================================================================
// Typed journal pages for criticals and fumbles. Mirrors the injury
// page model deliberately (same shape, same reasoning) so the two can
// share tooling and, later, a common Coffee Pub base.
// ==================================================================

import { MODULE } from '../const.js';
import {
    KINDS, SEVERITIES, TARGETS, CONDITIONS, MODIFIER_STATS, DAMAGE_BANDS,
    kindLabel, titleCase, severityLabel, targetLabel, describeModifier, modifiersToChanges, secondsToRounds
} from './outcome-schema.js';

export const OUTCOME_PAGE_TYPE = `${MODULE.ID}.outcome`;

const choicesFrom = (values) => Object.fromEntries(values.map((v) => [v, v]));

export class OutcomePageModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            kind: new fields.StringField({
                required: true, blank: false, initial: 'crit', choices: choicesFrom(KINDS)
            }),
            severity: new fields.StringField({
                required: true, blank: false, initial: 'minor', choices: choicesFrom(SEVERITIES)
            }),
            // Who it lands on: the creature that was hit, or the roller.
            appliesto: new fields.StringField({
                required: true, blank: false, initial: 'target', choices: choicesFrom(TARGETS)
            }),
            image: new fields.StringField({ required: false, blank: true, initial: '' }),
            imagetitle: new fields.StringField({ required: false, blank: true, initial: '' }),
            description: new fields.StringField({ required: false, blank: true, initial: '' }),
            // One-time HP dealt where the outcome lands.
            damage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0, nullable: false }),
            // Seconds. 0 = INSTANT — nothing lingers, so no effect is created
            // unless a condition or modifier needs somewhere to live.
            duration: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0, nullable: false }),
            statuseffect: new fields.StringField({
                required: true, blank: false, initial: 'none', choices: choicesFrom(CONDITIONS)
            }),
            odds: new fields.NumberField({ required: true, integer: true, min: 1, max: 100, initial: 50, nullable: false }),
            // The teeth: structured roll modifiers rather than prose the
            // table has to remember.
            modifiers: new fields.ArrayField(new fields.SchemaField({
                stat: new fields.StringField({ required: true, blank: false, initial: 'attack', choices: choicesFrom(Object.keys(MODIFIER_STATS)) }),
                value: new fields.NumberField({ required: true, integer: true, initial: -2, nullable: false }),
                rounds: new fields.NumberField({ required: false, integer: true, min: 0, initial: 1, nullable: false })
            }), { initial: [] }),
            // Shipped "how to run it" guidance, same as injuries.
            // Hands someone a card from the inspiration deck. WHO comes
            // from `appliesto`, so this is a flag rather than a target of
            // its own. The one place crits feed the deck.
            dealscard: new fields.BooleanField({ required: false, initial: false }),
            gmnotes: new fields.StringField({ required: false, blank: true, initial: '' })
        };
    }

    get title() { return this.parent?.name ?? ''; }
    get kindLabel() { return kindLabel(this.kind); }

    /** "Carnage", "Nasty" — the bucket's real name, not "moderate". */
    get severityLabel() { return severityLabel(this.kind, this.severity); }

    /** "Carnage (moderate)" for the sheet, where both are useful. */
    get severityLabelFull() { return `${this.severityLabel} (${this.severity})`; }

    /** "The creature hit" / "A party member" / … */
    get targetLabel() { return targetLabel(this.appliesto); }

    /** Duration in rounds — how outcomes are actually spoken about. */
    get rounds() { return secondsToRounds(this.duration); }

    get durationLabel() {
        if (!this.duration) return 'Instant';
        const rounds = this.rounds;
        return rounds <= 10 ? `${rounds} round${rounds === 1 ? '' : 's'}` : `${Math.round(this.duration / 60)} minutes`;
    }

    /** ["-2 to attack rolls for 2 rounds", …] */
    get modifierLabels() {
        return (this.modifiers ?? []).map(describeModifier).filter(Boolean);
    }

    /** ActiveEffect changes for the modifiers, so the numbers actually apply. */
    get effectChanges() {
        return modifiersToChanges(this.modifiers ?? []);
    }

    /**
     * Whether this outcome needs a lingering ActiveEffect at all. A pure
     * damage result is instant: apply the HP, post the card, done — no
     * effect cluttering the token.
     */
    get lingers() {
        return this.duration > 0 || this.statuseffect !== 'none' || (this.modifiers?.length ?? 0) > 0;
    }

    /** The flat record, matching one entry of resources/outcomes.json. */
    get record() {
        return {
            kind: this.kind,
            title: this.title,
            image: this.image,
            imagetitle: this.imagetitle,
            description: this.description,
            severity: this.severity,
            appliesto: this.appliesto,
            damage: this.damage,
            duration: this.duration,
            statuseffect: this.statuseffect,
            odds: this.odds,
            ...(this.modifiers?.length ? { modifiers: this.modifiers.map((m) => ({ ...m })) } : {}),
            ...(this.dealscard ? { dealscard: true } : {}),
            ...(this.gmnotes ? { gmnotes: this.gmnotes } : {})
        };
    }

    /** Advisory checks the schema cannot express; shown on the sheet. */
    get warnings() {
        const out = [];
        const band = DAMAGE_BANDS[this.severity];
        if (band && (this.damage < band[0] || this.damage > band[1])) {
            out.push(`Damage ${this.damage} is outside the ${this.severity} range ${band[0]}–${band[1]}.`);
        }
        if (!this.image) out.push('No image set — the card and token effect will have no art.');
        if (this.duration === 0 && (this.statuseffect !== 'none' || this.modifiers?.length)) {
            out.push('Duration is Instant but this carries a condition or modifier, so it will linger until removed by hand.');
        }
        return out;
    }
}
