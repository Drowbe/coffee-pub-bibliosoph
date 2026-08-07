// ==================================================================
// ===== INJURY TICKS & EXPIRY (scripts/manager-injury-ticks.js) =====
// ==================================================================
// The two things a wound does over time:
//
//   TICK    Recurring damage at the start of the victim's turn, as a
//           percentage of max HP — the wound refusing to close.
//   EXPIRY  What happens when the duration runs out: 'heal' removes the
//           injury and unwinds its condition, 'linger' stops the ticking
//           and the penalties but leaves the injury for someone to treat.
//
// Both run on the ACTIVE GM only. The combat hooks fire on every client,
// and an HP change applied five times because five people are logged in
// is the classic version of this bug.
//
// Ticks are deliberately tied to COMBAT TURNS rather than the game clock.
// A wound that bleeds every six seconds of wall time while the party
// shops is bookkeeping nobody asked for; a wound that bleeds on your turn
// is a thing you feel.
// ==================================================================

import { MODULE } from './const.js';
import { damageFor } from './data/injury-schema.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `INJURY TICKS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | INJURY TICKS | ${message}`, data);
    }
}

function toast(title, subtitle = '', icon = 'fa-solid fa-droplet') {
    const api = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (api?.show) api.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    else ui.notifications.info(subtitle ? `${title} — ${subtitle}` : title);
}

const isActiveGm = () => game.user.isGM && game.users.activeGM?.id === game.user.id;

/** Bibliosoph afflictions on an actor, with their flags. */
function afflictionsOf(actor) {
    const out = [];
    for (const effect of actor?.effects ?? []) {
        const flag = effect.getFlag(MODULE.ID, 'outcomeBurst');
        if (flag) out.push({ effect, flag });
    }
    return out;
}

/**
 * Has a lingering wound finished bleeding?
 *
 * This is a PHASE timer, not a lifetime. It reads our own stamp rather than
 * the effect's duration, because a lingering wound has no Foundry duration —
 * it is permanent until treated, and the bleeding is a spell inside that.
 * Effect lifetimes are Blacksmith's: it owns expiry and deletion, and a
 * consumer that also deletes is racing it (architecture-ownership.md).
 */
function bleedPhaseOver(flag) {
    const seconds = Number(flag?.bleedSeconds) || 0;
    if (seconds <= 0) return false;                 // not a bleeding wound, or already settled
    const started = Number(flag?.bleedStart);
    if (!Number.isFinite(started)) return false;
    return (game.time.worldTime - started) >= seconds;
}

/**
 * Bleed one actor for one turn, and retire anything whose clock has run
 * out. Returns a short summary line per affliction that did something,
 * so the caller can say it out loud once rather than per-effect.
 */
async function resolveTurnFor(actor) {
    const notes = [];
    for (const { effect, flag } of afflictionsOf(actor)) {
        // SETTLE first: a wound that stopped bleeding this turn should not
        // also get one last tick out of the deal.
        //
        // Nothing here deletes. A heal injury's lifetime runs out on its own
        // duration and Blacksmith removes it; we only hear about it, through
        // onExpired. This branch is the other case — the bleeding stops and
        // the wound stays, which is not an expiry at all.
        if (bleedPhaseOver(flag)) {
            try {
                await effect.update({
                    changes: [],
                    [`flags.${MODULE.ID}.outcomeBurst.tick`]: 0,
                    [`flags.${MODULE.ID}.outcomeBurst.bleedSeconds`]: 0,
                    [`flags.${MODULE.ID}.outcomeBurst.lingering`]: true
                });
                notes.push(`${effect.name} has stopped worsening, but it still needs treating`);
            } catch (error) {
                log(`Could not settle "${effect.name}" into lingering`, error?.message, false, false);
            }
            continue;
        }

        // TICK
        const percent = Number(flag.tick) || 0;
        if (percent <= 0) continue;
        const hp = actor.system?.attributes?.hp;
        const loss = damageFor(percent, hp);
        if (loss <= 0) continue;              // already at 1 HP; a wound does not finish anyone
        try {
            await actor.update({
                'system.attributes.hp.value': Math.max(0, (Number(hp.value) || 0) - loss)
            });
            notes.push(`${effect.name} costs ${loss} HP`);
        } catch (error) {
            log(`Could not tick "${effect.name}" on ${actor.name}`, error?.message, false, false);
        }
    }
    return notes;
}

/**
 * Start-of-turn: bleed and retire. Bound to updateCombat rather than a
 * per-second clock so the damage lands on the victim's own turn, where
 * the table is already looking.
 */
export function registerInjuryTickHooks() {
    Hooks.on('updateCombat', async (combat, changed) => {
        try {
            if (!isActiveGm()) return;
            // Only when the turn actually moved. updateCombat also fires
            // for unrelated edits, and bleeding on those would be a bug
            // nobody could reproduce.
            if (!('turn' in changed) && !('round' in changed)) return;

            const actor = combat?.combatant?.actor;
            if (!actor) return;
            const notes = await resolveTurnFor(actor);
            if (!notes.length) return;

            log(`${actor.name}: ${notes.join('; ')}`, '', true, false);
            toast(`${actor.name}'s Injuries`, notes.join(' · '), 'fa-solid fa-droplet');
        } catch (error) {
            log('Turn tick failed', error?.message, false, false);
        }
    });

    // Out of combat the world clock still moves — a long rest advances hours —
    // so a bleed phase must be able to run out there too. No ticking here:
    // recurring damage is a combat beat, not a shopping one, and this only
    // lifts the penalties once the bleeding is over.
    Hooks.on('updateWorldTime', async () => {
        try {
            if (!isActiveGm()) return;
            for (const actor of game.actors) {
                if (!actor.effects?.size) continue;
                const settled = [];
                for (const { effect, flag } of afflictionsOf(actor)) {
                    if (!bleedPhaseOver(flag)) continue;
                    const name = effect.name;
                    try {
                        await effect.update({
                            changes: [],
                            [`flags.${MODULE.ID}.outcomeBurst.tick`]: 0,
                            [`flags.${MODULE.ID}.outcomeBurst.bleedSeconds`]: 0,
                            [`flags.${MODULE.ID}.outcomeBurst.lingering`]: true
                        });
                        settled.push(name);
                    } catch (error) {
                        log(`Could not settle "${name}" into lingering`, error?.message, false, false);
                    }
                }
                if (!settled.length) continue;
                log(`${actor.name}: ${settled.join('; ')} stopped bleeding with the clock`, '', true, false);
                toast(`${actor.name} Stabilised`, `${settled.join(' · ')} — still needs treating`, 'fa-solid fa-bandage');
            }
        } catch (error) {
            log('World-time bleed sweep failed', error?.message, false, false);
        }
    });

    // EXPIRY IS BLACKSMITH'S. Their sweep decides when a lifetime has run out
    // and either deletes the effect or yields that to Times Up, so exactly one
    // actor deletes in every configuration. We used to do this ourselves and
    // raced them; the loser cannot even suppress the error, because Foundry
    // notifies from inside the socket response handler before the promise
    // rejects. All we want is to say it happened.
    //
    // Their event fires on the GM client only, which matches this whole lane.
    const effectsApi = game.modules.get('coffee-pub-blacksmith')?.api?.effects;
    if (typeof effectsApi?.onExpired === 'function') {
        effectsApi.onExpired(({ effect, actor } = {}) => {
            try {
                const flag = effect?.getFlag?.(MODULE.ID, 'outcomeBurst');
                if (!flag || !actor) return;
                // A lingering wound has no duration, so it can never reach
                // here — if one somehow does, it is not ours to announce as
                // healed.
                if (flag.expiry === 'linger') return;
                toast(`${actor.name} Recovered`, `${effect.name} has healed`, 'fa-solid fa-heart-pulse');
                log(`${actor.name}: "${effect.name}" expired — Blacksmith owns the removal`, '', true, false);
            } catch (error) {
                log('Expiry announcement failed', error?.message, false, false);
            }
        });
    } else {
        log('Blacksmith build has no effects.onExpired; healed wounds will not be announced', '', false, false);
    }

    log('Watching turns for injury ticks and bleed phases', '', true, false);
}
