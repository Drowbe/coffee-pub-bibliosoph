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
//   - Optional mechanics: immediate one-time HP damage, duration in
//     seconds, and an official condition applied via CORE Foundry
//     (Actor#toggleStatusEffect, validated against CONFIG.statusEffects).
//     No third-party dependency.
// ==================================================================

import { MODULE } from './const.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `STATUS EFFECTS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | STATUS EFFECTS | ${message}`, data);
    }
}

// Info notices ride Blacksmith's adaptive toast (3s), falling back to a
// Foundry notification when the toast API is absent.
function showStatusToast(title, subtitle = '', icon = 'fa-solid fa-burst') {
    const toast = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (toast?.show) {
        toast.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    } else {
        ui.notifications.info(subtitle ? `${title} — ${subtitle}` : title);
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
 * @param {number|null} [config.damage]    One-time HP damage dealt on apply
 * @param {string|null} [config.statusEffect]     Official condition name (core toggle; DFreds when active)
 * @param {string} [config.kindLabel]      For user-facing warnings ("critical", "injury", ...)
 * @param {Actor[]|null} [config.explicitActors]  Known recipients; skips target/selection entirely
 * @param {{kind?: string, category?: string}|null} [config.burst]  Tag the effect so every client plays the outcome burst on the token (kind: 'injury' | 'crit' | 'fumble')
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
    explicitActors = null,
    burst = null
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
            showStatusToast('No Target', `Target or select a token to apply the ${kindLabel} to.`, 'fa-solid fa-crosshairs');
            return [];
        }
        recipients = tokens
            .filter((t) => t.actor)
            .map((t) => ({ actor: t.actor, displayName: t.name }));
    }

    const applied = [];
    for (const { actor, displayName } of recipients) {
        if (!actor.isOwner) {
            showStatusToast('No Permission', `You cannot modify ${displayName}.`, 'fa-solid fa-lock');
            continue;
        }
        if (actor.effects.some((e) => e.name === name)) {
            // Already carrying it — the desired state exists, count it applied
            showStatusToast('Already Applied', `${displayName} already has "${name}".`, 'fa-solid fa-circle-check');
            log(`${displayName} already has "${name}", skipping`, '', false, false);
            applied.push(displayName);
            continue;
        }

        // Resolve the condition up front. Real conditions (in
        // CONFIG.statusEffects) toggle as their own effect after ours is
        // created. dnd5e "pseudo" conditions (bleeding, burning, diseased —
        // rules-reference hazards the system deliberately makes
        // non-toggleable) are conveyed BY the injury effect itself via its
        // statuses array, which is exactly how dnd5e means them to be used:
        // actor.statuses reports them, and the injury's own icon marks the
        // token.
        let toggleId = null;
        let pseudoId = null;
        if (statusEffect) {
            const statusId = String(statusEffect).toLowerCase();
            if (CONFIG.statusEffects?.some((s) => s.id === statusId)) {
                toggleId = statusId;
            } else if (CONFIG.DND5E?.conditionTypes?.[statusId]) {
                pseudoId = statusId;
            } else if (statusId !== 'none') {
                log(`Unknown status effect "${statusEffect}" — not a condition or dnd5e pseudo-condition, skipped`, '', false, false);
            }
        }

        const effectData = {
            name,
            img,
            description: description || '',
            duration: Number.isFinite(durationSeconds) && durationSeconds > 0
                ? { seconds: durationSeconds }
                : {},
            statuses: pseudoId ? [pseudoId] : [],
            changes: [],
            // The burst flag makes createActiveEffect play the canvas
            // outcome burst on every connected client (manager-injury-effects).
            // It also records the toggled condition so Treatment knows what
            // to unwind when this affliction is removed.
            ...(burst ? { flags: { [MODULE.ID]: { outcomeBurst: {
                kind: burst.kind ?? 'injury',
                category: burst.category ?? 'General',
                name,
                condition: toggleId ?? null,
                // Treatment-roll DC: an authored `dc` wins, else the severity
                // ladder (minor 10 / moderate 15 / major 20), else a flat 15.
                severity: burst.severity ?? null,
                dc: Number.isFinite(Number(burst.dc)) && Number(burst.dc) > 0 ? Number(burst.dc) : null,
                // Points back at the injury's journal page so the GM can
                // read its notes later; the notes themselves are never
                // copied into chat, where players could read the DOM.
                sourceUuid: burst.sourceUuid ?? null
            } } } } : {})
        };
        await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
        if (pseudoId) log(`"${name}" conveys ${pseudoId} (dnd5e pseudo-condition) on ${displayName}`, '', false, false);
        showStatusToast('Applied', `"${name}" now afflicts ${displayName}.`, 'fa-solid fa-burst');
        applied.push(displayName);

        // One-time HP damage, dealt on apply as a direct update. This
        // deliberately bypasses the damage pipeline (Actor#applyDamage) so
        // an injury's own damage can never re-trigger the injury automation.
        if (Number.isFinite(damage) && damage > 0) {
            const hp = actor.system?.attributes?.hp;
            if (hp) {
                await actor.update({
                    'system.attributes.hp.value': Math.max(0, (Number(hp.value) || 0) - damage)
                });
                log(`Dealt ${damage} HP to ${displayName} from "${name}"`, '', false, false);
            }
        }

        // Real condition via CORE Foundry only: Actor#toggleStatusEffect.
        // (DFreds was dropped after testing: its toggle API rejected our calls
        // and it lacks the dnd5e 5.x conditions. Core conditions render fine
        // in DFreds' panel when that module is active.)
        if (toggleId) {
            try {
                if (!actor.statuses?.has(toggleId)) {
                    await actor.toggleStatusEffect(toggleId, { active: true });
                    log(`Toggled condition ${toggleId} (core) on ${displayName}`, '', false, false);
                }
            } catch (error) {
                log(`Could not toggle condition ${toggleId}`, error?.message, false, false);
            }
        }
    }
    return applied;
}
