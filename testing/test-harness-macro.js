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
const { rollOutcomeCard, rollInjuryCard } = await import(`${MODULE_PATH}/bibliosoph.js`);

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

function threshold() {
    try { return Number(game.settings.get('coffee-pub-bibliosoph', 'injuryThreshold')) || 50; }
    catch (_) { return 50; }
}

// --- scenarios ----------------------------------------------------

const SCENARIOS = [
    {
        label: '🩸 Injury: threshold hit (slashing)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const amount = pctOfMax(token, threshold());
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount,
                damages: [{ value: amount, type: 'slashing' }]
            }));
            ui.notifications.info(`Sent ${amount} slashing (at threshold) for ${token.name} — expect an injury toast.`);
        }
    },
    {
        label: '🩹 Injury: below threshold (no trigger)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            const amount = Math.max(1, pctOfMax(token, threshold()) - 2);
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount,
                damages: [{ value: amount, type: 'slashing' }]
            }));
            ui.notifications.info(`Sent ${amount} slashing (below threshold) for ${token.name} — expect NOTHING.`);
        }
    },
    {
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
            ui.notifications.info(`Sent mixed ${amount} (fire-dominant) for ${token.name} — expect a FIRE injury.`);
        }
    },
    {
        label: '💚 Injury: healing (must not trigger)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            InjuryTriggerManager._onDamageResolved(injuryOutcome(token, {
                amount: -pctOfMax(token, 80),
                damages: [{ value: pctOfMax(token, 80), type: 'healing' }],
                isHealing: true
            }));
            ui.notifications.info(`Sent healing for ${token.name} — expect NOTHING.`);
        }
    },
    {
        label: '💥 Crit toast (attackResolved)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            RollToastManager._onAttackResolved(attackOutcome(token, { isCritical: true }));
            ui.notifications.info(`Sent crit for ${token.name} — expect the crit toast (armed for the owner).`);
        }
    },
    {
        label: '💔 Fumble toast (attackResolved)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            RollToastManager._onAttackResolved(attackOutcome(token, { isFumble: true }));
            ui.notifications.info(`Sent fumble for ${token.name} — expect the fumble toast.`);
        }
    },
    {
        label: '🃏 Crit card directly (skip toast)',
        run: () => rollOutcomeCard('crit')
    },
    {
        label: '🩻 Injury card directly (Fire → subject)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            rollInjuryCard('Fire', { actorId: token.actor.id, tokenId: token.id });
        }
    },
    {
        label: '🍺 Social toasts (all configured)',
        run: async () => {
            for (const kind of ['beverage', 'bio', 'insult', 'praise']) {
                await triggerSocialToast(kind);
            }
            ui.notifications.info('Fired all configured social toasts (unconfigured ones warn or skip).');
        }
    }
];

// --- dialog -------------------------------------------------------
// Scenarios render as a vertical stack in the content (DialogV2's footer
// buttons flex-wrap badly with long labels). Content buttons don't close
// the dialog, so you can fire scenario after scenario.

const scenarioButtons = SCENARIOS.map((s, i) => `
    <button type="button" data-scenario="${i}"
        style="display:block; width:100%; margin:3px 0; padding:6px 10px; text-align:left;">
        ${s.label}
    </button>`).join('');

await foundry.applications.api.DialogV2.wait({
    window: { title: 'Bibliosoph Test Harness' },
    content: `
        <p style="margin:0 0 8px 0;">Target a token first for injury/crit/fumble scenarios.<br>
        Threshold is currently <strong>${threshold()}%</strong> of max HP.
        The dialog stays open — fire as many as you like.</p>
        ${scenarioButtons}`,
    buttons: [{ action: 'close', label: 'Close', default: true }],
    position: { width: 440 },
    render: (event, dialog) => {
        const root = dialog?.element ?? dialog;
        root.querySelectorAll('[data-scenario]').forEach((btn) => {
            btn.addEventListener('click', () => SCENARIOS[Number(btn.dataset.scenario)].run());
        });
    }
});
