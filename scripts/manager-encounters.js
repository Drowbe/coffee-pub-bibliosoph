// ==================================================================
// ===== ENCOUNTER MANAGER ==========================================
// ==================================================================
// Orchestrates the Quick Encounter tool: opens the window, coordinates
// CR/compendium (Blacksmith), search (Recommend), roll for encounter, and deploy.

import { MODULE, BIBLIOSOPH, getDetectionLevelInfo } from './const.js';
import { WindowEncounter, WINDOW_ENCOUNTER_APP_ID, WINDOW_ENCOUNTER_HEIGHT_COLLAPSED } from './window-encounter.js';

let _encounterWindow = null;

/** Max monster types returned by Recommend (random pick; no budget). */
const MAX_RECOMMENDATIONS = 20;
/** Max distinct monster types in a rolled encounter (then we fill by adding more of same types). */
/** Cap actors loaded per compendium when not using cache. */
const MAX_ACTORS_PER_PACK = 200;
/** Cache version for migrations; bump when schema changes. */
const ENCOUNTER_CACHE_VERSION = 1;
/** World setting key for the encounter monster cache. */
const ENCOUNTER_CACHE_SETTING = 'quickEncounterCache';
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
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: openEncounterWindow called', '', true, false);
    const isOurWindow = _encounterWindow?.id === WINDOW_ENCOUNTER_APP_ID
        || _encounterWindow?.element?.id === WINDOW_ENCOUNTER_APP_ID;
    if (_encounterWindow && _encounterWindow.rendered && isOurWindow) {
        _encounterWindow.bringToFront();
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: brought existing window to front', '', true, false);
        return _encounterWindow;
    }
    let position = { width: 1000, height: 800 };
    try {
        const savedBounds = game.settings.get(MODULE.ID, 'quickEncounterWindowBounds');
        if (savedBounds && typeof savedBounds === 'object' && (savedBounds.width != null || savedBounds.height != null || savedBounds.left != null || savedBounds.top != null)) {
            position = { ...position, ...savedBounds };
        }
    } catch (_) {}
    _encounterWindow = new WindowEncounter({
        id: WINDOW_ENCOUNTER_APP_ID,
        position
    });
    _encounterWindow.render(true);
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: new window rendered', '', true, false);
    return _encounterWindow;
}

/**
 * Get BLACKSMITH compendium list (from window or Blacksmith api).
 * If empty, fall back to all Actor compendiums so Quick Encounter still works without Blacksmith config.
 * @returns {string[]} Compendium ids in priority order
 */
function getMonsterCompendiums() {
    const blacksmith = typeof window !== 'undefined' && window.BLACKSMITH;
    const fromApi = game.modules.get('coffee-pub-blacksmith')?.api?.BLACKSMITH;
    const source = blacksmith ?? fromApi;
    let list = source?.arrSelectedMonsterCompendiums ?? source?.arrSelectedActorCompendiums ?? [];
    if (!Array.isArray(list)) list = [];
    if (list.length > 0) return list;
    // Fallback: use all Actor compendiums (game system + world) so we always have something to search
    const actorPacks = game.packs?.filter?.((p) => p.documentName === 'Actor' && p.indexed) ?? [];
    return actorPacks.map((p) => p.collection);
}

/**
 * Return true if the actor is eligible for encounter rolls: NPC (monster) only, not CR 0, not vehicle, not player.
 * D&D 5e: type "npc" = monsters/NPCs, "character" = PC, "vehicle" = vehicle.
 * @param {Actor} doc
 * @returns {boolean}
 */
function isValidEncounterActor(doc) {
    if (!doc) return false;
    const type = doc.type ?? doc.documentName;
    if (type === 'vehicle') return false;
    if (type === 'character') return false; // players
    if (type !== 'npc') return false; // only monsters / NPCs
    const crNum = getActorCR(doc);
    if (crNum === 0 || (typeof crNum === 'number' && Number.isNaN(crNum))) return false; // exclude CR 0
    return true;
}

/**
 * Get token image from an Actor document (prototype token); fallback to actor portrait.
 * Used for result cards so they show the token, not the portrait.
 * @param {Actor|{ prototypeToken?: { texture?: { src?: string }, img?: string }, img?: string }} doc
 * @returns {string}
 */
function getActorTokenImg(doc) {
    if (!doc) return '';
    const pt = doc.prototypeToken ?? doc.prototypeTokenData;
    const src = pt?.texture?.src ?? pt?.img;
    return src && typeof src === 'string' ? src : (doc.img ?? '');
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
 */
function formatCR(value) {
    if (value == null || Number.isNaN(value)) return '—';
    if (typeof value !== 'number') return String(value);
    if (value === 0.5) return '1/2';
    return String(Math.round(value));
}

/** D&D 5e CR to XP (DMG). Used for encounter budget. */
const CR_TO_XP = [
    10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000
];

function getActorXP(doc) {
    const crNum = getActorCR(doc);
    if (Number.isNaN(crNum) || crNum < 0) return NaN;
    const idx = crNum === 0 ? 0 : crNum <= 0.125 ? 1 : crNum <= 0.25 ? 2 : crNum <= 0.5 ? 3 : Math.min(3 + Math.floor(crNum), CR_TO_XP.length - 1);
    return CR_TO_XP[Math.max(0, idx)] ?? NaN;
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
 * Extract habitat tags (lowercase) from D&D 5e environment for cache.
 * @param {*} env - system.details.environment (array or string)
 * @returns {string[]}
 */
function extractHabitatTags(env) {
    if (env == null) return [];
    const raw = Array.isArray(env) ? env : [env];
    const tags = new Set();
    for (const e of raw) {
        const s = String(e).toLowerCase().trim();
        if (!s) continue;
        // One tag per value; optionally split on comma for "Mountain, Hill"
        for (const part of s.split(/\s*,\s*/)) {
            if (part) tags.add(part);
        }
    }
    return [...tags];
}

/**
 * Read encounter cache from settings. Valid only if compendium list matches and entries exist.
 * @returns {{ valid: boolean, entries: Array<{id, name, img, cr, xp, habitats}>, compendiumIds: string[] }}
 */
function getEncounterCache() {
    try {
        const raw = game.settings.get(MODULE.ID, ENCOUNTER_CACHE_SETTING);
        if (!raw || typeof raw !== 'object') return { valid: false, entries: [], compendiumIds: [] };
        const version = raw.version ?? 0;
        if (version !== ENCOUNTER_CACHE_VERSION) return { valid: false, entries: raw.entries ?? [], compendiumIds: raw.compendiumIds ?? [] };
        const compendiumIds = getMonsterCompendiums();
        const cachedIds = raw.compendiumIds ?? [];
        const sameList = Array.isArray(cachedIds) && Array.isArray(compendiumIds)
            && cachedIds.length === compendiumIds.length
            && cachedIds.every((id, i) => id === compendiumIds[i]);
        const entries = Array.isArray(raw.entries) ? raw.entries : [];
        const valid = sameList && entries.length > 0;
        return { valid, entries, compendiumIds };
    } catch (_) {
        return { valid: false, entries: [], compendiumIds: [] };
    }
}

/**
 * Public cache status for UI (valid + count).
 * @returns {{ valid: boolean, count: number }}
 */
export function getEncounterCacheStatus() {
    const { valid, entries } = getEncounterCache();
    return { valid, count: entries.length };
}

/**
 * Build encounter cache from current Blacksmith compendium list: load all NPC/character actors,
 * extract id, name, img, cr, xp, habitats, and save to world setting. Optional progress callback.
 * @param {(packIndex: number, totalPacks: number, entryCount: number) => void} [progressCallback]
 * @returns {Promise<{ count: number }>}
 */
export async function buildEncounterCache(progressCallback) {
    const compendiumIds = getMonsterCompendiums();
    if (compendiumIds.length === 0) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: No compendiums to cache', '', true, false);
        return { count: 0 };
    }

    const allEntries = [];
    const total = compendiumIds.length;

    for (let p = 0; p < compendiumIds.length; p++) {
        const compendiumId = compendiumIds[p];
        const pack = game.packs.get(compendiumId);
        if (!pack) {
            if (typeof progressCallback === 'function') progressCallback(p + 1, total, allEntries.length);
            continue;
        }
        try {
            let docs = [];
            const index = await pack.getIndex();
            const entries = Array.isArray(index) ? index : (index?.index ?? index?.entries ?? []);
            const ids = (Array.isArray(entries) ? entries : []).map((e) => e?._id ?? e?.id).filter(Boolean);
            if (ids.length > 0) {
                docs = await pack.getDocuments({ _id__in: ids });
            } else {
                docs = await pack.getDocuments();
            }
            docs = Array.isArray(docs) ? docs : [];
            for (const doc of docs) {
                if (!isValidEncounterActor(doc)) continue;
                const crNum = getActorCR(doc);
                const xp = getActorXP(doc);
                if (Number.isNaN(crNum) || Number.isNaN(xp)) continue;
                const id = doc.uuid ?? `${compendiumId}.${doc.id}`;
                const env = doc?.system?.details?.environment;
                const habitats = extractHabitatTags(env);
                allEntries.push({
                    id,
                    compendiumId,
                    docId: doc.id,
                    name: doc.name ?? 'Unknown',
                    img: getActorTokenImg(doc),
                    cr: crNum,
                    xp,
                    habitats
                });
            }
        } catch (e) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Quick Encounter: Cache failed for ${compendiumId}`, e?.message ?? '', true, false);
        }
        if (typeof progressCallback === 'function') progressCallback(p + 1, total, allEntries.length);
    }

    const payload = {
        version: ENCOUNTER_CACHE_VERSION,
        compendiumIds,
        builtAt: Date.now(),
        entries: allEntries
    };
    await game.settings.set(MODULE.ID, ENCOUNTER_CACHE_SETTING, payload);
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Cache built', `${allEntries.length} monsters from ${total} compendium(s)`, true, false);
    return { count: allEntries.length };
}

/**
 * Load candidate actors: use cache when valid (fast), otherwise load from compendiums (slower).
 * @returns {Promise<Array<{ doc: { img, name }, id: string, cr: number, xp: number }>>}
 */
async function getCandidatesWithXP(habitat) {
    const cache = getEncounterCache();
    if (cache.valid && cache.entries.length > 0) {
        const habitatLower = (habitat && habitat !== 'Any') ? String(habitat).toLowerCase() : null;
        let filtered = habitatLower
            ? cache.entries.filter((e) => !Array.isArray(e.habitats) || e.habitats.length === 0 || e.habitats.some((h) => h.includes(habitatLower) || habitatLower.includes(h)))
            : cache.entries;
        filtered = filtered.filter((e) => e.cr > 0); // exclude CR 0 (e.g. from older cache)
        return filtered.map((e) => ({
            doc: { img: e.img ?? '', name: e.name ?? 'Unknown' },
            id: e.id,
            cr: e.cr,
            xp: e.xp
        }));
    }

    const compendiumIds = getMonsterCompendiums();
    if (compendiumIds.length === 0) return [];

    const loadOnePack = async (compendiumId) => {
        const pack = game.packs.get(compendiumId);
        if (!pack) return [];
        try {
            let docs;
            const index = await pack.getIndex();
            // getIndex() may return { index }, { entries }, or the array of entries directly
            const entries = Array.isArray(index) ? index : (index?.index ?? index?.entries ?? []);
            const ids = (Array.isArray(entries) ? entries : []).map((e) => e?._id ?? e?.id).filter(Boolean).slice(0, MAX_ACTORS_PER_PACK);
            if (ids.length > 0) {
                docs = await pack.getDocuments({ _id__in: ids });
            } else {
                // Fallback when index shape doesn't give ids (e.g. v13): load all then cap
                docs = await pack.getDocuments();
                docs = (Array.isArray(docs) ? docs : []).slice(0, MAX_ACTORS_PER_PACK);
            }
            if (!docs?.length) return [];
            const out = [];
            for (const doc of docs) {
                if (!isValidEncounterActor(doc)) continue;
                if (!actorMatchesHabitat(doc, habitat)) continue;
                const crNum = getActorCR(doc);
                const xp = getActorXP(doc);
                if (Number.isNaN(crNum) || Number.isNaN(xp)) continue;
                out.push({
                    doc: { img: getActorTokenImg(doc), name: doc.name ?? 'Unknown' },
                    id: doc.uuid ?? `${compendiumId}.${doc.id}`,
                    cr: crNum,
                    xp
                });
            }
            return out;
        } catch (e) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Quick Encounter: Failed to load ${compendiumId}`, e?.message ?? '', true, false);
            return [];
        }
    };

    const packs = await Promise.all(compendiumIds.map((id) => loadOnePack(id)));
    return packs.flat();
}

/**
 * Find monsters by name (ignore habitat/CR). Used for "Include" list; results get override: true.
 * @param {string[]} names - Trimmed, non-empty names (e.g. ["goblin", "orc"])
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string, override: true}>>}
 */
export async function encounterGetIncludeMonsters(names) {
    const normalized = (names || [])
        .map((n) => String(n).trim())
        .filter((n) => n.length > 0);
    if (normalized.length === 0) return [];

    const seen = new Set();
    const results = [];

    // Use cache for name lookup whenever we have entries (even if "invalid" due to compendium list change)
    const cache = getEncounterCache();
    if (cache.entries.length > 0) {
        for (const entry of cache.entries) {
            if (!entry.id || !entry.name || entry.cr <= 0) continue;
            const entryNameLower = String(entry.name).toLowerCase();
            const matched = normalized.some((n) => {
                const searchLower = n.toLowerCase();
                return entryNameLower.includes(searchLower) || searchLower.includes(entryNameLower);
            });
            if (matched && !seen.has(entry.id)) {
                seen.add(entry.id);
                results.push({
                    id: entry.id,
                    img: entry.img ?? '',
                    name: entry.name ?? 'Unknown',
                    cr: formatCR(entry.cr),
                    override: true
                });
            }
        }
        return results;
    }

    const compendiumIds = getMonsterCompendiums();
    for (const compendiumId of compendiumIds) {
        const pack = game.packs.get(compendiumId);
        if (!pack) continue;
        try {
            const index = await pack.getIndex();
            // v13: getIndex() returns a Collection; use .contents for array of index entry objects
            let entries = Array.isArray(index) ? index : (index?.contents ?? index?.index ?? index?.entries ?? []);
            if (entries.length > 0 && Array.isArray(entries[0]) && entries[0].length >= 2) {
                entries = entries.map((e) => e[1]);
            }
            const matchingIds = [];
            for (const e of entries) {
                const name = e?.name ?? e?.metadata?.name ?? '';
                if (!name) continue;
                const nameLower = String(name).toLowerCase();
                const matched = normalized.some((n) => {
                    const searchLower = n.toLowerCase();
                    return nameLower.includes(searchLower) || searchLower.includes(nameLower);
                });
                if (matched) matchingIds.push(e?._id ?? e?.id);
            }
            if (matchingIds.length === 0) continue;
            const docs = await pack.getDocuments({ _id__in: matchingIds.filter(Boolean) });
            for (const doc of docs || []) {
                if (!isValidEncounterActor(doc)) continue;
                const id = doc.uuid ?? `${compendiumId}.${doc.id}`;
                if (seen.has(id)) continue;
                const crNum = getActorCR(doc);
                if (Number.isNaN(crNum) || crNum <= 0) continue;
                const nameLower = String(doc.name ?? '').toLowerCase();
                const matched = normalized.some((n) => {
                    const searchLower = n.toLowerCase();
                    return nameLower.includes(searchLower) || searchLower.includes(nameLower);
                });
                if (!matched) continue;
                seen.add(id);
                results.push({
                    id,
                    img: getActorTokenImg(doc),
                    name: doc.name ?? 'Unknown',
                    cr: formatCR(crNum),
                    override: true
                });
            }
        } catch (e) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Quick Encounter: Include search failed for ${compendiumId}`, e?.message ?? '', true, false);
        }
    }
    return results;
}

/**
 * Recommend monsters: random pick up to maxRecommendations meeting habitat + CR (no budget).
 * Purpose: suggestions that might augment or inspire an encounter; not pre-selected, no counts.
 * @param {number} [minCR=0] - floor: no monster below this CR
 * @param {number} [maxCR=30] - ceiling: no monster above this CR
 * @param {number} [maxRecommendations=20] - max monster types to return (from UI slider)
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string}>>}
 */
export async function encounterRecommend(habitat, difficulty, targetCR, minCR = 0, maxCR = 30, maxRecommendations = MAX_RECOMMENDATIONS) {
    let candidates = await getCandidatesWithXP(habitat);
    const minCRNum = typeof minCR === 'number' && !Number.isNaN(minCR) ? Math.max(0, minCR) : 0;
    const maxCRNum = typeof maxCR === 'number' && !Number.isNaN(maxCR) ? Math.min(30, Math.max(0, maxCR)) : 30;
    if (minCRNum > 0) candidates = candidates.filter((c) => c.cr >= minCRNum);
    if (maxCRNum < 30) candidates = candidates.filter((c) => c.cr <= maxCRNum);
    if (candidates.length === 0) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: No monster compendiums or no matching actors', '', true, true);
        return [];
    }

    const capNum = typeof maxRecommendations === 'number' && !Number.isNaN(maxRecommendations)
        ? Math.max(1, Math.min(100, maxRecommendations))
        : MAX_RECOMMENDATIONS;
    // Random pick up to capNum (no budget; ignore XP)
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const cap = Math.min(capNum, shuffled.length);
    const results = [];
    for (let i = 0; i < cap; i++) {
        const { doc, id, cr: crNum } = shuffled[i];
        results.push({
            id,
            img: doc.img ?? '',
            name: doc.name ?? 'Unknown',
            cr: formatCR(crNum)
        });
    }

    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Recommend', `${results.length} monsters (habitat=${habitat}, CR ${minCRNum}–${maxCRNum}, random)`, true, false);
    return results;
}

/**
 * Build a single encounter: up to variability types, then add more of those types to close monster CR gap (without going over target).
 * Optionally appends extra unselected monsters (count 0) for GM swap options.
 * Returns array of { id, img, name, cr, count } with count >= 1 for built, count 0 for extras.
 * @param {string} habitat
 * @param {number} targetCR - target encounter CR; we fill until total monster CR is as close as possible without exceeding this
 * @param {number} [minCR=0] - floor: no monster below this CR
 * @param {number} [maxCR=30] - ceiling: no monster above this CR
 * @param {number} [variability=3] - number of monster types in the built encounter
 * @param {number} [maxExtraOptions=0] - add this many extra unselected monsters (count 0) to the result
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string, count: number}>>}
 */
export async function buildEncounter(habitat, targetCR, minCR = 0, maxCR = 30, variability = 3, maxExtraOptions = 0) {
    let candidates = await getCandidatesWithXP(habitat);
    const minCRNum = typeof minCR === 'number' && !Number.isNaN(minCR) ? Math.max(0, minCR) : 0;
    const maxCRNum = typeof maxCR === 'number' && !Number.isNaN(maxCR) ? Math.min(30, Math.max(0, maxCR)) : 30;
    if (minCRNum > 0) candidates = candidates.filter((c) => c.cr >= minCRNum);
    if (maxCRNum < 30) candidates = candidates.filter((c) => c.cr <= maxCRNum);
    if (candidates.length === 0) return [];

    const targetCRNum = typeof targetCR === 'number' && !Number.isNaN(targetCR) ? Math.max(0, targetCR) : 0;
    const maxTypes = Math.max(1, Math.min(5, Math.floor(variability) || 3));
    /** @type {Array<{id: string, img: string, name: string, crNum: number, count: number}>} */
    const encounter = [];
    let totalCR = 0;
    const usedIds = new Set();

    // Phase 1: pick up to variability types at random, each with count 1, so total CR <= target
    for (let i = 0; i < maxTypes; i++) {
        const valid = candidates.filter((c) => !usedIds.has(c.id) && c.cr + totalCR <= targetCRNum);
        if (valid.length === 0) break;
        const pick = valid[Math.floor(Math.random() * valid.length)];
        usedIds.add(pick.id);
        encounter.push({
            id: pick.id,
            img: pick.doc?.img ?? '',
            name: pick.doc?.name ?? 'Unknown',
            crNum: pick.cr,
            count: 1
        });
        totalCR += pick.cr;
    }

    if (encounter.length === 0) {
        const fallback = candidates.filter((c) => c.cr <= targetCRNum);
        const pick = fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : candidates[0];
        if (pick) {
            encounter.push({
                id: pick.id,
                img: pick.doc?.img ?? '',
                name: pick.doc?.name ?? 'Unknown',
                crNum: pick.cr,
                count: 1
            });
            totalCR = pick.cr;
        }
    }

    // Phase 2: add more of an existing type (whichever gets total CR closest to target without going over) until we can't
    while (true) {
        let bestEntry = null;
        let bestNewTotal = totalCR;
        for (const entry of encounter) {
            const newTotal = totalCR + entry.crNum;
            if (newTotal <= targetCRNum && newTotal > bestNewTotal) {
                bestNewTotal = newTotal;
                bestEntry = entry;
            }
        }
        if (bestEntry === null) break;
        bestEntry.count += 1;
        totalCR = bestNewTotal;
    }

    const out = encounter.map((e) => ({
        id: e.id,
        img: e.img,
        name: e.name,
        cr: formatCR(e.crNum),
        count: e.count
    }));

    // Phase 3: add extra unselected monsters (count 0) for GM swap options
    const numExtra = Math.max(0, Math.floor(maxExtraOptions));
    if (numExtra > 0) {
        const unused = candidates.filter((c) => !usedIds.has(c.id));
        const shuffled = [...unused].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numExtra && i < shuffled.length; i++) {
            const pick = shuffled[i];
            out.push({
                id: pick.id,
                img: pick.doc?.img ?? '',
                name: pick.doc?.name ?? 'Unknown',
                cr: formatCR(pick.cr),
                count: 0
            });
        }
    }

    const totalTokens = out.filter((e) => e.count > 0).reduce((s, e) => s + e.count, 0);
    const extraCount = out.length - encounter.length;
    const extraText = extraCount > 0 ? ` +${extraCount} options` : '';
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Built encounter', `${encounter.length} types${extraText}, ${totalTokens} tokens (CR gap ${(targetCRNum - totalCR).toFixed(2)})`, true, false);
    return out;
}

/**
 * Load encounters narrative JSON (encounterFalse / encounterTrue).
 * Structure: { encounterFalse: { [habitat]: { day: [], night: [] } }, encounterTrue: same }.
 * @returns {Promise<Object>}
 */
async function loadEncounterNarrative() {
    const res = await fetch(BIBLIOSOPH.ENCOUNTER_NARRATIVE_PATH);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
}

/**
 * Get current time of day from game time (v13 game.time).
 * Uses calendar hours-per-day so it works with non-24h calendars.
 * @returns {"day" | "night"}
 */
function getTimeOfDay() {
    if (typeof game === 'undefined' || !game.time?.components) return 'day';
    const { hour } = game.time.components;
    const hoursPerDay = game.time.calendar?.config?.days?.hoursPerDay ?? 24;
    const dayStart = Math.floor(hoursPerDay * 0.25);
    const nightStart = Math.floor(hoursPerDay * 0.75);
    return (hour >= dayStart && hour < nightStart) ? 'day' : 'night';
}

/**
 * Get narrative entries for a given encounter type, habitat, and time of day.
 * narrativeJson[encounterKey] is { [habitat]: { day: [], night: [] } }.
 * @param {Object} narrativeJson - loaded encounters-narrative.json
 * @param {"encounterFalse" | "encounterTrue"} encounterKey
 * @param {string} habitat - e.g. "Any", "Forest"
 * @param {"day" | "night"} timeOfDay
 * @returns {Array<{ title: string, icon: string, image?: string, description: string }>}
 */
function getNarrativeEntriesForHabitatAndTime(narrativeJson, encounterKey, habitat, timeOfDay) {
    const section = narrativeJson[encounterKey];
    if (!section || typeof section !== 'object') return [];
    const habitatKey = (habitat && habitat !== 'Any')
        ? (Object.keys(section).find((k) => k.toLowerCase() === habitat.toLowerCase()) ?? habitat)
        : null;
    const resolvedHabitat = habitatKey ?? (() => {
        const keys = Object.keys(section).filter((k) => section[k]?.[timeOfDay]);
        return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
    })();
    if (!resolvedHabitat) return [];
    const byTime = section[resolvedHabitat];
    const entries = byTime?.[timeOfDay];
    return Array.isArray(entries) ? entries : [];
}

/**
 * Pick a random encounter intro entry (encounterTrue) for the given habitat and current time of day.
 * Shared by roll (when there is an encounter) and deploy card (when no intro from roll, e.g. Recommend → Deploy).
 * @param {Object} narrativeJson - loaded encounters-narrative.json
 * @param {string} habitat - e.g. "Any", "Forest"
 * @returns {{ title: string, icon: string, image?: string, description: string } | null}
 */
function pickRandomEncounterIntroEntry(narrativeJson, habitat) {
    const timeOfDay = getTimeOfDay();
    const entries = getNarrativeEntriesForHabitatAndTime(narrativeJson, 'encounterTrue', habitat, timeOfDay);
    return entries.length ? entries[Math.floor(Math.random() * entries.length)] : null;
}

/**
 * Build encounter card data for chat-card.hbs (isEncounterCard branch).
 * @param {Object} entry - { title, icon, image?, description }
 * @param {string} theme - card theme (e.g. from cardThemeEncounter)
 * @param {string} [cardTitle] - e.g. "Encounter" or "No Encounter"
 * @param {Array<{name: string, count?: number, cr: string, img?: string}>} [encounterMonsters] - optional list to show on card
 * @returns {Object} CARDDATA for template
 */
function buildEncounterCardData(entry, theme, cardTitle = 'Encounter', encounterMonsters = null) {
    const strUserName = game.user?.name ?? '';
    const strUserAvatar = game.user?.avatar ?? '';
    const strCharacterName = game.user?.character?.name ?? '';
    const data = {
        isEncounterCard: true,
        isGM: game.user?.isGM ?? false,
        userName: strUserName,
        userAvatar: strUserAvatar,
        characterName: strCharacterName,
        theme: theme ?? 'theme-default',
        iconStyle: 'fa-swords',
        cardTitle,
        narrativeTitle: entry?.title ?? cardTitle,
        narrativeDescription: entry?.description ?? '',
        narrativeIcon: entry?.icon ?? '<i class="fa-solid fa-dice"></i>',
        narrativeImage: entry?.image ?? null
    };
    if (Array.isArray(encounterMonsters) && encounterMonsters.length > 0) {
        data.encounterMonsters = encounterMonsters.map((m) => {
            const name = m.name ?? 'Unknown';
            const count = typeof m.count === 'number' && m.count >= 1 ? m.count : 1;
            const uuid = m.id || m.uuid || m.actorUuid || m.actorUUID;
            const displayName = count > 1 ? `${count} × ${name}` : name;
            const displayNameLink = uuid ? `@UUID[${uuid}]{${displayName}}` : displayName;
            return {
                name,
                count,
                displayName,
                displayNameLink,
                cr: m.cr ?? '—',
                img: m.img ?? m.portrait ?? m.tokenImg ?? ''
            };
        });
        const detectionLevel = Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterDetection')) ?? 3));
        const detectionInfo = getDetectionLevelInfo(detectionLevel);
        data.detectionLevelHeader = detectionInfo.label;
        data.detectionNarrativeText = detectionInfo.narrative;
    }
    return data;
}

/**
 * Render encounter card HTML and post to chat.
 * @param {Object} cardData - from buildEncounterCardData
 * @returns {Promise<void>}
 */
async function postEncounterCardToChat(cardData) {
    const response = await fetch(BIBLIOSOPH.MESSAGE_TEMPLATE_CARD);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);
    const compiledHtml = template(cardData);
    await ChatMessage.create({
        user: game.user.id,
        content: compiledHtml,
        speaker: ChatMessage.getSpeaker()
    });
}

/**
 * Roll for encounter using Global Encounter Settings (encounterOdds).
 * Uses encounters-narrative.json for no-encounter and encounter intro text.
 * If no encounter: posts No Encounter card, returns empty recommendations.
 * If encounter: runs recommend, returns recommendations (encounter card is posted only on Deploy when Chat Card is checked).
 * @param {string} habitat - e.g. "Any", "Forest"
 * @param {string} difficulty - "Easy" | "Medium" | "Hard" | "Deadly"
 * @param {number} targetCR - target encounter CR for recommend
 * @param {number} [minCR=0] - floor: no monster below this CR
 * @param {number} [maxCR=30] - ceiling: no monster above this CR
 * @returns {Promise<{ encounter: boolean, recommendations: Array, introEntry?: Object }>}
 */
export async function rollForEncounter(habitat, difficulty, targetCR, minCR = 0, maxCR = 30) {
    let narrativeJson;
    try {
        narrativeJson = await loadEncounterNarrative();
    } catch (e) {
        console.warn(MODULE.ID + ' | Could not load encounter narrative:', e);
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Could not load encounters-narrative.json.', e?.message ?? String(e), false, false);
        return { encounter: false, recommendations: [] };
    }

    const timeOfDay = getTimeOfDay();
    const encounterFalseEntries = getNarrativeEntriesForHabitatAndTime(narrativeJson, 'encounterFalse', habitat, timeOfDay);
    const pickEntry = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : { title: '', icon: '<i class="fa-solid fa-dice"></i>', description: '' });

    const encounterOdds = Math.max(0, Math.min(100, Number(game.settings.get(MODULE.ID, 'encounterOdds')) ?? 20));
    const roll = await new Roll('1d100').evaluate();
    if (game.settings.get(MODULE.ID, 'showDiceRolls') && typeof BlacksmithUtils?.rollCoffeePubDice === 'function') {
        BlacksmithUtils.rollCoffeePubDice(roll);
    }
    const hasEncounter = roll.total <= encounterOdds;

    const theme = game.settings.get(MODULE.ID, 'cardThemeEncounter') ?? 'theme-default';

    if (!hasEncounter) {
        const entry = pickEntry(encounterFalseEntries);
        const cardData = buildEncounterCardData(entry, theme, 'No Encounter');
        await postEncounterCardToChat(cardData);
        const encounterFalseSound = game.settings.get(MODULE.ID, 'encounterFalseSound');
        const encounterSoundVolume = game.settings.get(MODULE.ID, 'encounterSoundVolume') ?? 0.7;
        if (typeof BlacksmithUtils?.playSound === 'function' && encounterFalseSound && encounterFalseSound !== 'none') {
            BlacksmithUtils.playSound(encounterFalseSound, String(encounterSoundVolume));
        }
        return { encounter: false, recommendations: [] };
    }

    const introEntry = pickRandomEncounterIntroEntry(narrativeJson, habitat);
    const variability = Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterVariability')) ?? 3));
    const maxRec = Math.max(5, Math.min(30, Number(game.settings.get(MODULE.ID, 'quickEncounterMaxRecommendations')) ?? 10));
    const maxExtraOptions = Math.max(0, maxRec - variability);
    const recommendations = await buildEncounter(habitat, targetCR, minCR, maxCR, variability, maxExtraOptions);
    const n = recommendations.filter((r) => (r.count ?? 0) > 0).reduce((s, r) => s + (r.count ?? 1), 0);
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Roll for Encounter', `${recommendations.length} types, ${n} tokens`, false, false);
    return { encounter: true, recommendations, introEntry };
}

/**
 * Post the encounter deploy card to chat with the selected monster list, then place is done by the caller.
 * Card shows narrative (optional intro or a random encounterTrue entry for habitat/time) plus the list of monsters being placed.
 * @param {Object} [introEntry] - optional narrative entry from roll (title, description, icon, image); if null, picks from narrative by habitat/time
 * @param {Array<{name: string, count?: number, cr: string, img?: string}>} [selectedMonsters] - monsters being deployed (for card list)
 * @param {string} [habitat] - e.g. "Mountain"; card title becomes "{habitat} Encounter" when set (omitted when "Any"); also used to pick narrative when introEntry is null
 */
export async function postEncounterDeployCardToChat(introEntry, selectedMonsters = null, habitat = '') {
    const theme = game.settings.get(MODULE.ID, 'cardThemeEncounter') ?? 'theme-default';
    let entry;
    const fallbackEntry = { title: 'Encounter Deployed', icon: '<i class="fa-solid fa-map-location-dot"></i>', description: '' };
    if (introEntry) {
        entry = { ...introEntry };
    } else {
        try {
            const narrativeJson = await loadEncounterNarrative();
            entry = pickRandomEncounterIntroEntry(narrativeJson, habitat) ?? fallbackEntry;
        } catch (e) {
            console.warn(MODULE.ID + ' | Could not load encounter narrative for deploy card:', e);
            entry = fallbackEntry;
        }
    }
    const habitatStr = habitat ? String(habitat).trim() : '';
    const cardTitle = (habitatStr && habitatStr.toLowerCase() !== 'any') ? `${habitatStr} Encounter` : 'Encounter';
    const cardData = buildEncounterCardData(entry, theme, cardTitle, selectedMonsters);
    await postEncounterCardToChat(cardData);
    const encounterTrueSound = game.settings.get(MODULE.ID, 'encounterTrueSound');
    const encounterSoundVolume = game.settings.get(MODULE.ID, 'encounterSoundVolume') ?? 0.7;
    if (typeof BlacksmithUtils?.playSound === 'function' && encounterTrueSound && encounterTrueSound !== 'none') {
        BlacksmithUtils.playSound(encounterTrueSound, String(encounterSoundVolume));
    }
}

// Expose for window-encounter.js
if (typeof window !== 'undefined') {
    window.bibliosophEncounterRecommend = encounterRecommend;
    window.bibliosophEncounterGetIncludeMonsters = encounterGetIncludeMonsters;
    window.bibliosophRollForEncounter = rollForEncounter;
    window.bibliosophPostEncounterDeployCard = postEncounterDeployCardToChat;
    window.bibliosophBuildEncounterCache = buildEncounterCache;
    window.bibliosophGetEncounterCacheStatus = getEncounterCacheStatus;
}
