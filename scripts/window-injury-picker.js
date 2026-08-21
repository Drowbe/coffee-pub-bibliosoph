// ==================================================================
// ===== INJURY PICKER (window-injury-picker.js) ====================
// ==================================================================
// Choosing which wound lands, without a chat card in the way.
//
// The old flow posted a selector CARD to chat, you clicked a damage
// type on it, and a random injury from that type was rolled. That put
// a permanent message in the log for what is really a GM control, and
// it could only ever roll at random — there was no way to say "the
// villain takes the eye", which is exactly the moment a GM most wants
// to choose.
//
// This is a Tool window (BlacksmithToolWindowBaseV2): the shell Blacksmith
// ships for small utilities that live over the canvas. It follows the
// user's Light/Dark/Glass choice for free, which is why there is not a
// single colour literal below — every surface comes from the
// `--blacksmith-tool-*` family. See Blacksmith's api-window doc.
// ==================================================================

import { MODULE } from './const.js';
// From Blacksmith's bridge rather than `game.modules`: `extends` is
// evaluated when this module is, and there is no `game` at that point.
import { BlacksmithToolWindowBaseV2 } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { CATEGORIES, displayCategory } from './data/injury-schema.js';

function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api ?? null;
}

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INJURY PICKER | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INJURY PICKER | ${message}`, data);
    }
}

const esc = (value) => foundry.utils.escapeHTML?.(String(value ?? '')) ?? String(value ?? '');

/**
 * Every injury in the configured compendium, grouped by category, with the
 * odds resolved into a percentage so the picker can show how likely each one
 * is when rolled at random. Read once per open — the pack is small and this
 * is a GM control, not a hot path.
 */
async function loadInjuriesByCategory() {
    const packId = game.settings.get(MODULE.ID, 'injuryCompendium');
    const pack = game.packs.get(packId);
    if (!pack) {
        log(`Compendium "${packId}" not found`, '', false, true);
        return null;
    }
    const byCategory = new Map();
    for (const journal of await pack.getDocuments()) {
        const rows = [];
        for (const page of journal.pages) {
            const system = page?.system;
            if (!system?.severity) continue;   // not a typed injury page
            rows.push({
                uuid: page.uuid,
                title: page.name,
                image: system.image || '',
                severity: system.severity,
                odds: Number(system.odds) || 1,
                tick: Number(system.tick) || 0,
                statuseffect: system.statuseffect && system.statuseffect !== 'none' ? system.statuseffect : ''
            });
        }
        if (rows.length) byCategory.set(journal.name, rows.sort((a, b) => a.title.localeCompare(b.title)));
    }
    return byCategory;
}

export class InjuryPickerWindow extends BlacksmithToolWindowBaseV2 {

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}),
        {
            id: `${MODULE.ID}-injury-picker`,
            classes: ['bibliosoph-injury-picker'],
            position: { width: 480, height: 'auto' },
            window: { title: 'Deal an Injury', resizable: false }
        }
    );

    static PARTS = {
        body: { template: `modules/${MODULE.ID}/templates/window-injury-picker.hbs` }
    };

    /** Who the wound lands on, resolved at OPEN time and shown in the header. */
    #target = null;
    #byCategory = null;
    #openCategory = null;

    /**
     * The consumer hook is `getData`, NOT `_prepareContext`. The Blacksmith
     * base owns `_prepareContext` — it calls `getData()` and merges the result
     * with the zone defaults and the tool-theme flags. Overriding
     * `_prepareContext` intercepts that chain and the base's own call to
     * `getData` then fails, which is the error this replaced.
     */
    async getData(options = {}) {
        this.#byCategory ??= await loadInjuriesByCategory();

        const token = Array.from(game.user.targets ?? [])[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
        this.#target = token?.actor
            ? { actorId: token.actor.id, tokenId: token.id, name: token.name }
            : null;

        // Categories in schema order rather than pack order, so the list reads
        // the same whatever a GM has renamed or reordered in their own copy.
        const known = new Set(this.#byCategory?.keys() ?? []);
        const ordered = [
            ...CATEGORIES.map(displayCategory).filter((c) => known.has(c)),
            ...[...known].filter((c) => !CATEGORIES.map(displayCategory).includes(c))
        ];

        const categories = ordered.map((name) => {
            const rows = this.#byCategory.get(name) ?? [];
            const total = rows.reduce((sum, r) => sum + r.odds, 0) || 1;
            return {
                name,
                count: rows.length,
                open: name === this.#openCategory,
                injuries: rows.map((r) => ({
                    ...r,
                    chance: Math.round(100 * r.odds / total),
                    detail: [
                        r.severity,
                        r.statuseffect || null,
                        r.tick > 0 ? `bleeds ${r.tick}%` : null
                    ].filter(Boolean).join(' · ')
                }))
            };
        });

        // Plain object: the base merges this over the zone defaults and the
        // tool-theme flags, so there is nothing to merge into here.
        return {
            targetName: this.#target?.name ?? null,
            categories,
            anyInjuries: categories.some((c) => c.count > 0)
        };
    }

    static ACTION_HANDLERS = {
        // Third argument is the instance — required so the handlers keep
        // working if more than one picker is ever open.
        toggleCategory: (event, target, app) => app._toggleCategory(target?.dataset?.category),
        rollCategory: (event, target, app) => app._deal(target?.dataset?.category, null),
        requestRoll: (event, target, app) => app._requestRoll(target?.dataset?.category),
        dealInjury: (event, target, app) => app._deal(target?.dataset?.category, target?.dataset?.title),
        openJournal: (event, target, app) => app._openJournal(target?.dataset?.uuid)
    };

    /**
     * Hand the roll to the target's player instead of rolling it here. The
     * same armed toast the damage threshold sends, so from the player's side
     * a GM-initiated injury is indistinguishable from an automatic one.
     *
     * Category only, never a named injury: choosing the wound and then asking
     * somebody else to roll for it are contradictory acts.
     */
    async _requestRoll(category) {
        if (!category) return;
        const actor = this.#target?.actorId ? game.actors.get(this.#target.actorId) : null;
        if (!actor) {
            const toast = getBlacksmith()?.toast;
            const message = 'Target or select a token first — somebody has to be asked.';
            if (toast?.show) toast.show({ title: 'No Target', subtitle: message, icon: 'fa-solid fa-crosshairs', duration: 3, moduleId: MODULE.ID });
            else ui.notifications.warn(message);
            return;
        }
        try {
            const { InjuryTriggerManager } = await import('./manager-injury-triggers.js');
            const reachedPlayer = InjuryTriggerManager.requestRoll(actor, category, this.#target);
            log(reachedPlayer
                ? `Asked ${this.#target.name}'s player to roll a ${category} injury`
                : `Nobody owns ${this.#target.name} — the ${category} prompt came back to you`, '', true, false);
        } catch (error) {
            log('Could not request the roll', error?.message, false, true);
        }
        this.close();
    }

    /**
     * Show the authored page behind a row. Deliberately does NOT close the
     * picker — reading what a wound does is how you decide whether to deal
     * it, so you land back on the list still open.
     */
    async _openJournal(uuid) {
        if (!uuid) return;
        try {
            const page = await fromUuid(uuid);
            if (!page) return log(`Page ${uuid} not found`, '', false, true);
            // The parent journal scrolled to this page reads better than the
            // bare page sheet: you get the category's other wounds alongside.
            const journal = page.parent;
            if (journal?.sheet?.render) journal.sheet.render(true, { pageId: page.id });
            else page.sheet?.render?.(true);
        } catch (error) {
            log('Could not open the injury page', error?.message, false, true);
        }
    }

    _toggleCategory(name) {
        if (!name) return;
        this.#openCategory = this.#openCategory === name ? null : name;
        this.render();
    }

    /**
     * Post the injury card. `title` null means the usual odds-weighted draw
     * from that category — the old chat-card behaviour, minus the chat card.
     */
    async _deal(category, title) {
        if (!category) return;
        try {
            const { rollInjuryCard } = await import('./bibliosoph.js');
            await rollInjuryCard(category, this.#target, title ? { title } : {});
            log(`Dealt ${title ? `"${title}"` : `a random ${category} injury`}${this.#target ? ` to ${this.#target.name}` : ''}`, '', true, false);
        } catch (error) {
            log('Could not deal the injury', error?.message, false, true);
        }
        this.close();
    }
}

/** Open the picker. Ephemeral by design — no registration, no singleton. */
export async function openInjuryPicker() {
    const window = new InjuryPickerWindow();
    await window.render({ force: true });
    return window;
}
