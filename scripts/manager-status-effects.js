// ==================================================================
// ===== STATUS EFFECTS (manager-status-effects.js) =================
// ==================================================================
// The ONE place Bibliosoph applies card results as Active Effects on
// tokens — used by the Apply Critical / Apply Fumble buttons and the
// injury card's apply button, and built to be extended (future outcome
// types call the same function).
//
// Behavior contract, identical for every caller:
//   - Applies to TARGETED token(s), falling back to selected; warns if
//     neither.
//   - Permission-aware: you must own the target's actor.
//   - Duplicate-safe: a token never gets the same-named effect twice.
//   - The effect carries name, image, and a DESCRIPTION (visible on the
//     effect sheet and dnd5e tooltips) so the table never forgets what
//     the card said.
//   - Optional mechanics: immediate HP damage, duration in seconds, and
//     an official condition toggled via DFreds Convenient Effects when
//     that module is active.
// ==================================================================

import { MODULE } from './const.js';

/** Official dnd5e conditions eligible for the DFreds toggle. */
const OFFICIAL_STATUS_EFFECTS = [
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
    'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
    'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion'
];

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `STATUS EFFECTS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | STATUS EFFECTS | ${message}`, data);
    }
}

/**
 * Apply a named, described status effect. Recipients are either passed
 * explicitly (`explicitActors` — e.g. the injury automation knows exactly
 * who took the damage) or chosen at click time: targeted token(s),
 * falling back to selected.
 *
 * @param {object} config
 * @param {string} config.name             Effect name, already prefixed (e.g. "Critical: Severed Tendon")
 * @param {string} config.img              Effect/token icon image path
 * @param {string} [config.description]    Text/HTML stored on the effect
 * @param {number|null} [config.durationSeconds]  Effect duration; null = until removed
 * @param {number|null} [config.damage]    Immediate HP loss applied via the effect
 * @param {string|null} [config.statusEffect]     Official condition name to toggle via DFreds
 * @param {string} [config.kindLabel]      For user-facing warnings ("critical", "injury", ...)
 * @param {Actor[]|null} [config.explicitActors]  Known recipients; skips target/selection entirely
 * @returns {Promise<string[]>} Display names the effect is now on (including
 *          recipients who already carried it) — empty when nothing applied.
 */
export async function applyStatusToTokens({
    name,
    img,
    description = '',
    durationSeconds = null,
    damage = null,
    statusEffect = null,
    kindLabel = 'effect',
    explicitActors = null
} = {}) {
    if (!name) return [];

    // Normalize recipients to { actor, displayName }
    let recipients = [];
    if (explicitActors?.length) {
        recipients = explicitActors
            .filter(Boolean)
            .map((actor) => ({
                actor,
                displayName: actor.token?.name ?? actor.getActiveTokens?.()[0]?.name ?? actor.name
            }));
    } else {
        const targets = Array.from(game.user.targets ?? []);
        const tokens = targets.length ? targets : canvas.tokens.controlled;
        if (!tokens.length) {
            ui.notifications.warn(`Target a token (or select one) to apply the ${kindLabel} to.`);
            return [];
        }
        recipients = tokens
            .filter((t) => t.actor)
            .map((t) => ({ actor: t.actor, displayName: t.name }));
    }

    const applied = [];
    for (const { actor, displayName } of recipients) {
        if (!actor.isOwner) {
            ui.notifications.warn(`You do not have permission to modify ${displayName}.`);
            continue;
        }
        if (actor.effects.some((e) => e.name === name)) {
            // Already carrying it — the desired state exists, count it applied
            ui.notifications.info(`${displayName} already has "${name}".`);
            log(`${displayName} already has "${name}", skipping`, '', false, false);
            applied.push(displayName);
            continue;
        }

        const effectData = {
            name,
            img,
            description: description || '',
            duration: Number.isFinite(durationSeconds) && durationSeconds > 0
                ? { seconds: durationSeconds }
                : {},
            changes: Number.isFinite(damage) && damage > 0
                ? [{ key: 'system.attributes.hp.value', mode: 2, value: `-${damage}` }]
                : []
        };
        await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
        ui.notifications.info(`Applied "${name}" to ${displayName}.`);
        applied.push(displayName);

        // Official condition via DFreds Convenient Effects, when present
        if (statusEffect && game.modules.get('dfreds-convenient-effects')?.active
            && OFFICIAL_STATUS_EFFECTS.includes(String(statusEffect).toLowerCase())) {
            const conditionName = String(statusEffect).charAt(0).toUpperCase() + String(statusEffect).slice(1).toLowerCase();
            try {
                const hasCondition = actor.effects.some((e) => e.name === conditionName);
                if (!hasCondition) {
                    await game.dfreds.effectInterface.toggleEffect(conditionName, actor);
                    log(`Toggled condition ${conditionName} on ${displayName}`, '', false, false);
                }
            } catch (error) {
                log(`Could not toggle condition ${conditionName}`, error?.message, false, false);
            }
        }
    }
    return applied;
}
