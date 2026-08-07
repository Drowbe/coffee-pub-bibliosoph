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
import { deleteEffectSafely } from './manager-status-effects.js';

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
 * How many combat rounds an effect has left, or null when it does not
 * work in rounds.
 *
 * Foundry reports `duration.remaining` IN THE UNIT THE DOCUMENT CARRIES:
 * seconds for a seconds-based duration, but rounds (as a decimal) for a
 * turns-based one. This used to divide both by six, which understated
 * every rounds-based wound by a factor of six — a five-round effect
 * reported "1 round remains".
 *
 * Documents arrive turns-based for reasons outside our control: dnd5e maps
 * a source item's round/turn units that way, the sheet's Temporary section
 * defaults `duration.rounds` to 1, and Times Up rewrites short durations.
 * So both units have to be handled, not just the one we author.
 */
export function roundsRemaining(effect) {
    const duration = effect?.duration;
    if (!duration) return null;
    const remaining = Number(duration.remaining);
    if (duration.type === 'turns') {
        return Number.isFinite(remaining) && remaining > 0 ? Math.ceil(remaining) : null;
    }
    if (Number.isFinite(remaining) && remaining > 0) return Math.ceil(remaining / 6);
    const seconds = Number(duration.seconds);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds / 6);
    return null;
}

/** "2 rounds remain" / "1 round remains" / "" when it is permanent. */
export function remainingLabel(effect) {
    const rounds = roundsRemaining(effect);
    if (!rounds) return '';
    return rounds === 1 ? '1 round remains' : `${rounds} rounds remain`;
}

/**
 * Has this effect's duration run out? Foundry's own `duration.remaining`
 * is authoritative when it is populated; the fallback compares the world
 * clock against when the effect started.
 */
function hasExpired(effect) {
    const duration = effect?.duration;
    if (!duration || duration.type === 'none') return false;   // permanent

    // `remaining` is authoritative and unit-agnostic: core counts down in
    // rounds for a turns-based duration and seconds for a seconds-based one,
    // and zero means over either way.
    //
    // This used to gate on `duration.seconds` being positive FIRST, which
    // made every turns-based affliction look permanent — including any our
    // own seconds duration had been rewritten into, since that rewrite nulls
    // `seconds`. Our expiry silently opted out of exactly the effects most
    // likely to expire during a fight.
    const remaining = Number(duration.remaining);
    if (Number.isFinite(remaining)) return remaining <= 0;

    // No `remaining` to read: out of combat a turns-based duration cannot be
    // resolved at all, so only the world clock can answer.
    const seconds = Number(duration.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    const started = Number(duration.startTime ?? 0);
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
        // EXPIRY first: an injury that ran out this turn should not also
        // get one last tick out of the deal.
        if (hasExpired(effect)) {
            if (flag.expiry === 'linger') {
                // Stop the bleeding and drop the roll penalties, but leave
                // the wound. Clearing `changes` is what actually lifts the
                // modifiers; the effect stays so it can still be treated.
                if (flag.tick || effect.changes?.length) {
                    try {
                        await effect.update({
                            changes: [],
                            'duration.seconds': null,
                            [`flags.${MODULE.ID}.outcomeBurst.tick`]: 0,
                            [`flags.${MODULE.ID}.outcomeBurst.lingering`]: true
                        });
                        notes.push(`${effect.name} has stopped worsening, but it still needs treating`);
                    } catch (error) {
                        log(`Could not settle "${effect.name}" into lingering`, error?.message, false, false);
                    }
                }
                continue;
            }
            // 'heal': delete it. The deleteActiveEffect hook unwinds the
            // condition and plays the recovery burst, so this is one call.
            //
            // Announce only if WE removed it. Another module expiring effects
            // on its own schedule can beat us to the same document; when it
            // does, the unwind hook still fires for it and claiming the heal
            // here would be a second announcement of one event.
            const healedName = effect.name;
            if (await deleteEffectSafely(effect)) notes.push(`${healedName} has healed`);
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

    // Out of combat the world clock still moves — a long rest advances
    // hours — so durations must be able to run out there too. No ticking
    // here: recurring damage is a combat beat, not a shopping one.
    Hooks.on('updateWorldTime', async () => {
        try {
            if (!isActiveGm()) return;
            // Combatants retire on their OWN turn, where the table is already
            // looking and resolveTurnFor announces it. Advancing a round also
            // moves the world clock, so without this guard the sweep deleted
            // the effect first and the turn announcement never happened —
            // the wound simply vanished with no explanation.
            const inCombat = game.combat?.started
                ? new Set(game.combat.combatants.map((c) => c.actor?.id).filter(Boolean))
                : null;
            for (const actor of game.actors) {
                if (!actor.effects?.size) continue;
                if (inCombat?.has(actor.id)) continue;
                const retired = [];
                for (const { effect, flag } of afflictionsOf(actor)) {
                    if (!hasExpired(effect)) continue;
                    if (flag.expiry === 'linger') continue;   // handled on its next turn
                    const name = effect.name;
                    if (await deleteEffectSafely(effect)) retired.push(name);
                }
                if (!retired.length) continue;
                // Say it out loud here too. Silence was the bug: the burst
                // plays on every client, so the table saw something happen
                // and were never told what.
                log(`${actor.name}: ${retired.join('; ')} expired with the clock`, '', true, false);
                toast(`${actor.name} Recovered`, retired.join(' · '), 'fa-solid fa-heart-pulse');
            }
        } catch (error) {
            log('World-time expiry sweep failed', error?.message, false, false);
        }
    });

    log('Watching turns for injury ticks and expiry', '', true, false);
}
