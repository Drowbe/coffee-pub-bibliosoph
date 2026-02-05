// ==================================================================
// ===== ENCOUNTER MANAGER ==========================================
// ==================================================================
// Orchestrates the Quick Encounter tool: opens the window, coordinates
// CR/compendium (Blacksmith), search (Recommend), and will wire deploy later.

import { MODULE } from './const.js';
import { WindowEncounter, WINDOW_ENCOUNTER_APP_ID } from './window-encounter.js';

let _encounterWindow = null;

const MAX_RECOMMENDATIONS = 24;
const OFFICIAL_HABITATS = new Set([
    'Any', 'Arctic', 'Coastal', 'Desert', 'Forest', 'Grassland',
    'Hill', 'Mountain', 'Planar', 'Swamp', 'Underdark', 'Underwater', 'Urban'
]);

/**
 * Open the Quick Encounter configuration window (Application V2).
 * Idempotent: reuses existing window if open. Only reuses our own app (by id) to avoid
 * focusing another module's window (e.g. Artificer).
 */
export function openEncounterWindow() {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: openEncounterWindow called', '', true, false);
    }
    const isOurWindow = _encounterWindow?.id === WINDOW_ENCOUNTER_APP_ID
        || _encounterWindow?.element?.id === WINDOW_ENCOUNTER_APP_ID;
    if (_encounterWindow && _encounterWindow.rendered && isOurWindow) {
        _encounterWindow.bringToFront();
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: brought existing window to front', '', true, false);
        }
        return _encounterWindow;
    }
    _encounterWindow = new WindowEncounter({ id: WINDOW_ENCOUNTER_APP_ID });
    _encounterWindow.render(true);
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: new window rendered', '', true, false);
    }
    return _encounterWindow;
}

/**
 * Get BLACKSMITH compendium list (from window or Blacksmith api).
 * @returns {string[]} Compendium ids in priority order
 */
function getMonsterCompendiums() {
    const blacksmith = typeof window !== 'undefined' && window.BLACKSMITH;
    const fromApi = game.modules.get('coffee-pub-blacksmith')?.api?.BLACKSMITH;
    const source = blacksmith ?? fromApi;
    const list = source?.arrSelectedMonsterCompendiums ?? source?.arrSelectedActorCompendiums ?? [];
    return Array.isArray(list) ? list : [];
}

/**
 * Get numeric CR from D&D 5e actor (system.details.cr).
 * @param {Actor} doc
 * @returns {number}
 */
function getActorCR(doc) {
    const cr = doc?.system?.details?.cr;
    if (cr == null) return NaN;
    if (typeof cr === 'number' && !Number.isNaN(cr)) return cr;
    if (typeof cr === 'object' && typeof cr.value === 'number') return cr.value;
    if (typeof cr === 'string') return parseFloat(cr) || NaN;
    return NaN;
}

/**
 * Format CR for display (e.g. 0.5 -> "1/2").
 * Uses Blacksmith if available, else simple string.
 */
function formatCR(value) {
    if (value == null || Number.isNaN(value)) return '—';
    if (typeof value !== 'number') return String(value);
    if (value === 0.5) return '1/2';
    return String(Math.round(value));
}

/**
 * Check if actor matches habitat. D&D 5e: system.details.environment (array) or environment string.
 * @param {Actor} doc
 * @param {string} habitat - "Any" or one of OFFICIAL_HABITATS
 */
function actorMatchesHabitat(doc, habitat) {
    if (!habitat || habitat === 'Any') return true;
    const env = doc?.system?.details?.environment;
    if (env == null) return true;
    if (Array.isArray(env)) {
        return env.some(e => String(e).toLowerCase().includes(habitat.toLowerCase()));
    }
    return String(env).toLowerCase().includes(habitat.toLowerCase());
}

/**
 * Recommend monsters: search Blacksmith-configured compendiums, filter by habitat and CR.
 * @param {string} habitat - e.g. "Any", "Forest"
 * @param {string} difficulty - e.g. "Easy", "Medium", "Hard", "Deadly"
 * @param {number} [targetCR] - optional target encounter CR; if set, search around this CR instead of party-based range
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string}>>}
 */
export async function encounterRecommend(habitat, difficulty, targetCR) {
    const compendiumIds = getMonsterCompendiums();
    if (compendiumIds.length === 0) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: No monster compendiums configured in Blacksmith', '', true, true);
        }
        return [];
    }

    let centerCR = NaN;
    if (typeof targetCR === 'number' && !Number.isNaN(targetCR)) {
        centerCR = Math.max(0, targetCR);
    }
    if (Number.isNaN(centerCR)) {
        try {
            const api = game.modules.get('coffee-pub-blacksmith')?.api;
            const assessment = api?.getCombatAssessment ? await api.getCombatAssessment() : null;
            if (assessment?.partyCR != null) {
                centerCR = typeof assessment.partyCR === 'number' ? assessment.partyCR : parseFloat(assessment.partyCR);
            }
        } catch (_) {}
        if (Number.isNaN(centerCR)) centerCR = 5;
    }
    const crMin = Math.max(0, centerCR - 2);
    const crMax = centerCR + 3;

    const results = [];
    for (const compendiumId of compendiumIds) {
        if (results.length >= MAX_RECOMMENDATIONS) break;
        const pack = game.packs.get(compendiumId);
        if (!pack) continue;
        let docs;
        try {
            docs = await pack.getDocuments();
        } catch (e) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Quick Encounter: Failed to load compendium ${compendiumId}`, e?.message ?? '', true, false);
            }
            continue;
        }
        for (const doc of docs) {
            if (results.length >= MAX_RECOMMENDATIONS) break;
            const crNum = getActorCR(doc);
            if (Number.isNaN(crNum)) continue;
            if (doc?.type !== 'npc' && doc?.type !== 'character') continue;
            if (!actorMatchesHabitat(doc, habitat)) continue;
            if (crNum < crMin || crNum > crMax) continue;
            const id = doc.uuid ?? doc.id ?? `${compendiumId}.${doc.id}`;
            results.push({
                id,
                img: doc.img ?? '',
                name: doc.name ?? 'Unknown',
                cr: formatCR(crNum)
            });
        }
    }

    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Recommend', `${results.length} monsters (habitat=${habitat}, CR ${crMin}-${crMax})`, true, false);
    }
    return results;
}

// Expose for window-encounter.js so "Recommend monsters" can call it
if (typeof window !== 'undefined') {
    window.bibliosophEncounterRecommend = encounterRecommend;
}
