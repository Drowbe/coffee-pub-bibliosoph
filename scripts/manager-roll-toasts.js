// ==================================================================
// ===== ROLL TOASTS (manager-roll-toasts.js) =======================
// ==================================================================
// Phase 1 of the Blacksmith rolls-API integration: when an attack roll
// resolves as a critical or a fumble, show a configured toast on every
// client. Blacksmith classifies the roll and fires attackResolved on
// the GM client; the active GM builds the toast payload from settings
// and relays it over the Blacksmith socket API. Toasts are a
// per-client primitive, so each recipient (including the GM) renders
// locally via module.api.toast.show().
//
// Requires Blacksmith newer than 13.11.3 (module.api.rolls). On older
// builds isAvailable() is absent and this manager stays dormant —
// relayed toasts still render if another client sends them.
// ==================================================================

import { MODULE } from './const.js';

/** Socket event: GM tells clients to render a roll-outcome toast. */
export const SOCKET_ROLL_TOAST = `${MODULE.ID}.rollToast`;

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `ROLL TOASTS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | ROLL TOASTS | ${message}`, data);
    }
}

export class RollToastManager {
    static _initialized = false;

    static async initialize() {
        if (this._initialized) return;
        this._initialized = true;

        const blacksmith = getBlacksmith();
        if (!blacksmith) return;

        // Every client renders relayed toasts locally.
        await this._registerSocketHandler(blacksmith);

        // attackResolved fires on the GM client; subscribing everywhere is
        // harmless and the activeGM guard keeps exactly one relayer.
        const rolls = blacksmith.rolls;
        if (!rolls?.isAvailable?.()) {
            log('Blacksmith rolls API unavailable (needs Blacksmith > 13.11.3); crit/fumble toasts dormant', '', true, false);
            return;
        }
        rolls.on('attackResolved', (outcome) => {
            try {
                this._onAttackResolved(outcome);
            } catch (error) {
                log('attackResolved handler failed', error?.message, false, false);
            }
        });
        log('Listening for attack crits and fumbles', '', true, false);
    }

    // ==============================================================
    // ===== DETECTION (active GM only) =============================
    // ==============================================================

    static _onAttackResolved(outcome) {
        if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;

        const type = outcome?.isCritical ? 'crit' : (outcome?.isFumble ? 'fumble' : null);
        if (!type) return;

        // Automation mode is the master switch: 'off' = no toast, no rolls.
        const automation = getSetting(`${type}Automation`, 'click');
        if (automation === 'off') return;
        if (!this._passesSourceFilter(outcome)) return;

        const payload = this._buildPayload(type, outcome);
        if (!payload) return;

        // Default: announcement toasts self-dismiss everywhere.
        payload.duration = 3;
        const broadcastable = outcome.visibility === 'public';

        // 'click': the ROLLER owns the click. The payload carries plain data
        // (rollAction + rollUserId); each receiving client — including this
        // one — arms onClick locally in _showLocal only when it IS that
        // user, since functions can never ride the socket relay. Hidden
        // rolls don't broadcast, so the GM takes the click instead.
        if (automation === 'click') {
            payload.rollAction = type;
            payload.rollUserId = (broadcastable ? this._rollerUserId(outcome) : null) ?? game.user.id;
            log(`Click-to-roll ${type} toast targeted at ${game.users.get(payload.rollUserId)?.name ?? payload.rollUserId}`, '', true, false);
        }

        // Blind/private/self rolls never broadcast — the GM still sees the toast.
        if (broadcastable) this._broadcast(payload);
        this._showLocal(payload);

        // 'auto' posts the table card immediately (GM side).
        if (automation === 'auto') this._rollCard(type);
    }

    /** The user who made the roll: chat message author, else the actor's active player owner. */
    static _rollerUserId(outcome) {
        const message = game.messages.get(outcome?.messageId ?? '');
        const authorId = (message?.author ?? message?.user)?.id;
        if (authorId) return authorId;
        const actor = game.actors.get(outcome?.actorId ?? '');
        const owner = actor
            ? game.users.find((u) => !u.isGM && u.active && actor.testUserPermission(u, 'OWNER'))
            : null;
        log(`Roller lookup fell back to actor owner: ${owner?.name ?? 'none found'}`, '', true, false);
        return owner?.id ?? null;
    }

    /**
     * Post the outcome chat card via the existing card paths:
     * crit/fumble roll their table, injury rolls the journal compendium
     * for the given damage category (target = who took the damage).
     */
    static async _rollCard(type, category, target) {
        try {
            if (type === 'injury') {
                const { rollInjuryCard } = await import('./bibliosoph.js');
                await rollInjuryCard(category || 'General', target ?? null);
            } else {
                const { rollOutcomeCard } = await import('./bibliosoph.js');
                await rollOutcomeCard(type);
            }
        } catch (error) {
            log('Roll card failed', error?.message, false, false);
        }
    }

    /**
     * Show a toast locally and relay it to every other client. Entry point
     * for sibling managers (injury triggers) that reuse this socket and
     * the receipt-side click-arming in _showLocal.
     */
    static deliver(payload, { broadcast = true } = {}) {
        if (broadcast) this._broadcast(payload);
        this._showLocal(payload);
    }

    /**
     * Filter on WHAT is rolling — the actor type — not which account
     * controls it. 'players' = character actors; 'npcs' = everything else.
     * Unknown actors pass rather than silently eating outcomes.
     */
    static _passesSourceFilter(outcome) {
        const mode = getSetting('rollTriggerSource', 'everyone');
        if (mode === 'everyone') return true;
        const actor = game.actors.get(outcome?.actorId ?? '')
            ?? canvas?.tokens?.get(outcome?.tokenId ?? '')?.actor;
        if (!actor) return true;
        const isCharacter = actor.type === 'character';
        return mode === 'players' ? isCharacter : !isCharacter;
    }

    static _buildPayload(type, outcome) {
        const token = canvas?.tokens?.get(outcome?.tokenId ?? '');
        const actor = game.actors.get(outcome?.actorId ?? '') ?? token?.actor;
        const rollerName = token?.name || actor?.name || 'Someone';

        // Substitution codes for the title/message settings.
        let weaponName = 'their weapon';
        try {
            weaponName = (outcome?.itemUuid && fromUuidSync(outcome.itemUuid)?.name) || 'their weapon';
        } catch (_) { /* compendium-index misses resolve to the fallback */ }
        let targetName = 'their target';
        try {
            const targetUuid = outcome?.hitTargets?.[0]
                ?? outcome?.missTargets?.[0]
                ?? outcome?.targets?.[0]?.uuid;
            targetName = (targetUuid && fromUuidSync(targetUuid)?.name) || 'their target';
        } catch (_) { /* no target stays generic */ }
        const interpolate = (text) => String(text ?? '')
            .replaceAll('{name}', rollerName)
            .replaceAll('{target}', targetName)
            .replaceAll('{weapon}', weaponName)
            .replaceAll('{d20}', String(outcome?.d20 ?? '?'))
            .replaceAll('{total}', String(outcome?.total ?? '?'));

        const title = interpolate(getSetting(`${type}ToastTitle`, ''));
        if (!title) return null;

        const payload = { title, moduleId: MODULE.ID };

        const subtitle = interpolate(getSetting(`${type}ToastMessage`, ''));
        if (subtitle) payload.subtitle = subtitle;

        // The roller's portrait is the toast avatar (image wins over icon in
        // the toast API); a fixed icon is the no-portrait fallback.
        const portrait = actor?.img || token?.document?.texture?.src || null;
        if (portrait) {
            payload.image = portrait;
        } else {
            payload.icon = type === 'crit' ? 'fa-solid fa-burst' : 'fa-solid fa-heart-crack';
        }

        const size = getSetting(`${type}ToastSize`, 'large');
        if (size && size !== 'adapt') payload.size = size;

        // Duration is set by the caller from the Automation mode.

        // Animations only apply to sized (billboard) toasts; harmless otherwise.
        const animation = getSetting(`${type}ToastAnimation`, 'none');
        if (animation && animation !== 'none') payload.animation = animation;

        const sound = getSetting(`${type}ToastSound`, 'none');
        if (sound && sound !== 'none') payload.sound = sound;

        const color = String(getSetting(`${type}ToastBorderColor`, '') ?? '').trim();
        if (HEX_COLOR.test(color)) payload.color = color;

        const backgroundColor = String(getSetting(`${type}ToastBackgroundColor`, '') ?? '').trim();
        if (HEX_COLOR.test(backgroundColor)) payload.backgroundColor = backgroundColor;

        const backgroundImage = String(getSetting(`${type}ToastBackgroundImage`, '') ?? '').trim();
        if (backgroundImage) payload.backgroundImage = backgroundImage;

        return payload;
    }

    // ==============================================================
    // ===== DELIVERY ===============================================
    // ==============================================================

    static async _broadcast(payload) {
        const sockets = getBlacksmith()?.sockets;
        if (!sockets) return;
        try {
            await sockets.waitForReady();
            await sockets.emit(SOCKET_ROLL_TOAST, payload);
        } catch (error) {
            log('Toast relay failed', error?.message, false, false);
        }
    }

    static _showLocal(payload) {
        const toast = getBlacksmith()?.toast;
        if (!toast?.show) return;
        // Receipt-side arming: if this toast carries a roll action and THIS
        // client is the designated roller, make it persistent and clickable —
        // clicking posts the crit/fumble table card from this client.
        const { rollAction, rollUserId, rollCategory, rollTarget, ...config } = payload ?? {};
        if (rollAction && rollUserId === game.user.id) {
            config.duration = 0;
            config.onClick = () => this._rollCard(rollAction, rollCategory, rollTarget);
            // Button-styled pill on the armed toast only (Blacksmith renders
            // it solely when onClick is live, on small/medium/large sizes).
            // Configurable text; blank hides the pill (toast stays clickable).
            const buttonText = String(getSetting(`${rollAction}ToastButton`, '') ?? '').trim();
            if (buttonText) config.callToAction = buttonText;
            log(`Toast armed for click-to-roll (${rollAction}) on this client`, '', true, false);
        } else if (rollAction) {
            log(`Toast is click-to-roll for another user (${rollUserId}); showing plain`, '', true, false);
        }
        toast.show(config);
    }

    static async _registerSocketHandler(blacksmith) {
        // sockets attach to module.api asynchronously — poll briefly
        let attempts = 0;
        while (!blacksmith.sockets && attempts < 20) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }
        const sockets = blacksmith.sockets;
        if (!sockets) {
            log('Blacksmith sockets unavailable; roll toasts will show on the GM client only', '', false, false);
            return;
        }
        await sockets.waitForReady();
        await sockets.register(SOCKET_ROLL_TOAST, (data) => {
            if (data && typeof data === 'object') this._showLocal(data);
        });
    }
}
