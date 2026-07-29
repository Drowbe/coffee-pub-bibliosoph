// ==================================================================
// ===== OUTCOME PAGE SHEET (scripts/sheets/outcome-page-sheet.js) ===
// ==================================================================
// Editing sheet for critical / fumble pages. Same structure as the
// injury page sheet — see that file for why it extends the ProseMirror
// sheet rather than the abstract text sheet.
// ==================================================================

import { MODULE } from '../const.js';
import { KINDS, SEVERITIES, TARGETS, CONDITIONS, MODIFIER_STATS, kindLabel, titleCase, severityLabel, targetLabel } from '../data/outcome-schema.js';
import { mountGmNotesField } from '../utility-gm-notes.js';

const JournalEntryPageProseMirrorSheet = foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet;
const renderTemplate = (path, data) => foundry.applications.handlebars.renderTemplate(path, data);
const labelled = (values, format) => values.map((value) => ({ value, label: format(value) }));

export class OutcomePageSheet extends JournalEntryPageProseMirrorSheet {
    static DEFAULT_OPTIONS = {
        classes: ['bibliosoph-outcome-page']
    };

    static EDIT_PARTS = {
        header: JournalEntryPageProseMirrorSheet.EDIT_PARTS.header,
        outcomeFields: {
            template: `modules/${MODULE.ID}/templates/page-outcome-fields-edit.hbs`
        },
        content: JournalEntryPageProseMirrorSheet.EDIT_PARTS.content,
        footer: JournalEntryPageProseMirrorSheet.EDIT_PARTS.footer
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId === 'outcomeFields') {
            const system = this.document.system;
            context.document = this.document;
            context.system = system;
            context.kindChoices = labelled(KINDS, kindLabel);
            // Buckets shown under their real names — Butchery / Carnage /
            // Slaughter for crits, Meek / Nasty / Devastating for fumbles.
            context.severityChoices = SEVERITIES.map((value) => ({
                value,
                label: `${severityLabel(system.kind, value)} (${value})`
            }));
            context.targetChoices = TARGETS.map((value) => ({ value, label: targetLabel(value) }));
            context.conditionChoices = labelled(CONDITIONS, (v) => (v === 'none' ? 'None' : titleCase(v)));
            context.statChoices = Object.entries(MODIFIER_STATS).map(([value, s]) => ({ value, label: titleCase(s.label) }));
            context.rounds = system.rounds;
            context.warnings = system.warnings;
            // Rows are rendered from the stored array plus one blank slot,
            // so adding a modifier needs no JavaScript at all.
            context.modifierRows = [...(system.modifiers ?? []), { stat: '', value: '', rounds: '' }];
        }
        return context;
    }

    /** Mount Blacksmith's GM Notes field; destroy before re-mount and on close. */
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        this.#destroyGmNotes();
        const host = this.element?.querySelector('[data-gm-notes-host]');
        if (!host) return;
        try {
            this.#gmNotes = await mountGmNotesField(host, this.document, { label: 'GM Notes' });
        } catch (error) {
            console.warn(`${MODULE.ID} | Could not mount the GM Notes field`, error);
        }
    }

    /** @inheritDoc */
    _onClose(options) {
        this.#destroyGmNotes();
        return super._onClose?.(options);
    }

    #gmNotes = null;

    #destroyGmNotes() {
        try { this.#gmNotes?.destroy?.(); } catch (_) { /* already gone */ }
        this.#gmNotes = null;
    }

    /** @inheritDoc */
    async _prepareContentContext(context, options) {
        await super._prepareContentContext(context, options);
        if (this.isView) {
            const system = this.document.system;
            const fieldsHtml = await renderTemplate(
                `modules/${MODULE.ID}/templates/page-outcome-fields-view.hbs`,
                {
                    document: this.document,
                    system,
                    kindLabel: system.kindLabel,
                    severityLabel: system.severityLabel,
                    targetLabel: system.targetLabel,
                    durationLabel: system.durationLabel,
                    conditionLabel: system.statuseffect === 'none' ? 'None' : titleCase(system.statuseffect),
                    modifierLabels: system.modifierLabels,
                    isGM: game.user.isGM
                }
            );
            context.text.enriched = fieldsHtml + (context.text.enriched || '');
        }
    }

    /**
     * Duration is authored in ROUNDS (how anyone actually talks about a
     * critical) and stored in seconds. Blank modifier rows are dropped so
     * the spare slot never becomes a junk entry.
     */
    _prepareSubmitData(event, form, formData, updateData) {
        const data = super._prepareSubmitData(event, form, formData, updateData);

        const rounds = foundry.utils.getProperty(data, 'system.rounds');
        if (rounds !== undefined) {
            foundry.utils.setProperty(data, 'system.duration', Math.max(0, Math.round(Number(rounds) || 0) * 6));
            delete data.system.rounds;
        }

        const mods = foundry.utils.getProperty(data, 'system.modifiers');
        if (mods && typeof mods === 'object') {
            const cleaned = Object.values(mods)
                .filter((m) => m?.stat && Number(m.value))
                .map((m) => ({
                    stat: String(m.stat),
                    value: Math.round(Number(m.value) || 0),
                    rounds: Math.max(0, Math.round(Number(m.rounds) || 0))
                }));
            foundry.utils.setProperty(data, 'system.modifiers', cleaned);
        }

        return data;
    }
}
