// ==================================================================
// ===== ENCOUNTER MANAGER ==========================================
// ==================================================================
// Orchestrates the Quick Encounter tool: opens the window, coordinates
// CR/compendium (Blacksmith), search (Recommend), roll for encounter, and deploy.

import { MODULE, BIBLIOSOPH } from './const.js';
import { WindowEncounter, WINDOW_ENCOUNTER_APP_ID } from './window-encounter.js';

let _encounterWindow = null;

const MAX_RECOMMENDATIONS = 24;
/** Cap actors loaded per compendium to keep lookup under ~10–15s. */
const MAX_ACTORS_PER_PACK = 200;
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
    let position = { width: 500, height: 750 };
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
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: new window rendered', '', true, false);
    }
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
 * Load candidate actors from all compendiums in parallel, capped per pack for speed.
 * @returns {Promise<Array<{ doc: Actor, id: string, cr: number, xp: number }>>}
 */
async function getCandidatesWithXP(habitat) {
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
                if (doc?.type !== 'npc' && doc?.type !== 'character') continue;
                if (!actorMatchesHabitat(doc, habitat)) continue;
                const crNum = getActorCR(doc);
                const xp = getActorXP(doc);
                if (Number.isNaN(crNum) || Number.isNaN(xp)) continue;
                out.push({
                    doc,
                    id: doc.uuid ?? `${compendiumId}.${doc.id}`,
                    cr: crNum,
                    xp
                });
            }
            return out;
        } catch (e) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Quick Encounter: Failed to load ${compendiumId}`, e?.message ?? '', true, false);
            }
            return [];
        }
    };

    const packs = await Promise.all(compendiumIds.map((id) => loadOnePack(id)));
    return packs.flat();
}

/**
 * Recommend monsters: search Blacksmith-configured compendiums, filter by habitat and CR.
 * Uses parallel pack loading and per-pack cap for speed.
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string}>>}
 */
export async function encounterRecommend(habitat, difficulty, targetCR) {
    const candidates = await getCandidatesWithXP(habitat);
    if (candidates.length === 0) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: No monster compendiums or no matching actors', '', true, true);
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
    for (const { doc, id, cr: crNum } of candidates) {
        if (results.length >= MAX_RECOMMENDATIONS) break;
        if (crNum < crMin || crNum > crMax) continue;
        results.push({
            id,
            img: doc.img ?? '',
            name: doc.name ?? 'Unknown',
            cr: formatCR(crNum)
        });
    }

    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Recommend', `${results.length} monsters (habitat=${habitat}, CR ${crMin}-${crMax})`, true, false);
    }
    return results;
}

/**
 * Build a single encounter: a set of monsters that together meet the target CR (XP budget).
 * Returns array of { id, img, name, cr, count } with count >= 1.
 * @param {string} habitat
 * @param {number} targetCR - target encounter CR (used for XP budget)
 * @returns {Promise<Array<{id: string, img: string, name: string, cr: string, count: number}>>}
 */
export async function buildEncounter(habitat, targetCR) {
    const candidates = await getCandidatesWithXP(habitat);
    if (candidates.length === 0) return [];

    const budget = CR_TO_XP[Math.min(Math.max(0, Math.floor(targetCR) + 3), CR_TO_XP.length - 1)] ?? 1800;
    const minMonsters = 1;
    const maxMonsters = 6;
    const multiplier = (n) => (n <= 1 ? 1 : n <= 2 ? 1.5 : n <= 6 ? 2 : n <= 10 ? 2.5 : 3);

    const encounter = [];
    let totalAdjustedXP = 0;
    let monsterCount = 0;

    while (monsterCount < maxMonsters) {
        const nextMult = multiplier(monsterCount + 1);
        const remaining = budget - totalAdjustedXP;
        if (remaining <= 0) break;
        const maxSingleXP = Math.ceil(remaining / nextMult);
        const valid = candidates.filter((c) => c.xp <= maxSingleXP && c.xp >= 10);
        if (valid.length === 0) break;
        const pick = valid[Math.floor(Math.random() * valid.length)];
        const doc = pick.doc;
        const xpCost = pick.xp * nextMult;
        if (totalAdjustedXP + xpCost > budget * 1.15) break;

        const existing = encounter.find((e) => e.id === pick.id);
        if (existing) {
            existing.count += 1;
        } else {
            encounter.push({
                id: pick.id,
                img: doc.img ?? '',
                name: doc.name ?? 'Unknown',
                cr: formatCR(pick.cr),
                count: 1
            });
        }
        totalAdjustedXP += xpCost;
        monsterCount += 1;
    }

    if (encounter.length === 0) {
        const fallback = candidates[Math.floor(Math.random() * candidates.length)];
        if (fallback) {
            encounter.push({
                id: fallback.id,
                img: fallback.doc.img ?? '',
                name: fallback.doc.name ?? 'Unknown',
                cr: formatCR(fallback.cr),
                count: 1
            });
        }
    }

    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        const totalTokens = encounter.reduce((s, e) => s + e.count, 0);
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Built encounter', `${encounter.length} types, ${totalTokens} tokens`, true, false);
    }
    return encounter;
}

/**
 * Load encounters narrative JSON (encounterFalse / encounterTrue).
 * @returns {Promise<{ encounterFalse: Array, encounterTrue: Array }>}
 */
async function loadEncounterNarrative() {
    const res = await fetch(BIBLIOSOPH.ENCOUNTER_NARRATIVE_PATH);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
}

/**
 * Build encounter card data for chat-card.hbs (isEncounterCard branch).
 * @param {Object} entry - { title, icon, image?, description }
 * @param {string} theme - card theme (e.g. from cardThemeEncounter)
 * @param {string} [cardTitle] - e.g. "Encounter" or "No Encounter"
 * @returns {Object} CARDDATA for template
 */
function buildEncounterCardData(entry, theme, cardTitle = 'Encounter') {
    const strUserName = game.user?.name ?? '';
    const strUserAvatar = game.user?.avatar ?? '';
    const strCharacterName = game.user?.character?.name ?? game.i18n?.localize?.('coffee-pub-bibliosoph.NoCharacterSet') ?? 'No Character Set';
    return {
        isEncounterCard: true,
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
 * Roll for encounter using Global Encounter Settings (encounterOdds, encounterDice).
 * Uses encounters-narrative.json for no-encounter and encounter intro text.
 * If encounter: posts intro card, runs recommend, returns recommendations.
 * If no encounter: posts no-encounter card, returns empty recommendations.
 * @param {string} habitat - e.g. "Any", "Forest"
 * @param {string} difficulty - "Easy" | "Medium" | "Hard" | "Deadly"
 * @param {number} targetCR - target encounter CR for recommend
 * @returns {Promise<{ encounter: boolean, recommendations: Array, introEntry?: Object }>}
 */
export async function rollForEncounter(habitat, difficulty, targetCR) {
    let narrativeJson;
    try {
        narrativeJson = await loadEncounterNarrative();
    } catch (e) {
        console.warn(MODULE.ID + ' | Could not load encounter narrative:', e);
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Could not load encounters-narrative.json.', e?.message ?? String(e), false, true);
        }
        return { encounter: false, recommendations: [] };
    }

    const encounterFalseEntries = narrativeJson.encounterFalse ?? [];
    const encounterTrueEntries = narrativeJson.encounterTrue ?? [];
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
        if (typeof BlacksmithUtils?.playSound === 'function') {
            BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/rustling-grass.mp3', '0.7');
        }
        return { encounter: false, recommendations: [] };
    }

    const introEntry = pickEntry(encounterTrueEntries);
    const introCardData = buildEncounterCardData(introEntry, theme, 'Encounter');
    await postEncounterCardToChat(introCardData);
    if (typeof BlacksmithUtils?.playSound === 'function') {
        BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/weapon-sword-blade-swish.mp3', '0.7');
    }

    const recommendations = await buildEncounter(habitat, targetCR);
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        const n = recommendations.reduce((s, r) => s + (r.count ?? 1), 0);
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Roll for Encounter', `${recommendations.length} types, ${n} tokens`, false, false);
    }
    return { encounter: true, recommendations, introEntry };
}

/**
 * Post the "encounter deploy" card to chat (when user deploys after a roll-for-encounter).
 * Uses the same intro entry or a simple deploy message.
 * @param {Object} [introEntry] - optional narrative entry from roll (title, description, icon, image)
 */
export async function postEncounterDeployCardToChat(introEntry) {
    const theme = game.settings.get(MODULE.ID, 'cardThemeEncounter') ?? 'theme-default';
    const entry = introEntry
        ? { ...introEntry, description: introEntry.description ? `${introEntry.description} Monsters have been deployed to the canvas.` : 'Monsters have been deployed to the canvas.' }
        : { title: 'Encounter Deployed', icon: '<i class="fa-solid fa-map-location-dot"></i>', description: 'Monsters have been deployed to the canvas.' };
    const cardData = buildEncounterCardData(entry, theme, 'Encounter');
    await postEncounterCardToChat(cardData);
}

// Expose for window-encounter.js
if (typeof window !== 'undefined') {
    window.bibliosophEncounterRecommend = encounterRecommend;
    window.bibliosophRollForEncounter = rollForEncounter;
    window.bibliosophPostEncounterDeployCard = postEncounterDeployCardToChat;
}
