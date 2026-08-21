// ==================================================================
// ===== LOOT (scripts/manager-loot.js) ==============================
// ==================================================================
//
// Putting things ON an actor — found items and found coins — goes
// through Blacksmith's inventory API rather than through
// `createEmbeddedDocuments` and `actor.update`.
//
// WHY, since a direct write is fewer lines: merging is harder than it
// looks. The row a payload becomes is not the payload — creation fills
// schema defaults, writes `system.identifier` from the name, and
// normalises properties — so a hand-built payload can never be compared
// against an existing row and never merges. Three arrows found in one
// search landed as three rows of one, while the card said "3 Arrows".
// The API also takes a per-actor lock, which a bare `actor.update` does
// not: two finds resolving at once would each read the same balance and
// one would be lost.

import { MODULE } from './const.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `LOOT | ${message}`, data, debug, notify);
    }
}

/** Blacksmith's inventory API, or null when it is unavailable. */
function getInventoryAPI() {
    return game.modules.get('coffee-pub-blacksmith')?.api?.inventory ?? null;
}

/**
 * Add found items to an actor's inventory, merging stacks.
 *
 * One call for the whole find rather than one per slot: a batch is a
 * single write to the Actor, and it is what lets two of the same item
 * merge into a stack of two instead of racing each other.
 *
 * @param {Actor} actor
 * @param {Array<{name: string, uuid: string}>} items
 * @returns {Promise<string[]>} names that could NOT be added
 */
export async function grantFoundItems(actor, items) {
    const inventory = getInventoryAPI();
    if (!inventory?.grantItems) {
        log('Inventory API unavailable — nothing added', '', false, false);
        return items.map((item) => item.name);
    }
    try {
        const outcome = await inventory.grantItems({
            targetActorUuid: actor.uuid,
            items: items.map((item) => ({ itemUuid: item.uuid, quantity: 1 })),
            stack: 'merge'
        });
        if (outcome?.ok) return [];
        // Partial success is the normal case worth reporting: one bad
        // compendium reference must not cost the rest of the find.
        const results = outcome?.results ?? [];
        if (!results.length) return items.map((item) => item.name);
        return items.filter((_, index) => !results[index]?.ok).map((item) => item.name);
    } catch (error) {
        log('grantItems threw', error?.message ?? String(error), false, false);
        return items.map((item) => item.name);
    }
}

/**
 * Add found coins to an actor's purse.
 *
 * @param {Actor} actor
 * @param {{pp: number, gp: number, ep: number, sp: number, cp: number}} coins
 * @returns {Promise<boolean>} whether the coins landed
 */
export async function grantCurrency(actor, coins) {
    const inventory = getInventoryAPI();
    if (!inventory?.grantCurrency) {
        log('Inventory API unavailable — coins not added', '', false, false);
        return false;
    }
    try {
        const outcome = await inventory.grantCurrency({ targetActorUuid: actor.uuid, currency: coins });
        if (!outcome?.ok) log('Coins not added', outcome?.code ?? '', false, false);
        return Boolean(outcome?.ok);
    } catch (error) {
        log('grantCurrency threw', error?.message ?? String(error), false, false);
        return false;
    }
}
