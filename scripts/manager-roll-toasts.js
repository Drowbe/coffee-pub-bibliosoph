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
        if (!getSetting(`${type}ToastEnabled`, false)) return;
        if (!this._passesSourceFilter(outcome)) return;

        const payload = this._buildPayload(type, outcome);
        if (!payload) return;

        // Blind/private/self rolls never broadcast — the GM still sees the toast.
        if (outcome.visibility === 'public') this._broadcast(payload);
        this._showLocal(payload);
    }

    /** "players" mode skips rolls whose chat message was authored by a GM. */
    static _passesSourceFilter(outcome) {
        if (getSetting('rollToastTriggeredBy', 'everyone') !== 'players') return true;
        const message = game.messages.get(outcome?.messageId ?? '');
        const author = message?.author ?? message?.user;
        return author ? !author.isGM : true;
    }

    static _buildPayload(type, outcome) {
        const tokenName = canvas?.tokens?.get(outcome?.tokenId ?? '')?.name;
        const actorName = game.actors.get(outcome?.actorId ?? '')?.name;
        const rollerName = tokenName || actorName || 'Someone';
        const interpolate = (text) => String(text ?? '').replaceAll('{name}', rollerName);

        const title = interpolate(getSetting(`${type}ToastTitle`, ''));
        if (!title) return null;

        const payload = { title, moduleId: MODULE.ID };

        const subtitle = interpolate(getSetting(`${type}ToastMessage`, ''));
        if (subtitle) payload.subtitle = subtitle;

        const icon = String(getSetting(`${type}ToastIcon`, '') ?? '').trim();
        if (icon && icon !== 'none') payload.icon = icon;

        const size = getSetting(`${type}ToastSize`, 'large');
        if (size && size !== 'adapt') payload.size = size;

        const duration = Number(getSetting(`${type}ToastDuration`, 3));
        if (Number.isFinite(duration)) payload.duration = duration;

        // Animations only apply to sized (billboard) toasts; harmless otherwise.
        const animation = getSetting(`${type}ToastAnimation`, 'none');
        if (animation && animation !== 'none') payload.animation = animation;

        const sound = getSetting(`${type}ToastSound`, 'none');
        if (sound && sound !== 'none') payload.sound = sound;

        const color = String(getSetting(`${type}ToastBorderColor`, '') ?? '').trim();
        if (HEX_COLOR.test(color)) payload.color = color;

        const backgroundColor = String(getSetting(`${type}ToastBackgroundColor`, '') ?? '').trim();
        if (HEX_COLOR.test(backgroundColor)) payload.backgroundColor = backgroundColor;

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
        getBlacksmith()?.toast?.show?.(payload);
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
