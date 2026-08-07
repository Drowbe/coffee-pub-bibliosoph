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
import { damageFor, tickDamageFor } from './data/injury-schema.js';
import { modifiersToChanges, severityLabel, titleCase } from './data/outcome-schema.js';

/**
 * Build the applyStatusToTokens config for an injury from a decoded
 * data-effect payload.
 *
 * There are two ways an injury lands — the player clicks Apply on the card,
 * or `injuryAutoApply` applies it the moment the card is posted — and both
 * read the SAME button payload. They were built separately and drifted:
 * auto-apply passed the authored percentage as FLAT damage (bypassing the
 * floor that stops an injury killing anyone), and dropped modifiers, tick
 * and expiry entirely, so an automated wound did the wrong damage, cost no
 * roll penalties, never bled and never lingered.
 *
 * One builder, so a field added here reaches both paths or neither. It lives
 * beside the applier rather than in the card code so it can be exercised
 * without loading the module entry point.
 *
 * @param {object} data                 decoded data-effect payload
 * @param {Actor[]|null} explicitActors known recipients, or null to target at click time
 * @returns {object} config for applyStatusToTokens
 */
export function buildInjuryApplyConfig(data, explicitActors = null) {
    return {
        name: data.name,
        img: data.icon,
        description: data.description || '',
        durationSeconds: Number(data.duration) || null,
        // Injury damage is a PERCENTAGE of max HP, floored so an injury
        // maims and never kills.
        damagePercent: Number(data.damage) || null,
        statusEffect: data.statuseffect || null,
        // Roll penalties ride along as real ActiveEffect changes, so a
        // mangled hand costs the attack roll and not just prose.
        changes: modifiersToChanges(data.modifiers ?? []),
        kindLabel: 'injury',
        explicitActors,
        burst: {
            kind: 'injury',
            category: data.category || 'General',
            severity: data.severity || null,
            dc: data.treatmentDC ?? null,
            // Recurring damage and end-of-clock behaviour ride the flag so
            // the round ticker can read them off the effect.
            tick: Number(data.tick) || 0,
            expiry: data.expiry || 'heal',
            sourceUuid: data.sourceUuid ?? null
        }
    };
}

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
 * @param {number|null} [config.damage]    One-time FLAT HP damage dealt on apply
 * @param {number|null} [config.damagePercent]  One-time damage as a percentage
 *        of MAX HP, floored so it never drops the character below 1. Injuries
 *        use this; it wins over `damage` when both are given.
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
    damagePercent = null,
    statusEffect = null,
    kindLabel = 'effect',
    explicitActors = null,
    burst = null,
    changes = []
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
            // Real ActiveEffect changes — how a critical's "-2 to attacks
            // for 2 rounds" becomes a number the system applies rather
            // than a note the table has to remember.
            changes: Array.isArray(changes) ? changes : [],
            // The burst flag makes createActiveEffect play the canvas
            // outcome burst on every connected client (manager-injury-effects).
            // It also records the toggled condition so Treatment knows what
            // to unwind when this affliction is removed.
            ...(burst ? { flags: { [MODULE.ID]: { outcomeBurst: {
                kind: burst.kind ?? 'injury',
                category: burst.category ?? 'General',
                name,
                condition: toggleId ?? null,
                // Recurring damage (percent of max HP per turn) and what
                // happens when the clock runs out. The round ticker reads
                // both off this flag; 0/absent means neither applies.
                tick: Number(burst.tick) > 0 ? Number(burst.tick) : 0,
                expiry: burst.expiry === 'linger' ? 'linger' : 'heal',
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
        //
        // `damagePercent` is the injury path: a share of MAX HP, so the
        // same wound means the same thing at level 1 and level 15, floored
        // so it can never drop a character. `damage` is the flat path that
        // crits, fumbles and the harness still use.
        const flat = Number.isFinite(damagePercent) && damagePercent > 0
            ? damageFor(damagePercent, actor.system?.attributes?.hp)
            : (Number.isFinite(damage) && damage > 0 ? damage : 0);
        if (flat > 0) {
            const hp = actor.system?.attributes?.hp;
            if (hp) {
                await actor.update({
                    'system.attributes.hp.value': Math.max(0, (Number(hp.value) || 0) - flat)
                });
                const how = Number.isFinite(damagePercent) && damagePercent > 0
                    ? `${flat} HP (${damagePercent}% of ${hp.max})`
                    : `${flat} HP`;
                log(`Dealt ${how} to ${displayName} from "${name}"`, '', false, false);
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

// ==================================================================
// ===== EFFECTS CLASSIFIER =========================================
// ==================================================================
// Teaches Blacksmith what our effects ARE, so any surface that renders
// an actor's effects — their combat bar, a status window, Crier's turn
// card — shows "Injury · Moderate · Deafened · bleeding 3 HP/turn"
// instead of a bare row, without any of them importing from us.
//
// We supply meaning only. Blacksmith keeps the display, the filtering
// and the duration; it never learns what an injury is, and nothing here
// mutates an effect. Removal is deliberately NOT handled through this
// registry — the deleteActiveEffect unwind hook already covers every
// route, including callers who never opted in.
//
// Blacksmith ships a low-priority compatibility classifier for our flag
// (`coffee-pub-blacksmith.bibliosoph-outcome`, priority -100). Ours wins
// on priority and reads the fields theirs cannot know about; theirs stays
// registered as the fallback for worlds running an older Bibliosoph.
// ==================================================================

/** Our stamp on an effect, tolerant of a raw object with no getFlag. */
function readBurst(effect) {
    try {
        return effect?.getFlag?.(MODULE.ID, 'outcomeBurst') ?? effect?.flags?.[MODULE.ID]?.outcomeBurst ?? null;
    } catch {
        return effect?.flags?.[MODULE.ID]?.outcomeBurst ?? null;
    }
}

/** flag.kind -> the display type Blacksmith renders. */
const TYPE_BY_KIND = {
    injury:   { type: 'injury',   label: 'Injury',   severityKind: null },
    crit:     { type: 'critical', label: 'Critical', severityKind: 'crit' },
    critical: { type: 'critical', label: 'Critical', severityKind: 'crit' },
    fumble:   { type: 'fumble',   label: 'Fumble',   severityKind: 'fumble' }
};

/**
 * Describe one of our effects for Blacksmith's normalization layer.
 *
 * @param {ActiveEffect} effect
 * @param {object} ctx                  supplied by Blacksmith
 * @param {Actor} [ctx.actor]           whose sheet this is — needed to turn a
 *                                      percent tick into real hit points
 * @param {string[]} [ctx.conditionIds] conditions Blacksmith already found
 * @param {object} [ctx.api]            EffectsAPI, for condition labels
 * @returns {object|null} classification, or null if the effect is not ours
 */
function classifyAffliction(effect, { actor = null, conditionIds = [], api = null } = {}) {
    const burst = readBurst(effect);
    if (!burst) return null;

    const kind = String(burst.kind ?? '').toLowerCase();
    const mapped = TYPE_BY_KIND[kind];

    // 'treated' is a cosmetic stamp applied to somebody else's effect on the
    // way out so the recovery burst plays. It is not an affliction of ours.
    if (!mapped) {
        return {
            type: 'effect',
            typeLabel: 'Effect',
            name: String(effect?.name ?? '').trim(),
            conditionIds: []
        };
    }

    // Everything Blacksmith already found, plus the condition we toggled
    // separately — that one exists only in our flag, so nothing else can see it.
    const ids = new Set((conditionIds ?? []).map(String).filter(Boolean));
    if (burst.condition) ids.add(String(burst.condition));

    const parts = [];

    // Crits and fumbles carry the bucket name the table actually says
    // ("Carnage"); nobody calls a wound "a Carnage injury", so injuries
    // report their severity plainly.
    if (burst.severity) {
        parts.push(mapped.severityKind
            ? severityLabel(mapped.severityKind, burst.severity)
            : titleCase(burst.severity));
    }

    for (const id of ids) parts.push(api?.getConditionLabel?.(id) ?? id);

    // A live bleed, stated in hit points rather than the authored percent —
    // "3 HP/turn" is a thing a player can act on; "2%" is not. Deliberately
    // unlabelled: a wound conveying Bleeding would otherwise read
    // "Bleeding · bleeding 3 HP/turn".
    const tick = Number(burst.tick) || 0;
    if (tick > 0) {
        const perTurn = tickDamageFor(tick, actor?.system?.attributes?.hp);
        if (perTurn > 0) parts.push(`${perTurn} HP/turn`);
    } else if (burst.lingering) {
        // Lingering clears the duration, so without this the row would go
        // silent exactly when it most needs somebody to notice it.
        parts.push('needs treating');
    }

    return {
        type: mapped.type,
        typeLabel: mapped.label,
        name: String(effect?.name ?? '').replace(/^(Critical|Fumble)\s*:\s*/i, '').trim(),
        // undefined (not '') so Blacksmith falls back to its own condition
        // list when we have nothing better to say.
        context: parts.length ? parts.join(' · ') : undefined,
        conditionIds: [...ids]
    };
}

/**
 * Register the classifier. Safe on builds without the registry: older
 * Blacksmith has no registerClassifier and the built-in compatibility
 * classifier keeps rendering our effects, just with less detail.
 */
export function registerAfflictionClassifier() {
    const effects = game.modules.get('coffee-pub-blacksmith')?.api?.effects;
    if (typeof effects?.registerClassifier !== 'function') {
        log('Blacksmith build predates the effects classifier registry; skipping', '', true, false);
        return;
    }
    effects.registerClassifier({
        id: `${MODULE.ID}.afflictions`,
        priority: 100,             // beats Blacksmith's -100 compatibility classifier
        replace: true,             // idempotent across a module reload
        qualifies: (effect) => Boolean(readBurst(effect)),
        classify: classifyAffliction
    });
    log('Registered affliction classifier with Blacksmith', '', true, false);
}
