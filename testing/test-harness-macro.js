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
    return automation === 'auto'
        ? 'expect a toast AND the injury card immediately (fully automated).'
        : 'expect a toast with a roll button for the owner.';
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
    { id: 'rolls', label: '🎲 Crits & Fumbles' },
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
        tab: 'injuries',
        label: '🩻 Injury card directly (Fire → subject)',
        run: () => {
            const token = getSubjectToken();
            if (!token) return;
            rollInjuryCard('Fire', { actorId: token.actor.id, tokenId: token.id });
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
         Threshold: <strong>${threshold()}%</strong> of max HP ·
         Triggered By: <strong>${setting('injuryTriggerSource', 'players')}</strong>`
    ),
    rolls: settingsBox(
        `Crit: <strong>${setting('critAutomation', 'click')}</strong> ·
         Fumble: <strong>${setting('fumbleAutomation', 'click')}</strong> ·
         Triggered By: <strong>${setting('rollTriggerSource', 'everyone')}</strong>`
    ),
    tools: settingsBox(
        `Injury Compendium: <strong>${setting('injuryCompendium', 'coffee-pub-bibliosoph.injuries')}</strong>`
    )
};

const tabPanels = TABS.map((t, i) => `
    <div data-tab-panel="${t.id}" style="display:${i === 0 ? 'block' : 'none'};">
        ${TAB_SETTINGS[t.id] ?? ''}
        ${SCENARIOS.map((s, si) => s.tab === t.id ? `
            <button type="button" data-scenario="${si}"
                style="display:block; width:100%; margin:3px 0; padding:6px 10px; text-align:left;">
                ${s.label}
            </button>` : '').join('')}
    </div>`).join('');

await foundry.applications.api.DialogV2.wait({
    window: { title: 'Bibliosoph Test Harness' },
    content: `
        <p style="margin:0 0 8px 0;">Target a token first for injury/crit/fumble scenarios.
        The dialog stays open — fire as many as you like.</p>
        <div style="display:flex; gap:2px; margin:0 0 6px 0;">${tabButtons}</div>
        ${tabPanels}`,
    buttons: [{ action: 'close', label: 'Close', default: true }],
    position: { width: 460 },
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
