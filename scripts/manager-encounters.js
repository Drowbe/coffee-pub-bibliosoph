// ==================================================================
// ===== ENCOUNTER MANAGER ==========================================
// ==================================================================
// Orchestrates the Quick Encounter tool: opens the window, coordinates
// CR/compendium (Blacksmith), and will wire search/deploy later.

import { MODULE } from './const.js';
import { WindowEncounter, WINDOW_ENCOUNTER_APP_ID } from './window-encounter.js';

let _encounterWindow = null;

/**
 * Open the Quick Encounter configuration window (Application V2).
 * Idempotent: reuses existing window if open. Only reuses our own app (by id) to avoid
 * focusing another module's window (e.g. Artificer).
 */
export function openEncounterWindow() {
    const isOurWindow = _encounterWindow?.id === WINDOW_ENCOUNTER_APP_ID
        || _encounterWindow?.element?.id === WINDOW_ENCOUNTER_APP_ID;
    if (_encounterWindow && _encounterWindow.rendered && isOurWindow) {
        _encounterWindow.bringToFront();
        return _encounterWindow;
    }
    _encounterWindow = new WindowEncounter({ id: WINDOW_ENCOUNTER_APP_ID });
    _encounterWindow.render(true);
    return _encounterWindow;
}

/**
 * Stub for "Recommend monsters" — manager will implement compendium search
 * using BLACKSMITH.arrSelectedMonsterCompendiums and return { id, img, name, cr }[].
 * Set on window so the encounter window can call it.
 * @param {string} habitat
 * @param {string} difficulty
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string}>>}
 */
export async function encounterRecommend(habitat, difficulty) {
    // TODO: search compendiums, filter by habitat/CR/difficulty, return list
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Recommend not implemented yet', { habitat, difficulty }, true, false);
    }
    return [];
}

// Expose for window-encounter.js so "Recommend monsters" can call it
if (typeof window !== 'undefined') {
    window.bibliosophEncounterRecommend = encounterRecommend;
}
