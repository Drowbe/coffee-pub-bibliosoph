// ==================================================================
// ===== INSPIRATION (scripts/manager-inspiration.js) ================
// ==================================================================
// Drawing and using homebrew inspiration cards.
//
// The lifecycle, per the house rules:
//   DRAW — GM discretion, or a critical that grants access. Drawing a
//          card GIVES the character an inspiration point.
//   USE  — spending that point resolves the card.
//
// So the draw grants, the use spends, and a card sits between them.
// The point is the currency; the card is what it buys.
// ==================================================================

import { MODULE } from './const.js';
import { INSPIRATION_PATH, actionButton, actionHint } from './data/inspiration-schema.js';

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

/** Does this actor currently hold an inspiration point? */
export function hasInspiration(actor) {
    return !!foundry.utils.getProperty(actor ?? {}, INSPIRATION_PATH);
}

/** Grant a point. Called when a card is DRAWN. */
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

/** Spend a point. Called when a card is USED. */
export async function spendInspiration(actor) {
    if (!actor) return false;
    try {
        await actor.update({ [INSPIRATION_PATH]: false });
        return true;
    } catch (error) {
        log(`Could not spend inspiration for ${actor.name}`, error?.message, false, false);
        return false;
    }
}

/** Targeted tokens, falling back to selected — the usual house rule. */
function resolveTargets() {
    const targeted = Array.from(game.user.targets ?? []);
    const tokens = targeted.length ? targeted : Array.from(canvas?.tokens?.controlled ?? []);
    return tokens.map((t) => t.actor).filter(Boolean);
}

const hpOf = (actor) => actor?.system?.attributes?.hp ?? null;

/**
 * Run a card's automatable action. Every branch is a plain state change
 * with no judgement in it — anything needing a decision stays in the
 * prose and never reaches here.
 *
 * @returns {Promise<{ok: boolean, summary: string}>}
 */
export async function runInspirationAction(card) {
    const action = card?.action ?? 'none';
    if (action === 'none') return { ok: true, summary: '' };

    const actors = resolveTargets();
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
                if (typeof actor.longRest === 'function') {
                    await actor.longRest({ dialog: false, chat: false, newDay: false });
                } else {
                    const hp = hpOf(actor);
                    if (hp) await actor.update({ 'system.attributes.hp.value': hp.max });
                }
                return { ok: true, summary: `${actor.name} has taken a long rest.` };
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
