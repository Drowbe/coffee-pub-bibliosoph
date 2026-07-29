// ==================================================================
// ===== INSPIRATION PAGE SHEET =====================================
// ===== (scripts/sheets/inspiration-page-sheet.js) =================
// ==================================================================
// Same structure as the injury and outcome sheets.
// ==================================================================

import { MODULE } from '../const.js';
import { ACTIONS, ACTION_KEYS } from '../data/inspiration-schema.js';
import { mountGmNotesField } from '../utility-gm-notes.js';

const JournalEntryPageProseMirrorSheet = foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet;
const renderTemplate = (path, data) => foundry.applications.handlebars.renderTemplate(path, data);

export class InspirationPageSheet extends JournalEntryPageProseMirrorSheet {
    static DEFAULT_OPTIONS = { classes: ['bibliosoph-inspiration-page'] };

    static EDIT_PARTS = {
        header: JournalEntryPageProseMirrorSheet.EDIT_PARTS.header,
        inspirationFields: {
            template: `modules/${MODULE.ID}/templates/page-inspiration-fields-edit.hbs`
        },
        content: JournalEntryPageProseMirrorSheet.EDIT_PARTS.content,
        footer: JournalEntryPageProseMirrorSheet.EDIT_PARTS.footer
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId === 'inspirationFields') {
            const system = this.document.system;
            context.document = this.document;
            context.system = system;
            context.actionChoices = ACTION_KEYS.map((value) => ({ value, label: ACTIONS[value].label }));
            context.warnings = system.warnings;
            context.showAmount = system.action === 'setHp';
            context.showFormula = system.action === 'percentDamage';
        }
        return context;
    }

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
                `modules/${MODULE.ID}/templates/page-inspiration-fields-view.hbs`,
                {
                    document: this.document,
                    system,
                    actionLabel: system.actionLabel,
                    isAutomated: system.isAutomated,
                    isGM: game.user.isGM
                }
            );
            context.text.enriched = fieldsHtml + (context.text.enriched || '');
        }
    }
}
