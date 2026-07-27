// ==================================================================
// ===== INJURY TRIGGERS (manager-injury-triggers.js) ===============
// ==================================================================
// Automation for injuries: when a single application of damage deals at
// least the configured percent of the target's MAX HP, roll an injury
// from the journal compendium by the hit's dominant damage type.
//
// Detection rides Blacksmith's rolls API (`rolls.on('damageResolved')`),
// which centralizes the dnd5e calculateDamage/applyDamage correlation and
// delivers a normalized payload — final amount, typed breakdown, and an
// hp {before, after, max} snapshot — on the GM CLIENT (matching the
// attack lane; player-side applications are relayed to the GM by
// Blacksmith). Requires a Blacksmith build with damageResolved; dormant
// otherwise. Toast delivery and receipt-side click-arming reuse
// RollToastManager (same socket).
//
// The manual flow (toolbar button -> selector card -> category click) is
// untouched. See documentation/plan-injuries-automation.md and
// documentation/request-blacksmith-damage-api.md.
// ==================================================================

import { MODULE } from './const.js';
import { RollToastManager } from './manager-roll-toasts.js';

/** dnd5e damage types with a matching injury category in the compendium. */
const DAMAGE_CATEGORIES = new Set([
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
    'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
]);

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

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INJURY TRIGGERS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INJURY TRIGGERS | ${message}`, data);
    }
}

export class InjuryTriggerManager {
    static _initialized = false;

    static initialize() {
        if (this._initialized) return;
        this._initialized = true;

        const rolls = game.modules.get('coffee-pub-blacksmith')?.api?.rolls;
        if (!rolls?.isAvailable?.()) {
            log('Blacksmith rolls API unavailable; injury automation dormant', '', true, false);
            return;
        }
        rolls.on('damageResolved', (outcome) => {
            try {
                this._onDamageResolved(outcome);
            } catch (error) {
                log('damageResolved handler failed', error?.message, false, false);
            }
        });
        log('Listening for injury-threshold damage (Blacksmith damageResolved)', '', true, false);
    }

    // ==============================================================
    // ===== DETECTION (GM client — Blacksmith delivers there) ======
    // ==============================================================

    static _onDamageResolved(outcome) {
        // Blacksmith delivers on the GM client (player-side applications are
        // relayed); the activeGM guard keeps exactly one client acting.
        if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;

        // Healing and zero-damage applications never trigger.
        if (outcome?.isHealing) return;
        const amount = Number(outcome?.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;

        // Automation ladder: 'off' and 'manual' both mean no detection —
        // manual keeps the toolbar selector for hand-rolled injuries.
        const automation = getSetting('injuryAutomation', 'click');
        if (automation === 'off' || automation === 'manual') return;

        const actor = game.actors.get(outcome?.actorId ?? '')
            ?? canvas?.tokens?.get(outcome?.tokenId ?? '')?.actor;
        if (!actor) return;
        if (!this._passesSourceFilter(actor)) return;

        const maxHp = Number(outcome?.hp?.max)
            || Number(actor.system?.attributes?.hp?.max) || 0;
        if (maxHp <= 0) return;
        const pct = (amount / maxHp) * 100;
        const threshold = Number(getSetting('injuryThreshold', 50));
        if (pct < threshold) return;

        const category = this._dominantCategory(outcome?.damages);
        log(`Injury triggered: ${actor.name} took ${amount}/${maxHp} (${Math.round(pct)}% >= ${threshold}%), category ${category}`, '', true, false);

        const payload = this._buildPayload(actor, amount, pct, category);
        if (!payload) return;

        payload.duration = 3;
        const target = { actorId: actor.id, tokenId: outcome?.tokenId ?? null };
        if (automation === 'click') {
            payload.rollAction = 'injury';
            payload.rollCategory = category;
            payload.rollTarget = target;
            payload.rollUserId = this._ownerUserId(actor) ?? game.user.id;
        }
        RollToastManager.deliver(payload);
        if (automation === 'auto') RollToastManager._rollCard('injury', category, target);
    }

    /** Filter on WHAT was injured — the actor type, like crit's Triggered By. */
    static _passesSourceFilter(actor) {
        const mode = getSetting('injuryTriggerSource', 'players');
        if (mode === 'everyone') return true;
        const isCharacter = actor.type === 'character';
        return mode === 'players' ? isCharacter : !isCharacter;
    }

    /** Largest typed component of the outcome's breakdown; General otherwise. */
    static _dominantCategory(damages) {
        if (!Array.isArray(damages)) return 'General';
        let best = null;
        for (const part of damages) {
            const value = Number(part?.value) || 0;
            const type = String(part?.type ?? '').toLowerCase();
            if (value <= 0 || !DAMAGE_CATEGORIES.has(type)) continue;
            if (!best || value > best.value) best = { value, type };
        }
        if (!best) return 'General';
        return best.type.charAt(0).toUpperCase() + best.type.slice(1);
    }

    /**
     * Who owns the click: the injured actor's player. Prefer the active
     * user whose assigned character this is, then any active non-GM owner.
     */
    static _ownerUserId(actor) {
        const assigned = game.users.find((u) => !u.isGM && u.active && u.character?.id === actor.id);
        if (assigned) return assigned.id;
        const owner = game.users.find((u) => !u.isGM && u.active && actor.testUserPermission(u, 'OWNER'));
        return owner?.id ?? null;
    }

    static _buildPayload(actor, amount, pct, category) {
        const token = actor.token?.object ?? actor.getActiveTokens?.()[0] ?? null;
        const injuredName = token?.name || actor.name || 'Someone';
        // 'General' is the absence of a type — render {type} as nothing and
        // collapse the leftover whitespace so the sentence reads cleanly
        // ("took a brutal hit" instead of "took a brutal General hit").
        const displayType = category === 'General' ? '' : category;
        const interpolate = (text) => String(text ?? '')
            .replaceAll('{name}', injuredName)
            .replaceAll('{type}', displayType)
            .replaceAll('{damage}', String(Math.round(amount)))
            .replaceAll('{percent}', String(Math.round(pct)))
            .replace(/\s{2,}/g, ' ')
            .trim();

        const title = interpolate(getSetting('injuryToastTitle', ''));
        if (!title) return null;

        const payload = { title, moduleId: MODULE.ID };

        const subtitle = interpolate(getSetting('injuryToastMessage', ''));
        if (subtitle) payload.subtitle = subtitle;

        // Injured portrait as the avatar; fixed fallback icon.
        const portrait = actor.img || token?.document?.texture?.src || null;
        if (portrait) {
            payload.image = portrait;
        } else {
            payload.icon = 'fa-solid fa-bandage';
        }

        const size = getSetting('injuryToastSize', 'large');
        if (size && size !== 'adapt') payload.size = size;

        const animation = getSetting('injuryToastAnimation', 'none');
        if (animation && animation !== 'none') payload.animation = animation;

        const sound = getSetting('injuryToastSound', 'none');
        if (sound && sound !== 'none') payload.sound = sound;

        const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        const color = String(getSetting('injuryToastBorderColor', '') ?? '').trim();
        if (HEX_COLOR.test(color)) payload.color = color;
        const backgroundColor = String(getSetting('injuryToastBackgroundColor', '') ?? '').trim();
        if (HEX_COLOR.test(backgroundColor)) payload.backgroundColor = backgroundColor;
        const backgroundImage = String(getSetting('injuryToastBackgroundImage', '') ?? '').trim();
        if (backgroundImage) payload.backgroundImage = backgroundImage;

        return payload;
    }
}
