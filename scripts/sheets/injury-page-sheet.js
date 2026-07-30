// ==================================================================
// ===== INJURY PAGE SHEET (scripts/sheets/injury-page-sheet.js) =====
// ==================================================================
// Structure mirrors Squire's CodexPageSheet deliberately (see that file
// for the reasoning on extending the ProseMirror sheet rather than the
// abstract text sheet):
//
//   - EDIT mode inserts a fields part between the standard header and the
//     ProseMirror editor, so the page's own text.content keeps stock
//     editing and becomes free-form GM notes.
//   - VIEW mode's core content part is `root: true`, so sibling parts are
//     not possible; the rendered field block is prepended to the enriched
//     content instead.
// ==================================================================

import { MODULE } from '../const.js';
import { CATEGORIES, SEVERITIES, CONDITIONS, MODIFIER_STATS, displayCategory } from '../data/injury-schema.js';
import { mountGmNotesField } from '../utility-gm-notes.js';

const JournalEntryPageProseMirrorSheet = foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet;

const renderTemplate = (path, data) => foundry.applications.handlebars.renderTemplate(path, data);

const labelled = (values, format = (v) => v) =>
    values.map((value) => ({ value, label: format(value) }));

export class InjuryPageSheet extends JournalEntryPageProseMirrorSheet {
    static DEFAULT_OPTIONS = {
        classes: ['bibliosoph-injury-page']
    };

    static EDIT_PARTS = {
        header: JournalEntryPageProseMirrorSheet.EDIT_PARTS.header,
        injuryFields: {
            template: `modules/${MODULE.ID}/templates/page-injury-fields-edit.hbs`
        },
        content: JournalEntryPageProseMirrorSheet.EDIT_PARTS.content,
        footer: JournalEntryPageProseMirrorSheet.EDIT_PARTS.footer
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId === 'injuryFields') {
            const system = this.document.system;
            context.document = this.document;
            context.system = system;
            context.categoryChoices = labelled(CATEGORIES, displayCategory);
            context.severityChoices = labelled(SEVERITIES, displayCategory);
            context.conditionChoices = labelled(CONDITIONS, (v) => (v === 'none' ? 'None' : displayCategory(v)));
            context.treatmentDC = system.treatmentDC;
            context.warnings = system.warnings;
            context.statChoices = Object.entries(MODIFIER_STATS)
                .map(([value, s]) => ({ value, label: s.label.charAt(0).toUpperCase() + s.label.slice(1) }));
            // One spare blank row so adding a modifier never needs a button.
            context.modifierRows = [...(system.modifiers ?? []), { stat: '', value: '', rounds: '' }];
        }
        return context;
    }

    /**
     * Mount Blacksmith's GM Notes field into the single reserved host.
     * The controller is kept on the instance and destroyed before every
     * re-mount and on close — otherwise each render leaks a hook listener
     * and an editor instance.
     */
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

        // View mode: prepend the styled field block above the GM notes
        if (this.isView) {
            const system = this.document.system;
            const fieldsHtml = await renderTemplate(
                `modules/${MODULE.ID}/templates/page-injury-fields-view.hbs`,
                {
                    document: this.document,
                    system,
                    categoryLabel: system.categoryLabel,
                    severityLabel: displayCategory(system.severity),
                    conditionLabel: system.statuseffect === 'none' ? 'None' : displayCategory(system.statuseffect),
                    durationLabel: system.duration === 0 ? 'Permanent (until treated)' : formatSeconds(system.duration),
                    modifierLabels: system.modifierLabels ?? [],
                    treatmentDC: system.treatmentDC,
                    hasDetails: system.hasDetails,
                    isGM: game.user.isGM
                }
            );
            context.text.enriched = fieldsHtml + (context.text.enriched || '');
        }
    }

    /** @inheritDoc */
    _prepareSubmitData(event, form, formData, updateData) {
        const data = super._prepareSubmitData(event, form, formData, updateData);
        // A blank DC override means "use the severity ladder", not zero.
        const dc = foundry.utils.getProperty(data, 'system.treatmentdc');
        if (dc === '' || dc === undefined || Number(dc) <= 0) {
            foundry.utils.setProperty(data, 'system.treatmentdc', null);
        }
        return data;
    }
}

/** "1800" -> "30 minutes". Kept local: the sheet is the only caller. */
function formatSeconds(seconds) {
    const total = Number(seconds) || 0;
    if (total < 60) return `${total} seconds`;
    const units = [
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60]
    ];
    for (const [name, size] of units) {
        if (total >= size) {
            const value = Math.round((total / size) * 10) / 10;
            return `${value} ${name}${value === 1 ? '' : 's'}`;
        }
    }
    return `${total} seconds`;
}
