// ==================================================================
// ===== INSPIRATION (scripts/manager-inspiration.js) ================
// ==================================================================
// Drawing and using homebrew inspiration cards.
//
// The lifecycle, per the house rules:
//   DRAW — GM discretion, or a critical that grants access. Drawing a
//          card GIVES the character an inspiration point AND puts the
//          card itself in their inventory as a real item.
//   USE  — using that item spends the point and resolves the card.
//
// The item is the point of the whole thing. A card the player can see on
// their sheet, hold onto for six sessions and cash in at the dramatic
// moment is a different object than a line in a chat log — so the item
// is the trigger, not a button on a card that has scrolled away.
// "Use any time, use once": no activation cost, one charge, and it
// destroys itself on the way out.
// ==================================================================

import { MODULE } from './const.js';
import { INSPIRATION_PATH, actionButton, actionHint, describeInspirationCardHtml } from './data/inspiration-schema.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INSPIRATION | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INSPIRATION | ${message}`, data);
    }
}

function toast(title, subtitle = '', icon = 'fa-solid fa-lightbulb') {
    const api = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (api?.show) api.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    else ui.notifications.info(subtitle ? `${title} — ${subtitle}` : title);
}

const getSetting = (key, fallback) => {
    try { return game.settings.get(MODULE.ID, key); } catch (_) { return fallback; }
};

// ==================================================================
// ===== dnd5e's INSPIRATION FLAG ===================================
// ==================================================================
// The card lifecycle does NOT touch this. Drawing a card grants no point
// and playing one spends none — the card is the currency, so a parallel
// point would be the same fact recorded twice, and dnd5e's flag is a
// BOOLEAN that cannot represent a hand of several cards anyway.
//
// These two survive for exactly one reason: the `grantInspiration` card
// action, where handing over a point is the card's own stated effect.
// That leaves the pip free for whatever else the table uses it for.

/** Does this actor currently hold a dnd5e inspiration point? */
export function hasInspiration(actor) {
    return !!foundry.utils.getProperty(actor ?? {}, INSPIRATION_PATH);
}

/** Grant a dnd5e inspiration point — the `grantInspiration` card action. */
export async function grantInspiration(actor) {
    if (!actor) return false;
    if (hasInspiration(actor)) {
        log(`${actor.name} already holds inspiration`, '', true, false);
        return false;
    }
    try {
        await actor.update({ [INSPIRATION_PATH]: true });
        return true;
    } catch (error) {
        log(`Could not grant inspiration to ${actor.name}`, error?.message, false, false);
        return false;
    }
}

/** Targeted tokens, falling back to selected — the usual house rule. */
export function resolveTargets() {
    const targeted = Array.from(game.user.targets ?? []);
    const tokens = targeted.length ? targeted : Array.from(canvas?.tokens?.controlled ?? []);
    return tokens.map((t) => t.actor).filter(Boolean);
}

// ==================================================================
// ===== THE CARD AS AN ITEM ========================================
// ==================================================================

/** Flag key: marks an inventory item as a drawn inspiration card. */
export const CARD_FLAG = 'inspirationCard';

/**
 * The item description IS the card — everything the chat card shows when
 * it is drawn, because the item is what the player still has in front of
 * them three sessions later when the chat log is long gone. Art, caption,
 * prose, and the mechanics spelled out.
 *
 * The link back to the deck page means they can always read the
 * authoritative version, and the GM edits one journal page rather than
 * chasing copies already sitting in six inventories.
 */
function buildCardDescription(card) {
    const parts = ['<p><em>Inspiration Card</em></p>'];
    if (card.image) {
        parts.push(`<p><img src="${card.image}" alt="${card.imagetitle || card.title}" /></p>`);
    }
    if (card.imagetitle) parts.push(`<p><em>${card.imagetitle}</em></p>`);
    if (card.description) parts.push(card.description);

    const mechanics = describeInspirationCardHtml(card, { context: 'item' });
    if (mechanics) parts.push(`<h4>What This Does</h4>${mechanics}`);

    if (card.sourceUuid) parts.push(`<p>@UUID[${card.sourceUuid}]{${card.title}}</p>`);
    return parts.join('');
}

// NOTE: no system.description.chat here on purpose. dnd5e's own usage card
// never posts — preUseActivity vetoes it and the Bibliosoph play card goes
// up instead — so a chat description would be dead data on every item.

/**
 * Item data for a drawn card: a one-charge consumable with a single
 * no-cost activity, so "use any time, use once" is modelled in dnd5e's
 * own terms rather than bolted on. autoDestroy removes it when the
 * charge is spent.
 */
export function buildInspirationItemData(card, holder = null) {
    const activityId = foundry.utils.randomID();
    return {
        name: `Inspiration: ${card.title}`,
        type: 'consumable',
        img: card.image || 'icons/magic/light/explosion-star-glow-silhouette.webp',
        system: {
            description: { value: buildCardDescription(card) },
            type: { value: 'trinket' },
            quantity: 1,
            weight: { value: 0, units: 'lb' },
            price: { value: 0, denomination: 'gp' },
            rarity: 'veryRare',
            uses: { spent: 0, max: '1', recovery: [], autoDestroy: true },
            activities: {
                [activityId]: {
                    _id: activityId,
                    type: 'utility',
                    name: actionButton(card.action) || 'Play This Card',
                    activation: { type: 'special', value: null, override: true },
                    consumption: {
                        targets: [{ type: 'itemUses', target: '', value: '1' }],
                        scaling: { allowed: false }
                    }
                }
            }
        },
        flags: {
            [MODULE.ID]: {
                // The WHOLE card, not just its mechanics. The play card is
                // rendered straight from this, so art and prose have to be
                // here — and it has to keep working if the deck page is
                // later renamed, moved, or the compendium unlinked.
                [CARD_FLAG]: {
                    title: card.title,
                    image: card.image ?? '',
                    imagetitle: card.imagetitle ?? '',
                    description: card.description ?? '',
                    action: card.action ?? 'none',
                    actionamount: card.actionamount ?? null,
                    actionformula: card.actionformula ?? '',
                    appliesto: card.appliesto ?? null,
                    sourceUuid: card.sourceUuid ?? null,
                    holderActorId: holder?.id ?? null
                }
            }
        }
    };
}

/**
 * Put the card in the character's hands. Returns the created item, or
 * null if it could not be made — the draw still stands either way, since
 * the point is what the rules actually turn on.
 */
export async function grantInspirationItem(actor, card) {
    if (!actor || !card) return null;
    try {
        const [item] = await actor.createEmbeddedDocuments('Item', [buildInspirationItemData(card, actor)]);
        log(`Gave ${actor.name} the "${card.title}" card as an item`, '', true, false);
        return item ?? null;
    } catch (error) {
        log(`Could not create the card item for ${actor.name}`, error?.message, false, false);
        return null;
    }
}

/** The card payload stored on an inventory item, if it is one of ours. */
export function readCardItem(item) {
    return item?.getFlag?.(MODULE.ID, CARD_FLAG) ?? null;
}

/**
 * Using the item raises the card; a button on the card resolves it.
 *
 * Fires on whichever client clicked, normally the owning player. They own
 * their own character, so the common path needs no GM. Actions that reach
 * across to somebody else's sheet (Life Swap) relay through the active GM.
 */
export function registerInspirationItemHook() {
    // Using the item RAISES THE CARD. dnd5e's own usage card is a name and
    // a couple of pills; the Bibliosoph card is the art, the prose, the
    // mechanics and a button per person it could land on. So we take the
    // activity over entirely: veto it, and post the real card instead.
    //
    // Vetoing also means nothing is spent yet. Both the charge and the card
    // survive until a button actually gets clicked, so opening a card and
    // thinking better of it costs nothing.
    Hooks.on('dnd5e.preUseActivity', (activity) => {
        const item = activity?.item;
        const card = readCardItem(item);
        if (!card) return;

        // Fire and forget: the hook is synchronous because it has to
        // return false to stop dnd5e, so the card posts just behind it.
        playCardToChat(item, card).catch((error) => {
            log(`Could not raise the card for "${card.title}"`, error?.message, false, false);
        });
        return false;
    });
    log('Watching for inspiration card items being used', '', true, false);
}

/** Post the playable card. The buttons on it do the actual work. */
async function playCardToChat(item, card) {
    const { postInspirationPlayCard } = await import('./bibliosoph.js');
    await postInspirationPlayCard({
        card: await freshenCard(card),
        holder: item?.actor ?? null,
        itemUuid: item?.uuid ?? null
    });
}

/**
 * Prefer the live deck page over the snapshot in the item's flag, so a GM
 * who rewords a card sees the change on cards already dealt. Also repairs
 * cards dealt before the flag carried art and prose at all.
 *
 * The flag stays authoritative for anything the page no longer supplies —
 * a deleted or unlinked page must not blank out somebody's card.
 */
async function freshenCard(card) {
    if (!card?.sourceUuid) return card;
    try {
        const page = await fromUuid(card.sourceUuid);
        const system = page?.system;
        if (!system) return card;
        const live = system.toObject?.() ?? system;
        return {
            ...card,
            ...Object.fromEntries(Object.entries(live).filter(([, v]) => v !== undefined && v !== null && v !== '')),
            title: page.name || card.title,
            sourceUuid: card.sourceUuid,
            holderActorId: card.holderActorId ?? null
        };
    } catch (error) {
        log(`Could not re-read the deck page for "${card.title}"`, error?.message, true, false);
        return card;
    }
}

/**
 * "Use once": the card leaves their inventory the moment it resolves, and
 * that departure IS the cost. Nothing was spent when they opened it, so
 * this is the one and only place anything is consumed.
 */
export async function discardCardItem(itemUuid) {
    if (!itemUuid) return;
    try {
        const item = await fromUuid(itemUuid);
        if (item?.delete) await item.delete();
    } catch (_) { /* already gone is the goal */ }
}

/** Is the card still in hand? The only thing that gates a play. */
async function cardStillHeld(itemUuid) {
    if (!itemUuid) return true;             // no item behind it: nothing to check
    try { return !!(await fromUuid(itemUuid)); } catch (_) { return false; }
}

/**
 * Resolve a card: run its action, then discard the card. THE CARD IS THE
 * CURRENCY — holding it is the right to play it, and playing it spends it.
 * There is no separate point to track, so there is nothing to get out of
 * step with the hand somebody is holding.
 *
 * Relays to the active GM when it touches an actor this client cannot
 * write to — Life Swap reaches onto somebody else's sheet.
 */
export async function applyInspirationCard({ card, holderActorId = null, targetActorIds = [], itemUuid = null }) {
    const holder = game.actors.get(holderActorId ?? '') ?? null;
    const targets = targetActorIds.map((id) => game.actors.get(id)).filter(Boolean);

    // Guards against a stale card sitting in the chat log: the item is
    // gone, so there is nothing left to play.
    if (!await cardStillHeld(itemUuid)) {
        return { ok: false, summary: 'That card has already been played.' };
    }

    const needsGm = targets.some((a) => !a.isOwner) || (holder && !holder.isOwner);
    if (needsGm && !game.user.isGM) {
        const relayed = await relayCardToGm({ card, holderActorId, targetActorIds, itemUuid });
        return relayed
            ? { ok: true, relayed: true, summary: 'Sent to the GM to resolve.' }
            : { ok: false, summary: 'No GM connected to resolve this one.' };
    }

    const result = await runInspirationAction(card, targets);
    if (!result.ok) return result;          // the card survives a miss
    await discardCardItem(itemUuid);
    return result;
}

export const SOCKET_INSPIRATION_USE = `${MODULE.ID}.inspirationUse`;

async function relayCardToGm(payload) {
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets || !game.users.activeGM) return false;
    try {
        await sockets.waitForReady();
        await sockets.emit(SOCKET_INSPIRATION_USE, payload);
        return true;
    } catch (error) {
        log('Card relay to the GM failed', error?.message, false, false);
        return false;
    }
}

/** GM side: perform card resolutions relayed by players. */
export async function registerInspirationSocket() {
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets) return;
    await sockets.waitForReady();
    await sockets.register(SOCKET_INSPIRATION_USE, async (payload) => {
        if (game.users.activeGM?.id !== game.user.id) return;
        // Re-check against live state: the relay is a request, not a fact.
        // The card still being in hand is the whole authorisation now.
        if (!await cardStillHeld(payload?.itemUuid)) {
            log(`Ignoring relayed card "${payload?.card?.title}" — already played`, '', true, false);
            return;
        }
        const targets = (payload?.targetActorIds ?? []).map((id) => game.actors.get(id)).filter(Boolean);
        const result = await runInspirationAction(payload?.card ?? {}, targets);
        if (!result.ok) {
            // The card survives a failed resolution — the player still holds
            // it and can try again once they pick a valid target.
            log(`Relayed card "${payload?.card?.title}" did not resolve: ${result.summary}`, '', true, false);
            return;
        }
        toast('Inspiration Used', result.summary || payload?.card?.title || '', 'fa-solid fa-lightbulb');
        // The player could not necessarily finish this themselves, so the
        // discard belongs here too.
        await discardCardItem(payload?.itemUuid);
    });
}

const hpOf = (actor) => actor?.system?.attributes?.hp ?? null;

/**
 * Run a card's automatable action. Every branch is a plain state change
 * with no judgement in it — anything needing a decision stays in the
 * prose and never reaches here.
 *
 * @param {object} card                  the card record
 * @param {Actor[]|null} explicitActors  resolved targets; pass these when
 *                                       the click happened on another
 *                                       client, since targeting is per-user
 * @returns {Promise<{ok: boolean, summary: string}>}
 */
export async function runInspirationAction(card, explicitActors = null) {
    const action = card?.action ?? 'none';
    if (action === 'none') return { ok: true, summary: '' };

    const actors = explicitActors?.length ? explicitActors : resolveTargets();
    if (!actors.length) {
        return { ok: false, summary: actionHint(action) || 'Select a token first.' };
    }

    try {
        switch (action) {
            case 'healFull': {
                const actor = actors[0];
                const hp = hpOf(actor);
                if (!hp) return { ok: false, summary: `${actor.name} has no hit points to restore.` };
                await actor.update({ 'system.attributes.hp.value': hp.max });
                return { ok: true, summary: `${actor.name} restored to full (${hp.max} HP).` };
            }
            case 'setHp': {
                const actor = actors[0];
                const amount = Number(card.actionamount) || 0;
                await actor.update({ 'system.attributes.hp.value': amount });
                return { ok: true, summary: `${actor.name} is back on ${amount} HP.` };
            }
            case 'longRest': {
                const actor = actors[0];
                if (typeof actor.longRest !== 'function') {
                    return { ok: false, summary: `${actor.name} cannot take a long rest in this system.` };
                }
                // A REAL long rest — the same thing the sheet's own button
                // does, so hit dice, spell slots, limited uses and
                // exhaustion all recover. Specifically:
                //   newDay: true   — anything else is a partial rest that
                //                    silently skips daily-recharge items
                //   request: true  — the card is the authorisation, so
                //                    dnd5e's "Allow Rests" player setting
                //                    must not block it
                //   advanceTime    — false: the card is instant ("blank
                //                    for a split second"), no 8 hours pass
                //   chat: true     — dnd5e's rest summary is the receipt
                const result = await actor.longRest({
                    dialog: false, chat: true, newDay: true, request: true, advanceTime: false
                });
                // longRest returns undefined when it was refused: a hook
                // vetoed it, or the actor is a vehicle. Claiming success
                // there would spend the point and burn the card for nothing.
                if (!result) {
                    return { ok: false, summary: `${actor.name}'s long rest did not go through — nothing spent.` };
                }
                const dhp = Number(result.dhp) || 0;
                const dhd = Number(result.dhd) || 0;
                const gained = [];
                if (dhp) gained.push(`${dhp} HP`);
                if (dhd) gained.push(`${dhd} hit ${dhd === 1 ? 'die' : 'dice'}`);
                return {
                    ok: true,
                    summary: gained.length
                        ? `${actor.name} long-rested — recovered ${gained.join(' and ')}.`
                        : `${actor.name} long-rested.`
                };
            }
            case 'percentDamage': {
                const actor = actors[0];
                const hp = hpOf(actor);
                if (!hp) return { ok: false, summary: `${actor.name} has no hit points.` };
                const roll = new Roll(card.actionformula || '1d10*10');
                await roll.evaluate();
                if (game.dice3d) { try { await game.dice3d.showForRoll(roll, game.user, true); } catch (_) { /* cosmetic */ } }
                const percent = Math.max(0, Math.min(100, Number(roll.total) || 0));
                const lost = Math.floor((Number(hp.value) || 0) * (percent / 100));
                await actor.update({ 'system.attributes.hp.value': Math.max(0, (Number(hp.value) || 0) - lost) });
                return { ok: true, summary: `${percent}% — ${actor.name} loses ${lost} HP.` };
            }
            case 'swapHp': {
                if (actors.length < 2) {
                    return { ok: false, summary: 'Select BOTH characters — yours and theirs.' };
                }
                const [a, b] = actors;
                const hpA = hpOf(a); const hpB = hpOf(b);
                if (!hpA || !hpB) return { ok: false, summary: 'Both need hit points to swap.' };
                const valueA = Number(hpA.value) || 0;
                const valueB = Number(hpB.value) || 0;
                // Anything over a character's own maximum arrives as temp HP,
                // per the card: "you gain the additional health as temporary".
                const giveA = Math.min(valueB, Number(hpA.max) || valueB);
                const giveB = Math.min(valueA, Number(hpB.max) || valueA);
                await a.update({
                    'system.attributes.hp.value': giveA,
                    'system.attributes.hp.temp': Math.max(0, valueB - giveA)
                });
                await b.update({
                    'system.attributes.hp.value': giveB,
                    'system.attributes.hp.temp': Math.max(0, valueA - giveB)
                });
                return { ok: true, summary: `${a.name} and ${b.name} swapped health (${valueA} ⇄ ${valueB}).` };
            }
            case 'grantInspiration': {
                const actor = actors[0];
                const granted = await grantInspiration(actor);
                return { ok: true, summary: granted ? `${actor.name} gains inspiration.` : `${actor.name} already had inspiration.` };
            }
            default:
                return { ok: true, summary: '' };
        }
    } catch (error) {
        log(`Action "${action}" failed`, error?.message, false, false);
        return { ok: false, summary: 'That did not work — see the console.' };
    }
}

export { actionButton, actionHint, toast as inspirationToast, getSetting as inspirationSetting, log as inspirationLog };
