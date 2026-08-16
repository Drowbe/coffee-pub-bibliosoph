// ==================================================================
// ===== CHAT CARDS =================================================
// ==================================================================
//
// Bibliosoph does not write card HTML. A card is described as data —
// a composition of Blacksmith-owned parts — and Blacksmith renders it.
// See documentation/api/api-chatcards.md in Blacksmith.
//
// This module owns access to that API and the handful of conversions
// our own data needs before it can be composed.

import { MODULE } from './const.js';

/** Blacksmith's chat cards API, or null when it is unavailable. */
export function getChatCardsAPI() {
    return game.modules.get('coffee-pub-blacksmith')?.api?.chatCards ?? null;
}

/**
 * Post one card.
 *
 * `moduleId` is supplied here so no caller has to remember it, and
 * because every button's action is namespaced by it.
 *
 * @param {object} options - a chatCards.post() descriptor, minus moduleId
 * @returns {Promise<ChatMessage|null>} null when the card could not be posted
 */
export async function postCard(options = {}) {
    const chatCards = getChatCardsAPI();
    if (!chatCards) {
        // `typeof` rather than optional chaining: Blacksmith assigns this
        // on window, so a bare read throws when it never loaded at all.
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(
                MODULE.NAME, 'Chat cards API unavailable — card not posted', options?.type ?? '', false, false
            );
        }
        return null;
    }
    return chatCards.post({ moduleId: MODULE.ID, ...options });
}

/**
 * The stored composition of a posted card, or null.
 *
 * Blacksmith returns a deep clone, so splicing the parts here cannot
 * reach the live flags — the write is always deliberate.
 *
 * @param {ChatMessage|string} message
 * @returns {object|null} { v, moduleId, type, theme, parts }
 */
export function getCard(message) {
    return getChatCardsAPI()?.getCard?.(message) ?? null;
}

/**
 * Rebuild a posted card from an amended composition.
 *
 * The theme is deliberately not passed: omitting it keeps whatever the
 * card was pinned to, which is what every caller here wants — none of
 * them is changing a card's colour, only what it says.
 *
 * @param {ChatMessage|string} message
 * @param {Array<object>} parts
 * @returns {Promise<ChatMessage|null>}
 */
export async function updateCard(message, parts) {
    const chatCards = getChatCardsAPI();
    if (!chatCards?.update) return null;
    return chatCards.update(message, { parts });
}

/**
 * Replace a card's `actions` part with a closing stamp.
 *
 * The shape every "this decision has been made" ending shares: the
 * controls go, and a band saying what happened takes their place. The
 * instruction goes with them, because a direction above nothing is a
 * direction nobody can follow.
 *
 * @param {ChatMessage|string} message
 * @param {string} text - what the stamp says
 * @param {object} [options]
 * @param {string} [options.icon]
 * @param {string} [options.tone] - positive (default), negative, info, pending
 * @returns {Promise<boolean>} whether the card was rewritten
 */
export async function stampCardActions(message, text, { icon = 'fa-solid fa-check', tone = 'positive' } = {}) {
    const card = getCard(message);
    const at = card?.parts?.findIndex((part) => part.part === 'actions') ?? -1;
    if (at === -1) return false;
    card.parts.splice(at, 1, { part: 'band', text, icon, tone });
    return Boolean(await updateCard(message, card.parts));
}

/**
 * The Font Awesome classes out of an authored icon.
 *
 * The narrative resource files store their icons as markup
 * (`<i class="fa-solid fa-dice"></i>`), which a part cannot take: parts
 * are given a class string and Blacksmith writes the element. Reading
 * the class out is what lets those files stay as they are.
 *
 * @param {string} icon - markup, a bare class string, or nothing
 * @param {string} fallback
 * @returns {string} a Font Awesome class string
 */
export function iconClass(icon, fallback = 'fa-solid fa-dice') {
    const raw = String(icon ?? '').trim();
    if (!raw) return fallback;
    const markup = raw.match(/class\s*=\s*["']([^"']+)["']/i);
    if (markup) return markup[1].trim() || fallback;
    // Already a class string. A bare glyph ("fa-dice") needs a style.
    if (raw.startsWith('<')) return fallback;
    return /\bfa-(solid|regular|light|thin|duotone|brands)\b/.test(raw) ? raw : `fa-solid ${raw}`;
}
