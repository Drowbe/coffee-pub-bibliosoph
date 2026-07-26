// ==================================================================
// ===== SOCIAL TOASTS (manager-social-toasts.js) ===================
// ==================================================================
// Beverage Break, Bio Break, Insults, and Praise — triggered from the
// Messages window header buttons. Each rolls its configured roll table
// and announces the result as a toast on every client, riding the same
// Blacksmith socket relay the crit/fumble roll toasts use. These
// features no longer bind macros, appear in toolbars, or post chat
// cards. The toast look is fixed in code (no settings), one shared
// style for all four.
// ==================================================================

import { MODULE } from './const.js';
import { SOCKET_ROLL_TOAST } from './manager-roll-toasts.js';

/** Fixed look shared by all social toasts. */
const TOAST_STYLE = {
    size: 'small',
    duration: 3,
    animation: 'pop',
    color: '#a4becc',
    backgroundColor: '#000e14'
};

/** One entry per feature: header button image doubles as the toast image. */
export const SOCIAL_TOASTS = {
    beverage: {
        label: 'Beverage Break',
        title: 'Beverage Break!',
        image: 'icons/consumables/drinks/alcohol-beer-stein-wooden-brown.webp',
        tableKey: 'beverageTable',
        sound: 'modules/coffee-pub-blacksmith/sounds/general-cocktail-ice.mp3'
    },
    bio: {
        label: 'Bio Break',
        title: 'Bio Break!',
        image: 'icons/commodities/biological/organ-stomach.webp',
        tableKey: 'bioTable',
        sound: 'modules/coffee-pub-blacksmith/sounds/general-toilet-flushing.mp3'
    },
    insult: {
        label: 'Insult',
        title: 'Insult!',
        image: 'icons/skills/wounds/injury-face-impact-orange.webp',
        tableKey: 'insultsTable',
        sound: 'modules/coffee-pub-blacksmith/sounds/reaction-oooooh.mp3'
    },
    praise: {
        label: 'Praise',
        title: 'Praise!',
        image: 'icons/magic/life/heart-shadow-red.webp',
        tableKey: 'praiseTable',
        sound: 'modules/coffee-pub-blacksmith/sounds/reaction-ahhhhh.mp3'
    }
};

function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api;
}

function getSetting(key, defaultValue) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.getSettingSafely) {
        return BlacksmithUtils.getSettingSafely(MODULE.ID, key, defaultValue);
    }
    try {
        return game.settings.get(MODULE.ID, key) ?? defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

function stripHtml(text) {
    return String(text ?? '').replace(/(<([^>]+)>)/ig, '').trim();
}

/** The feature's configured table name, or null when set to None/unset. */
function getConfiguredTableName(config) {
    const tableName = getSetting(config.tableKey, 'none');
    if (!tableName || tableName === 'none' || tableName === '-- Choose a Roll Table --') return null;
    return tableName;
}

/** A feature's header button shows only when a table is chosen (not None). */
export function isSocialToastEnabled(kind) {
    const config = SOCIAL_TOASTS[kind];
    return !!config && !!getConfiguredTableName(config);
}

/**
 * Roll the feature's table and toast the result on every client.
 * Runs on the clicking client — any user, not just the GM.
 */
export async function triggerSocialToast(kind) {
    const config = SOCIAL_TOASTS[kind];
    if (!config) return;

    const tableName = getConfiguredTableName(config);
    const table = tableName ? game.tables.getName(tableName) : null;
    if (!table) {
        ui.notifications.warn(`Bibliosoph: choose a roll table for ${config.label} in settings.`);
        return;
    }

    // No dice: pick a weighted random result straight from the table.
    // table.roll() would evaluate a real Roll, which triggers dice
    // fulfillment prompts and animations — all wrong for a gag button.
    const results = table.results?.contents ?? [];
    if (!results.length) {
        ui.notifications.warn(`Bibliosoph: the ${config.label} table has no entries.`);
        return;
    }
    const totalWeight = results.reduce((sum, r) => sum + (r.weight || 1), 0);
    let pick = Math.random() * totalWeight;
    let chosen = results[results.length - 1];
    for (const result of results) {
        pick -= (result.weight || 1);
        if (pick < 0) { chosen = result; break; }
    }
    const text = stripHtml(chosen.description ?? chosen.text ?? chosen.name);

    const payload = {
        title: config.title,
        subtitle: text,
        image: config.image,
        sound: config.sound,
        ...TOAST_STYLE,
        moduleId: MODULE.ID
    };

    // Relay to every other client; emit never delivers to the sender,
    // so render locally as well.
    const blacksmith = getBlacksmith();
    try {
        const sockets = blacksmith?.sockets;
        if (sockets) {
            await sockets.waitForReady();
            await sockets.emit(SOCKET_ROLL_TOAST, payload);
        }
    } catch (error) {
        console.warn(`${MODULE.ID} | Social toast relay failed:`, error);
    }
    blacksmith?.toast?.show?.(payload);
}
