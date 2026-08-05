// ==================================================================
// ===== BIBLIOSOPH TEST HARNESS (testing/test-harness-macro.js) ====
// ==================================================================
// Paste this entire file into a Foundry SCRIPT MACRO and run it as the
// GM. It fires synthetic payloads through the REAL pipelines — the same
// code paths live play uses — so each scenario is one click instead of
// swinging weapons and typing manual rolls.
//
// Setup per run:
//   - Run as GM.
//   - For injury/crit/fumble scenarios: TARGET a token first (falls back
//     to selected). That token is the "injured"/"roller" actor.
//   - Toasts broadcast for real — connected players will see them.
//   - Console (F12) + Blacksmith debug logging narrate every decision.
// ==================================================================

const MODULE_PATH = '/modules/coffee-pub-bibliosoph/scripts';

const { RollToastManager } = await import(`${MODULE_PATH}/manager-roll-toasts.js`);
const { InjuryTriggerManager } = await import(`${MODULE_PATH}/manager-injury-triggers.js`);
const { triggerSocialToast } = await import(`${MODULE_PATH}/manager-social-toasts.js`);
const { applyStatusToTokens } = await import(`${MODULE_PATH}/manager-status-effects.js`);
const { rollOutcomeCard, rollInjuryCard } = await import(`${MODULE_PATH}/bibliosoph.js`);

// Scenario buttons sit two-up on the wider dialog; long labels still fit.
const SCENARIO_COLUMNS = 2;

// --- helpers ------------------------------------------------------

function getSubjectToken() {
    const targeted = Array.from(game.user.targets ?? []);
    const token = targeted[0] ?? canvas.tokens.controlled[0] ?? null;
    if (!token?.actor) {
        ui.notifications.warn('Target (or select) a token with an actor first.');
        return null;
    }
    return token;
}

function injuryOutcome(token, { amount, damages, isHealing = false }) {
    const hpMax = Number(token.actor.system?.attributes?.hp?.max) || 20;
    return {
        kind: 'damage',
        source: 'test-harness',
        amount,
        isHealing,
        damages,
        actorId: token.actor.id,
        tokenId: token.id,
        hp: {
            before: Number(token.actor.system?.attributes?.hp?.value) || hpMax,
            after: Math.max(0, (Number(token.actor.system?.attributes?.hp?.value) || hpMax) - amount),
            max: hpMax,
            temp: 0
        },
        meta: { ts: Date.now(), trigger: 'test-harness' }
    };
}

function attackOutcome(token, { isCritical = false, isFumble = false }) {
    return {
        kind: 'attack',
        source: 'test-harness',
        d20: isCritical ? 20 : (isFumble ? 1 : 12),
        total: isCritical ? 25 : (isFumble ? 4 : 15),
        isCritical,
        isFumble,
        success: isCritical,
        actorId: token.actor.id,
        tokenId: token.id,
        messageId: null,          // roller resolution falls back to actor owner
        visibility: 'public',
        hitTargets: [],
        missTargets: [],
        itemUuid: null,
        meta: { ts: Date.now(), trigger: 'test-harness' }
    };
}

function pctOfMax(token, pct) {
    const hpMax = Number(token.actor.system?.attributes?.hp?.max) || 20;
    return Math.max(1, Math.ceil(hpMax * (pct / 100)));
}

function setting(key, dflt) {
    try { return game.settings.get('coffee-pub-bibliosoph', key) ?? dflt; }
    catch (_) { return dflt; }
}
const threshold = () => Number(setting('injuryThreshold', 50)) || 50;

// --- toast channels -----------------------------------------------
// Every channel name Bibliosoph stamps on a toast. A GM lists these in
// Blacksmith's "Channels Excluded Users Still See" (toastBypassChannels)
// to let a camera/stream account see them despite being in
// toastExcludedUsers. Blacksmith only string-matches, so a typo fails
// silently — hence the audit scenario in the Tools tab.
const TOAST_CHANNELS = ['crit', 'fumble', 'injury', 'social'];

/** null when this Blacksmith build predates channels (setting unregistered). */
function blacksmithSetting(key) {
    try { return game.settings.get('coffee-pub-blacksmith', key) ?? ''; }
    catch (_) { return null; }
}

/** Blacksmith's own parsing: comma list, trimmed, lowercased. */
function commaList(raw) {
    return String(raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// --- settings-aware expectations ---------------------------------
// The handlers gate on Automation and Triggered By; predict the outcome
// from the LIVE settings so a no-op reads as "correct" instead of broken.

function sourceFilterBlocks(filterKey, token) {
    const mode = setting(filterKey, filterKey === 'injuryTriggerSource' ? 'players' : 'everyone');
    if (mode === 'everyone') return null;
    const isCharacter = token.actor.type === 'character';
    if (mode === 'players' && !isCharacter) return `Triggered By = Players, but ${token.name} is type "${token.actor.type}"`;
    if (mode === 'npcs' && isCharacter) return `Triggered By = NPCs and Monsters, but ${token.name} is a character`;
    return null;
}

function expectInjury(token, qualifies) {
    const automation = setting('injuryAutomation', 'click');
    if (automation === 'off' || automation === 'manual') {
        return `expect NOTHING (injury Automation = "${automation}" — no detection).`;
    }
    const blocked = sourceFilterBlocks('injuryTriggerSource', token);
    if (blocked) return `expect NOTHING (${blocked}).`;
    if (!qualifies) return 'expect NOTHING (below threshold).';
    const autoApply = setting('injuryAutoApply', false)
        ? ' Auto-Apply is ON: the card arrives pre-stamped and the injury is already applied.'
        : '';
    return (automation === 'auto'
        ? 'expect a toast AND the injury card immediately (fully automated).'
        : 'expect a toast with a roll button for the owner.') + autoApply;
}

function expectAttack(kind, token) {
    const automation = setting(`${kind}Automation`, 'click');
    if (automation === 'off' || automation === 'manual') {
        return `expect NOTHING (${kind} Automation = "${automation}" — no detection).`;
    }
    const blocked = sourceFilterBlocks('rollTriggerSource', token);
    if (blocked) return `expect NOTHING (${blocked}).`;
    return automation === 'auto'
        ? 'expect a toast AND the card immediately (fully automated).'
        : 'expect a toast with a roll button for the owner.';
}

// --- scenarios ----------------------------------------------------
// Each scenario belongs to a tab; the dialog renders one tab at a time.

const TABS = [
    { id: 'injuries', label: '🩸 Injuries' },
    { id: 'treatment', label: '🩹 Treatment' },
    { id: 'rolls', label: '🎲 Crits & Fumbles' },
    { id: 'inspiration', label: '💡 Inspiration' },
    { id: 'tools', label: '🧰 Apply, Social & Audit' }
];

const SCENARIOS = [
    {
        tab: 'injuries',
        label: '🩸 Injury: threshold hit (slashing)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const amount = pctOfMax(token, threshold());
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount,
                damages: [{ value: amount, type: 'slashing' }]
            }));
            ui.notifications.info(`Sent ${amount} slashing (at threshold) for ${token.name} — ${expectInjury(token, true)}`);
        }
    },
    {
        tab: 'injuries',
        label: '🩹 Injury: below threshold (no trigger)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const amount = Math.max(1, pctOfMax(token, threshold()) - 2);
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount,
                damages: [{ value: amount, type: 'slashing' }]
            }));
            ui.notifications.info(`Sent ${amount} slashing (below threshold) for ${token.name} — ${expectInjury(token, false)}`);
        }
    },
    {
        tab: 'injuries',
        label: '🔥 Injury: mixed damage, fire dominant',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const amount = pctOfMax(token, Math.min(100, threshold() + 10));
            const fire = Math.ceil(amount * 0.7);
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount,
                damages: [{ value: fire, type: 'fire' }, { value: amount - fire, type: 'piercing' }]
            }));
            ui.notifications.info(`Sent mixed ${amount} (fire-dominant) for ${token.name} — category should be FIRE. ${expectInjury(token, true)}`);
        }
    },
    {
        tab: 'injuries',
        label: '💚 Injury: healing (must not trigger)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount: -pctOfMax(token, 80),
                damages: [{ value: pctOfMax(token, 80), type: 'healing' }],
                isHealing: true
            }));
            ui.notifications.info(`Sent healing for ${token.name} — expect NOTHING (healing never triggers).`);
        }
    },
    {
        tab: 'treatment',
        label: '🤕 Apply treatable test injury (moderate, DC 15) → subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const applied = await applyStatusToTokens({
                name: 'Test: Treatable Wound',
                img: 'icons/skills/wounds/injury-pain-body-orange.webp',
                description: 'Harness injury for treatment-roll testing. Moderate severity → DC 15 (13 with a kit). Conveys Prone.',
                durationSeconds: 600,
                damage: null,
                statusEffect: 'prone',
                kindLabel: 'injury',
                explicitActors: [token.actor],
                burst: { kind: 'injury', category: 'Slashing', severity: 'moderate' }
            });
            ui.notifications.info(
                `Applied treatable wound to [${applied.join(', ') || 'nobody'}]. `
                + `Now post a Check-Up for ${token.name} and treat it from a PLAYER client to test the roll flow.`
            );
        }
    },
    {
        tab: 'treatment',
        label: '🎒 Give Healer\'s Kit (10 uses) → subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            await token.actor.createEmbeddedDocuments('Item', [{
                name: "Healer's Kit",
                type: 'consumable',
                img: 'icons/containers/bags/pack-leather-white-tan.webp',
                system: {
                    type: { value: 'trinket' },
                    uses: { max: '10', spent: 0 }
                }
            }]);
            ui.notifications.info(`Gave ${token.name} a Healer's Kit (10 uses). Their treats now roll with Advantage at DC −2.`);
        }
    },
    {
        tab: 'treatment',
        label: '🧽 Reset kit uses (spent → 0) on subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const kits = token.actor.items.filter((i) => i.name?.toLowerCase() === "healer's kit");
            for (const kit of kits) {
                if (kit.system?.uses) await kit.update({ 'system.uses.spent': 0 });
            }
            ui.notifications.info(kits.length
                ? `Reset uses on ${kits.length} Healer's Kit(s) for ${token.name}.`
                : `${token.name} has no Healer's Kit.`);
        }
    },
    {
        tab: 'treatment',
        label: '🗑️ Remove Healer\'s Kits from subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const ids = token.actor.items.filter((i) => i.name?.toLowerCase() === "healer's kit").map((i) => i.id);
            if (ids.length) await token.actor.deleteEmbeddedDocuments('Item', ids);
            ui.notifications.info(ids.length
                ? `Removed ${ids.length} Healer's Kit(s) from ${token.name}. Their treats lose the kit bonuses.`
                : `${token.name} has no Healer's Kit.`);
        }
    },
    {
        tab: 'injuries',
        label: '🩸 Apply a BLEEDING injury (2%/turn, 3 rounds, lingers)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const applied = await applyStatusToTokens({
                name: 'Test: Open Wound',
                img: 'icons/skills/wounds/blood-spurt-spray-red.webp',
                description: 'Harness bleed. Ticks 2% of max HP at the start of each turn for 3 rounds, then LINGERS — the bleeding stops but the wound stays until treated.',
                durationSeconds: 18,
                damagePercent: 5,
                statusEffect: 'prone',
                kindLabel: 'injury',
                explicitActors: [token.actor],
                burst: { kind: 'injury', category: 'Slashing', severity: 'moderate', tick: 2, expiry: 'linger' }
            });
            ui.notifications.info(
                `Applied to [${applied.join(', ') || 'nobody'}]. Start combat and advance ${token.name}'s turn 3 times: `
                + `expect 2%/turn damage and a toast each turn, then "stopped worsening" — the effect stays, its penalties clear.`
            );
        }
    },
    {
        tab: 'injuries',
        label: '⏳ Apply a HEALING-ON-EXPIRY injury (2 rounds, then gone)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            await applyStatusToTokens({
                name: 'Test: Passing Sting',
                img: 'icons/skills/wounds/injury-pain-body-orange.webp',
                description: 'Harness expiry. No tick. After 2 rounds it should delete itself AND unwind Blinded.',
                durationSeconds: 12,
                damagePercent: 3,
                statusEffect: 'blinded',
                kindLabel: 'injury',
                explicitActors: [token.actor],
                burst: { kind: 'injury', category: 'Piercing', severity: 'minor', tick: 0, expiry: 'heal' }
            });
            ui.notifications.info(`Applied to ${token.name} with Blinded. Advance 2 rounds — the injury should vanish AND Blinded should come off with it.`);
        }
    },
    {
        tab: 'injuries',
        label: '🧯 Condition unwind: delete an affliction from the SHEET',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const flagged = token.actor.effects.filter((e) => e.getFlag('coffee-pub-bibliosoph', 'outcomeBurst'));
            const before = Array.from(token.actor.statuses ?? []);
            console.log('BIBLIOSOPH UNWIND | before:', { afflictions: flagged.map((e) => e.name), statuses: before });
            ui.notifications.info(
                flagged.length
                    ? `${token.name} has ${flagged.length} affliction(s) and statuses [${before.join(', ') || 'none'}]. `
                      + `Now delete one from the ACTOR SHEET (not this card) — its condition must come off too. Re-run to compare.`
                    : `${token.name} has no Bibliosoph afflictions — apply an injury or crit first.`
            );
        }
    },
    {
        tab: 'treatment',
        label: '🔁 Clear treatment attempts on subject (retest)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            let cleared = 0;
            for (const effect of token.actor.effects) {
                if (effect.getFlag('coffee-pub-bibliosoph', 'treatAttempts')) {
                    await effect.unsetFlag('coffee-pub-bibliosoph', 'treatAttempts');
                    cleared++;
                }
            }
            ui.notifications.info(cleared
                ? `Cleared treatment attempts on ${cleared} effect(s) for ${token.name} — everyone may retry.`
                : `${token.name} has no recorded treatment attempts.`);
        }
    },
    {
        tab: 'treatment',
        label: '📋 Report treatment state (subject + your character)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const DCS = { minor: 10, moderate: 15, major: 20 };
            const lines = [];
            for (const effect of token.actor.effects) {
                const flag = effect.getFlag('coffee-pub-bibliosoph', 'outcomeBurst');
                if (flag?.kind !== 'injury') continue;
                const dc = flag.dc ?? DCS[String(flag.severity ?? '').toLowerCase()] ?? 15;
                const tried = (effect.getFlag('coffee-pub-bibliosoph', 'treatAttempts') ?? [])
                    .map((id) => game.actors.get(id)?.name ?? id);
                lines.push(`${effect.name}: severity=${flag.severity ?? 'none (legacy)'}, DC=${dc}, tried=[${tried.join(', ')}]`);
            }
            const me = game.user.character;
            const kit = me?.items?.find((i) => i.name?.toLowerCase() === "healer's kit");
            const uses = kit?.system?.uses;
            const kitLine = !me ? 'no assigned character'
                : !kit ? `${me.name}: no Healer's Kit`
                : Number(uses?.max) > 0 ? `${me.name}: kit with ${Math.max(0, Number(uses.max) - Number(uses.spent ?? 0))}/${uses.max} uses`
                : `${me.name}: kit (no uses pool — presence-only)`;
            console.log(`BIBLIOSOPH TREATMENT | ${token.name} injuries:\n  ${lines.join('\n  ') || '(none)'}\n  Roller: ${kitLine}`);
            ui.notifications.info(`${token.name}: ${lines.length} treatable injuries — details in console (F12). Roller: ${kitLine}.`);
        }
    },
    {
        tab: 'treatment',
        label: '🎯 Report the advantage matrix (what WOULD be requested)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { treatmentRollPlan } = await import(`${MODULE_PATH}/bibliosoph.js`);
            const roller = game.user.character;
            if (!roller) return ui.notifications.warn('Assign a character to your user — the plan is computed for the roller.');

            // The live case, then the same roller against themselves, so
            // both self/other rows show without swapping tokens.
            const rows = [
                ['treating ' + token.name, treatmentRollPlan(roller, token.actor.id, 15)],
                ['treating THEMSELVES', treatmentRollPlan(roller, roller.id, 15)]
            ];
            const out = rows.map(([label, p]) =>
                `${label.padEnd(24)} kit=${p.useKit ? 'YES' + p.kitNote : 'no '} self=${p.self ? 'yes' : 'no '} `
                + `-> ${p.mode.toUpperCase().padEnd(12)} DC ${p.dc}${p.dc !== p.baseDc ? ` (base ${p.baseDc})` : ''}\n      "${p.explanation}"`);
            console.log(`BIBLIOSOPH TREATMENT MATRIX | roller: ${roller.name}\n  ${out.join('\n  ')}`);
            ui.notifications.info(
                `${roller.name} → ${token.name}: ${rows[0][1].mode} at DC ${rows[0][1].dc} · `
                + `→ self: ${rows[1][1].mode} at DC ${rows[1][1].dc}. Full matrix + explanations in console (F12).`
            );
        }
    },
    {
        tab: 'treatment',
        label: '🎲 Fire a LOCKED request per mode (adv / dis / normal)',
        run: async () => {
            const roller = game.user.character ?? getSubjectToken()?.actor;
            if (!roller) return ui.notifications.warn('Assign a character or select a token first.');
            const api = game.modules.get('coffee-pub-blacksmith')?.api;
            if (!api?.openRequestRollDialog) return ui.notifications.warn('Blacksmith request API unavailable.');

            const token = canvas.tokens.placeables.find((t) => t.actor?.id === roller.id);
            const entry = token ? { tokenId: token.id, actorId: roller.id, name: roller.name } : { actorId: roller.id, name: roller.name };
            const CASES = [
                ['advantage', "A Healer's Kit steadies your hands: roll with Advantage."],
                ['disadvantage', 'Treating your own wounds is never easy: roll with Disadvantage.'],
                ['normal', 'Kit Advantage and self-treatment Disadvantage cancel out.']
            ];
            for (const [mode, explanation] of CASES) {
                await api.openRequestRollDialog({
                    silent: true,
                    title: `Harness: locked ${mode}`,
                    initialType: 'skill',
                    initialValue: 'medicine',
                    dc: 13,
                    showDC: false,
                    groupRoll: false,
                    rollAdvantage: mode,
                    lockRollAdvantage: true,
                    explanation,
                    actors: [{ ...entry, rollAdvantage: mode }]
                });
            }
            ui.notifications.info(
                'Posted 3 locked requests. Each should render ONLY its own button and show the explanation under "About this Roll". '
                + 'If all three buttons appear, this Blacksmith build predates Request #5.'
            );
        }
    },
    {
        tab: 'treatment',
        label: '🔍 Inspect the last request\'s roll-mode flags',
        run: () => {
            const msg = game.messages.contents.slice().reverse()
                .find((m) => m.flags?.['coffee-pub-blacksmith']?.actors);
            if (!msg) return ui.notifications.warn('No Blacksmith roll request found in chat — fire one first.');
            const f = msg.flags['coffee-pub-blacksmith'];
            const report = [
                `message: ${msg.id}`,
                `request rollAdvantage : ${f.rollAdvantage ?? '(unset — build predates Request #5?)'}`,
                `lockRollAdvantage     : ${f.lockRollAdvantage ?? '(unset)'}`,
                `explanation           : ${f.explanation ? `"${f.explanation}"` : '(unset)'}`,
                ...(f.actors ?? []).map((a, i) => `actor[${i}] ${String(a.name ?? a.actorId).padEnd(18)} rollAdvantage=${a.rollAdvantage ?? '(inherits)'}`)
            ];
            console.log('BIBLIOSOPH REQUEST FLAGS\n  ' + report.join('\n  '));
            ui.notifications.info(
                f.rollAdvantage || (f.actors ?? []).some((a) => a.rollAdvantage)
                    ? `Roll mode travelled: ${f.rollAdvantage ?? 'per-actor'}${f.lockRollAdvantage ? ' (LOCKED)' : ''}. Details in console (F12).`
                    : 'No rollAdvantage on the request — either it was not sent, or this Blacksmith build drops it. Console (F12).'
            );
        }
    },
    {
        tab: 'treatment',
        label: '🖼️ Preview all 4 outcome cards (success/crit/fail/fumble)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { postTreatmentOutcome } = await import(`${MODULE_PATH}/bibliosoph.js`);
            const healer = game.user.character ?? token.actor;
            for (const outcome of ['success', 'crit', 'fail', 'fumble']) {
                await postTreatmentOutcome({
                    healer,
                    patient: token.actor,
                    effectName: 'Test: Treatable Wound',
                    effectImg: 'icons/skills/wounds/injury-pain-body-orange.webp',
                    outcome
                });
            }
            ui.notifications.info('Posted all 4 outcome-card variants (no mechanics ran — preview only).');
        }
    },
    {
        tab: 'rolls',
        label: '💥 Crit toast (attackResolved)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            RollToastManager._onAttackResolved(attackOutcome(token, { isCritical: true }));
            ui.notifications.info(`Sent crit for ${token.name} — ${expectAttack('crit', token)}`);
        }
    },
    {
        tab: 'rolls',
        label: '💔 Fumble toast (attackResolved)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            RollToastManager._onAttackResolved(attackOutcome(token, { isFumble: true }));
            ui.notifications.info(`Sent fumble for ${token.name} — ${expectAttack('fumble', token)}`);
        }
    },
    {
        tab: 'rolls',
        label: '🃏 Crit card directly (skip toast)',
        run: () => rollOutcomeCard('crit')
    },
    {
        tab: 'rolls',
        label: '🃏 Fumble card directly (skip toast)',
        run: () => rollOutcomeCard('fumble')
    },
    {
        tab: 'rolls',
        label: '👥 Demo the ALLY picker (pick or roll a party member)',
        run: async () => {
            // "Crappy Neighbor" lands on a party member — the card should
            // show a Random button plus one button per character.
            await rollOutcomeCard('fumble', { title: 'Crappy Neighbor' });
            ui.notifications.info('Expect: a "Random Party Member" button plus one per character. Picking one stamps the card and removes the rest.');
        }
    },
    {
        tab: 'rolls',
        label: '✌️ Demo a TWO-PICK ally card (picks: 2)',
        run: async () => {
            // No shipped outcome sets picks > 1 yet, so this overrides the
            // record rather than editing the compendium. The card should
            // stay open until BOTH choices are made.
            await rollOutcomeCard('fumble', { title: 'Crappy Neighbor', overrides: { picks: 2 } });
            ui.notifications.info('Expect: "Pick 2 party members — one at a time." Click one → the hint becomes "Pick 1 more party member.", a "✓ So far:" line appears, and that person\'s button is gone. Click a second → the whole picker collapses to one stamp naming both.');
        }
    },
    {
        tab: 'rolls',
        label: '✌️ Two-pick via RANDOM twice (no repeat picks)',
        run: async () => {
            await rollOutcomeCard('fumble', { title: 'Crappy Neighbor', overrides: { picks: 3 } });
            ui.notifications.info('Click "Random Party Member" three times. Expect three DIFFERENT characters — random excludes anyone already chosen, and each pick also removes that character\'s own button.');
        }
    },
    {
        tab: 'rolls',
        label: '🔐 Who sees Apply? (roller-owner gate)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            await rollOutcomeCard('fumble', {
                title: 'Crappy Neighbor',
                rollerActorId: token.actor?.id ?? null,
                rollerTokenId: token.id
            });
            const owners = game.users.filter((u) => !u.isGM && token.actor?.testUserPermission(u, 'OWNER')).map((u) => u.name);
            ui.notifications.info(
                `Card posted as ${token.name}'s roll. GM sees the picker always. `
                + (owners.length
                    ? `These players should ALSO see it: ${owners.join(', ')}. Their click relays to the GM — watch the GM console.`
                    : `No non-GM player owns ${token.name}, so no player should see the buttons.`)
            );
        }
    },
    {
        tab: 'rolls',
        label: '🧑‍🤝‍🧑 Who counts as "the party"? (type + on-canvas filter)',
        run: () => {
            const assigned = game.users.filter((u) => !u.isGM && u.character).map((u) => u.character);
            const raw = assigned.length ? assigned : game.actors.filter((a) => a.hasPlayerOwner);
            const seen = new Map();
            for (const a of raw) if (a) seen.set(a.id, a);
            const all = [...seen.values()];
            const wrongType = all.filter((a) => a.type !== 'character');
            const chars = all.filter((a) => a.type === 'character');
            const present = chars.filter((a) => (a.getActiveTokens?.() ?? []).length > 0);
            const absent = chars.filter((a) => !(a.getActiveTokens?.() ?? []).length);
            const report = [
                `source: ${assigned.length ? 'assigned player characters' : 'player-owned actors (nobody assigned)'}`,
                `excluded by TYPE: ${wrongType.map((a) => `${a.name} (${a.type})`).join(', ') || 'none'}`,
                `on this scene:    ${present.map((a) => a.name).join(', ') || 'NOBODY'}`,
                `off this scene:   ${absent.map((a) => a.name).join(', ') || 'none'}`,
                `-> pickers offer: ${(present.length ? present : chars).map((a) => a.name).join(', ') || '(none — card falls back to select-a-token)'}`
                    + (present.length ? '' : '   [FALLBACK: nobody placed, so the whole party is offered]')
            ];
            console.log('BIBLIOSOPH PARTY RESOLUTION\n  ' + report.join('\n  '));
            ui.notifications.info(
                `${(present.length ? present : chars).length} in crit/fumble pickers`
                + (wrongType.length ? ` · ${wrongType.length} excluded by type (${wrongType.map((a) => a.type).join(', ')})` : '')
                + `. Full breakdown in console (F12).`
            );
        }
    },
    {
        tab: 'rolls',
        label: '🎉 Demo the PARTY apply (one button, everyone)',
        run: async () => {
            await rollOutcomeCard('crit', { title: 'Play Date' });
            ui.notifications.info('Expect: a single "Apply to the Whole Party (n)" button — no selecting.');
        }
    },
    {
        tab: 'rolls',
        label: '⚔️ Demo MODIFIERS on a card (Chicken Hat: -2 attack, 2 rounds)',
        run: async () => {
            await rollOutcomeCard('fumble', { title: 'Chicken Hat' });
            ui.notifications.info('Expect a mechanics block listing the -2 attack modifier. Apply it, then check the effect\'s Changes tab on the actor.');
        }
    },
    {
        tab: 'rolls',
        label: '🎲 Audit outcome pool: buckets, targets, mechanics',
        run: async () => {
            const out = [];
            for (const [kind, settingKey] of [['crit', 'critCompendium'], ['fumble', 'fumbleCompendium']]) {
                const packId = setting(settingKey, 'none');
                if (!packId || packId === 'none') { out.push(`${kind}: source is None (roll table path)`); continue; }
                const pack = game.packs.get(packId);
                if (!pack) { out.push(`${kind}: compendium "${packId}" not found`); continue; }
                const recs = [];
                for (const journal of await pack.getDocuments()) {
                    for (const page of journal.pages) {
                        const s = page._source?.system ?? page.system;
                        if (s?.kind) recs.push({ ...s, title: page.name, journal: journal.name });
                    }
                }
                const buckets = {}; const targets = {};
                let mech = 0, mods = 0;
                const multi = [];
                for (const r of recs) {
                    buckets[r.journal] = (buckets[r.journal] ?? 0) + 1;
                    targets[r.appliesto] = (targets[r.appliesto] ?? 0) + 1;
                    if (r.statuseffect !== 'none' || r.damage || r.modifiers?.length) mech++;
                    if (r.modifiers?.length) mods++;
                    // Flags both authored multi-picks and the broken combination
                    // (picks > 1 without the ally picker, where it does nothing).
                    if (Number(r.picks) > 1) multi.push(`${r.title} ×${r.picks}${r.appliesto === 'ally' ? '' : ` [IGNORED — lands on ${r.appliesto}]`}`);
                }
                const total = recs.reduce((s, r) => s + (Number(r.odds) || 1), 0);
                const top = [...recs].sort((a, b) => (b.odds || 1) - (a.odds || 1))[0];
                out.push(`${kind.toUpperCase()} (${recs.length}) from ${packId}`);
                out.push(`  buckets: ${Object.entries(buckets).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
                out.push(`  lands on: ${Object.entries(targets).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
                out.push(`  with mechanics: ${mech}/${recs.length} · with modifiers: ${mods}`);
                out.push(`  multi-pick: ${multi.length ? multi.join(' · ') : 'none'}`);
                out.push(`  most likely: ${top?.title} (${Math.round(100 * (top?.odds || 1) / total)}%)`);
            }
            console.log('BIBLIOSOPH OUTCOME POOL\n  ' + out.join('\n  '));
            ui.notifications.info('Outcome pool audited — buckets, targets, and mechanics coverage in console (F12).');
        }
    },
    {
        tab: 'rolls',
        label: '🎯 Simulate 200 crit rolls (bucket distribution)',
        run: async () => {
            const packId = setting('critCompendium', 'none');
            const pack = game.packs.get(packId);
            if (!pack) return ui.notifications.warn('Set a Criticals Source compendium first.');
            const recs = [];
            for (const journal of await pack.getDocuments()) {
                for (const page of journal.pages) {
                    const s = page._source?.system ?? page.system;
                    if (s?.kind === 'crit') recs.push({ ...s, title: page.name });
                }
            }
            const pick = (items) => {
                const w = items.map((i) => Math.max(1, Number(i.odds) || 1));
                const t = w.reduce((a, b) => a + b, 0);
                let r = Math.random() * t;
                for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
                return items.at(-1);
            };
            const mix = {};
            for (let n = 0; n < 200; n++) { const s = pick(recs).severity; mix[s] = (mix[s] ?? 0) + 1; }
            console.log('BIBLIOSOPH | 200 crit rolls by bucket:', mix);
            ui.notifications.info(`200 crit rolls: ${Object.entries(mix).map(([k, v]) => `${k} ${Math.round(v / 2)}%`).join(' · ')} (expect roughly 10/85/5).`);
        }
    },
    {
        tab: 'injuries',
        label: '🩻 Injury card directly (Fire → subject)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            rollInjuryCard('Fire', { actorId: token.actor.id, tokenId: token.id });
        }
    },
    {
        tab: 'injuries',
        label: '🩺 Check-Up card (all subject\'s afflictions)',
        run: () => {
            if (typeof window.triggerTreatmentCard === 'function') {
                window.triggerTreatmentCard();
            } else {
                ui.notifications.warn('Treatment not available — reload after the module update.');
            }
        }
    },
    {
        tab: 'inspiration',
        label: '🃏 Open the DEAL dialog (choose a card, or random)',
        run: async () => {
            const { openInspirationDealDialog } = await import(`${MODULE_PATH}/bibliosoph.js`);
            await openInspirationDealDialog();
        }
    },
    {
        tab: 'inspiration',
        label: '💡 Draw a card (random) → item on subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { drawInspirationCard } = await import(`${MODULE_PATH}/bibliosoph.js`);
            await drawInspirationCard(token.actor);
            ui.notifications.info(`Drew for ${token.name} — check their sheet for the "Inspiration: …" item. Using that item raises the PLAY card, and its buttons resolve it.`);
        }
    },
    {
        tab: 'inspiration',
        label: '🧪 Deal the 4 AUTOMATED cards → subject\'s inventory',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { drawInspirationCard } = await import(`${MODULE_PATH}/bibliosoph.js`);
            for (const title of ['Snake Oil', 'Raise the Dead', 'Cat Nap', 'Smite']) {
                await drawInspirationCard(token.actor, { title });
            }
            ui.notifications.info(`Four cards are in ${token.name}'s inventory — ALL FOUR playable, no points needed. Expect: Snake Oil + Raise the Dead offer self/party/target buttons, Cat Nap one self button, Smite a button per targeted creature.`);
        }
    },
    {
        tab: 'inspiration',
        label: '🔄 Deal LIFE SWAP (target the other character on use)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { drawInspirationCard } = await import(`${MODULE_PATH}/bibliosoph.js`);
            await drawInspirationCard(token.actor, { title: 'Life Swap' });
            ui.notifications.info(`In ${token.name}'s inventory. Using it offers a button per OTHER party member plus "Random Party Member" — no selecting. Overflow lands as temp HP.`);
        }
    },
    {
        tab: 'inspiration',
        label: '📖 Deal NARRATIVE cards (no automation, still spends)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { drawInspirationCard } = await import(`${MODULE_PATH}/bibliosoph.js`);
            for (const title of ['Re-roll', 'Night School']) {
                await drawInspirationCard(token.actor, { title });
            }
            ui.notifications.info('No automation by design — using the item raises the card with one "Play This Card" button. Clicking it spends the point and discards the card.');
        }
    },
    {
        tab: 'inspiration',
        label: '🗑️ Take back the subject\'s card items (retest)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { CARD_FLAG } = await import(`${MODULE_PATH}/manager-inspiration.js`);
            const ids = token.actor.items.filter((i) => i.getFlag('coffee-pub-bibliosoph', CARD_FLAG)).map((i) => i.id);
            if (ids.length) await token.actor.deleteEmbeddedDocuments('Item', ids);
            ui.notifications.info(ids.length
                ? `Removed ${ids.length} card item(s) from ${token.name}.`
                : `${token.name} is holding no cards.`);
        }
    },
    {
        tab: 'inspiration',
        label: '📋 Who is holding cards right now?',
        run: async () => {
            const { CARD_FLAG } = await import(`${MODULE_PATH}/manager-inspiration.js`);
            const lines = [];
            for (const actor of game.actors.filter((a) => a.type === 'character')) {
                const cards = actor.items.filter((i) => i.getFlag('coffee-pub-bibliosoph', CARD_FLAG)).map((i) => i.name);
                if (cards.length) lines.push(`${actor.name} (${cards.length}): ${cards.join(', ')}`);
            }
            console.log(`BIBLIOSOPH INSPIRATION HANDS\n  ${lines.join('\n  ') || '(nobody is holding a card)'}`);
            ui.notifications.info(lines.length
                ? `${lines.length} character(s) holding cards — details in console (F12).`
                : 'Nobody is holding a card.');
        }
    },
    {
        tab: 'inspiration',
        label: '♻️ Play a card TWICE (must refuse the second time)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { CARD_FLAG, applyInspirationCard } = await import(`${MODULE_PATH}/manager-inspiration.js`);
            const item = token.actor.items.find((i) => i.getFlag('coffee-pub-bibliosoph', CARD_FLAG));
            if (!item) return ui.notifications.warn(`${token.name} is holding no cards — deal one first.`);
            const card = item.getFlag('coffee-pub-bibliosoph', CARD_FLAG);
            const args = { card, holderActorId: token.actor.id, targetActorIds: [token.actor.id], itemUuid: item.uuid };
            const first = await applyInspirationCard(args);
            const second = await applyInspirationCard(args);
            console.log('BIBLIOSOPH | double-play test:', { first, second });
            ui.notifications.info(
                `1st: ${first.ok ? 'OK — ' + first.summary : 'refused — ' + first.summary} | `
                + `2nd: ${second.ok ? 'RESOLVED AGAIN (BUG!)' : 'refused — ' + second.summary}`
            );
        }
    },
    {
        tab: 'inspiration',
        label: '🔍 Inspect a card item\'s wiring (uses, activity, flag)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { CARD_FLAG } = await import(`${MODULE_PATH}/manager-inspiration.js`);
            const item = token.actor.items.find((i) => i.getFlag('coffee-pub-bibliosoph', CARD_FLAG));
            if (!item) return ui.notifications.warn(`${token.name} is holding no card items — deal one first.`);
            const flag = item.getFlag('coffee-pub-bibliosoph', CARD_FLAG);
            const activities = Array.from(item.system.activities ?? []).map((a) => `${a.type}/${a.name} consumes=${JSON.stringify(a.consumption?.targets ?? [])}`);
            const report = [
                `item: ${item.name} (${item.type}/${item.system.type?.value})`,
                `uses: spent=${item.system.uses?.spent} max=${item.system.uses?.max} autoDestroy=${item.system.uses?.autoDestroy}`,
                `activities: ${activities.join(' | ') || 'NONE — it will not be usable!'}`,
                `flag: action=${flag.action} amount=${flag.actionamount} formula=${flag.actionformula || '—'}`,
                `source: ${flag.sourceUuid ?? 'none'}`
            ];
            console.log('BIBLIOSOPH CARD ITEM\n  ' + report.join('\n  '));
            ui.notifications.info(`${item.name}: ${activities.length} activity, ${item.system.uses?.max} use, autoDestroy=${item.system.uses?.autoDestroy}. Full wiring in console (F12).`);
        }
    },
    {
        tab: 'inspiration',
        label: '🎲 Audit the deck (actions, odds, art)',
        run: async () => {
            const packId = setting('inspirationCompendium', 'none');
            if (!packId || packId === 'none') return ui.notifications.warn('Inspiration source is None — set a compendium first.');
            const pack = game.packs.get(packId);
            if (!pack) return ui.notifications.warn(`Compendium "${packId}" not found.`);
            const rows = [];
            let automated = 0;
            for (const journal of await pack.getDocuments()) {
                for (const page of journal.pages) {
                    const s = page._source?.system ?? page.system;
                    if (!s) continue;
                    if (s.action && s.action !== 'none') automated++;
                    rows.push(`${page.name.padEnd(16)} action=${String(s.action).padEnd(14)} odds=${s.odds}`);
                }
            }
            console.log(`BIBLIOSOPH INSPIRATION DECK (${packId})\n  ${rows.join('\n  ')}`);
            ui.notifications.info(`${rows.length} cards — ${automated} automated, ${rows.length - automated} narrative. Details in console (F12).`);
        }
    },
    {
        tab: 'tools',
        label: '🍺 Social toasts (all configured)',
        run: async () => {
            for (const kind of ['beverage', 'bio', 'insult', 'praise']) {
                await triggerSocialToast(kind);
            }
            ui.notifications.info('Fired all configured social toasts (unconfigured ones warn or skip).');
        }
    },
    {
        tab: 'tools',
        label: '📡 Audit toast channels (will the camera see crits?)',
        run: () => {
            const allowedRaw = blacksmithSetting('toastBypassChannels');
            if (allowedRaw === null) {
                return ui.notifications.warn(
                    'This Blacksmith build has no toastBypassChannels setting (needs the release after 13.15.0). '
                    + 'Bibliosoph still stamps channels; they are ignored, so excluded users see nothing — same as before.'
                );
            }
            const allowed = commaList(allowedRaw);
            const excludedNames = commaList(blacksmithSetting('toastExcludedUsers'));
            const byName = new Map(game.users.map((u) => [u.name.toLowerCase(), u]));
            const excludedUsers = excludedNames.map((n) => byName.get(n)).filter(Boolean);
            // Exclusion matches the user NAME exactly (case-insensitive), so a
            // renamed or misspelled account silently excludes nobody.
            const ghosts = excludedNames.filter((n) => !byName.has(n));
            // Allowed names Bibliosoph never sends: another module's channel,
            // or the typo that makes this whole feature look broken.
            const foreign = allowed.filter((c) => !TOAST_CHANNELS.includes(c));

            const rows = TOAST_CHANNELS.map((c) =>
                `${c.padEnd(8)} ${allowed.includes(c) ? 'ALLOWED — excluded users DO see it' : 'blocked — excluded users see nothing'}`);
            const report = [
                `excluded users : ${excludedUsers.map((u) => `${u.name}${u.active ? '' : ' (offline)'}`).join(', ') || '(none — exclusion is off, everyone sees everything)'}`,
                ...(ghosts.length ? [`  NO SUCH USER : ${ghosts.join(', ')} — excludes nobody; check spelling against the user list`] : []),
                `allowed channels: ${allowed.join(', ') || '(none)'}`,
                ...(foreign.length ? [`  not Bibliosoph's: ${foreign.join(', ')} — another module's channel, or a typo of ${TOAST_CHANNELS.join('/')}`] : []),
                '',
                ...rows
            ];
            console.log('BIBLIOSOPH TOAST CHANNELS\n  ' + report.join('\n  '));
            ui.notifications.info(
                excludedUsers.length
                    ? `${excludedUsers.length} excluded user(s) · allowed: ${allowed.filter((c) => TOAST_CHANNELS.includes(c)).join(', ') || 'nothing from Bibliosoph'}`
                      + `${ghosts.length ? ` · ${ghosts.length} name(s) match no user!` : ''}. Full table in console (F12).`
                    : 'Nobody is toast-excluded in Blacksmith — channels have no effect until someone is. Details in console (F12).'
            );
        }
    },
    {
        tab: 'tools',
        label: '📢 Fire one toast per channel (watch the excluded client)',
        run: async () => {
            // Bypasses automation, thresholds, and source filters — the point
            // is the channel field, not the detection that normally sets it.
            for (const channel of TOAST_CHANNELS) {
                RollToastManager.deliver({
                    title: `Channel test: ${channel}`,
                    subtitle: `If you are toast-excluded, you see this only when "${channel}" is in Blacksmith's allowed channels.`,
                    icon: 'fa-solid fa-satellite-dish',
                    size: 'small',
                    duration: 5,
                    channel,
                    moduleId: 'coffee-pub-bibliosoph'
                });
            }
            ui.notifications.info(
                `Broadcast ${TOAST_CHANNELS.length} toasts, one per channel. Normal clients see all ${TOAST_CHANNELS.length}. `
                + 'An excluded client should see only the allowed ones — run the channel audit to see which those are.'
            );
        }
    },
    {
        tab: 'tools',
        label: '🧪 Apply mechanics: synthetic effect → subject',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const hpBefore = Number(token.actor.system?.attributes?.hp?.value);
            const applied = await applyStatusToTokens({
                name: 'Test: Harness Effect',
                img: 'icons/skills/wounds/blood-spurt-spray-red.webp',
                description: 'Deterministic harness check: 3 HP one-time damage, 2-minute duration, Blinded via core Foundry.',
                durationSeconds: 120,
                damage: 3,
                statusEffect: 'blinded',
                kindLabel: 'test effect',
                explicitActors: [token.actor]
            });
            const hpAfter = Number(token.actor.system?.attributes?.hp?.value);
            ui.notifications.info(
                `Applied: [${applied.join(', ') || 'nobody'}]. HP ${hpBefore} → ${hpAfter} `
                + `(expect -3 first run, unchanged on re-run with an "already has" notice). `
                + `Check: Blinded condition on, 2-min duration on the effect. Delete "Test: Harness Effect" + Blinded when done.`
            );
        }
    },
    {
        tab: 'tools',
        label: '💢 Burst: injury (random type → subject)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { playInjuryBurst } = await import(`${MODULE_PATH}/manager-injury-effects.js`);
            const cats = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic',
                'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder', 'General'];
            const cat = cats[Math.floor(Math.random() * cats.length)];
            playInjuryBurst(token, cat, cat === 'General' ? 'Injury' : `${cat} Injury`);
            ui.notifications.info(`Burst preview: INJURY (${cat}). Local-only; real applies burst on every client.`);
        }
    },
    {
        tab: 'tools',
        label: '✨ Burst: crit (gold starburst → subject)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { playCritBurst } = await import(`${MODULE_PATH}/manager-injury-effects.js`);
            playCritBurst(token, 'Critical Hit');
        }
    },
    {
        tab: 'tools',
        label: '💀 Burst: fumble (impact + debris → subject)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { playFumbleBurst } = await import(`${MODULE_PATH}/manager-injury-effects.js`);
            playFumbleBurst(token, 'Fumble');
        }
    },
    {
        tab: 'tools',
        label: '💚 Burst: treatment (heal motes → subject)',
        run: async () => {
            const token = getSubjectToken();
            if (!token) return;
            const { playTreatmentBurst } = await import(`${MODULE_PATH}/manager-injury-effects.js`);
            playTreatmentBurst(token, 'Treated');
        }
    },
    {
        tab: 'injuries',
        label: '🎲 Audit injury pool: odds weighting + severity mix',
        run: async () => {
            const packId = game.settings.get('coffee-pub-bibliosoph', 'injuryCompendium');
            const pack = game.packs.get(packId);
            if (!pack) return ui.notifications.warn(`Compendium "${packId}" not found.`);
            const MODULE_ID = 'coffee-pub-bibliosoph';
            const readRecord = (page) => {
                const system = page?.system;
                if (system?.category) return { rec: { ...system, title: page.name || system.title }, via: 'system' };
                const flagged = page?.flags?.[MODULE_ID]?.injury;
                if (flagged?.title) return { rec: flagged, via: 'flag' };
                const m = String(page?.text?.content ?? '').match(/<h2>Metadata<\/h2>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
                if (!m) return null;
                const rec = {};
                for (const li of m[1].matchAll(/<strong>([^<:]+):<\/strong>\s*([^<]*)</g)) rec[li[1].trim()] = li[2].trim();
                return rec.title ? { rec, via: 'html' } : null;
            };
            const lines = [];
            const tiers = { system: 0, flag: 0, html: 0 };
            const mix = { minor: 0, moderate: 0, major: 0 };
            for (const journal of await pack.getDocuments()) {
                const recs = [];
                for (const page of journal.pages) {
                    const read = readRecord(page._source ?? page);
                    if (!read) continue;
                    tiers[read.via]++;
                    recs.push(read.rec);
                }
                if (!recs.length) continue;
                const total = recs.reduce((s, r) => s + (Number(r.odds) || 1), 0);
                const worst = recs.slice().sort((a, b) => (Number(b.odds) || 1) - (Number(a.odds) || 1))[0];
                for (const r of recs) mix[String(r.severity).toLowerCase()] = (mix[String(r.severity).toLowerCase()] ?? 0) + 1;
                lines.push(`${journal.name.padEnd(12)} ${String(recs.length).padStart(3)} injuries · most likely: ${worst.title} (${Math.round(100 * (Number(worst.odds) || 1) / total)}%)`);
            }
            const total = tiers.system + tiers.flag + tiers.html;
            console.log(`BIBLIOSOPH INJURY POOL\n  storage: ${tiers.system} typed (system), ${tiers.flag} flag, ${tiers.html} legacy HTML\n  severity mix: ${JSON.stringify(mix)}\n  ${lines.join('\n  ')}`);
            ui.notifications.info(
                `Injury pool: ${total} injuries — ${tiers.system} typed pages`
                + (tiers.flag || tiers.html ? `, ${tiers.flag} flag, ${tiers.html} legacy HTML (run "npm run packs:build" with Foundry closed)` : ' (all migrated)')
                + `. Breakdown in console (F12).`
            );
        }
    },
    {
        tab: 'tools',
        label: '🔎 Audit compendium status effects (live data)',
        run: async () => {
            const packId = game.settings.get('coffee-pub-bibliosoph', 'injuryCompendium');
            const pack = game.packs.get(packId);
            if (!pack) return ui.notifications.warn(`Compendium "${packId}" not found.`);
            const legal = new Set([...(CONFIG.statusEffects ?? []).map((s) => s.id), 'none']);
            const counts = {};
            const invalid = [];
            for (const journal of await pack.getDocuments()) {
                for (const page of journal.pages) {
                    const m = String(page.text?.content ?? '').match(/<strong>statuseffect:<\/strong>\s*([^<]+)/i);
                    if (!m) continue;
                    const value = m[1].trim().toLowerCase();
                    counts[value] = (counts[value] || 0) + 1;
                    if (!legal.has(value)) invalid.push(`${journal.name} / ${page.name}: "${m[1].trim()}"`);
                }
            }
            console.log('BIBLIOSOPH AUDIT | status counts:', counts);
            console.log('BIBLIOSOPH AUDIT | invalid (no matching CONFIG.statusEffects id):', invalid);
            ui.notifications.info(
                `Audited ${Object.values(counts).reduce((a, b) => a + b, 0)} injuries: `
                + `${invalid.length} with non-condition status values (see console — flavor-only entries are expected there).`
            );
        }
    }
];

// --- dialog -------------------------------------------------------
// Tabbed: one group of scenarios visible at a time. Content buttons don't
// close the dialog, so you can fire scenario after scenario.

const tabButtons = TABS.map((t, i) => `
    <button type="button" data-tab-button="${t.id}"
        style="flex:1; padding:5px 4px; ${i === 0 ? 'font-weight:bold; border-bottom:2px solid var(--color-warm-2, #c9a66b);' : 'opacity:0.7;'}">
        ${t.label}
    </button>`).join('');

// Per-tab live-settings box: each tab shows only the gates its scenarios
// run through. off/manual = detection scenarios correctly do nothing.
const settingsBox = (rows) => `
    <div style="font-size:0.9em; opacity:0.9; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 8px; margin:0 0 6px 0;">
        <strong>Live settings:</strong> ${rows}
    </div>`;

const TAB_SETTINGS = {
    injuries: settingsBox(
        `Automation: <strong>${setting('injuryAutomation', 'click')}</strong> ·
         Auto-Apply: <strong>${setting('injuryAutoApply', false) ? 'ON' : 'off'}</strong> ·
         Threshold: <strong>${threshold()}%</strong> of max HP ·
         Triggered By: <strong>${setting('injuryTriggerSource', 'players')}</strong>`
    ),
    treatment: settingsBox(
        `Player Rolls: <strong>${setting('injuryTreatmentRolls', true) ? 'ON' : 'off'}</strong> ·
         Crits/Fumbles: <strong>${setting('injuryTreatmentCritFumble', true) ? 'ON' : 'off'}</strong> ·
         Kit Uses: <strong>${setting('injuryTreatmentKitUses', 'attempt')}</strong>`
    ),
    rolls: settingsBox(
        `Crit: <strong>${setting('critAutomation', 'click')}</strong> ·
         Fumble: <strong>${setting('fumbleAutomation', 'click')}</strong> ·
         Triggered By: <strong>${setting('rollTriggerSource', 'everyone')}</strong><br>
         Criticals Source: <strong>${setting('critCompendium', 'none')}</strong> ·
         Fumbles Source: <strong>${setting('fumbleCompendium', 'none')}</strong>
         <em>(None = classic roll tables)</em>`
    ),
    inspiration: settingsBox(
        `Deck Source: <strong>${setting('inspirationCompendium', 'none')}</strong><br>
         <em>The CARD is the currency — no points are tracked. Draw → card item
         on the sheet. Using the item raises the play card; its buttons pick the
         target and discard the card. Nothing is spent until a button is clicked.</em>`
    ),
    tools: settingsBox(
        `Injury Compendium: <strong>${setting('injuryCompendium', 'coffee-pub-bibliosoph.injuries')}</strong><br>
         Toast-excluded users: <strong>${blacksmithSetting('toastExcludedUsers') || 'none'}</strong> ·
         Channels they still see: <strong>${blacksmithSetting('toastBypassChannels') === null
            ? '(unsupported — this Blacksmith predates channels)'
            : (blacksmithSetting('toastBypassChannels') || 'none')}</strong>
         <em>(Bibliosoph sends: ${TOAST_CHANNELS.join(', ')})</em>`
    )
};

// Two columns on the wider dialog, so long scenario lists stay on screen.
const tabPanels = TABS.map((t, i) => `
    <div data-tab-panel="${t.id}" style="display:${i === 0 ? 'block' : 'none'};">
        ${TAB_SETTINGS[t.id] ?? ''}
        <div style="display:grid; grid-template-columns:repeat(${SCENARIO_COLUMNS}, 1fr); gap:4px;">
        ${SCENARIOS.map((s, si) => s.tab === t.id ? `
            <button type="button" data-scenario="${si}"
                style="display:block; width:100%; margin:0; padding:6px 10px; text-align:left; white-space:normal; line-height:1.25;">
                ${s.label}
            </button>` : '').join('')}
        </div>
    </div>`).join('');

await foundry.applications.api.DialogV2.wait({
    window: { title: 'Bibliosoph Test Harness' },
    content: `
        <p style="margin:0 0 8px 0;">Target a token first for injury/crit/fumble scenarios.
        The dialog stays open — fire as many as you like.</p>
        <div style="display:flex; gap:2px; margin:0 0 6px 0;">${tabButtons}</div>
        ${tabPanels}`,
    buttons: [{ action: 'close', label: 'Close', default: true }],
    position: { width: 860, height: 'auto' },
    render: (event, dialog) => {
        const root = dialog?.element ?? dialog;
        root.querySelectorAll('[data-scenario]').forEach((btn) => {
            btn.addEventListener('click', () => SCENARIOS[Number(btn.dataset.scenario)].run());
        });
        root.querySelectorAll('[data-tab-button]').forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                const target = tabBtn.dataset.tabButton;
                root.querySelectorAll('[data-tab-panel]').forEach((panel) => {
                    panel.style.display = panel.dataset.tabPanel === target ? 'block' : 'none';
                });
                root.querySelectorAll('[data-tab-button]').forEach((b) => {
                    const active = b.dataset.tabButton === target;
                    b.style.fontWeight = active ? 'bold' : 'normal';
                    b.style.opacity = active ? '1' : '0.7';
                    b.style.borderBottom = active ? '2px solid var(--color-warm-2, #c9a66b)' : 'none';
                });
            });
        });
    }
});
