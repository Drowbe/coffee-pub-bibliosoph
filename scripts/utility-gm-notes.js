// ==================================================================
// ===== GM NOTES ADAPTER (scripts/utility-gm-notes.js) ==============
// ==================================================================
// The ONE place Bibliosoph talks to Blacksmith's GM Notes API, per the
// integration contract in documentation/note-blacksmith-gmnotes-journals.md
// and Blacksmith's reply.
//
// Rules this file exists to enforce:
//   - Never write flags["coffee-pub-blacksmith"].gmNotes directly.
//     Blacksmith owns the schema, text mirror, timestamps, migrations,
//     preservation semantics, and hooks.
//   - Never store note text in the injury page's own text.content.
//   - Never put note text in shared chat HTML — pass a UUID and let each
//     GM's client resolve it locally.
//
// Blacksmith is shipping getAsync/canSet/getMany and an embeddable field
// component. Everything here prefers those the moment they exist and
// falls back only for older builds, so adopting the component is a change
// in this file alone.
// ==================================================================

import { MODULE } from './const.js';

const BLACKSMITH_ID = 'coffee-pub-blacksmith';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `GM NOTES | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | GM NOTES | ${message}`, data);
    }
}

export function getGmNotesApi() {
    return game.modules.get(BLACKSMITH_ID)?.api?.gmNotes ?? null;
}

export function isGmNotesAvailable() {
    const api = getGmNotesApi();
    return !!api && (api.isAvailable?.() ?? true);
}

/**
 * The change hook, so surfaces can live-refresh when a note is edited
 * elsewhere. Blacksmith exposes it as api.gmNotes.CHANGE_HOOK; the
 * literal is the fallback for older builds.
 */
export const GM_NOTES_CHANGE_HOOK = 'blacksmith.gmNotesChanged';

export function gmNotesChangeHook() {
    return getGmNotesApi()?.CHANGE_HOOK ?? GM_NOTES_CHANGE_HOOK;
}

// NOTE: Bibliosoph deliberately contributes NOTHING to GM Notes.
// "Running This Injury" is ordinary injury data — a field on the page,
// rendered like Description and Treatment. GM Notes stays what Blacksmith
// built it for: the GM's own notes, mirroring how Foundry treats items.

/**
 * Resolve to a live Document. Blacksmith's synchronous methods cannot
 * resolve an unloaded compendium uuid, and injuries ship in a pack — so
 * we hand them a Document rather than a string wherever we can.
 */
async function resolveTarget(pageOrUuid) {
    if (!pageOrUuid) return null;
    if (pageOrUuid?.getFlag) return pageOrUuid;
    try {
        return await fromUuid(String(pageOrUuid));
    } catch (error) {
        log(`Could not resolve ${pageOrUuid}`, error?.message, true, false);
        return null;
    }
}

/** Full note envelope for a page, or null. */
export async function readGmNote(pageOrUuid) {
    const api = getGmNotesApi();
    if (!api) return null;
    try {
        if (typeof api.getAsync === 'function') return await api.getAsync(pageOrUuid);
        const document = await resolveTarget(pageOrUuid);
        return document ? api.get(document) : null;
    } catch (error) {
        log('Read failed', error?.message, true, false);
        return null;
    }
}

/** Authored note HTML, or '' when there is none. */
export async function readGmNoteHtml(pageOrUuid) {
    const api = getGmNotesApi();
    if (!api) return '';
    try {
        if (typeof api.getHtmlAsync === 'function') return (await api.getHtmlAsync(pageOrUuid)) || '';
        const document = await resolveTarget(pageOrUuid);
        return document ? (api.getHtml(document) || '') : '';
    } catch (error) {
        log('Read failed', error?.message, true, false);
        return '';
    }
}

/**
 * Whether this note can be written, and why not when it cannot.
 * Blacksmith's canSet() is authoritative once present; until then we make
 * the same determination conservatively so a GM is never allowed to type
 * into a field that will silently discard the text.
 */
export async function canWriteGmNote(pageOrUuid) {
    const api = getGmNotesApi();
    if (!api) return { allowed: false, reason: 'unsupported', message: 'Blacksmith GM Notes is not available.' };
    try {
        if (typeof api.canSet === 'function') return await api.canSet(pageOrUuid);
    } catch (error) {
        log('canSet failed', error?.message, true, false);
    }
    // Fallback determination for older Blacksmith builds
    const document = await resolveTarget(pageOrUuid);
    if (!document) return { allowed: false, reason: 'unresolved', message: 'That page could not be loaded.' };
    if (document.pack) {
        const pack = game.packs.get(document.pack);
        if (pack?.locked) {
            return {
                allowed: false, reason: 'locked-pack', document,
                message: 'This injury lives in a locked compendium. Copy it into a world compendium to add notes that survive module updates.'
            };
        }
    }
    if (!game.user.isGM) return { allowed: false, reason: 'no-permission', document, message: 'Only a GM can write GM notes.' };
    return { allowed: true, reason: 'allowed', document };
}

/** Write note HTML. Always through the API — never a direct setFlag. */
export async function writeGmNote(pageOrUuid, html) {
    const api = getGmNotesApi();
    if (!api?.set) return null;
    try {
        const target = (typeof api.getAsync === 'function') ? pageOrUuid : await resolveTarget(pageOrUuid);
        if (!target) return null;
        return await api.set(target, { html: String(html ?? '') });
    } catch (error) {
        log('Write failed', error?.message, false, false);
        return null;
    }
}

/**
 * Mount the GM Notes field into a host element.
 *
 * Blacksmith's own component does all of it: the editor, the locked-pack
 * and permission states with their remedy messaging, live refresh,
 * styling, and cleanup. We supply a host and hold the controller so we
 * can destroy it.
 *
 * There is deliberately no textarea fallback any more. One existed while
 * `createField()` was pre-release; keeping it would mean shipping a
 * second, worse notes editor that silently diverges from the real one —
 * and a missing component is a Blacksmith version problem the GM should
 * be told about plainly, not papered over.
 *
 * @returns {{destroy: Function}|null} controller — always destroy() before
 *          re-mounting or closing, or hooks and editors leak.
 */
export async function mountGmNotesField(host, pageOrUuid, { label = 'GM Notes' } = {}) {
    if (!host) return null;
    const api = getGmNotesApi();
    if (!api) {
        host.innerHTML = `<p class="gm-notes-unavailable">GM Notes needs the Coffee Pub Blacksmith module.</p>`;
        return null;
    }

    const factory = api.createField ?? api.renderField;   // renderField is the compat alias
    if (typeof factory !== 'function') {
        log('Blacksmith has no GM Notes field component (createField/renderField)', '', false, false);
        host.innerHTML = `<p class="gm-notes-unavailable">GM Notes needs a newer Coffee Pub Blacksmith — this build has no notes field to embed.</p>`;
        return null;
    }

    try {
        // No `collapsed` option: the group header owns collapse state
        // and opens by default, so the guidance is readable on sight.
        const controller = await factory.call(api, pageOrUuid, {
            label,
            editable: true,
            replace: true,
            className: 'bibliosoph-injury-gm-notes'
        });
        controller.mount(host, { replace: true });
        return controller;
    } catch (error) {
        log('Blacksmith GM Notes field failed to mount', error?.message, false, false);
        host.innerHTML = `<p class="gm-notes-unavailable">GM Notes could not be loaded — see the console.</p>`;
        return null;
    }
}
