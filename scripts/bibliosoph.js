// ================================================================== 
// ===== GET IMPORTS AND CONSTANTS ==================================
// ================================================================== 

// Grab the module data
import { MODULE, BIBLIOSOPH } from './const.js';
import { registerToolbarTools, unregisterToolbarTools } from './manager-toolbar.js';
import { applyStatusToTokens, buildInjuryApplyConfig, deleteEffectSafely } from './manager-status-effects.js';
import { InjuryPageModel, INJURY_PAGE_TYPE } from './data/injury-page-model.js';
import { InjuryPageSheet } from './sheets/injury-page-sheet.js';
import { OutcomePageModel, OUTCOME_PAGE_TYPE } from './data/outcome-page-model.js';
import { OutcomePageSheet } from './sheets/outcome-page-sheet.js';
import { describeModifier, modifiersToChanges, secondsToRounds, severityLabel, targetLabel, targetHint, picksFor, TARGET_HINTS } from './data/outcome-schema.js';
import { InspirationPageModel, INSPIRATION_PAGE_TYPE } from './data/inspiration-page-model.js';
import { InspirationPageSheet } from './sheets/inspiration-page-sheet.js';
import * as INSPIRATION_ACTIONS from './data/inspiration-schema.js';
import { SEVERITY_DCS as INJURY_SEVERITY_DCS, damageFor } from './data/injury-schema.js';
import { registerInjuryTickHooks } from './manager-injury-ticks.js';
import { postCard, getChatCardsAPI, getCard, updateCard, stampCardActions, iconClass } from './manager-cards.js';
import { grantFoundItems, grantCurrency } from './manager-loot.js';

// Log through Blacksmith's console tool wherever possible; raw console is
// reserved for bootstrap failures where Blacksmith itself is unavailable.
function logBib(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, message, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | ${message}`, data);
    }
}

// Cached investigation narrative JSON (static resource)
let _investigationNarrative = null;
async function getInvestigationNarrative() {
    if (!_investigationNarrative) {
        const res = await fetch(BIBLIOSOPH.INVESTIGATION_NARRATIVE_PATH);
        if (!res.ok) throw new Error(res.statusText);
        _investigationNarrative = await res.json();
    }
    return _investigationNarrative;
}






// ================================================================== 
// ===== BEGIN: REGISTER BLACKSMITH API =============================
// ================================================================== 
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// ==================================================================
// ===== INJURIES: THE JSON IMPORT PROFILE ==========================
// ==================================================================
// Blacksmith builds the page and stamps the subtype; we own the schema,
// so the declaration must mirror InjuryPageModel -- an under-describing
// one lands pages with fields silently defaulted, and a page without
// `system.severity` is invisible to the picker. Gated at build time by
// tools/verify-injury-profile.mjs, which also runs the registry's own
// `validateDeclaration` so a format failure is caught before a world.
//
// ITS OWN HOOK, deliberately. This was inside the module-registration
// hook below, after `registerFn`, which meant an exception anywhere
// earlier in that handler -- `waitForReady`, `registerModule` -- was
// caught by its outer `catch` and the profile silently never registered.
// Blacksmith has now deleted its legacy injury path, so this is the ONLY
// way an injury imports: it should not depend on unrelated steps
// succeeding first. Separate hook, own guard, own failure message.
// ==================================================================
Hooks.once('ready', async () => {
    try {
        if (!game.modules.get('coffee-pub-blacksmith')?.active) return;
        if (typeof BlacksmithAPI.waitForReady === 'function') {
            await BlacksmithAPI.waitForReady();
        }
        const { registerInjuryImportProfile } = await import('./data/injury-import-profile.js');
        registerInjuryImportProfile();
    } catch (error) {
        // Loud rather than debug: with the legacy path gone, a failure here
        // means nothing imports an injury at all, and the GM's symptom is an
        // import tool that simply does not offer injuries.
        logBib('Injury import profile could not be registered; injury import is unavailable', error, false, true);
    }
});

// Register your module with Blacksmith and then register toolbar tools
Hooks.once('ready', async () => {
    try {
        const bsMod = game.modules.get('coffee-pub-blacksmith');
        if (!bsMod?.active) return;

        // Globals like BlacksmithModuleManager / BlacksmithUtils attach after markReadyForConsumers();
        // module.api.registerModule is available earlier on fixed Blacksmith, but waitForReady keeps
        // registration + toolbar path safe on all builds and hook orderings.
        if (typeof BlacksmithAPI.waitForReady === 'function') {
            await BlacksmithAPI.waitForReady();
        }

        const api = game.modules.get('coffee-pub-blacksmith')?.api;
        const registerFn =
            (typeof api?.registerModule === 'function' && api.registerModule.bind(api)) ||
            (typeof api?.ModuleManager?.registerModule === 'function' &&
                api.ModuleManager.registerModule.bind(api.ModuleManager)) ||
            (typeof BlacksmithModuleManager?.registerModule === 'function' &&
                BlacksmithModuleManager.registerModule.bind(BlacksmithModuleManager));

        if (!registerFn) {
            console.warn(`${MODULE.ID} | Blacksmith registerModule not available; skipping module registration`);
        } else {
            registerFn(MODULE.ID, {
                name: MODULE.NAME,
                version: MODULE.VERSION
            });
            logBib('✅ Module registered with Blacksmith successfully', '', false, false);
        }

        // MESSAGES: conversation system + window registry
        try {
            const messagesEnabled = BlacksmithUtils?.getSettingSafely
                ? BlacksmithUtils.getSettingSafely(MODULE.ID, 'messagesEnabled', true)
                : game.settings.get(MODULE.ID, 'messagesEnabled');
            if (messagesEnabled) {
                const { ConversationManager } = await import('./manager-conversations.js');
                await ConversationManager.initialize();
                if (api?.registerWindow) {
                    api.registerWindow('bibliosoph-messages', {
                        open: async (options = {}) => {
                            const { openMessagesWindow } = await import('./window-messages.js');
                            return openMessagesWindow(options);
                        },
                        title: 'Messages',
                        moduleId: MODULE.ID
                    });
                    // The lightweight single-conversation popout. Normally
                    // reached by the popout icon on a tray row, but registered
                    // so it can be opened directly with a conversation id.
                    api.registerWindow('bibliosoph-messages-lite', {
                        open: async (options = {}) => {
                            const { openMessagesLite } = await import('./window-messages-lite.js');
                            return openMessagesLite(options);
                        },
                        title: 'Messages Popout',
                        moduleId: MODULE.ID
                    });
                }
                // Menubar: left zone, right next to Squire's Quick Note (general/999/202)
                if (api?.registerMenubarTool) {
                    api.registerMenubarTool('bibliosoph-messages', {
                        icon: "fa-solid fa-comments",
                        name: "bibliosoph-messages",
                        title: null,
                        tooltip: "Messages",
                        onClick: async () => {
                            if (api.isWindowRegistered?.('bibliosoph-messages')) {
                                return api.openWindow('bibliosoph-messages');
                            }
                            const { openMessagesWindow } = await import('./window-messages.js');
                            return openMessagesWindow();
                        },
                        // Right-click: jump straight into a favorited conversation
                        // as a popout, without opening the full window first.
                        // Evaluated on each right-click (Blacksmith supports a
                        // function here), so the list is always current.
                        contextMenuItems: () => {
                            const favorites = ConversationManager.getFavoriteConversations();
                            if (!favorites.length) {
                                return [{
                                    name: 'No favorites yet',
                                    icon: 'fa-regular fa-heart',
                                    description: 'Right-click a conversation in the Messages tray to add one.',
                                    disabled: true
                                }];
                            }
                            return favorites.map((fav) => ({
                                name: fav.unread ? `${fav.name} (${fav.unread})` : fav.name,
                                icon: fav.icon,
                                description: fav.virtual
                                    ? 'Start a direct message'
                                    : (fav.unread ? `${fav.unread} unread` : 'Open as a popout'),
                                onClick: async () => {
                                    const { openMessagesLite } = await import('./window-messages-lite.js');
                                    return openMessagesLite({ conversationId: fav.id });
                                }
                            }));
                        },
                        zone: "left",
                        group: "general",
                        groupOrder: 999,
                        order: 203,
                        moduleId: MODULE.ID,
                        gmOnly: false,
                        leaderOnly: false,
                        visible: true,
                        toggleable: false,
                        active: false,
                        iconColor: null,
                        buttonNormalTint: null,
                        buttonSelectedTint: null
                    });
                }
            }
        } catch (error) {
            logBib('Failed to initialize Messages system', error?.message, false, false);
        }

        // TOAST CHANNELS: declare our channel names so a GM can tick them in
        // Blacksmith rather than guess them. Separate from the managers below
        // because social toasts have channels too and do not depend on the
        // rolls API being available.
        try {
            const { registerToastChannels } = await import('./manager-roll-toasts.js');
            registerToastChannels();
        } catch (error) {
            logBib('Failed to declare toast channels', error?.message, false, false);
        }

        // ROLL TOASTS: crit/fumble announcements via the Blacksmith rolls API
        try {
            const { RollToastManager } = await import('./manager-roll-toasts.js');
            await RollToastManager.initialize();
        } catch (error) {
            logBib('Failed to initialize Roll Toasts', error?.message, false, false);
        }

        // INJURY TRIGGERS: damage-threshold injury automation (Blacksmith damageResolved)
        try {
            const { InjuryTriggerManager } = await import('./manager-injury-triggers.js');
            InjuryTriggerManager.initialize();
        } catch (error) {
            logBib('Failed to initialize Injury Triggers', error?.message, false, false);
        }

        // INJURY EFFECTS: canvas burst on injury application (every client)
        try {
            const { InjuryEffectsManager } = await import('./manager-injury-effects.js');
            InjuryEffectsManager.initialize();
        } catch (error) {
            logBib('Failed to initialize Injury Effects', error?.message, false, false);
        }

        // EFFECTS CLASSIFIER: tell Blacksmith what our effects ARE, so every
        // surface that lists an actor's effects — their combat bar, a status
        // window, a turn card — can describe ours without importing from us.
        try {
            const { registerAfflictionClassifier } = await import('./manager-status-effects.js');
            registerAfflictionClassifier();
        } catch (error) {
            logBib('Failed to register the affliction classifier', error?.message, false, false);
        }

        // CARD BUTTONS: every client registers every handler, GM and player
        // alike. A chat message is data on each client, so a callback cannot
        // ride the card — each browser resolves the handler from its own
        // registry when the card renders, which is also why buttons still
        // work after a reload.
        try {
            registerCardActions();
        } catch (error) {
            logBib('Failed to register card actions', error?.message, false, false);
        }

        // TREAT STAMPS: players can't edit GM-owned chat messages, so a
        // player's treat click relays a stamp-sweep intent to the active GM
        try {
            await registerTreatStampSocket();
        } catch (error) {
            logBib('Failed to register treat-stamp socket', error?.message, false, false);
        }

        // OUTCOME APPLIES: the player who owns the roller may make the
        // card's choice, but only the GM can carry it out — same relay.
        try {
            await registerOutcomeApplySocket();
        } catch (error) {
            logBib('Failed to register outcome-apply socket', error?.message, false, false);
        }

        // TREATMENT ROLLS: player Medicine checks resolve on the active GM
        try {
            await registerTreatRollSocket();
        } catch (error) {
            logBib('Failed to register treatment-roll socket', error?.message, false, false);
        }

        // TREATMENT RETRIES: a rest clears failed attempts, so a bad roll
        // is a setback rather than a permanent dead end.
        try {
            registerTreatmentRestReset();
        } catch (error) {
            logBib('Failed to register the treatment rest reset', error?.message, false, false);
        }

        // CONDITION UNWIND: removing an injury, critical or fumble takes its
        // conveyed condition with it — however the effect was removed.
        try {
            registerConditionUnwindHook();
        } catch (error) {
            logBib('Failed to register the condition unwind hook', error?.message, false, false);
        }

        // TICKS & EXPIRY: wounds that keep bleeding, and wounds that close
        // on their own. Active GM only — see the module header.
        try {
            registerInjuryTickHooks();
        } catch (error) {
            logBib('Failed to register injury tick hooks', error?.message, false, false);
        }

        // INSPIRATION CARDS: the drawn card is an item, and USING that item
        // is what spends the point and runs the automation. Every client
        // watches, because the click happens on the owner's client.
        try {
            const { registerInspirationItemHook, registerInspirationSocket } = await import('./manager-inspiration.js');
            registerInspirationItemHook();
            await registerInspirationSocket();
        } catch (error) {
            logBib('Failed to register inspiration card hooks', error?.message, false, false);
        }


        // NOW register toolbar tools after module registration is complete
        // In v13, we need to wait for Blacksmith to be fully ready
        // Try multiple times with increasing delays to ensure API is available
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 200; // Start with 200ms, increase if needed
        
        const tryRegisterTools = () => {
            attempts++;
            const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
            
            if (blacksmith?.registerToolbarTool && typeof registerToolbarTools === 'function') {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Blacksmith API ready (attempt ${attempts}), registering toolbar tools`, "", true, false);
                try {
                    registerToolbarTools();
                } catch (error) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Error during toolbar registration: ${error.message}`, "", true, false);
                    logBib('Toolbar registration error', error?.message, false, false);
                }
            } else if (attempts < maxAttempts) {
                // Blacksmith not ready yet, try again
                setTimeout(tryRegisterTools, checkInterval);
            } else {
                // Max attempts reached
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Failed to register tools after ${maxAttempts} attempts. Blacksmith API may not be available.`, "", false, false);
                logBib('Failed to register toolbar tools - Blacksmith API not available', '', false, false);
            }
        };
        
        // Start trying after initial delay
        setTimeout(tryRegisterTools, checkInterval);
        
    } catch (error) {
        console.error(MODULE.ID + ' | ❌ Failed to register ' + MODULE.NAME + ' with Blacksmith:', error);
    }
});
// ================================================================== 
// ===== END: REGISTER BLACKSMITH API ===============================
// ================================================================== 


// ================================================================== 
// ===== TOOLBAR DIALOG FUNCTIONS ==================================
// ================================================================== 

// Party/private message dialogs removed — replaced by the unified Messages
// window (window-messages.js + manager-conversations.js).

// Post the Investigation card (toolbar button)
function triggerInvestigation() {
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINVESTIGATION = true;
    BIBLIOSOPH.CARDTYPE = "Investigation";
    // Build the card
    publishChatCard();
}

// Manual roll triggers (toolbar buttons) — same path as click-to-roll
function triggerCriticalRoll() {
    rollOutcomeCard('crit');
}

function triggerFumbleRoll() {
    rollOutcomeCard('fumble');
}

// Roll a crit/fumble from its typed compendium and post the chat card.
// Used by the toolbar buttons above and by manager-roll-toasts.js for the
// Automation click/auto modes.
//
// The compendium is the ONLY source. Roll tables used to sit behind this as
// a fallback, but a table cannot carry what the card is now built around —
// conditions, durations, roll modifiers, targeting — so a card built from
// one was a strictly lesser thing wearing the same face. When there is no
// deck, we say so rather than quietly posting the lesser card.
//
// `title` forces a specific outcome instead of a weighted draw — the test
// harness uses it to demo a particular card on demand.
// The actor ids are who rolled and who they hit, when the triggering roll
// told us — they let the card name people instead of saying "the roller"
// and "the creature hit".
export async function rollOutcomeCard(type, { title = null, rollerActorId = null, rollerTokenId = null, hitActorId = null, overrides = null } = {}) {
    const kindLabel = type === 'crit' ? 'Criticals' : 'Fumbles';
    const compendium = getSettingSafe(type === 'crit' ? 'critCompendium' : 'fumbleCompendium', 'none');
    if (!compendium || compendium === 'none') {
        logBib(`No ${kindLabel} compendium set — nothing to post`, '', false, false);
        showBibToast(`No ${kindLabel} Deck`, `Choose a ${kindLabel} compendium in Bibliosoph settings.`, 'fa-solid fa-book-open');
        return;
    }
    const built = await createChatCardOutcome(type, { title, rollerActorId, rollerTokenId, hitActorId, overrides });
    if (!built) {
        logBib(`No outcome found in "${compendium}"`, '', false, false);
        showBibToast(`No ${kindLabel} Found`, `"${compendium}" has no matching entries.`, 'fa-solid fa-book-open');
        return;
    }
    await postCard({
        type: type === 'crit' ? 'critical' : 'fumble',
        theme: getSettingSafe(type === 'crit' ? 'cardThemeCritical' : 'cardThemeFumble', 'default'),
        parts: built.parts,
        flags: { outcome: built.state }
    });
}

// Read an outcome record off a typed page (system data is authoritative).
function readOutcomeRecord(page) {
    const system = page?.system;
    if (!system?.kind) return null;
    const fields = system.toObject?.() ?? system;
    return { ...fields, title: page?.name || '', sourceUuid: page?.uuid ?? null };
}

/**
 * Build a critical/fumble card from the typed compendium: pick weighted
 * by odds, then render with its mechanics spelled out and an Apply button
 * that carries the whole record rather than just a name and some prose.
 */
async function createChatCardOutcome(type, { title = null, rollerActorId = null, rollerTokenId = null, hitActorId = null, overrides = null } = {}) {
    const compendiumName = getSettingSafe(type === 'crit' ? 'critCompendium' : 'fumbleCompendium', 'none');
    const pack = game.packs.get(compendiumName);
    if (!pack) return null;

    // Scan EVERY journal in the pack. The bucket journals (Butchery,
    // Carnage, Slaughter…) are organisational; each page states its own
    // severity and odds, so a renamed or added journal changes nothing.
    const entries = await pack.getDocuments();
    const candidates = entries
        .flatMap((journal) => Array.from(journal.pages ?? []))
        .map((page) => readOutcomeRecord(page))
        .filter((rec) => rec && rec.kind === type);
    if (!candidates.length) return null;

    const picked = title
        ? candidates.find((c) => c.title === title)
        : await weightedPickRolled(candidates, (c) => c.odds);
    if (!picked) { logBib(`No outcome titled "${title}"`, '', false, false); return null; }
    logBib(`Outcome picked: "${picked.title}" (odds ${picked.odds} of ${candidates.length} ${type}s)`, '', true, false);

    // Test-harness seam, like `title` above: demo a field combination no
    // shipped outcome carries yet — a two-pick ally card, say — without
    // editing the compendium. Never set on a real roll.
    const rec = overrides ? { ...picked, ...overrides } : picked;

    const isCrit = type === 'crit';
    const modifierLines = (rec.modifiers ?? []).map(describeModifier).filter(Boolean);
    const rounds = secondsToRounds(rec.duration);

    // Everything the Apply button needs, so applying reproduces the
    // mechanics rather than just stamping a name on the token.
    const APPLYDATA = {
        kind: type,
        name: rec.title,
        description: rec.description || '',
        image: rec.image || '',
        damage: rec.damage || 0,
        duration: rec.duration || 0,
        statuseffect: rec.statuseffect || 'none',
        modifiers: rec.modifiers ?? [],
        appliesto: rec.appliesto || (isCrit ? 'target' : 'self'),
        severity: rec.severity || 'minor',
        sourceUuid: rec.sourceUuid ?? null
    };

    // Baked into the card so every client can answer "may I click this?"
    // without the GM having to render a second, different card. Ownership
    // of this actor is the whole gate (see the render hook).
    const cast = resolveOutcomeCast({ rollerActorId, rollerTokenId, hitActorId });
    const rollerId = cast.roller?.id ?? rollerActorId ?? '';

    BlacksmithUtils.playSound(
        isCrit ? 'modules/coffee-pub-blacksmith/sounds/reaction-yay.mp3'
            : 'modules/coffee-pub-blacksmith/sounds/sadtrombone.mp3',
        '0.7'
    );

    // Everything the card needs to answer a click, on the message rather
    // than in the buttons: the record to apply, who may press, and how
    // many picks are left. It is also the pick STATE — one card asking for
    // two party members has to survive a refresh and read the same on
    // every client, which a client's memory cannot do.
    const state = {
        apply: APPLYDATA,
        kind: type,
        icon: isCrit ? 'fa-solid fa-burst' : 'fa-solid fa-heart-crack',
        rollerActorId: rollerId,
        ...buildOutcomeTargets(rec, cast)
    };
    state.picksRemaining = state.picksTotal;
    state.picked = [];
    state.appliedNames = [];

    return {
        parts: composeOutcomeCard({
            title: rec.title,
            icon: isCrit ? 'fa-solid fa-burst' : 'fa-solid fa-heart-crack',
            cardTitle: isCrit ? 'Critical Hit' : 'Fumble',
            severity: severityLabel(type, rec.severity),
            tone: isCrit ? 'positive' : 'negative',
            roller: cast.roller,
            image: getSettingSafe('outcomeImageEnabled', true) ? (rec.image || '') : '',
            imageCaption: rec.imagetitle || '',
            description: rec.description,
            mechanics: buildOutcomeMechanics(rec, modifierLines, rounds)
        }, state),
        state
    };
}

/**
 * The outcome card as a composition.
 *
 * `state` supplies the tail — the controls, or the stamp that replaces
 * them — so the same function rebuilds the card after every pick.
 *
 * @returns {Array<object>} parts, in render order
 */
function composeOutcomeCard(outcome, state) {
    const parts = [{ part: 'header', icon: outcome.icon, title: outcome.cardTitle }];
    if (outcome.roller) {
        parts.push({ part: 'identity', img: outcome.roller.img || '', name: outcome.roller.name });
    }
    if (outcome.severity) {
        parts.push({ part: 'band', text: outcome.severity, tone: outcome.tone });
    }
    parts.push({ part: 'section', icon: 'fa-solid fa-dice', label: outcome.title });
    if (outcome.image) {
        parts.push({ part: 'image', src: outcome.image, alt: outcome.title, caption: outcome.imageCaption });
    }
    if (outcome.description) {
        parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: outcome.description }] });
    }
    if (outcome.mechanics?.length) {
        parts.push({
            part: 'notes',
            items: outcome.mechanics.map((line) => ({ icon: `fa-solid ${line.icon}`, text: line.text }))
        });
    }
    parts.push(composeOutcomeActions(state));
    return parts;
}

/**
 * The card's tail: the controls while picks remain, the stamp once they
 * are spent.
 *
 * WHO MAY PRESS. The choice belongs to the player whose character rolled,
 * so the part is readable by that actor's owner — and a GM owns every
 * actor, which is what puts it in front of them too. A button that
 * resolves against the clicker's canvas selection stays GM-only: relayed,
 * it would read the GM's selection rather than the player's and quietly
 * land on the wrong token.
 *
 * This decides what RENDERS. The handler checks again before applying.
 */
function composeOutcomeActions(state) {
    if (state.picksRemaining <= 0) {
        return {
            part: 'band',
            text: `Applied to ${state.appliedNames.join(', ')}`,
            icon: 'fa-solid fa-check',
            tone: 'positive'
        };
    }

    const buttons = [];
    const remaining = (state.candidates ?? []).filter((c) => !state.picked.includes(c.id));
    if (state.randomAllowed && remaining.length > 1) {
        buttons.push({
            moduleId: MODULE.ID, action: OUTCOME_APPLY_ACTION, value: 'random',
            label: 'Random Party Member', icon: 'fa-solid fa-dice-d20'
        });
    }
    for (const candidate of remaining) {
        buttons.push({
            moduleId: MODULE.ID, action: OUTCOME_APPLY_ACTION, value: candidate.id,
            label: candidate.name, icon: state.icon
        });
    }
    if (!buttons.length) {
        buttons.push({
            moduleId: MODULE.ID, action: OUTCOME_APPLY_ACTION, value: '',
            label: state.singleLabel || 'Apply', icon: state.icon, variant: 'primary'
        });
    }

    const part = {
        part: 'actions',
        layout: buttons.length > 1 ? 'stacked' : 'inline',
        buttons
    };
    // Progress belongs above the buttons on a multi-pick card: once the
    // prose has scrolled past, the card is the only place the count lives.
    const hint = state.picksTotal > 1
        ? targetHint('ally', state.picksTotal, state.picksRemaining)
        : state.hint;
    const done = state.appliedNames.length ? `So far: ${state.appliedNames.join(', ')}. ` : '';
    if (done || hint) part.instruction = `${done}${hint ?? ''}`.trim();

    if (state.needsSelection) part.readableBy = 'gm';
    else if (state.rollerActorId) {
        part.readableBy = 'owner';
        part.actorId = state.rollerActorId;
    }
    return part;
}

/**
 * A crit that hands somebody a card. Resolves who from the same payload
 * the status-applying outcomes use, then goes through the normal deal, so
 * the card lands in their inventory exactly as a GM-dealt one would.
 *
 * @returns {Promise<string[]>} names dealt to, for the button stamp
 */
async function dealOutcomeCard(data) {
    let actor = game.actors.get(data?.targetActorId ?? '') ?? null;
    if (data?.randomAlly) {
        // A card goes to a sheet, not to a square — being off-scene is no
        // reason to be skipped when the deck is handing something out.
        const party = getPartyActors({ requireToken: false });
        if (party.length) actor = party[Math.floor(Math.random() * party.length)];
    }
    actor ??= Array.from(game.user.targets ?? [])[0]?.actor
        ?? canvas?.tokens?.controlled?.[0]?.actor
        ?? game.user.character
        ?? null;

    if (!actor) {
        showBibToast('Nobody to Deal To', 'Select a token, or assign yourself a character.', 'fa-solid fa-lightbulb');
        return [];
    }
    await drawInspirationCard(actor);
    return [actor.name];
}

/**
 * The party, best-effort: characters assigned to non-GM users first,
 * since that is who is actually sitting at the table, falling back to
 * player-owned character actors for worlds that do not assign.
 *
 * Two filters matter here:
 *
 *   TYPE — only real `character` actors. Foundry's own Party actor (dnd5e
 *   type `group`) is a container, not a person: it has no HP to lose and
 *   putting it in a picker offers a choice that cannot be applied. The
 *   fallback branch always filtered on type; the assigned branch did not,
 *   so a user with the Party sheet assigned dragged it into every picker.
 *
 *   PRESENCE — someone with no token on the active scene is not in the
 *   fight, so they are not a legal "party member" for a crit to land on.
 *   This is a PREFERENCE, not a hard rule: if nobody is placed (a GM on a
 *   prep scene, theatre-of-mind play, the test harness) the whole party
 *   comes back rather than an empty picker, which would silently downgrade
 *   the card to its select-a-token fallback.
 */
function getPartyActors({ requireToken = true } = {}) {
    const assigned = game.users
        .filter((u) => !u.isGM && u.character)
        .map((u) => u.character);
    const raw = assigned.length
        ? assigned
        : game.actors.filter((a) => a.hasPlayerOwner);

    // Two users sharing a character would otherwise get two buttons.
    const pool = [...new Map(
        raw.filter((a) => a?.type === 'character').map((a) => [a.id, a])
    ).values()];

    if (!requireToken) return pool;
    const present = pool.filter((a) => (a.getActiveTokens?.() ?? []).length > 0);
    if (present.length) return present;
    logBib('No party tokens on this scene — offering the whole party instead', '', true, false);
    return pool;
}

/**
 * Who this card is about: the roller and, for crits, whoever they hit.
 * A card that can say "Apply to Grimshaw" beats one that says "Apply to
 * Roller", so we work reasonably hard to put a name to them.
 *
 * The ids come from the triggering roll when there was one. Failing that
 * — the toolbar buttons and the test harness post cards with no event
 * behind them — we lean on Foundry's own convention: you CONTROL your own
 * token and TARGET the one you are swinging at. So a lone controlled
 * token is the roller and a lone target is who they hit. Anything
 * ambiguous stays unnamed rather than guessed at.
 */
function resolveOutcomeCast({ rollerActorId = null, rollerTokenId = null, hitActorId = null } = {}) {
    const lone = (tokens) => {
        const pool = Array.from(tokens ?? []);
        return pool.length === 1 ? (pool[0].actor ?? null) : null;
    };
    const roller = game.actors.get(rollerActorId ?? '')
        ?? canvas?.tokens?.get(rollerTokenId ?? '')?.actor
        ?? game.user?.character
        ?? lone(canvas?.tokens?.controlled)
        ?? null;
    const hit = game.actors.get(hitActorId ?? '')
        ?? lone(game.user?.targets)
        ?? null;
    return { roller, hit };
}

/**
 * WHO an outcome can land on, as card state rather than as markup.
 *
 * Which controls appear comes from the record's target mode, so "who does
 * this land on?" is answered by clicking a name rather than by
 * remembering to select the right token first.
 *
 *   party  — one button, the whole party at once
 *   ally   — one per party member, plus let-the-dice-decide; `picks` of them
 *   self   — the roller, named
 *   target — the creature hit, named
 *   other  — whatever the clicker has selected (GM only, by nature)
 *
 * @returns {object} the targeting half of the card's state
 */
function buildOutcomeTargets(rec, cast = {}) {
    const party = getPartyActors();
    const asCandidate = (actor) => ({ id: actor.id, name: actor.name, img: actor.img || 'icons/svg/mystery-man.svg' });

    // Card-dealing outcomes hand someone a card from the inspiration deck
    // instead of applying a status. `appliesto` still decides WHO, so this
    // reuses the same targeting rather than inventing a second idea.
    if (rec.dealscard) {
        if ((rec.appliesto === 'ally' || rec.appliesto === 'party') && party.length) {
            return {
                dealscard: true, picksTotal: 1, randomAllowed: true,
                candidates: party.map(asCandidate),
                hint: 'Pick who draws a card, or let the dice decide.'
            };
        }
        const named = rec.appliesto === 'self' ? cast.roller : (cast.hit ?? cast.roller);
        return {
            dealscard: true, picksTotal: 1, candidates: [],
            targetActorId: named?.id ?? null,
            singleLabel: named ? `Deal a Card to ${named.name}` : 'Deal an Inspiration Card',
            needsSelection: !named,
            hint: named ? '' : 'Select who draws, or the card goes to your own character.'
        };
    }

    if (rec.appliesto === 'party') {
        return {
            partyMode: true, picksTotal: 1, candidates: [],
            singleLabel: party.length ? `Apply to the Whole Party (${party.length})` : 'Apply to the Whole Party',
            hint: party.length ? '' : 'No party members found — select tokens instead.'
        };
    }

    // "Two party members each lose 1 HP" is one card, not two: the picker
    // stays open until `picks` choices have been made.
    if (rec.appliesto === 'ally' && party.length) {
        const picks = picksFor(rec);
        return {
            picksTotal: picks,
            // Some entries say "you pick", others say "GM chooses with a
            // dice roll" — offer both rather than encoding which is which.
            randomAllowed: true,
            candidates: party.map(asCandidate),
            hint: picks > 1 ? targetHint('ally', picks) : 'Pick who it lands on, or let the dice decide.'
        };
    }

    // Name the person when we can and bind to them: the card records a
    // specific moment, so it should not quietly re-aim at whatever happens
    // to be selected when someone gets around to clicking.
    const named = rec.appliesto === 'self' ? cast.roller
        : (rec.appliesto === 'target' ? (cast.hit ?? null) : null);
    if (named) {
        return {
            picksTotal: 1, candidates: [], targetActorId: named.id,
            singleLabel: `Apply to ${named.name}`, hint: ''
        };
    }

    return {
        picksTotal: 1, candidates: [],
        singleLabel: `Apply to ${targetLabel(rec.appliesto).replace(/^The /, '')}`,
        needsSelection: true,
        hint: TARGET_HINTS[rec.appliesto] ?? ''
    };
}

function buildOutcomeMechanics(rec, modifierLines, rounds) {
    const lines = [];
    if (rec.damage) lines.push({ icon: 'fa-heart-crack', text: `${rec.damage} damage` });
    if (rec.statuseffect && rec.statuseffect !== 'none') {
        const label = rec.statuseffect.charAt(0).toUpperCase() + rec.statuseffect.slice(1);
        lines.push({ icon: 'fa-sparkles', text: rounds ? `${label} for ${rounds} round${rounds === 1 ? '' : 's'}` : label });
    }
    for (const text of modifierLines) lines.push({ icon: 'fa-dice-d20', text });
    // No damage, no status, no modifiers: the outcome is pure flavour, so the
    // card shows nothing here rather than a callout holding one apologetic
    // line. An empty array is falsy to the template's {{#if}}, so the whole
    // mechanics strip drops out and the description carries the card.
    return lines;
}

// Trigger the injuries selector card (toolbar button) — macro-free
async function triggerInjuriesRoll() {
    // The selector CARD is gone. It put a permanent message in the log for
    // what is really a GM control, and it could only roll at random — there
    // was no way to choose a specific wound, which is the moment a GM most
    // wants to. The picker does both and leaves the log alone; only the
    // resulting injury card is posted.
    const { openInjuryPicker } = await import('./window-injury-picker.js');
    await openInjuryPicker();
}

// Roll an injury for a specific damage category and post the card directly
// (skipping the selector). Used by manager-roll-toasts.js for the injury
// Automation click/auto modes. `target` ({actorId, tokenId}) is the actor
// who took the damage — the card's Apply button binds to them.
export async function rollInjuryCard(category, target = null, { title = null } = {}) {
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPE = "General";
    // `title` names a specific injury; without it the category rolls at
    // random, weighted by odds — the behaviour the old selector card had.
    const built = await createChatCardInjury(category, target, { title });
    resetBibliosophVars();
    if (!built) return;

    // Automatically Apply Injury: with a known target, apply BEFORE posting
    // and compose the card with the stamp in place of the button. Runs on
    // the rolling client (the injured player in click mode, the GM in auto),
    // both of whom own the target actor. Any failure falls back to posting
    // the normal button — hence composing only once we know it worked.
    let parts = built.parts;
    const autoApply = BlacksmithUtils.getSettingSafely(MODULE.ID, 'injuryAutoApply', false);
    if (autoApply && (target?.actorId || target?.tokenId)) {
        try {
            const targetActor = canvas?.tokens?.get(target.tokenId ?? '')?.actor
                ?? game.actors.get(target.actorId ?? '');
            if (targetActor) {
                const applied = await applyStatusToTokens(buildInjuryApplyConfig(built.effect, [targetActor]));
                if (applied.length) parts = built.compose({ appliedTo: applied.join(', ') });
            }
        } catch (error) {
            logBib('Auto-apply injury failed; posting card with the button', error?.message, false, false);
        }
    }

    await postInjuryCard(parts, built.effect);
}

/**
 * Post an injury card, with everything the Apply button will need stored
 * on the message rather than stuffed into the button.
 *
 * A button carries a `value`, and the applier needs the whole record —
 * modifiers, duration, source. Flags are where that belongs: the handler
 * reads them back off the message it was clicked on.
 */
async function postInjuryCard(parts, effect) {
    return postCard({
        type: 'injury',
        theme: getSettingSafe('cardThemeInjury', 'default'),
        parts,
        flags: { injury: effect }
    });
}

// Treatment: post a card listing the subject's Bibliosoph afflictions,
// each with an Apply Treatment button (toolbar; targeted-then-selected)
async function triggerTreatmentCard() {
    const targeted = Array.from(game.user.targets ?? []);
    const token = targeted[0] ?? canvas.tokens.controlled[0] ?? null;
    if (!token?.actor) {
        showBibToast('No Patient', 'Target or select a token to treat.', 'fa-solid fa-crosshairs');
        return;
    }
    const built = await createChatCardTreatment(token);
    if (!built) return;
    await postCard({
        type: 'check-up',
        theme: getSettingSafe('cardThemeInjury', 'default'),
        parts: built.parts,
        flags: { checkup: built.state }
    });
}

// Build the CHECK-UP card: portrait + diagnosis narrative, then one row
// per active affliction — Bibliosoph-applied outcomes AND any temporary
// effect or condition on the actor, whatever put it there. Each row shows
// the effect's icon, its conveyed conditions, treatment prose when the
// injury carries it, and its own Treat button.
// Treatment-roll DC ladder by injury severity (fallback 15)
const SEVERITY_DCS = { minor: 10, moderate: 15, major: 20 };

async function createChatCardTreatment(token) {
    const actor = token.actor;

    // Treatable = our flagged afflictions, any active temporary effect
    // (conditions are temporary effects), anything carrying a status
    // marker, and — because conditions are sometimes hand-authored with
    // no duration or status and land under "Passive Effects" — any effect
    // whose NAME matches a registered condition. Disabled and suppressed
    // effects, and genuinely passive feats/items, stay excluded.
    const conditionNames = new Set([
        ...(CONFIG.statusEffects ?? []).map((s) => game.i18n.localize(s.name ?? '').toLowerCase()),
        ...Object.values(CONFIG.DND5E?.conditionTypes ?? {}).map((c) => game.i18n.localize(c.name ?? '').toLowerCase())
    ].filter(Boolean));
    const allEffects = Array.from(actor.effects ?? []);
    logBib(`Check-Up: examining ${allEffects.length} effects on ${token.name}`, '', true, false);
    const afflictions = allEffects.filter((e) => {
        try {
            let verdict = 'excluded (passive, not a condition)';
            let include = false;
            if (e.disabled) verdict = 'excluded (disabled)';
            else if (e.isSuppressed) verdict = 'excluded (suppressed)';
            else if (e.getFlag(MODULE.ID, 'outcomeBurst')) { include = true; verdict = 'included (Bibliosoph affliction)'; }
            else if (e.isTemporary) { include = true; verdict = 'included (temporary)'; }
            else if (e.statuses?.size) { include = true; verdict = 'included (carries statuses)'; }
            else if (conditionNames.has(String(e.name ?? '').toLowerCase())) { include = true; verdict = 'included (condition name)'; }
            logBib(`Check-Up: "${e.name}" — ${verdict}`, '', true, false);
            return include;
        } catch (error) {
            logBib(`Check-Up: "${e?.name}" — filter error, skipped`, error?.message, false, false);
            return false;
        }
    });

    // Human name for a condition id, from the system's registrations
    const conditionLabel = (id) => {
        const se = CONFIG.statusEffects?.find((s) => s.id === id);
        if (se?.name) return game.i18n.localize(se.name);
        const ct = CONFIG.DND5E?.conditionTypes?.[id];
        if (ct?.name) return game.i18n.localize(ct.name);
        return id.charAt(0).toUpperCase() + id.slice(1);
    };

    const TextEditorImpl = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    // For a loose condition effect (Prone, Charmed…), find the flagged
    // affliction that conveys it, so its row can say "via Severed Strands"
    // instead of repeating its own name.
    const conveyedBy = (effect) => {
        if (!effect.statuses?.size) return null;
        for (const other of afflictions) {
            if (other === effect) continue;
            const otherFlag = other.getFlag(MODULE.ID, 'outcomeBurst');
            if (!['injury', 'crit', 'fumble'].includes(otherFlag?.kind)) continue;
            const conveyed = new Set(other.statuses ?? []);
            if (otherFlag.condition) conveyed.add(otherFlag.condition);
            for (const statusId of effect.statuses) {
                if (conveyed.has(statusId)) return other.name;
            }
        }
        return null;
    };

    // Remaining time comes from Blacksmith, keyed by effect id.
    //
    // We used to convert to rounds ourselves, unconditionally, which read
    // "100 rounds remain" on a ten-minute wound sitting out of combat —
    // right instinct, wrong place. The rule is rounds only when rounds are
    // being counted, and `getDisplayEffects` already implements it: rounds
    // for a short remainder mid-combat, minutes/hours/days otherwise. The
    // raw-seconds problem that made us roll our own is long fixed.
    //
    // Deliberately permissive filters: this map is a lookup, not the row
    // list, and a missing entry only costs the duration on that one row.
    const durationLabels = new Map();
    try {
        const effectsApi = game.modules.get('coffee-pub-blacksmith')?.api?.effects;
        if (effectsApi?.getDisplayEffects) {
            const rows = await effectsApi.getDisplayEffects(actor, {
                qualifyingOnly: false,
                includeDisabled: true,
                includeSuppressed: true,
                includeDescriptions: 'never'
            });
            for (const row of rows ?? []) {
                if (row?.id) durationLabels.set(row.id, row.durationLabel || '');
            }
        }
    } catch (error) {
        logBib('Could not read Blacksmith duration labels', error?.message, false, false);
    }

    const treatmentrows = await Promise.all(afflictions.map(async (effect) => {
        const flag = effect.getFlag(MODULE.ID, 'outcomeBurst');
        const kind = ['injury', 'crit', 'fumble'].includes(flag?.kind) ? flag.kind : 'other';
        // The zone header already says Criticals/Fumbles — drop the effect
        // name's prefix on the row (the full name stays on the token/sheet)
        const rowName = kind === 'crit' ? effect.name.replace(/^Critical:\s*/i, '')
            : kind === 'fumble' ? effect.name.replace(/^Fumble:\s*/i, '')
            : effect.name;
        const statusIds = new Set(effect.statuses ?? []);
        if (flag?.condition) statusIds.add(flag.condition);
        const conditions = [...statusIds].map(conditionLabel).join(', ');
        // The row's second line: flagged afflictions list what they convey;
        // loose conditions credit their source; any row with a duration
        // gets the remaining time appended.
        const durationLabel = durationLabels.get(effect.id) ?? '';
        let detail = conditions;
        if (kind === 'other') {
            const source = conveyedBy(effect);
            detail = source ? `via ${source}` : '';
        }
        // A bleeding wound says so before it says how long it has left.
        const tickPct = Number(flag?.tick) || 0;
        if (tickPct > 0) {
            const perTurn = damageFor(tickPct, actor.system?.attributes?.hp);
            const bleed = perTurn > 0 ? `${perTurn} HP per turn` : `${tickPct}% per turn`;
            detail = detail ? `${detail} · ${bleed}` : bleed;
        }
        if (flag?.lingering) detail = detail ? `${detail} · lingering` : 'lingering';
        if (durationLabel) detail = detail ? `${detail} · ${durationLabel}` : durationLabel;
        // Failed treatment attempts show who has already tried
        const attempts = (effect.getFlag(MODULE.ID, 'treatAttempts') ?? [])
            .map((id) => game.actors.get(id)?.name).filter(Boolean);
        if (attempts.length) detail = detail ? `${detail} · tried: ${attempts.join(', ')}` : `tried: ${attempts.join(', ')}`;
        // Hover card for the row icon: name, conditions, and the effect's
        // full description (injury text + Treatment prose ride along).
        // Foundry's TooltipManager renders data-tooltip content as HTML.
        // dnd5e condition descriptions are enricher syntax (@Embed of the
        // rules journal page), so run everything through the enricher.
        let description = String(effect.description ?? '').trim();
        if (description) {
            try {
                description = String(await TextEditorImpl.enrichHTML(description, {
                    relativeTo: effect,
                    rollData: actor.getRollData?.() ?? {}
                })).trim();
            } catch (_) { /* fall back to the raw text */ }
        }
        const tooltip = `<section style="max-width: 320px; text-align: left;">`
            + `<strong>${effect.name}</strong>`
            + (detail ? `<br><em>${detail}</em>` : '')
            + (description ? `<hr>${description}` : '')
            + `</section>`;
        // Injuries carry the treatment-roll DC (explicit > severity ladder
        // minor 10 / moderate 15 / major 20 > flat 15). The bandaid belongs
        // to rollable treatment; crit/fumble/condition rows get the GM-only
        // dismiss eraser (pruned for players at render time).
        const dc = flag?.dc ?? SEVERITY_DCS[String(flag?.severity ?? '').toLowerCase()] ?? 15;
        return {
            kind,
            name: rowName,
            img: effect.img || 'icons/svg/aura.svg',
            detail,
            tooltip,
            // The journal page this came from. Only the reference travels in
            // the card; a GM's own client fetches the notes at render time,
            // so the text never reaches a player's browser.
            sourceUuid: flag?.sourceUuid ?? '',
            buttonIcon: kind === 'injury' ? 'fa-solid fa-bandage'
                : (kind === 'crit' || kind === 'fumble') ? 'fa-solid fa-burst'
                : 'fa-solid fa-sparkles',
            // Keyed by effect id, because that is what a button carries as
            // its value and what a treated-row sweep looks rows up by.
            effectId: effect.id,
            dc
        };
    }));

    // Four zones, fixed order: injuries (bundles), then the d20 outcomes,
    // then loose effects & conditions. Empty zones are omitted.
    const GROUP_ORDER = [
        { key: 'injury', label: 'Injuries', icon: 'fa-solid fa-bandage' },
        { key: 'crit', label: 'Criticals', icon: 'fa-solid fa-burst' },
        { key: 'fumble', label: 'Fumbles', icon: 'fa-solid fa-heart-crack' },
        { key: 'other', label: 'Effects & Conditions', icon: 'fa-solid fa-sparkles' }
    ];
    const treatmentgroups = GROUP_ORDER
        .map((g) => ({ label: g.label, icon: g.icon, rows: treatmentrows.filter((r) => r.kind === g.key) }))
        .filter((g) => g.rows.length);

    // Diagnosis narrative from the actor's state
    const hp = actor.system?.attributes?.hp;
    const pctHp = hp?.max ? Math.round((Number(hp.value) / Number(hp.max)) * 100) : null;
    const healthDesc = pctHp === null ? 'of indeterminate health'
        : pctHp >= 100 ? 'in perfect health'
        : pctHp >= 75 ? 'lightly wounded'
        : pctHp >= 50 ? 'wounded'
        : pctHp >= 25 ? 'badly wounded'
        : pctHp > 0 ? 'gravely wounded'
        : 'down';
    const hpNote = pctHp === null ? '' : ` (${hp.value}/${hp.max} HP)`;
    const diagnosis = treatmentrows.length
        ? `${token.name} is ${healthDesc}${hpNote} and suffering from ${treatmentrows.length} affliction${treatmentrows.length === 1 ? '' : 's'}.`
        : `${token.name} is ${healthDesc}${hpNote} with no afflictions found. A clean bill of health.`;

    // Portrait blood overlay — same 5%-stepped frames as Blacksmith's
    // combat-bar hover card (blood-0..100.webp by damage taken, 101 = down)
    let portraitBlood = '';
    if (pctHp !== null) {
        const bloodStep = Math.round((100 - Math.max(0, Math.min(100, pctHp))) / 5) * 5;
        const bloodValue = Number(hp.value) <= 0 ? 101 : bloodStep;
        if (bloodValue > 0) portraitBlood = `modules/coffee-pub-blacksmith/images/portraits/blood/blood-${bloodValue}.webp`;
    }
    // Health bar. The colour is NOT ours to pass: on a meter the tint is
    // emphasis rather than data, so the theme derives it from the
    // proportion. Only the reading is ours.
    const hpBar = pctHp === null ? null : {
        value: Number(hp.value),
        max: Number(hp.max),
        label: `${hp.value}/${hp.max} HP`
    };

    BlacksmithUtils.playSound("modules/coffee-pub-blacksmith/sounds/notification.mp3", "0.7");

    // What a treat click needs, on the message rather than in the buttons:
    // a button carries one value, and resolving a treatment needs the
    // patient, the effect, its kind and its DC.
    const state = {
        actorId: actor.id,
        tokenId: token.id,
        rows: Object.fromEntries(treatmentrows.map((row) => [row.effectId, {
            kind: row.kind, name: row.name, dc: row.dc, sourceUuid: row.sourceUuid
        }]))
    };

    return {
        parts: composeCheckUpCard({
            name: token.name,
            portrait: actor.img || token.document?.texture?.src || '',
            portraitBlood,
            healthDesc: healthDesc.charAt(0).toUpperCase() + healthDesc.slice(1),
            hpBar,
            diagnosis,
            groups: treatmentgroups
        }),
        state
    };
}

/**
 * The Check-Up card as a composition.
 *
 * @returns {Array<object>} parts, in render order
 */
function composeCheckUpCard(checkup) {
    const parts = [{ part: 'header', icon: 'fa-solid fa-stethoscope', title: 'Check-Up' }];

    // The patient as one plain row rather than a `subject`: a subject
    // carries its bar but not an overlay, and the blood over the portrait
    // is the thing this card is least willing to lose. The bar follows as
    // its own part.
    const patient = {
        img: checkup.portrait,
        cover: true,
        label: checkup.name,
        sublabel: checkup.healthDesc
    };
    if (checkup.portraitBlood) patient.overlays = [checkup.portraitBlood];
    parts.push({ part: 'rows', plain: true, items: [patient] });

    if (checkup.hpBar) {
        parts.push({
            part: 'meter',
            value: checkup.hpBar.value,
            max: checkup.hpBar.max,
            tooltip: checkup.hpBar.label
        });
    }
    parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: checkup.diagnosis }] });

    // One zone per group, each row carrying its own Treat button. Which
    // buttons a reader actually gets is decided in their own browser — see
    // the treat-affordance render pass.
    for (const group of checkup.groups) {
        parts.push({ part: 'section', icon: group.icon, label: group.label });
        parts.push({
            part: 'rows',
            items: group.rows.map((row) => ({
                img: row.img,
                label: row.name,
                sublabel: row.detail,
                tooltip: row.tooltip,
                moduleId: MODULE.ID,
                action: TREAT_ACTION,
                value: row.effectId,
                actionIcon: row.buttonIcon
            }))
        });
    }
    return parts;
}

/**
 * Every card in the configured deck. Shared by the random draw and the
 * GM's deal-a-specific-card picker, so both see exactly the same deck.
 *
 * @returns {Promise<object[]|null>} null when the deck is missing or
 *          empty, having already told the user why
 */
async function loadInspirationDeck() {
    const compendiumName = getSettingSafe('inspirationCompendium', 'none');
    const pack = game.packs.get(compendiumName);
    if (!pack) {
        showBibToast('No Card Deck', 'Set an Inspiration Cards compendium in the settings.', 'fa-solid fa-lightbulb');
        return null;
    }
    const entries = await pack.getDocuments();
    const cards = entries
        .flatMap((journal) => Array.from(journal.pages ?? []))
        .map((page) => {
            const system = page?.system;
            if (!system || system.odds === undefined) return null;
            const fields = system.toObject?.() ?? system;
            return { ...fields, title: page.name, sourceUuid: page.uuid };
        })
        .filter(Boolean);
    if (!cards.length) {
        showBibToast('Empty Deck', `No cards found in "${compendiumName}".`, 'fa-solid fa-lightbulb');
        return null;
    }
    return cards;
}

/**
 * Draw an inspiration card and hand it to a character as an inventory
 * item. THE CARD IS THE CURRENCY — holding it is the right to play it.
 *
 * @param {Actor|null} actor  who receives the card; defaults to the
 *                            targeted/selected token's actor
 * @param {string|null} title  deal a SPECIFIC card by name instead of
 *                            drawing at random — the GM's picker and the
 *                            test harness both go through this
 */
export async function drawInspirationCard(actor = null, { title = null } = {}) {
    const cards = await loadInspirationDeck();
    if (!cards) return;

    const card = title ? cards.find((c) => c.title === title) : await weightedPickRolled(cards, (c) => c.odds);
    if (!card) {
        showBibToast('No Such Card', `Nothing titled "${title}" in the deck.`, 'fa-solid fa-lightbulb');
        return;
    }
    const holder = actor
        ?? Array.from(game.user.targets ?? [])[0]?.actor
        ?? canvas?.tokens?.controlled?.[0]?.actor
        ?? null;

    // Drawing hands them the card as a real item they can sit on until the
    // moment is right. THE CARD IS THE CURRENCY — no separate point is
    // granted, because holding the card is already the right to play it.
    let cardItem = null;
    if (holder) {
        const { grantInspirationItem } = await import('./manager-inspiration.js');
        cardItem = await grantInspirationItem(holder, card);
    }

    // With the card in their inventory, the ITEM is how it gets used — a
    // button here would just be a way to play the card without it leaving
    // their sheet. It survives only as the fallback for a draw that
    // reached nobody.
    const state = cardItem ? null : {
        card: {
            title: card.title,
            action: card.action ?? 'none',
            actionamount: card.actionamount ?? null,
            actionformula: card.actionformula ?? '',
            holderActorId: holder?.id ?? null,
            sourceUuid: card.sourceUuid ?? null
        },
        label: card.action && card.action !== 'none'
            ? `Use — ${actionButtonFor(card.action)}`
            : 'Use This Card',
        hint: card.action && card.action !== 'none' ? actionHintFor(card.action) : '',
        holderActorId: holder?.id ?? null
    };

    const parts = composeInspirationCard({
        title: card.title,
        description: card.description,
        image: card.image || '',
        imageCaption: card.imagetitle || '',
        // Same describer the item uses, so the draw card and the card in
        // their inventory say the same thing about what it does.
        mechanics: INSPIRATION_ACTIONS.describeInspirationCard(card),
        recipient: buildInspirationRecipient(card, holder, cardItem)
    }, state);

    BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/spell-magic-circle.mp3', '0.7');
    await postInspirationCard(parts, state);

    // Say what happened. Dealing from the picker is a click that produces a
    // chat card somewhere off to the side and an item on a sheet you may
    // not have open — without this it reads as though nothing happened.
    if (!holder) {
        showBibToast('Dealt to No One', `${card.title} went nowhere — select or target a token first.`, 'fa-solid fa-triangle-exclamation');
    } else if (cardItem) {
        showBibToast('Card Dealt', `${card.title} → ${holder.name}`, 'fa-solid fa-lightbulb');
    } else {
        showBibToast('Card Not Dealt', `${card.title} could not be added to ${holder.name}'s inventory.`, 'fa-solid fa-triangle-exclamation');
    }
}

/**
 * PLAY a card: the pretty card, raised by using the item, with a button
 * for every person it could land on. This is the card the table actually
 * looks at — art, prose, mechanics, and one click that resolves it.
 *
 * Nothing has been spent at this point. The buttons do the spending.
 */
export async function postInspirationPlayCard({ card, holder = null, itemUuid = null }) {
    const state = buildInspirationPlayState(card, holder, itemUuid);
    const parts = composeInspirationCard({
        title: card.title,
        description: card.description,
        image: card.image || '',
        imageCaption: card.imagetitle || '',
        mechanics: INSPIRATION_ACTIONS.describeInspirationCard(card, { context: 'play' }),
        // Same portrait row as the draw card, so "whose card is this" reads
        // identically whether it was just dealt or is being cashed in.
        // No note line here — the mechanics block already states that
        // playing it discards the card, and saying it twice on one card
        // reads like the card is not sure.
        recipient: holder ? { label: 'Played by', name: holder.name, img: holder.img || 'icons/svg/mystery-man.svg' } : null
    }, state);

    BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/spell-magic-circle.mp3', '0.7');
    await postInspirationCard(parts, state, holder);
}

/**
 * The inspiration card as a composition. One shape for both the draw and
 * the play, because they are the same card at two moments.
 *
 * @param {object} inspiration - already-resolved display values
 * @param {object|null} state - the resolve controls, or null for a card
 *        whose only control is the item now sitting on a sheet
 * @returns {Array<object>} parts, in render order
 */
function composeInspirationCard(inspiration, state) {
    const parts = [{ part: 'header', icon: 'fa-solid fa-lightbulb', title: 'Inspiration' }];
    parts.push({ part: 'section', icon: 'fa-solid fa-sparkles', label: inspiration.title });
    if (inspiration.image) {
        parts.push({ part: 'image', src: inspiration.image, alt: inspiration.title, caption: inspiration.imageCaption });
    }
    if (inspiration.description) {
        parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: inspiration.description }] });
    }
    if (inspiration.mechanics?.length) {
        parts.push({
            part: 'notes',
            items: inspiration.mechanics.map((line) => ({ icon: `fa-solid ${line.icon}`, text: line.text }))
        });
    }

    // WHOSE CARD THIS IS. On the draw card this is the point of the whole
    // thing — a draw with no button is otherwise the only thing saying
    // where the card went.
    const recipient = inspiration.recipient;
    if (recipient?.name) {
        parts.push({
            part: 'rows',
            items: [{
                img: recipient.img,
                cover: true,
                label: recipient.name,
                sublabel: [recipient.label, recipient.note].filter(Boolean).join(' — ')
            }]
        });
    } else if (recipient?.note) {
        parts.push({ part: 'notes', items: [{ icon: 'fa-solid fa-triangle-exclamation', text: recipient.note }] });
    }

    if (state) parts.push(composeInspirationActions(state));
    return parts;
}

/** The card's tail: who it can land on, or the stamp once it has. */
function composeInspirationActions(state) {
    if (state.spent) {
        return { part: 'band', text: state.spent, icon: 'fa-solid fa-check', tone: 'positive' };
    }
    const buttons = [];
    if (state.randomAllowed && (state.candidates ?? []).length > 1) {
        buttons.push({
            moduleId: MODULE.ID, action: INSPIRATION_USE_ACTION, value: 'random',
            label: 'Random Party Member', icon: 'fa-solid fa-dice-d20'
        });
    }
    for (const candidate of state.candidates ?? []) {
        buttons.push({
            moduleId: MODULE.ID, action: INSPIRATION_USE_ACTION, value: candidate.id,
            label: candidate.name, icon: 'fa-solid fa-lightbulb'
        });
    }
    if (!buttons.length) {
        buttons.push({
            moduleId: MODULE.ID, action: INSPIRATION_USE_ACTION, value: '',
            label: state.label || 'Use This Card', icon: 'fa-solid fa-lightbulb', variant: 'primary'
        });
    }
    const part = {
        part: 'actions',
        layout: buttons.length > 1 ? 'stacked' : 'inline',
        buttons
    };
    if (state.hint) part.instruction = state.hint;
    // The holder's card to spend. A GM owns every actor, so this reads as
    // "the holder and the GM" — and the handler checks again.
    if (state.holderActorId) {
        part.readableBy = 'owner';
        part.actorId = state.holderActorId;
    }
    return part;
}

/** Post an inspiration card, with its resolve state on the message. */
async function postInspirationCard(parts, state, holder = null) {
    return postCard({
        type: 'inspiration',
        theme: getSettingSafe('cardThemeInspiration', 'default'),
        speaker: holder ? ChatMessage.getSpeaker({ actor: holder }) : undefined,
        parts,
        flags: state ? { inspiration: state } : {}
    });
}

/**
 * WHO a played card can land on, as card state rather than as markup.
 *
 * Which controls appear comes from the card's target mode, so the
 * question "who does this land on?" is answered by clicking a name rather
 * than by remembering to select the right token first.
 *
 *   none   — one button; the table resolves the rest
 *   self   — one button, naming the holder
 *   ally   — one per party member, plus let-the-dice-decide
 *   target — one per creature they currently have targeted
 *   any    — the holder, the party, and anything targeted
 */
function buildInspirationPlayState(card, holder, itemUuid) {
    const mode = INSPIRATION_ACTIONS.targetModeFor(card);
    const base = {
        card: {
            title: card.title,
            action: card.action ?? 'none',
            actionamount: card.actionamount ?? null,
            actionformula: card.actionformula ?? '',
            holderActorId: holder?.id ?? null,
            sourceUuid: card.sourceUuid ?? null,
            itemUuid
        },
        holderActorId: holder?.id ?? null,
        candidates: []
    };

    // No aiming to do: one button, and the point is the whole mechanic.
    // The mechanics block above already states the cost, so the hint stays
    // out of the way rather than repeating it.
    if (mode === 'none') return { ...base, label: 'Play This Card', hint: '' };

    if (mode === 'self') {
        return {
            ...base,
            targetActorId: holder?.id ?? null,
            label: holder ? `Use on ${holder.name}` : (actionButtonFor(card.action) || 'Use This Card'),
            hint: ''
        };
    }

    // Inspiration is played at the table, not on the battle map: a party
    // member with no token on this scene is still a legal target.
    const party = getPartyActors({ requireToken: false });
    const targeted = Array.from(game.user?.targets ?? []).map((t) => t.actor).filter(Boolean);

    // Candidates, deduped, in the order the player is likeliest to want:
    // themselves first for "any", then the party, then their target.
    const candidates = [];
    const add = (actor, note = '') => {
        if (!actor || candidates.some((c) => c.id === actor.id)) return;
        candidates.push({
            id: actor.id,
            name: note ? `${actor.name} (${note})` : actor.name,
            img: actor.img || 'icons/svg/mystery-man.svg'
        });
    };
    if (mode === 'any') add(holder, 'yourself');
    if (mode === 'ally' || mode === 'any') {
        for (const actor of party) {
            if (mode === 'ally' && actor.id === holder?.id) continue;   // cannot swap with yourself
            add(actor);
        }
    }
    for (const actor of targeted) add(actor, 'targeted');

    // Nothing to list — most often a `target` card played before anything
    // was targeted. The button still works: targets are read when it is
    // CLICKED, so they can aim now and click without redrawing the card.
    if (!candidates.length) {
        return {
            ...base,
            label: actionButtonFor(card.action) || 'Use This Card',
            hint: mode === 'target'
                ? 'Target a creature on the canvas, then click.'
                : actionHintFor(card.action)
        };
    }

    return {
        ...base,
        candidates,
        // Life Swap-style "call out their name" cards get a dice option
        // too, for the tables that would rather let fate pick.
        randomAllowed: mode === 'ally',
        hint: mode === 'target' ? 'Pick the creature it hits.' : 'Pick who it lands on.'
    };
}

/**
 * The GM's deal dialog: every card in the deck, art and all, plus a
 * random draw. Dealing a chosen card is a normal part of running this —
 * "you get Smite for that" — so it belongs in the UI rather than only in
 * the `title` argument, which nothing the GM can click ever reached.
 *
 * Goes through Blacksmith's dialog API so it inherits the house chrome
 * (blacksmith-dialog: spacing, button row, tokens) instead of looking
 * like a stock Foundry dialog next to our own windows. Core DialogV2 is
 * the fallback for a Blacksmith too old to have api.dialog.
 */
export async function openInspirationDealDialog() {
    const cards = await loadInspirationDeck();
    if (!cards) return;

    const holder = Array.from(game.user.targets ?? [])[0]?.actor
        ?? canvas?.tokens?.controlled?.[0]?.actor
        ?? null;

    const esc = (s) => Handlebars.escapeExpression(s ?? '');
    const totalOdds = cards.reduce((sum, c) => sum + (Number(c.odds) || 1), 0);
    const byName = [...cards].sort((a, b) => a.title.localeCompare(b.title));

    // Short labels only. actionLabel() reads "Swap hit points with another
    // character", which wrapped and clipped inside a two-column tile; the
    // button label ("Swap Health") is the same fact in two words.
    const rows = byName.map((card) => {
        const chance = Math.round(100 * (Number(card.odds) || 1) / totalOdds);
        const kind = card.action && card.action !== 'none'
            ? INSPIRATION_ACTIONS.actionButton(card.action) || 'Automated'
            : 'Narrative';
        return `
            <button type="button" data-deal="${esc(card.title)}"
                style="display:flex; align-items:center; gap:8px; width:100%; min-height:48px; margin:0; padding:4px 6px; text-align:left; line-height:1.2;">
                <img src="${esc(card.image)}" alt="" style="flex:0 0 40px; width:40px; height:40px; object-fit:cover; border:none; border-radius:var(--blacksmith-radius-md, 4px); margin:0;" />
                <span style="flex:1; min-width:0; overflow:hidden;">
                    <span style="display:block; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(card.title)}</span>
                    <span style="display:block; font-size:0.82em; opacity:0.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(kind)} · ${chance}%</span>
                </span>
            </button>`;
    }).join('');

    const content = `
        <p>Dealing to ${holder ? `<strong>${esc(holder.name)}</strong>` : '<strong>nobody</strong> — select or target a token first'}.</p>
        <button type="button" data-deal="__random__" style="width:100%; margin:0 0 8px 0;">
            <i class="fa-solid fa-dice-d20"></i> Deal a Random Card (weighted by odds)
        </button>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:4px; max-height:44vh; overflow-y:auto;">${rows}</div>`;

    // One handler for both the random button and every card tile; the
    // dataset value is the card name, or __random__ for a weighted draw.
    const wire = (root, close) => {
        root?.querySelectorAll?.('[data-deal]')?.forEach((btn) => {
            btn.addEventListener('click', async () => {
                const pick = btn.dataset.deal;
                close();
                await drawInspirationCard(holder, { title: pick === '__random__' ? null : pick });
            });
        });
    };

    const api = game.modules.get('coffee-pub-blacksmith')?.api?.dialog;
    if (api?.wait) {
        await api.wait({
            title: 'Deal an Inspiration Card',
            content,
            classes: ['bibliosoph-deal-dialog'],
            position: { width: 560, height: 'auto' },
            buttons: [{ action: 'cancel', label: 'Cancel', default: true }],
            onRender: (...args) => {
                // Signature varies by Blacksmith build; find the element and
                // the closer among whatever we were handed.
                const dialog = args.find((a) => a?.element || a?.close);
                const root = dialog?.element ?? args.find((a) => a?.querySelectorAll);
                wire(root, () => dialog?.close?.());
            }
        });
        return;
    }

    await foundry.applications.api.DialogV2.wait({
        window: { title: 'Deal an Inspiration Card' },
        classes: ['blacksmith-dialog', 'bibliosoph-deal-dialog'],
        content,
        buttons: [{ action: 'cancel', label: 'Cancel', default: true }],
        position: { width: 560, height: 'auto' },
        render: (event, dialog) => wire(dialog?.element ?? dialog, () => dialog?.close?.())
    });
}

/**
 * Who holds this card and what that means — the point of the draw card,
 * so it gets a portrait and a heading rather than a line of italics. A
 * player who does not know the card is on their sheet will sit there
 * waiting for a button that is never coming.
 *
 * @returns {object} template fields for the recipient row
 */
function buildInspirationRecipient(card, holder, cardItem) {
    if (!holder) {
        // A GM can fix this by selecting a token; a player cannot, so tell
        // each of them the thing they can actually act on.
        return {
            note: game.user.isGM
                ? 'Nobody was selected, so this card went to no one. Select a token and deal again.'
                : 'You have no assigned character, so this card went nowhere. Ask the GM to deal it to you.'
        };
    }
    return {
        name: holder.name,
        img: holder.img || 'icons/svg/mystery-man.svg',
        note: cardItem
            ? `**${card.title}** has been added to their inventory.`
            : `**${card.title}** could not be added. Add it manually.`
    };
}

function actionButtonFor(action) {
    const { ACTIONS } = INSPIRATION_ACTIONS;
    return ACTIONS?.[action]?.button ?? 'Resolve';
}

function actionHintFor(action) {
    const { ACTIONS } = INSPIRATION_ACTIONS;
    return ACTIONS?.[action]?.hint ?? '';
}

/**
 * Turn a clicked button into the actor list the action wants.
 *
 * swapHp is the odd one out: "swap health with that character" needs BOTH
 * sides, and runInspirationAction reads them as [a, b], so the holder has
 * to lead. Everything else acts on the one actor that was picked.
 *
 * @returns {string[]|null}  null when the button carried no decision, so
 *                           the caller falls back to token selection
 */
function resolveInspirationTargets(data, holder) {
    let chosenId = data?.targetActorId ?? null;

    if (data?.randomAlly) {
        const pool = getPartyActors({ requireToken: false }).filter((a) => a.id !== holder?.id);
        if (!pool.length) return null;
        chosenId = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (!chosenId) return null;

    if (data?.action === 'swapHp' && holder && holder.id !== chosenId) {
        return [holder.id, chosenId];
    }
    return [chosenId];
}

/**
 * Spend one inspiration card.
 *
 * `value` is the button that was pressed: an actor id, 'random', or empty
 * for a card with nothing to aim. Everything else is on the message.
 */
async function useInspirationCard(message, state, value) {
    const { applyInspirationCard, resolveTargets } = await import('./manager-inspiration.js');
    const data = state.card ?? {};
    const holder = game.actors.get(state.holderActorId ?? '');

    // The button carries the decision. Life Swap needs the holder in the
    // list too, since swapping is between two people; everything else acts
    // on the single actor whose name got clicked. Token selection is only
    // the fallback for a card posted without a picker.
    const pick = { ...data };
    if (value === 'random') pick.randomAlly = true;
    else if (value) pick.targetActorId = value;
    else if (state.targetActorId) pick.targetActorId = state.targetActorId;

    const targetActorIds = resolveInspirationTargets(pick, holder)
        ?? resolveTargets().map((a) => a.id);

    const result = await applyInspirationCard({
        card: data,
        holderActorId: holder?.id ?? null,
        targetActorIds,
        itemUuid: data?.itemUuid ?? null
    });
    if (!result.ok) {
        showBibToast('Not Yet', result.summary, 'fa-solid fa-crosshairs');
        return;
    }

    showBibToast('Inspiration Used', result.summary || data?.title || '', 'fa-solid fa-lightbulb');
    // Spending resolves the WHOLE card, however many names were offered:
    // one stamp replaces the lot rather than leaving the rest live.
    const spent = result.summary || (holder?.name ?? 'the party');
    const card = getCard(message);
    const at = card?.parts?.findIndex((part) => part.part === 'actions') ?? -1;
    if (at === -1) return;
    const next = { ...state, spent };
    card.parts[at] = composeInspirationActions(next);
    await updateCard(message, card.parts);
    await message.setFlag(MODULE.ID, 'inspiration', next);
}

// Deal or draw an Inspiration card (toolbar button)
function triggerInspiration() {
    // Same button, different job depending on who pressed it. The GM is
    // dealing — usually a chosen card, "you get Smite for that" — so they
    // get the picker. A player is drawing their own luck, so they get the
    // weighted draw straight away with no menu in the middle of it.
    // The deck is the only source. There is no roll-table path any more:
    // a table row cannot hold a card's action, odds or art, so what it
    // produced was a look-alike with none of the mechanics behind it.
    const compendium = getSettingSafe('inspirationCompendium', 'none');
    if (!compendium || compendium === 'none') {
        logBib('No Inspiration deck set — nothing to draw from', '', false, false);
        showBibToast('No Inspiration Deck', 'Choose an Inspiration compendium in Bibliosoph settings.', 'fa-solid fa-book-open');
        return;
    }
    if (game.user.isGM) openInspirationDealDialog();
    else drawInspirationCard(game.user.character ?? null);
}

// Make functions globally available for toolbar manager
window.triggerInvestigation = triggerInvestigation;
window.triggerCriticalRoll = triggerCriticalRoll;
window.triggerFumbleRoll = triggerFumbleRoll;
window.triggerInjuriesRoll = triggerInjuriesRoll;
window.triggerTreatmentCard = triggerTreatmentCard;
window.triggerInspiration = triggerInspiration;



// Nothing left to validate at startup: the only mandatory settings were the
// two macro names, and the toolbar buttons that replaced them cannot be
// misconfigured. Feature-level problems (no compendium chosen) are reported
// where they bite, by the feature itself.

// *** END: BLACKSMITH API INTEGRATION ***


// -- Import special page variables --
// Register settings so they can be loaded below.
import { registerSettings } from './settings.js';
// Grab windows

// ================================================================== 
// ===== REGISTER COMMON ============================================
// ================================================================== 

// Ensure the settings are registered before anything else
registerSettings();


// ================================================================== 
// ===== REGISTER HOOKS =============================================
// ================================================================== 

// ***** INIT *****
// Hook that loads as the module loads
Hooks.once('init', async function() {
    // Register the injury page subtype: data model + sheet. Injuries are
    // typed JournalEntryPages so Foundry validates every field on write
    // and GMs can author their own through a real sheet — the metadata
    // block this replaces was HTML that nothing could validate.
    try {
        Object.assign(CONFIG.JournalEntryPage.dataModels, {
            [INJURY_PAGE_TYPE]: InjuryPageModel
        });
        foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE.ID, InjuryPageSheet, {
            types: [INJURY_PAGE_TYPE],
            makeDefault: true,
            label: 'Bibliosoph Injury'
        });

        // Criticals and fumbles: the same typed-page treatment, minus
        // treatment (you do not treat a critical) and plus roll modifiers.
        Object.assign(CONFIG.JournalEntryPage.dataModels, {
            [OUTCOME_PAGE_TYPE]: OutcomePageModel
        });
        foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE.ID, OutcomePageSheet, {
            types: [OUTCOME_PAGE_TYPE],
            makeDefault: true,
            label: 'Bibliosoph Critical or Fumble'
        });

        // Inspiration cards: drawn for a point, spent to use.
        Object.assign(CONFIG.JournalEntryPage.dataModels, {
            [INSPIRATION_PAGE_TYPE]: InspirationPageModel
        });
        foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE.ID, InspirationPageSheet, {
            types: [INSPIRATION_PAGE_TYPE],
            makeDefault: true,
            label: 'Bibliosoph Inspiration Card'
        });
    } catch (error) {
        logBib('Failed to register the injury page subtype', error?.message, false, false);
    }

    // Module initialization - Blacksmith registration is now handled by the proper API import
    logBib('Module initialized', '', false, false);
});

// ***** READY *****
// Hook that fires after everything is loaded and ready
// Note: Toolbar registration is now handled in the Blacksmith API registration block above

// ***** MODULE DISABLE *****
// Clean up toolbar tools when module is disabled
Hooks.once('disableModule', (moduleId) => {
    if (moduleId === 'coffee-pub-bibliosoph') {
        unregisterToolbarTools();
        const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
        blacksmith?.unregisterWindow?.('bibliosoph-messages');
        blacksmith?.unregisterWindow?.('bibliosoph-messages-lite');
        // Popouts float free of the main window, so nothing else closes them.
        import('./window-messages-lite.js')
            .then((m) => m.closeAllMessagesLite?.())
            .catch(() => { /* module never loaded — nothing to close */ });
        blacksmith?.unregisterMenubarTool?.('bibliosoph-messages');
    }
});

// ************************************
// ** READY
// ************************************

// Hook that fires after module loads

Hooks.on("ready", async () => {

    if (game.modules.get('coffee-pub-blacksmith')?.active && typeof BlacksmithAPI.waitForReady === 'function') {
        await BlacksmithAPI.waitForReady();
    }

    // ********  VERIFY BLACKSMITH  **********
    // Verify Blacksmith API is available via global objects
    if (!BlacksmithUtils?.getSettingSafely) {
        console.error("BIBLIOSOPH | Blacksmith API not fully initialized! Module may not function properly.");
        console.warn("BIBLIOSOPH | Will use fallback values for settings");
        return;
    }

    // Use Blacksmith's safe console logging - system message for initialization
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Initializing Blacksmith connections...", "", false, false);
    
    if (game.modules.get("coffee-pub-blacksmith")?.active) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Coffee Pub Blacksmith is installed and connected.", "", false, false);
    } else {
        // This is an error that breaks functionality - use console.error
        console.error("BIBLIOSOPH | Coffee Pub Blacksmith does not seem to be enabled. It is required for Coffee Pub Bibliosoph to function. Please enable it in your options.");
        return;
    }
    // Do these things after the client has loaded
    // BIBLIOSOPH.DEBUGON = game.settings.get(MODULE.ID, 'globalDebugMode');
    // Get the variables ready
    resetBibliosophVars();
    
    // Create safe settings helper function (final version)
    const getSetting = (settingKey, defaultValue) => {
        if (BlacksmithUtils?.getSettingSafely) {
            // Use Blacksmith's safe settings access
            return BlacksmithUtils.getSettingSafely(MODULE.ID, settingKey, defaultValue);
        } else {
            // Fallback to standard FoundryVTT settings
            try {
                return game.settings.get(MODULE.ID, settingKey) ?? defaultValue;
            } catch (error) {
                // This is an error that could break functionality - keep as console.warn
                console.warn(`BIBLIOSOPH | Error getting setting ${settingKey}, using fallback:`, error);
                return defaultValue;
            }
        }
    };

    // Create safe settings setter function
    const setSetting = (settingKey, value) => {
        if (BlacksmithUtils?.setSettingSafely) {
            // Use Blacksmith's safe settings modification
            return BlacksmithUtils.setSettingSafely(MODULE.ID, settingKey, value);
        } else {
            // Fallback to standard FoundryVTT settings
            try {
                return game.settings.set(MODULE.ID, settingKey, value);
            } catch (error) {
                // This is an error that could break functionality - keep as console.warn
                console.warn(`BIBLIOSOPH | Error setting setting ${settingKey}:`, error);
                return false;
            }
        }
    };

    // Investigation and Inspiration used to bind a user-chosen macro whose
    // execute() this module overwrote. Both are toolbar buttons now
    // (window.triggerInvestigation / window.triggerInspiration), so there is
    // nothing to bind, nothing to rebind on settings change, and no macro
    // name to get wrong.

});




// ************************************
// ** BLACKSMITH HOOK LISTENER
// ************************************

Hooks.on('blacksmithUpdated', (newBlacksmith) => {
    if (newBlacksmith) {
        // This is debug info - only log if really needed for troubleshooting
        // console.log("BIBLIOSOPH | Blacksmith data updated:", newBlacksmith);
        
        // Re-verify API is ready - useful if this is the first time Blacksmith is fully initialized
        if (BlacksmithUtils?.getSettingSafely) {
            // This is debug info - only log if really needed for troubleshooting
            // console.log("BIBLIOSOPH | Blacksmith API now fully available via blacksmithUpdated hook");
            // console.log("BIBLIOSOPH | getSettingSafely available:", typeof BlacksmithUtils.getSettingSafely);
            // console.log("BIBLIOSOPH | setSettingSafely available:", typeof BlacksmithUtils.setSettingSafely);
        }
    }
});

// Card decoration that depends on WHO IS LOOKING lives in a registered
// render pass, not here — see registerCardActions(). A parts card
// re-renders from its stored composition a tick after Foundry paints it,
// and the swap throws away whatever a renderChatMessageHTML hook did.

// ==================================================================
// ===== CARD BUTTONS ===============================================
// ==================================================================
//
// Registered once per client at startup. Nothing here may assume the
// clicker is a GM: hiding a control is presentation, and any client can
// fire an action whatever its copy of the card looks like. Every handler
// re-checks what it is about to do.

const INJURY_APPLY_ACTION = 'apply-injury';
const OUTCOME_APPLY_ACTION = 'apply-outcome';
const TREAT_ACTION = 'treat-affliction';
const INSPIRATION_USE_ACTION = 'use-inspiration';

function registerCardActions() {
    const chatCards = getChatCardsAPI();
    if (!chatCards) return;

    // APPLY AN INJURY. The record lives in the message's own flags rather
    // than in the button's value: the applier needs modifiers, duration and
    // source, which is more than belongs in an attribute.
    chatCards.registerAction(MODULE.ID, INJURY_APPLY_ACTION, async ({ message }) => {
        if (!game.user.isGM) {
            showBibToast('Not Yours to Apply', 'Only the GM can apply an injury.', 'fa-solid fa-user-shield');
            return;
        }
        const effect = message?.getFlag?.(MODULE.ID, 'injury');
        if (!effect) return logBib('Injury card carried no effect data', '', false, false);

        // Automation cards know exactly who took the damage; a card rolled
        // from the picker falls back to click-time targeting.
        let explicitActors = null;
        if (effect.targetActorId || effect.targetTokenId) {
            const targetActor = canvas?.tokens?.get(effect.targetTokenId ?? '')?.actor
                ?? game.actors.get(effect.targetActorId ?? '');
            if (targetActor) explicitActors = [targetActor];
        }

        const applied = await applyStatusToTokens(buildInjuryApplyConfig(effect, explicitActors));
        if (!applied.length) return;
        await stampCardActions(message, `Applied to ${applied.join(', ')}`);
    });

    // APPLY A CRITICAL OR FUMBLE. The GM does it directly; anyone else asks
    // the GM to, because applying effects and rewriting the card both need
    // rights a player does not have.
    chatCards.registerAction(MODULE.ID, OUTCOME_APPLY_ACTION, async ({ message, value }) => {
        const state = message?.getFlag?.(MODULE.ID, 'outcome');
        if (!state) return logBib('Outcome card carried no state', '', false, false);
        if (state.picksRemaining <= 0) return;

        if (game.user.isGM) {
            await applyOutcomePick(message, state, value ?? '');
            return;
        }

        const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
        if (!sockets || !game.users.activeGM) {
            showBibToast('Nothing Applied', 'No GM is connected to resolve that choice.', 'fa-solid fa-triangle-exclamation');
            return;
        }
        try {
            await sockets.waitForReady();
            await sockets.emit(SOCKET_OUTCOME_APPLY, { messageId: message.id, value: value ?? '', userId: game.user.id });
        } catch (error) {
            logBib('Outcome apply relay failed', error?.message, false, false);
            showBibToast('Nothing Applied', 'That choice could not be sent to the GM.', 'fa-solid fa-triangle-exclamation');
        }
    });

    // SPEND AN INSPIRATION CARD. Playing it is the holder's call, and
    // applying it only ever touches actors — no chat message to rewrite
    // beyond this card, which its own author owns.
    chatCards.registerAction(MODULE.ID, INSPIRATION_USE_ACTION, async ({ message, value }) => {
        const state = message?.getFlag?.(MODULE.ID, 'inspiration');
        if (!state) return logBib('Inspiration card carried no state', '', false, false);
        if (state.spent) return;
        await useInspirationCard(message, state, value ?? '');
    });

    // TREAT ONE AFFLICTION. The button carries the effect id; everything
    // else about that row is on the message.
    chatCards.registerAction(MODULE.ID, TREAT_ACTION, async ({ message, value }) => {
        const row = checkUpRow(message, value);
        if (!row) return logBib('Treat button carried no row state', String(value), false, false);
        // Only injuries are player-treatable, and only by rolling. The
        // affordance pass hides the rest; this is the check that decides.
        if (!game.user.isGM && row.kind !== 'injury') {
            showBibToast('Not Yours to Clear', 'Only the GM can dismiss that.', 'fa-solid fa-user-shield');
            return;
        }
        await treatAffliction(message, row);
    });

    // WHO MAY TREAT WHAT, and how it would go for them. Both depend on the
    // reader, so both are decided in the reader's own browser: a
    // composition is written once and read by everybody.
    //
    // A render pass rather than a renderChatMessageHTML hook — a parts card
    // re-renders from its stored composition a tick after Foundry paints
    // it, and that swap discards anything a hook decorated.
    chatCards.registerRenderPass(MODULE.ID, 'treat-affordance', ({ message, root }) => {
        const buttons = root.querySelectorAll(`button[data-blacksmith-action="${TREAT_ACTION}"]`);
        for (const button of buttons) {
            const row = checkUpRow(message, button.dataset.blacksmithValue);
            if (!row) continue;
            // Crit, fumble and loose-condition rows are the GM's to dismiss.
            // Removing the control is the whole signal; the row stays, so a
            // player still sees what they are carrying.
            if (!game.user.isGM && row.kind !== 'injury') {
                button.remove();
                continue;
            }
            button.dataset.tooltip = game.user.isGM
                ? (row.kind === 'injury' ? `Treat instantly — GM discretion, no roll.${gmDcNote(row)}`
                    : row.kind === 'crit' ? 'Dismiss this critical (GM only).'
                    : row.kind === 'fumble' ? 'Dismiss this fumble (GM only).'
                    : 'Remove this effect and unwind its condition (GM only).')
                : buildTreatTooltip(row);
            button.dataset.tooltipDirection = 'UP';
        }
        // GM notes ride the row tooltips, and only ever on a GM's client:
        // the card carries the journal reference, never the text.
        if (game.user.isGM) appendGmNotesToTooltips(message, root);
    });
}

/**
 * One Check-Up row's state, by effect id, with the patient folded in.
 *
 * @returns {object|null} { actorId, tokenId, effectId, kind, name, dc, sourceUuid }
 */
function checkUpRow(message, effectId) {
    const state = message?.getFlag?.(MODULE.ID, 'checkup');
    const row = state?.rows?.[effectId ?? ''];
    if (!row) return null;
    return { ...row, actorId: state.actorId, tokenId: state.tokenId, effectId };
}

// ************************************
// ** TRIGGER Injury 
// ************************************

// -----------------------------------------------------------------------------------------------------------------



// Crit/fumble detection lives in manager-roll-toasts.js (Blacksmith rolls API).

// ************************************
// ** PUBLISH Chat Cards
// ************************************

async function publishChatCard() {
    // Build the card
    let parts = null;
    if (BIBLIOSOPH.CARDTYPEINVESTIGATION) {
        // INVESTIGATION (new flow: narrative + slots + per-rarity tables)
        parts = await createChatCardInvestigation();
    }
    // Criticals, fumbles, inspiration and INJURIES no longer come through
    // here: each builds its own card straight from its typed compendium
    // (createChatCardOutcome, the inspiration deck, createChatCardInjury).
    // This function is now the investigation path only.
    else
    {
        // NOTHING
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Card Type: No Card Type Set", "", true, false);
    }
    // If there is a composition, Blacksmith renders and posts it.
    // (Whisper delivery was removed with the legacy private messages — the
    // unified Messages window handles private conversations now.)
    if (parts?.length) {
        await postCard({
            type: 'investigation',
            theme: getSettingSafe('cardThemeInvestigation', 'default'),
            parts
        });
    }

    // Reset everything for the next time - This is a system message
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "The card has been delivered, so we are clearing our variables for next time.", "", false, false);
    resetBibliosophVars();
}


// ************************************
// ** CREATE Injury Card
// ************************************

async function createChatCardInjury(category, target = null, { title = null } = {}) {

    // Set the defaults
    var compendiumName = game.settings.get(MODULE.ID, 'injuryCompendium');
    var blnInjuryImageEnabled = game.settings.get(MODULE.ID, 'injuryImageEnabled');
    let strCategory = category; // we will use this to fileter the compendium
    var strSound = game.settings.get(MODULE.ID, 'injurySound');
    var strVolume = game.settings.get(MODULE.ID, 'injurySoundVolume');
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeInjury');
    var strIconStyle = "fa-droplet"; // default... specific overrides happen below.
    var iconSubStyle = "";
    var strType = BIBLIOSOPH.CARDTYPE + " Injury";

    // Set the defaults
    var strInjuryCategory = "";
    var intOdds = "";
    var strInjuryTitle = "";
    var strInjuryImageTitle = "";
    var strInjuryImage = "";
    var strInjuryDescription = "";
    var strInjuryTreatment =  "";
    var strInjurySeverity =  "";
    var intInjuryTreatmentDC = null;
    var intInjuryDamage = "";
    var strInjuryDamage = "";
    var intInjuryDuration = "";
    var strInjuryDuration = "";
    var strInjuryAction =  "";
    var strStatusEffect = "";

    // get the journal data
    let objInjuryData = await getJournalCategoryPageData(compendiumName, strCategory, title);
    if (!objInjuryData) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "objInjuryData is null or undefined", "", true, false);
    } else {
        strInjuryCategory = objInjuryData.category;
        intOdds = objInjuryData.odds; // weights which injury gets picked
        strInjuryTitle = objInjuryData.title;
        strInjuryImageTitle = objInjuryData.imagetitle; // caption under the card art
        strInjuryImage = objInjuryData.image;
        strInjuryDescription = objInjuryData.description;
        strInjuryTreatment = objInjuryData.treatment;
        strInjurySeverity = objInjuryData.severity; // drives the treatment DC (minor 10 / moderate 15 / major 20)
        // Optional authored override, e.g. "<strong>treatmentdc:</strong> 18"
        // in the page metadata. Wins over the severity ladder when present.
        intInjuryTreatmentDC = Number(
            objInjuryData.treatmentdc ?? objInjuryData.treatmentDC ?? objInjuryData['treatment dc']
        );
        if (!Number.isFinite(intInjuryTreatmentDC) || intInjuryTreatmentDC <= 0) intInjuryTreatmentDC = null;
        intInjuryDamage = objInjuryData.damage;
        intInjuryDuration = objInjuryData.duration;
        strStatusEffect = objInjuryData.statuseffect;
        if (!strInjuryCategory) {
            strInjuryCategory = "General";
            strIconStyle = "fa-droplet";
        } else {
            // Data was returned
            switch(strInjuryCategory.toLowerCase()) {
                case "acid":
                    iconSubStyle = "fa-splotch";
                    break;
                case "bludgeoning":
                    iconSubStyle = "fa-axe-battle";
                    break;
                case "cold":
                    iconSubStyle = "fa-snowflake";
                    break;
                case "fire":
                    iconSubStyle = "fa-fire";
                    break;
                case "force":
                    iconSubStyle = "fa-wind";
                    break;
                case "lightning":
                    iconSubStyle = "fa-bolt-lightning";
                    break;
                case "necrotic":
                    iconSubStyle = "fa-scythe";
                    break;
                case "piercing":
                    iconSubStyle = "fa-bow-arrow";
                     break;
                case "poison":
                    iconSubStyle = "fa-flask-round-poison";
                    break;
                case "psychic":
                    iconSubStyle = "fa-brain";
                    break;
                case "radiant":
                    iconSubStyle = "fa-bullseye";
                    break;
                case "slashing":
                    iconSubStyle = "fa-knife-kitchen";                    
                    break;
                case "thunder":
                    iconSubStyle = "fa-cloud-bolt";
                    break;
                default:
                    iconSubStyle = "fa-droplet";
           }
        }
        
        if (!strInjuryTitle) {
            strInjuryTitle = "Injury Label Missing";
        } else {
            // Data was returned
        }
        
        if (!strInjuryImage) {
            strInjuryImage = "icons/skills/wounds/injury-pain-body-orange.webp";
        } else {
            // Data was returned
        }
        
        if (!intInjuryDamage) {
            intInjuryDamage = "0";
        } else {
            // Damage is a percentage of MAX HP. The card names the share
            // rather than a hit point count, because the count depends on
            // who is reading it — and shows the real number for the token
            // the card is aimed at, when it is aimed at one.
            const hurtActor = game.actors.get(target?.actorId ?? '')
                ?? canvas?.tokens?.get(target?.tokenId ?? '')?.actor
                ?? null;
            const real = hurtActor ? damageFor(intInjuryDamage, hurtActor.system?.attributes?.hp) : 0;
            strInjuryDamage = real > 0
                ? `${real} Hit Points (${intInjuryDamage}% of max)`
                : `${intInjuryDamage}% of max Hit Points`;
        }
        
        if (!strInjuryDescription) {
            strInjuryDescription = "The description is missing.";
        } else {
            // Data was returned
        }
        
        if (!strInjuryTreatment) {
            strInjuryTreatment = "There is no known treatment.";
        } else {
            // Data was returned
        }
        
        // The apply-button label is derived, not authored — it was always
        // "Apply the {category} Injury" in the data, so the field is gone.
        if (!strInjuryAction) {
            strInjuryAction = strInjuryCategory && strInjuryCategory !== 'General'
                ? `Apply the ${strInjuryCategory} Injury`
                : "Apply Injury to Token";
        }
        
        if (intInjuryDuration === undefined || intInjuryDuration === null || intInjuryDuration === "") {
            intInjuryDuration = 0;
            strInjuryDuration = "Permanent";
        } else {
            // Data was returned
            // Convert seconds to words
            strInjuryDuration = BlacksmithUtils.convertSecondsToString(intInjuryDuration) || "Unknown Duration";
        }

        if (!strStatusEffect) {
            strStatusEffect = "none";
        } else {
            // Data was returned
        }

    }

    // Automation knows who took the damage — bind the Apply button to them
    // and name them on it. Manual selector cards keep click-time targeting.
    let strTargetName = "";
    if (target?.actorId || target?.tokenId) {
        const targetToken = canvas?.tokens?.get(target.tokenId ?? '');
        const targetActor = game.actors.get(target.actorId ?? '') ?? targetToken?.actor;
        strTargetName = targetToken?.name || targetActor?.name || "";
    }

    // Build Effect Array — carries everything the Apply button needs,
    // including the description so the applied effect explains itself.
    const EFFECTDATA = {
        name: strInjuryTitle,
        icon: strInjuryImage,
        damage: intInjuryDamage,
        duration: intInjuryDuration,
        statuseffect: strStatusEffect,
        category: strInjuryCategory || 'General',
        severity: strInjurySeverity || null,
        treatmentDC: intInjuryTreatmentDC,
        modifiers: objInjuryData?.modifiers ?? [],
        tick: Number(objInjuryData?.tick) || 0,
        expiry: objInjuryData?.expiry || 'heal',
        sourceUuid: objInjuryData?.sourceUuid ?? null,
        targetActorId: target?.actorId ?? null,
        targetTokenId: target?.tokenId ?? null,
        description: [
            strInjuryDescription,
            strInjuryTreatment ? `<strong>Treatment:</strong> ${strInjuryTreatment}` : ''
        ].filter(Boolean).join('<br><br>'),
    };

    // The image can be turned off in settings; the caption goes with it.
    const cardImage = blnInjuryImageEnabled ? strInjuryImage : "";

    // What the card SAYS about the condition. A real dnd5e condition wins;
    // otherwise the flavour text stands in for the injuries whose
    // "condition" was never one.
    const conditionLine = (strStatusEffect !== 'none' ? strStatusEffect : (objInjuryData?.flavor || 'none')).toUpperCase();

    BlacksmithUtils.playSound(strSound, strVolume);

    // `compose` rather than a finished parts array alone: the auto-apply
    // path needs the same card built a second way — stamp instead of
    // button — and rebuilding it from the same inputs is what stops the
    // two versions drifting.
    const compose = (options) => composeInjuryCard({
            title: strInjuryTitle,
            icon: `fa-solid ${strIconStyle}`,
            category: strInjuryCategory,
            categoryIcon: `fa-solid ${iconSubStyle}`,
            image: cardImage,
            imageCaption: cardImage ? (strInjuryImageTitle || "") : "",
            description: strInjuryDescription,
            modifiers: (objInjuryData?.modifiers ?? []).map(describeModifier).filter(Boolean),
            treatment: strInjuryTreatment,
            duration: strInjuryDuration,
            damage: strInjuryDamage,
            condition: conditionLine,
            buttonLabel: strTargetName ? `Apply to ${strTargetName}` : strInjuryAction,
            buttonIcon: `fa-solid ${strIconStyle}`
        }, options);

    return { parts: compose(), compose, effect: EFFECTDATA };
}

/**
 * The injury card as a composition.
 *
 * @param {object} injury - already-resolved display strings
 * @param {object} [options]
 * @param {string} [options.appliedTo] - names to stamp instead of the
 *        Apply button, for a card that was applied before it was posted
 * @returns {Array<object>} parts, in render order
 */
function composeInjuryCard(injury, { appliedTo = '' } = {}) {
    const parts = [{ part: 'header', icon: injury.icon, title: injury.title }];
    if (injury.category) {
        parts.push({ part: 'section', icon: injury.categoryIcon, label: injury.category });
    }
    if (injury.image) {
        parts.push({ part: 'image', src: injury.image, alt: injury.title, caption: injury.imageCaption });
    }
    if (injury.description) {
        parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: injury.description }] });
    }
    // Roll penalties, spelled out the same way the crit/fumble cards do.
    if (injury.modifiers?.length) {
        parts.push({ part: 'notes', items: injury.modifiers.map((text) => ({ icon: 'fa-solid fa-dice-d20', text })) });
    }

    // Treatment leads the panel and the rest of the injury's mechanics
    // follow it as statements — a panel row is a line of prose with an
    // icon, not a label in one column and a value in another.
    const rows = [];
    if (injury.duration) rows.push({ icon: 'fa-solid fa-hourglass-half', label: injury.duration });
    if (injury.damage) rows.push({ icon: 'fa-solid fa-heart-crack', label: injury.damage });
    if (injury.condition && injury.condition !== 'NONE') {
        rows.push({ icon: 'fa-solid fa-sparkles', label: injury.condition });
    }
    if (injury.treatment || rows.length) {
        parts.push({
            part: 'panel',
            icon: 'fa-solid fa-heart-pulse',
            label: 'Treatment',
            intro: injury.treatment,
            rows
        });
    }

    // Applying is the GM's call, so the controls are theirs. `readableBy`
    // decides what RENDERS — the handler checks permission again, because
    // any client can fire an action whatever its copy of the card shows.
    parts.push(appliedTo
        ? { part: 'band', text: `Applied to ${appliedTo}`, icon: 'fa-solid fa-check', tone: 'positive' }
        : {
            part: 'actions',
            readableBy: 'gm',
            buttons: [{
                moduleId: MODULE.ID,
                action: INJURY_APPLY_ACTION,
                label: injury.buttonLabel,
                icon: injury.buttonIcon,
                variant: 'primary'
            }]
        });

    return parts;
}

// ************************************
// ** CREATE Investigation Card (new flow: narrative + slots + per-rarity tables)
// ************************************
async function createChatCardInvestigation() {
    // Adaptive toast, not a Foundry notification — every user-facing notice
    // in this module goes through the Blacksmith toast so they all look and
    // behave the same.
    showBibToast(
        game.i18n.localize("coffee-pub-bibliosoph.investigationNotificationStart"),
        '',
        'fa-solid fa-eye'
    );
    logBib('Investigation check started', '', true, false);
    const investigationOdds = Number(game.settings.get(MODULE.ID, 'investigationOdds')) || 20;
    const maxSlots = Math.max(1, Math.min(20, Number(game.settings.get(MODULE.ID, 'investigationDice')) || 3));

    let narrativeJson;
    try {
        narrativeJson = await getInvestigationNarrative();
    } catch (e) {
        // This one aborts the whole card, so the table would otherwise see
        // nothing happen at all — say so out loud, not just in the console.
        logBib('Could not load investigation narrative. Check resources/investigation-narrative.json.', e?.message ?? String(e), false, false);
        showBibToast('Investigation Failed', 'Could not load the investigation narrative file.', 'fa-solid fa-triangle-exclamation');
        return null;
    }

    const foundNothingEntries = narrativeJson.foundNothing ?? [];
    const foundSomethingEntries = narrativeJson.foundSomething ?? [];
    const pickEntry = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : { title: "", tags: [], description: "" });

    const actor = game.user.character ?? canvas.tokens?.controlled?.[0]?.actor;

    // The card names the CHARACTER who searched, not the person holding
    // the mouse — it is a thing that happened in the fiction. The user is
    // the fallback only when there is no character to name at all.
    const searcher = actor
        ? { img: actor.img || '', name: actor.name }
        : { img: game.user.avatar, name: game.user.name };

    // Roll: find coins or not (independent of items)
    let coinsFound = null;
    let coinsSummaryLine = "";
    const coinsOdds = Math.max(0, Math.min(100, Number(game.settings.get(MODULE.ID, 'investigationCoinsOdds')) ?? 20));
    const rollCoins = await new Roll("1d100").evaluate();
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) BlacksmithUtils.rollCoffeePubDice(rollCoins);
    if (rollCoins.total <= coinsOdds) {
        const maxPp = Math.max(0, Number(game.settings.get(MODULE.ID, 'investigationCoinsMaxPlatinum')) ?? 0);
        const maxGp = Math.max(0, Number(game.settings.get(MODULE.ID, 'investigationCoinsMaxGold')) ?? 0);
        const maxSp = Math.max(0, Number(game.settings.get(MODULE.ID, 'investigationCoinsMaxSilver')) ?? 0);
        const maxEp = Math.max(0, Number(game.settings.get(MODULE.ID, 'investigationCoinsMaxElectrum')) ?? 0);
        const maxCp = Math.max(0, Number(game.settings.get(MODULE.ID, 'investigationCoinsMaxCopper')) ?? 0);
        const pp = maxPp > 0 ? Math.floor(Math.random() * (maxPp + 1)) : 0;
        const gp = maxGp > 0 ? Math.floor(Math.random() * (maxGp + 1)) : 0;
        const sp = maxSp > 0 ? Math.floor(Math.random() * (maxSp + 1)) : 0;
        const ep = maxEp > 0 ? Math.floor(Math.random() * (maxEp + 1)) : 0;
        const cp = maxCp > 0 ? Math.floor(Math.random() * (maxCp + 1)) : 0;
            if (pp + gp + sp + ep + cp > 0) {
            coinsFound = { pp, gp, ep, sp, cp };
            const coinParts = [];
            if (pp) coinParts.push(`${pp} pp`);
            if (gp) coinParts.push(`${gp} gp`);
            if (ep) coinParts.push(`${ep} ep`);
            if (sp) coinParts.push(`${sp} sp`);
            if (cp) coinParts.push(`${cp} cp`);
            // Through Blacksmith rather than writing `system.currency.*`
            // ourselves: that path is dnd5e-shaped and unlocked, and two
            // finds landing at once would each read the same balance and
            // one would win. grantCurrency takes the lock and applies a
            // delta. Zero denominations are dropped for us.
            if (actor) {
                const granted = await grantCurrency(actor, { pp, gp, ep, sp, cp });
                coinsSummaryLine = granted
                    ? game.i18n.format("coffee-pub-bibliosoph.investigationCoinsSummary", { coins: coinParts.join(", "), character: actor.name })
                    : game.i18n.format("coffee-pub-bibliosoph.investigationCoinsSummaryNoActor", {});
            } else {
                coinsSummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationCoinsSummaryNoActor", {});
            }
        }
    }

    // Roll: find something (items) or not — 1d100, or 1d100 + INT + PROF when player skill is used
    const rollFind = await new Roll("1d100").evaluate();
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) BlacksmithUtils.rollCoffeePubDice(rollFind);
    let findItemsRollSucceeds;
    if (game.settings.get(MODULE.ID, 'investigationPlayerSkill') && actor && game.system?.id === "dnd5e") {
        const intMod = Number(actor.system?.abilities?.int?.mod) ?? 0;
        const prof = Number(actor.system?.attributes?.prof) ?? 0;
        const findTotal = rollFind.total + intMod + prof;
        findItemsRollSucceeds = findTotal > (100 - investigationOdds);
    } else {
        findItemsRollSucceeds = rollFind.total <= investigationOdds;
    }
    if (!findItemsRollSucceeds) {
        // No items this time; use "found something" narrative if they found coins, else "found nothing"
        const foundAnything = !!coinsFound;
        const entry = pickEntry(foundAnything ? foundSomethingEntries : foundNothingEntries);
        BlacksmithUtils.playSound(foundAnything ? "modules/coffee-pub-blacksmith/sounds/chest-treasure.mp3" : "modules/coffee-pub-blacksmith/sounds/chest-open.mp3", "0.7");
        return composeInvestigationCard({
            searcher,
            entry,
            fallbackTitle: foundAnything ? "Search Results" : "Nothing Found",
            itemsByRarity: [],
            coinsFound,
            coinsSummaryLine,
            inventorySummaryLine: ""
        });
    }

    // Roll number of slots
    const rollSlots = await new Roll(`1d${maxSlots}`).evaluate();
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) BlacksmithUtils.rollCoffeePubDice(rollSlots);
    const numSlots = Math.max(1, Math.min(maxSlots, rollSlots.total));

    // Per-rarity odds (normalize to 100 for bands)
    const rarityKeys = ["Common", "Uncommon", "Rare", "VeryRare", "Legendary"];
    const oddsRaw = rarityKeys.map((r) => {
        const key = "investigationOdds" + r;
        return Math.max(0, Number(game.settings.get(MODULE.ID, key)) || 0);
    });
    const sum = oddsRaw.reduce((a, b) => a + b, 0) || 1;
    let cumul = 0;
    const bands = [0];
    oddsRaw.forEach((o) => {
        cumul += (o / sum) * 100;
        bands.push(cumul);
    });
    if (bands[bands.length - 1] < 100) bands[bands.length - 1] = 100;

    const foundItems = [];

    for (let i = 0; i < numSlots; i++) {
        const rollRarity = await new Roll("1d100").evaluate();
        if (game.settings.get(MODULE.ID, 'showDiceRolls')) BlacksmithUtils.rollCoffeePubDice(rollRarity);
        const r100 = Math.min(100, Math.max(0, rollRarity.total));
        let bandIndex = rarityKeys.length - 1;
        for (let b = 0; b < rarityKeys.length; b++) {
            if (r100 >= bands[b] && r100 < bands[b + 1]) {
                bandIndex = b;
                break;
            }
        }
        const rarityLabel = rarityKeys[bandIndex];
        const tableName = game.settings.get(MODULE.ID, "investigationTable" + rarityLabel);
        if (!tableName || tableName === "-- Choose a Roll Table --") continue;
        const table = game.tables.getName(tableName);
        if (!table) continue;
        const rollResult = await table.roll();
        if (game.settings.get(MODULE.ID, 'showDiceRolls') && rollResult.roll) BlacksmithUtils.rollCoffeePubDice(rollResult.roll);
        const result = rollResult.results?.[0];
        const documentUuid = result?.documentUuid;
        if (!documentUuid) continue;
        let itemDoc;
        try {
            itemDoc = await fromUuid(documentUuid);
        } catch (_) {
            continue;
        }
        if (!(itemDoc instanceof Item)) continue;
        const name = itemDoc.name || result?.name || result?.text || "Item";
        const img = result?.img ?? itemDoc.img ?? "";
        const rarity = itemDoc.system?.rarity?.value ?? rarityLabel;

        // Collected, not written: the whole find goes to the actor in one
        // grant below. A search that turns up three arrows is three arrows,
        // and adding them one at a time is three writes to one Actor that
        // land as three rows of one.
        foundItems.push({ name, img, uuid: documentUuid, rarity });
    }

    // Into the inventory in a single, merging grant.
    //
    // Blacksmith owns this because merging is harder than it looks: the row
    // a payload BECOMES is not the payload — creation fills schema defaults
    // and normalises properties — so comparing the two never matches. We
    // used to build item data by hand and create it directly, which is
    // exactly the shape that fails.
    let inventoryFailures = [];
    if (actor && foundItems.length) {
        inventoryFailures = await grantFoundItems(actor, foundItems);
        if (inventoryFailures.length) {
            const names = [...new Set(inventoryFailures)].join(', ');
            logBib(`Could not add ${names} to ${actor.name}'s inventory`, '', false, false);
            showBibToast('Items Not Added', `${names} could not be added to ${actor.name} — add by hand.`, 'fa-solid fa-sack-xmark');
        }
    }

    const entry = pickEntry(foundSomethingEntries);
    let inventorySummaryLine = "";
    if (foundItems.length && actor) {
        // Count what actually LANDED, not what was found. The card still
        // lists everything — the search turned it up either way — but the
        // line claiming it reached the sheet has to be true, or the sheet
        // and the card disagree with nobody the wiser.
        const failed = [...inventoryFailures];
        const landed = foundItems.filter((item) => {
            const at = failed.indexOf(item.name);
            if (at === -1) return true;
            failed.splice(at, 1);       // one failure retires one copy
            return false;
        });
        if (landed.length) {
            const counts = {};
            landed.forEach((f) => { counts[f.name] = (counts[f.name] || 0) + 1; });
            const parts = Object.entries(counts).map(([n, c]) => (c > 1 ? `${c} ${n}` : n));
            inventorySummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationInventorySummary", { items: parts.join(", "), character: actor.name });
        }
    } else if (foundItems.length && !actor) {
        inventorySummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationInventorySummaryNoActor", {});
    }

    const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Other"];
    const RARITY_ICONS = {
        "Common": "fa-box",
        "Uncommon": "fa-treasure-chest",
        "Rare": "fa-axe-battle",
        "Very Rare": "fa-trophy",
        "Legendary": "fa-gem",
        "Other": "fa-crate-apple",
    };
    const normalizeRarity = (s) => (s && typeof s === "string") ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "Common";
    const byRarity = {};
    foundItems.forEach((item) => {
        const r = normalizeRarity(item.rarity);
        const key = RARITY_ORDER.includes(r) ? r : "Other";
        if (!byRarity[key]) byRarity[key] = [];
        byRarity[key].push(item);
    });
    const itemsByRarity = RARITY_ORDER.filter((r) => byRarity[r]?.length).map((rarity) => ({
        rarity,
        icon: RARITY_ICONS[rarity] || RARITY_ICONS["Other"],
        items: byRarity[rarity],
    }));

    BlacksmithUtils.playSound("modules/coffee-pub-blacksmith/sounds/chest-treasure.mp3", "0.7");
    return composeInvestigationCard({
        searcher,
        entry,
        fallbackTitle: "Search Results",
        itemsByRarity,
        coinsFound,
        coinsSummaryLine,
        inventorySummaryLine
    });
}

/**
 * The investigation card as a composition of Blacksmith parts.
 *
 * Both outcomes come through here — a search that turned up nothing is
 * the same card with no findings — so the two cannot drift apart.
 *
 * @returns {Array<object>} parts, in render order
 */
function composeInvestigationCard({ searcher, entry, fallbackTitle, itemsByRarity = [],
                                    coinsFound = null, coinsSummaryLine = '', inventorySummaryLine = '' }) {
    const parts = [
        { part: 'header', icon: 'fa-solid fa-eye', title: 'Investigation' },
        { part: 'identity', img: searcher.img, name: searcher.name },
        { part: 'section', icon: iconClass(entry?.icon), label: entry?.title || fallbackTitle }
    ];
    if (entry?.description) {
        parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: entry.description }] });
    }

    // Coins as tiles rather than a run of prose: a denomination over a
    // count is exactly the caption-over-value shape, and it stays
    // readable whether they found one kind or all five.
    if (coinsFound) {
        const COIN_LABELS = { pp: 'Platinum', gp: 'Gold', ep: 'Electrum', sp: 'Silver', cp: 'Copper' };
        const items = Object.entries(COIN_LABELS)
            .filter(([key]) => Number(coinsFound[key]) > 0)
            .map(([key, label]) => ({ label, value: String(coinsFound[key]) }));
        if (items.length) {
            parts.push({ part: 'section', icon: 'fa-solid fa-coins', label: 'Coins' });
            parts.push({ part: 'tiles', items });
        }
    }

    // One section and one row list per rarity. `uuid` makes each label a
    // real document link, so the card no longer builds @UUID syntax by
    // hand and a renamed item still resolves.
    for (const group of itemsByRarity) {
        parts.push({ part: 'section', icon: `fa-solid ${group.icon}`, label: group.rarity });
        parts.push({
            part: 'rows',
            items: group.items.map((item) => ({ img: item.img, uuid: item.uuid, label: item.name }))
        });
    }

    const notes = [];
    if (inventorySummaryLine) notes.push({ icon: 'fa-solid fa-bag-shopping', text: inventorySummaryLine });
    if (coinsSummaryLine) notes.push({ icon: 'fa-solid fa-coins', text: coinsSummaryLine });
    if (notes.length) parts.push({ part: 'notes', items: notes });

    return parts;
}


// (Legacy whisper player-list/recipient utilities removed — the unified
// Messages window owns private conversations now.)

// ************************************
// ** UTILITY Controlled Tokens info ID
// ************************************

function getUserActiveTokenDetails(playerId) {
    // Find the user object for the given player ID
    const user = game.users.get(playerId);
    if (!user) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "User not found with ID: " + playerId, "", false, false);
        return null;
    }

    // Find all tokens on the current scene and filter for the first one owned by the user
    const ownedToken = canvas.tokens.placeables.find(token => token.actor && token.document.testUserPermission(user, "OWNER"));
    if (ownedToken) {
        // Return the token's name, ID, token image, and character portrait
        return {
            name: ownedToken.name,
            id: ownedToken.id,
            tokenImage: ownedToken.document.texture.src,
            characterPortrait: ownedToken.actor.img,
            playerPortrait: user.avatar
        };
    } else {
        // Handle the case where the user does not own any tokens
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "No owned tokens found for user with ID: " + playerId, "", false, false); 
        return null;
    }
}

// ************************************
// ** UTILITY Character Image by Name
// ************************************

function getCharacterImageByName(characterName) {
    // Find the actor by name
    const actor = game.actors.find(a => a.name === characterName);
    if (actor) {
        // Return the character's image
        return actor.data.img;
    } else {
        // Handle the case where no character is found
        // POST DEBUG
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Character not found: " + characterName, "", false, false); 
        return null;
    }
}



// ************************************
// ** UTILITY Text Between Strings
// ************************************

function grabTextBetweenStrings(strText, strStart, strEnd) {
    var strFinal = "";  
    var intOffset = strStart.length;
    if (strText.includes(strStart)) {
        strFinal = strText.substring(
            strText.indexOf(strStart) + intOffset, 
            strText.lastIndexOf(strEnd)
        );
    }
    return strFinal;
}

// ************************************
// ** UTILITY Numbers to Words
// ************************************
function numToWord(intNumber) {
    if (intNumber < 0) return false;
      
    const single_digit = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double_digit = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const below_hundred = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (intNumber === 0) return 'Zero';
    
    function translate(intNumber) {
        let word = "";
        if (intNumber < 10) {
            word = single_digit[intNumber] + ' ';
        } else if (intNumber < 20) {
            word = double_digit[intNumber - 10] + ' ';
        } else if (intNumber < 100) {
            var rem = single_digit[intNumber % 10];
            word = below_hundred[Math.floor(intNumber / 10) - 2] + ' ' + rem;
        } else if (intNumber < 1000) {
            word = single_digit[Math.trunc(intNumber / 100)] + ' Hundred ' + translate(intNumber % 100);
        } else if (intNumber < 1000000) {
            word = translate(parseInt(intNumber / 1000)).trim() + ' Thousand ' + translate(intNumber % 1000);
        } else if (intNumber < 1000000000) {
            word = translate(parseInt(intNumber / 1000000)).trim() + ' Million ' + translate(intNumber % 1000000);
        } else {
            word = translate(parseInt(intNumber / 1000000000)).trim() + ' Billion ' + translate(intNumber % 1000000000);
        }
        return word;
    }
    
    try {
        return translate(intNumber).trim();
    } catch(err) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Error occurred", err.toString(), false, false);
    }
}


// ************************************
// ** UTILITY Remove HTML Tags
// ************************************

function removeHTMLTags(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();
    // Regular expression to identify HTML tags in the input string. 
    // Replacing the identified HTML tag with a null string.
    return str.replace(/(<([^>]+)>)/ig, '');
}

// Pick one item weighted by its `odds` (1-100, higher = more common).
// Records with a missing or unusable value fall back to weight 1 rather
// than dropping out of the pool entirely.
/**
 * Weighted pick DECIDED BY A REAL DIE, so Dice So Nice can show the roll that
 * actually chose. Honours the `showDiceRolls` setting; with it off, or with
 * no 3D dice installed, this is just a weighted pick with extra steps and
 * costs nothing visible.
 *
 * The die is `1d{total weight}` and the result walks the same weights the
 * silent version uses, so odds are identical either way — a rarer injury does
 * not become likelier because somebody turned dice on.
 *
 * Deliberately not a decorative roll. Blacksmith's own notes flag
 * `rollCoffeePubDice()` fabricating a 2d20 when handed nothing as a bug; dice
 * that do not decide anything are the same lie wherever they are thrown.
 */
async function weightedPickRolled(items, weightOf) {
    const weights = items.map((item) => {
        const w = Number(weightOf(item));
        return Number.isFinite(w) && w > 0 ? w : 1;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return items[items.length - 1];

    let value;
    try {
        const roll = await new Roll(`1d${total}`).evaluate();
        value = roll.total;
        if (getSettingSafe('showDiceRolls', false) && typeof BlacksmithUtils?.rollCoffeePubDice === 'function') {
            BlacksmithUtils.rollCoffeePubDice(roll);
        }
    } catch (error) {
        // A roll should never cost somebody their injury card.
        logBib('Dice roll failed; picking silently', error?.message, false, false);
        value = Math.ceil(Math.random() * total);
    }

    let remaining = value;
    for (let i = 0; i < items.length; i++) {
        remaining -= weights[i];
        if (remaining <= 0) return items[i];
    }
    return items[items.length - 1];
}

// Read an injury record off a journal page, newest storage first:
//   1. system  — typed page subtype, validated by Foundry (current)
//   2. flag    — the interim format the generator stamped
//   3. HTML    — the original metadata block
// Older packs keep working; see documentation/architecture/architecture-injuries.md.
function readInjuryRecord(page) {
    // `sourceUuid` lets the applied effect point back at its journal page,
    // so GM notes stay live (and are never copied into chat HTML, where a
    // player could read them out of the DOM).
    const sourceUuid = page?.uuid ?? null;
    const system = page?.system;
    if (system && system.category && (page?.name || system.title)) {
        const fields = system.toObject?.() ?? system;
        return {
            ...fields,
            title: page?.name || fields.title || '',
            treatmentdc: fields.treatmentdc ?? undefined,
            sourceUuid
        };
    }
    const flagged = page?.flags?.[MODULE.ID]?.injury;
    if (flagged && flagged.title) return { ...flagged, sourceUuid };
    const content = page?.text?.content;
    const parsed = content ? getHTMLMetadata(content) : null;
    return parsed ? { ...parsed, sourceUuid } : null;
}

async function getJournalCategoryPageData(compendiumName, category, title = null) {


    const pack = game.packs.get(compendiumName);
    const strMatchingCategory = category.toLowerCase();


    //BlacksmithUtils.postConsoleAndNotification("*** getJournalCategoryPageData pack" , pack, false, true, false); 
    //BlacksmithUtils.postConsoleAndNotification("*** getJournalCategoryPageData strMatchingCategory" , strMatchingCategory, false, true, false); 


    if (!pack) {
        console.error(`Compendium ${compendiumName} not found`);
        return;
    }
    // Get all entries from the compendium 
    // The entries are the journals.
    const entries = await pack.getDocuments();

    //BlacksmithUtils.postConsoleAndNotification("*** getJournalCategoryPageData entries" , entries, false, true, false); 

    // Collect all available categories. Page DOCUMENTS (not _source) so
    // each one carries its data model and its uuid.
    let arrCategoryPages = [];
    for (let entry of entries) {
        if (entry.name.toLowerCase() == strMatchingCategory) {
            arrCategoryPages = Array.from(entry.pages ?? []);
        }
    }
    // If no pages
    if (arrCategoryPages.length === 0) {
        //BlacksmithUtils.postConsoleAndNotification("*** getJournalCategoryPageData No Pages Found" , arrCategoryPages, false, true, false); 
        return null;
    }

    //BlacksmithUtils.postConsoleAndNotification("*** getJournalCategoryPageData arrCategoryPages" , arrCategoryPages, false, true, false); 

    // Select a page weighted by each injury's authored `odds`, so rarer
    // (nastier) injuries stay rare instead of every page being equally
    // likely. Unreadable pages drop out of the pool.
    const arrCandidates = arrCategoryPages
        .map((page) => ({ page, record: readInjuryRecord(page) }))
        .filter((c) => c.record);
    if (!arrCandidates.length) {
        logBib(`No readable injuries in category "${category}"`, '', false, false);
        return null;
    }
    // A named injury skips the draw entirely — that is the whole point of
    // the picker, and it falls back to a weighted roll if the name no longer
    // matches anything (a renamed page, a repointed compendium).
    if (title) {
        const wanted = String(title).trim().toLowerCase();
        const exact = arrCandidates.find((c) => String(c.record.title ?? '').trim().toLowerCase() === wanted);
        if (exact) {
            logBib(`Injury chosen: "${exact.record.title}" (named, no roll)`, '', true, false);
            return exact.record;
        }
        logBib(`No injury named "${title}" in ${category} — rolling instead`, '', false, false);
    }
    const picked = await weightedPickRolled(arrCandidates, (c) => c.record.odds);
    logBib(`Injury picked: "${picked.record.title}" (odds ${picked.record.odds ?? 'n/a'} of ${arrCandidates.length} in ${category})`, '', true, false);
    return picked.record;
}


// ************************************
// ** UTILITY Parse Journal Metadata 
// ************************************

/**
 * This function takes HTML string and returns metadata as an object
 * It looks for the first <ul> after <h2>Metadata</h2> and parses it.
 * @param {string} html - HTML string to get metadata from 
 * @return {Object} Metadata object
 */
function getHTMLMetadata(html){
    try {
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(html, 'text/html');
        
        const metadataHeader = Array.from(doc.getElementsByTagName('h2')).find(h2 => h2.textContent === 'Metadata');
        if (!metadataHeader) throw new Error('Missing Metadata header');
        
        // This line is updated.
        let ulElement;
        for (let sibling of metadataHeader.parentNode.children) {
          if (sibling.tagName === "UL" && sibling.compareDocumentPosition(metadataHeader) === 2) {
            // The ul tag is found and it is after the h2 tag.
            ulElement = sibling;
            break;
          }
        }

        if (!ulElement) throw new Error('Unstructured html, expected UL after H2');
        
        const listItems = Array.from(ulElement.getElementsByTagName('li'));
        
        var metadata = {};
        listItems.forEach(li => {
            const strongElement = li.getElementsByTagName('strong')[0];
            if (!strongElement) throw new Error('Unstructured html, missing STRONG in LI');
            
            const label = strongElement.textContent.replace(':', '');  // Remove colon
            const value = li.textContent.replace(strongElement.textContent, '').trim();
            
            metadata[label] = value;
        });
        
        return metadata;
        
    } catch (error) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "getHTMLMetadata error: " + error.message, "", false, false);
    }
}

// ************************************
// ** UTILITY Get Injury Journal Data
// ************************************

async function getInjuryDataFromJournalPages(compendiumName, journalName) {
    //BlacksmithUtils.postConsoleAndNotification("getInjuryDataFromJournalPages compendiumName: ", compendiumName, false, true, false);
    //BlacksmithUtils.postConsoleAndNotification("getInjuryDataFromJournalPages journalName: ", journalName, false, true, false);
    const pack = game.packs.get(compendiumName);
    const entries = await pack.getDocuments();
    const journalEntry = entries.find((entry) => entry.name === journalName);
    
    //BlacksmithUtils.postConsoleAndNotification("entries", entries, false, true, false);

    var category = "";
    var label = "";
    var icon = "";
    var damage = "";
    var duration = "";
    var description = "";
    var treatment = "";
    var action = "";
    var statuseffect = "";

    if (journalEntry && journalEntry._source && journalEntry._source.pages) {
        let content = journalEntry._source.pages;
        //BlacksmithUtils.postConsoleAndNotification("Journal Entry Content: ", content, false, true, false);

        let categoryPage = content.find(page => page.name === 'category');
        category = removeHTMLTags(categoryPage ? categoryPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("category: ", category, false, true, false);

        let labelPage = content.find(page => page.name === 'label');
        label = removeHTMLTags(labelPage ? labelPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("label: ", label, false, true, false);

        let iconPage = content.find(page => page.name === 'icon');
        icon = removeHTMLTags(iconPage ? iconPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("icon: ", icon, false, true, false);

        let damagePage = content.find(page => page.name === 'damage');
        damage = removeHTMLTags(damagePage ? damagePage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("damage: ", damage, false, true, false);

        let durationPage = content.find(page => page.name === 'duration');
        duration = removeHTMLTags(durationPage ? durationPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("duration: ", duration, false, true, false);

        let descriptionPage = content.find(page => page.name === 'description');
        description = removeHTMLTags(descriptionPage ? descriptionPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("description: ", description, false, true, false);

        let treatmentPage = content.find(page => page.name === 'treatment');
        treatment = removeHTMLTags(treatmentPage ? treatmentPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("treatment: ", treatment, false, true, false);

        let actionPage = content.find(page => page.name === 'action');
        action = removeHTMLTags(actionPage ? actionPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("action: ", action, false, true, false);

        let statuseffectPage = content.find(page => page.name === 'status effect');
        statuseffect = removeHTMLTags(statuseffectPage ? statuseffectPage.text.content : null);
        //BlacksmithUtils.postConsoleAndNotification("statuseffect: ", statuseffect, false, true, false);

        return { category, label, icon, damage, duration, description, treatment, action, statuseffect };
    } else {
        // there is an issue with the journal.
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "No content found for entry " + journalName + " in compendium " + compendiumName, "", false, false);
    }
}


// ************************************
// ** UTILITY Apply Effects
// ************************************

// The key 'data.attributes.hp.value' is used to apply changes to the health point (HP) of the selected token character.
// The key 'data.flags.dnd5e.conditions.[condition]' is used to set a status effect associated with DnD 5e. For instance, if strStatusEffect is 'prone', 'data.flags.dnd5e.conditions.prone' will be used to make the character prone.
// The mode '2' in changes for HP indicates to reduce the current value by a certain amount.
// The mode '1' in changes for the condition indicates to override the current value.

/**
    * Apply an Active Effect to a selected token.
    * @param {string} strLabel - The name of the effect. 
    * @param {string} strIcon - The image to use for the effect.
    * @param {number} intDamage - The amount of damage to apply to the token.
    * @param {number} intDuration - How long the active effect lasts measured in seconds. 
    * @param {string} [strStatusEffect] - An optional additional status effect.
*/
// Apply a rolled critical or fumble as a status effect — thin mapping onto
// the shared applier (manager-status-effects.js). No mechanical changes:
// a named, described marker so the table doesn't forget what the card said.
// The recipient is chosen at CLICK time (targeted, then selected) — unlike
// injuries, the right target is a judgment call, not the attack's target.
async function applyOutcomeStatus(data) {
    // Card-dealing outcomes are not status effects at all — they reach
    // into the inspiration deck instead. Handled here because they arrive
    // on the same Apply button and carry the same targeting payload.
    if (data?.dealscard) return dealOutcomeCard(data);

    const blnIsCrit = data?.kind !== 'fumble';
    const strKindLabel = blnIsCrit ? 'Critical' : 'Fumble';
    const fallbackImg = blnIsCrit
        ? "icons/skills/wounds/blood-spurt-spray-red.webp"
        : "icons/skills/wounds/injury-pain-body-orange.webp";

    // Typed outcomes carry real mechanics; table-sourced ones carry only a
    // name and prose, and the nullish defaults below leave them behaving
    // exactly as they always have.
    const modifiers = Array.isArray(data?.modifiers) ? data.modifiers : [];
    const changes = modifiers.length ? modifiersToChanges(modifiers) : [];
    const rounds = secondsToRounds(data?.duration ?? 0);
    const description = [
        data?.description || '',
        modifiers.length ? `<p><strong>While this lasts:</strong> ${modifiers.map(describeModifier).filter(Boolean).join('; ')}</p>` : ''
    ].filter(Boolean).join('');

    // Party outcomes apply to everyone with no selecting; "pick who gets
    // this" outcomes carry the chosen actor on the button that was clicked.
    let explicitActors = null;
    if (data?.partyMode) {
        const party = getPartyActors();
        if (party.length) explicitActors = party;
    } else if (data?.randomAlly) {
        const party = getPartyActors();
        if (party.length) explicitActors = [party[Math.floor(Math.random() * party.length)]];
    } else if (data?.targetActorId) {
        const actor = game.actors.get(data.targetActorId);
        if (actor) explicitActors = [actor];
    }

    return applyStatusToTokens({
        name: `${strKindLabel}: ${data?.name || (blnIsCrit ? 'Critical Hit' : 'Fumble')}`,
        img: data?.image || fallbackImg,
        description,
        durationSeconds: Number(data?.duration) || null,
        damage: Number(data?.damage) || null,
        statusEffect: data?.statuseffect && data.statuseffect !== 'none' ? data.statuseffect : null,
        changes,
        explicitActors,
        kindLabel: strKindLabel.toLowerCase(),
        burst: {
            kind: blnIsCrit ? 'crit' : 'fumble',
            severity: data?.severity ?? null,
            sourceUuid: data?.sourceUuid ?? null,
            rounds
        }
    });
}

// Treat dispatch. The GM (or anyone, when Player Treatment Rolls is off)
// treats instantly, ownership-gated. With rolls on, a player clicking an
// INJURY row triggers a Medicine check against the injury's DC instead —
// see requestTreatmentRoll. Non-injury rows are GM-only (pruned at render).
async function treatAffliction(message, data) {
    const rollsOn = getSettingSafe('injuryTreatmentRolls', true);
    if (!game.user.isGM && rollsOn && data.kind === 'injury') {
        return requestTreatmentRoll(message, data);
    }
    const actor = canvas?.tokens?.get(data.tokenId ?? '')?.actor
        ?? game.actors.get(data.actorId ?? '');
    if (!actor) return showBibToast('Patient Not Found', 'Could not find the actor to treat.', 'fa-solid fa-triangle-exclamation');
    if (!actor.isOwner) return showBibToast('No Permission', `You cannot modify ${actor.name}.`, 'fa-solid fa-lock');

    const effect = actor.effects.get(data.effectId);
    if (!effect) {
        showBibToast('Already Gone', 'That affliction is no longer on the patient.', 'fa-solid fa-sparkles');
        await sweepTreatStamps(message);
        return;
    }
    const effectName = effect.name;
    await removeAffliction(actor, effect);
    showBibToast('Treated', `"${effectName}" removed from ${actor.name}.`, 'fa-solid fa-bandage');
    await markTreatButtonDone(message);
}

function getSettingSafe(key, fallback) {
    try { return game.settings.get(MODULE.ID, key); } catch (_) { return fallback; }
}

// Local info notices ride Blacksmith's adaptive toast (3s, icon), falling
// back to a Foundry notification when the toast API is absent.
export function showBibToast(title, subtitle = '', icon = 'fa-solid fa-bandage') {
    const toast = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (toast?.show) {
        toast.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    } else {
        ui.notifications.info(subtitle ? `${title} — ${subtitle}` : title);
    }
}

/**
 * Turn off a condition an affliction was conveying — unless something
 * else on the actor still conveys it. Shared so that every removal path
 * behaves the same, whichever one the effect actually left by.
 */
export async function unwindConveyedCondition(actor, condition, exceptEffectId = null) {
    if (!actor || !condition) return false;
    // EXCLUDE THE EFFECT THAT IS LEAVING. This runs from `deleteActiveEffect`,
    // and whether the deleted document is still in `actor.effects` when the
    // hook fires is not something a consumer should have to know — it varies
    // with who did the deleting and how. If it is still there it answers "yes,
    // something still conveys prone", meaning the wound that just left blocks
    // the unwind of its own condition, and Prone is stranded on the sheet.
    // Naming the departing effect makes the question the one we meant to ask.
    const stillConveyed = actor.effects.some(
        (e) => e.id !== exceptEffectId
            && (e.getFlag(MODULE.ID, 'outcomeBurst')?.condition === condition
                || (e.statuses?.has?.(condition) && e.getFlag(MODULE.ID, 'outcomeBurst')))
    );
    // Say WHY when declining. A stranded condition is invisible in the logs
    // otherwise, and the two reasons want completely different fixes.
    if (stillConveyed) {
        const holders = actor.effects
            .filter((e) => e.id !== exceptEffectId && e.getFlag(MODULE.ID, 'outcomeBurst'))
            .map((e) => e.name);
        logBib(`Left ${condition} on ${actor.name} — still conveyed by: ${holders.join(', ') || '(unknown)'}`, '', true, false);
        return false;
    }
    if (!actor.statuses?.has(condition)) {
        logBib(`Nothing to unwind: ${actor.name} does not carry ${condition}`, '', true, false);
        return false;
    }
    try {
        await actor.toggleStatusEffect(condition, { active: false });
        logBib(`Unwound ${condition} from ${actor.name} — nothing conveys it any more`, '', true, false);
        return true;
    } catch (error) {
        logBib(`Could not unwind condition ${condition}`, error?.message, false, false);
        return false;
    }
}

// The shared removal core: delete the affliction and unwind its toggled
// condition unless another untreated affliction still conveys it. The heal
// burst plays automatically everywhere via the deleteActiveEffect hook.
async function removeAffliction(actor, effect) {
    const flag = effect.getFlag(MODULE.ID, 'outcomeBurst');
    // Non-Bibliosoph effects (plain conditions, other modules' effects) get
    // the flag stamped just before deletion so the heal burst plays on
    // every client via the deleteActiveEffect hook.
    if (!flag) {
        try {
            await effect.setFlag(MODULE.ID, 'outcomeBurst', { kind: 'treated', name: effect.name });
        } catch (_) { /* burst is cosmetic; never block treatment */ }
    }
    // The unwind itself now happens in the deleteActiveEffect hook, so it
    // is identical however the effect leaves — this button, the actor
    // sheet, the token HUD, or a duration running out.
    //
    // Guarded: a GM can remove the same effect from the sheet while this
    // click is in flight, and anything else that expires effects on its own
    // schedule can beat us to it. Either way the desired end state is
    // reached, so a lost race is a no-op rather than an unhandled rejection.
    await deleteEffectSafely(effect);
}

/**
 * Unwind conditions whenever a flagged affliction is deleted, by ANY
 * route. Previously this lived only in the Check-Up card's button, so
 * deleting a critical from the actor sheet or the token HUD left its
 * Prone or Blinded stuck on the character with nothing left pointing at
 * it — the condition outliving the thing that caused it.
 *
 * GM-authoritative: the hook fires on every client, and only one of them
 * should be writing to the actor.
 */
function registerConditionUnwindHook() {
    Hooks.on('deleteActiveEffect', async (effect) => {
        try {
            if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
            const flag = effect?.getFlag?.(MODULE.ID, 'outcomeBurst');
            if (!flag) return;
            const actor = effect.parent;
            if (!actor?.statuses) return;

            // The real condition it toggled, plus any pseudo-conditions it
            // was carrying on its own statuses array.
            const conditions = new Set();
            if (flag.condition) conditions.add(flag.condition);
            for (const id of effect.statuses ?? []) conditions.add(id);

            for (const condition of conditions) {
                await unwindConveyedCondition(actor, condition, effect.id);
            }
        } catch (error) {
            logBib('Condition unwind hook failed', error?.message, false, false);
        }
    });
    logBib('Watching affliction removal to unwind conveyed conditions', '', true, false);
}

// ==================================================================
// ===== TREATMENT ROLLS (players heal via Medicine checks) =========
// ==================================================================
// The rules matrix: kit = Advantage + DC-2, self-treatment =
// Disadvantage, both = normal + DC-2. Nat 20 = crit heal (+5 HP),
// nat 1 = fumbled heal (-5 HP), per the shared toggle. The Blacksmith
// request API cannot force advantage/disadvantage yet (Blacksmith
// Request #6) — the required mode rides in the request title and the
// roller clicks the matching button; the GM resolver reads what was
// actually rolled from the roll formula.

const SOCKET_TREAT_ROLL = `${MODULE.ID}.treatRoll`;
const pendingTreatRolls = new Map();

// GM-only: fold an injury's journal GM Notes into its Check-Up hover card.
//
// The notes are deliberately NOT baked into the message — a player could
// read them straight out of the DOM. The card carries only the page's
// uuid; each GM's own client fetches the text and rewrites its local
// tooltip. That also keeps the notes live: editing the journal updates
// what the hover shows, with no need to repost the card.
async function appendGmNotesToTooltips(message, root) {
    const buttons = root?.querySelectorAll?.(`button[data-blacksmith-action="${TREAT_ACTION}"]`) ?? [];
    for (const button of buttons) {
        // The row is what carries the tooltip; the button is only how we
        // find it, because that is what holds the effect id.
        const row = button.closest('.blacksmith-part-row');
        const uuid = checkUpRow(message, button.dataset.blacksmithValue)?.sourceUuid;
        // Idempotent: a pass runs again on every re-render, and appending
        // the note a second time is exactly what the guard prevents.
        if (!row || !uuid || row.dataset.gmNotesChecked) continue;
        row.dataset.gmNotesChecked = '1';
        // Stamped so a later note edit can find this row again without
        // needing the message it came from.
        row.dataset.gmNoteUuid = uuid;
        // Stash the note-free tooltip so a later refresh can rebuild
        // rather than appending the note a second time.
        row.dataset.tooltipBase = row.dataset.tooltip ?? '';
        await paintGmNoteTooltip(row, uuid);
    }
}

async function paintGmNoteTooltip(icon, uuid) {
    try {
        const { readGmNoteHtml } = await import('./utility-gm-notes.js');
        const base = icon.dataset.tooltipBase ?? '';
        let extra = '';

        // Shipped run guidance (module content, on the page itself)
        const page = await fromUuid(uuid);
        const guidance = String(page?.system?.gmnotes ?? '').trim();
        if (guidance) {
            extra += `<hr><section style="text-align:left;"><strong><i class="fa-solid fa-masks-theater"></i> Running This Injury</strong><br>${guidance}</section>`;
        }
        // The GM's own private notes (Blacksmith's layer)
        const notes = (await readGmNoteHtml(page ?? uuid)).trim();
        if (notes) {
            extra += `<hr><section style="text-align:left;"><strong><i class="fa-solid fa-user-secret"></i> GM Notes</strong>${notes}</section>`;
        }
        icon.dataset.tooltip = base + extra;
    } catch (error) {
        logBib('Could not load GM notes for ' + uuid, error?.message, true, false);
    }
}

// Live-refresh open Check-Up cards when a note is edited anywhere else.
// Blacksmith's payload now also carries journal navigation context
// (parentUuid/parentName/breadcrumb); we key on uuid alone.
Hooks.on('blacksmith.gmNotesChanged', ({ uuid } = {}) => {
    if (!game.user.isGM || !uuid) return;
    document.querySelectorAll(`[data-gm-note-uuid="${uuid}"]`)
        .forEach((row) => paintGmNoteTooltip(row, uuid));
});

// Per-viewer hover text for an injury Treat button: a PREVIEW of what
// clicking will do for THIS user, in future tense — not narration.
// Never reveals the DC (hidden from players).
/**
 * THE TREATMENT MATRIX, in one place.
 *
 *   kit + other  → Advantage,    DC-2
 *   no kit + self→ Disadvantage, DC
 *   kit + self   → normal,       DC-2   (the two cancel)
 *   neither      → normal,       DC
 *
 * Everything that needs to know what a treatment roll will look like goes
 * through here: the request itself, the pre-click tooltip, and the test
 * harness. They each used to derive it separately, which is exactly how a
 * tooltip ends up promising Advantage on a roll that requests normal.
 *
 * @param {Actor} roller          who is treating
 * @param {string} patientActorId who is being treated
 * @param {number} baseDc         the injury's DC before the kit discount
 */
export function treatmentRollPlan(roller, patientActorId, baseDc = 15) {
    const self = !!roller && roller.id === patientActorId;
    const kit = findHealersKit(roller);
    const useKit = !!kit?.usable;
    const mode = useKit && !self ? 'advantage' : (!useKit && self ? 'disadvantage' : 'normal');
    const dc = useKit ? Math.max(1, Number(baseDc) - 2) : Number(baseDc);
    const kitNote = kit?.hasPool ? ` (${kit.remaining} use${kit.remaining === 1 ? '' : 's'} left)` : '';

    // One sentence, second person — it rides the request card via
    // Blacksmith's `explanation`, so it must read as plain text.
    const explanation = mode === 'advantage'
        ? "A Healer's Kit steadies your hands: roll with Advantage, and the difficulty is 2 lower."
        : mode === 'disadvantage'
        ? 'Treating your own wounds is never easy: roll with Disadvantage.'
        : useKit
        ? "Your Healer's Kit grants Advantage and treating yourself imposes Disadvantage, so they cancel — but the kit still lowers the difficulty by 2."
        : "No Healer's Kit — a bare-handed Medicine check.";

    return { self, kit, useKit, kitNote, mode, dc, baseDc: Number(baseDc), explanation };
}

function buildTreatTooltip(data) {
    if (!getSettingSafe('injuryTreatmentRolls', true)) {
        return 'Click to remove this affliction (you must own this character).';
    }
    const roller = game.user.character;
    if (!roller) return 'Clicking will roll a Medicine check to treat this injury — assign a character to your user first.';

    const plan = treatmentRollPlan(roller, data?.actorId ?? '', Number(data?.dc) || 15);
    const modeLine = plan.mode === 'advantage'
        ? `You'll roll with <strong>Advantage</strong> at a lowered DC — your Healer's Kit${plan.kitNote} helps.`
        : plan.mode === 'disadvantage'
        ? `You'll roll with <strong>Disadvantage</strong> — treating yourself without a Healer's Kit.`
        : plan.useKit
        ? `You'll roll normally at a lowered DC — self-treatment Disadvantage and your Healer's Kit${plan.kitNote} Advantage cancel out.`
        : `You'll roll normally — no Healer's Kit.`;
    return `<strong>Click to attempt treatment</strong><br>${roller.name} will roll a Medicine check against this injury.<br>${modeLine}<br><em>One attempt per character per injury.</em>`;
}

/**
 * The DC line for a GM's treat-button tooltip. Players never see the DC
 * by design — but the GM could not see it either without running a
 * harness report, which is a gap rather than a design.
 *
 * Reads the live effect so escalation from failed attempts is included:
 * the number shown is the number that will actually be rolled against.
 */
function gmDcNote(data) {
    try {
        const actor = canvas?.tokens?.get(data.tokenId ?? '')?.actor ?? game.actors.get(data.actorId ?? '');
        const effect = actor?.effects?.get(data.effectId ?? '') ?? null;
        const base = Number(data.dc) || 15;
        const live = escalatedTreatmentDc(base, effect);
        const failures = Number(effect?.getFlag?.(MODULE.ID, 'treatFailures') ?? 0) || 0;
        const tried = (effect?.getFlag?.(MODULE.ID, 'treatAttempts') ?? [])
            .map((id) => game.actors.get(id)?.name).filter(Boolean);
        return `<br>DC ${live}${live !== base ? ` (base ${base}, +${live - base} from ${failures} failure${failures === 1 ? '' : 's'})` : ''}`
            + (tried.length ? `<br>Already tried: ${tried.join(', ')}` : '');
    } catch (_) {
        return '';       // a malformed row simply gets the plain tooltip
    }
}

/**
 * An injury's CURRENT treatment DC: its base, plus whatever the failed
 * attempts so far have added. Without this, failing costs nothing but a
 * turn and the party simply queues up to roll again.
 *
 * @param {number} baseDc
 * @param {ActiveEffect|null} effect  the injury carrying the attempt list
 */
export function escalatedTreatmentDc(baseDc, effect) {
    const step = Number(getSettingSafe('injuryTreatmentDcEscalation', 0)) || 0;
    if (step <= 0 || !effect) return baseDc;
    const failures = Number(effect.getFlag?.(MODULE.ID, 'treatFailures') ?? 0) || 0;
    return baseDc + (failures * step);
}

/**
 * The item names that count as a healer's kit. A single hard-coded
 * string meant homebrew kits, localised names and "Healer's Satchel"
 * silently granted nothing, with no way for a GM to tell why.
 * Comma-separated, matched case-insensitively on the whole name.
 */
function healersKitNames() {
    const raw = String(getSettingSafe('injuryTreatmentKitNames', "Healer's Kit") || "Healer's Kit");
    const names = raw.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
    return names.length ? names : ["healer's kit"];
}

function findHealersKit(actor) {
    const names = healersKitNames();
    const kit = (actor?.items ?? []).find((i) => names.includes(String(i.name ?? '').toLowerCase()));
    if (!kit) return null;
    const uses = kit.system?.uses;
    const hasPool = Number(uses?.max) > 0;
    const remaining = hasPool ? Math.max(0, Number(uses.max) - Number(uses.spent ?? 0)) : null;
    return { item: kit, hasPool, remaining, usable: !hasPool || remaining > 0 };
}

// Player side: build the roll context, post a silent Medicine request via
// Blacksmith, and relay the treatment context to the active GM, who owns
// all resolution (validation, effect removal, HP changes, kit uses).
async function requestTreatmentRoll(message, data) {
    const api = game.modules.get('coffee-pub-blacksmith')?.api;
    if (!api?.openRequestRollDialog) {
        return showBibToast('Blacksmith Needed', 'Treatment rolls need a newer Blacksmith build — ask your GM to treat instead.', 'fa-solid fa-triangle-exclamation');
    }
    const roller = game.user.character;
    if (!roller) {
        return showBibToast('No Character', 'Assign a character to your user to attempt treatment.', 'fa-solid fa-user-slash');
    }
    const patientActor = canvas?.tokens?.get(data.tokenId ?? '')?.actor
        ?? game.actors.get(data.actorId ?? '');
    // Best-effort client-side attempt check; the GM re-validates.
    const priorAttempts = patientActor?.effects?.get(data.effectId)?.getFlag(MODULE.ID, 'treatAttempts') ?? [];
    if (priorAttempts.includes(roller.id)) {
        return showBibToast('Already Attempted', `${roller.name} has already tried to treat this injury.`, 'fa-solid fa-hand');
    }

    // One derivation, shared with the tooltip and the harness. `normal` is
    // a real requestable value, not the absence of one — which is exactly
    // what the "kit and self cancel out" row needs.
    const { mode, dc, useKit, kit, explanation } =
        treatmentRollPlan(roller, patientActor?.id ?? data.actorId, Number(data.dc) || 15);

    const rollerToken = canvas?.tokens?.placeables?.find((t) => t.actor?.id === roller.id);
    const rollerEntry = rollerToken
        ? { tokenId: rollerToken.id, actorId: roller.id, name: roller.name, rollAdvantage: mode }
        : { actorId: roller.id, name: roller.name, rollAdvantage: mode };

    const { messageId } = await api.openRequestRollDialog({
        silent: true,
        title: `Treat ${data.name || 'the injury'}`,
        initialType: 'skill',
        initialValue: 'medicine',
        dc,
        showDC: false,
        groupRoll: false,
        // Blacksmith carries the decision; we still make it. The DC
        // arithmetic and which situation maps to which mode stay ours.
        rollAdvantage: mode,
        // Locked because this matrix is a RULE, not a suggestion: whether
        // you hold a kit and whether the patient is you are both facts,
        // with no judgement in them. A player clicking the wrong button
        // here would be a mistake, not GM discretion.
        lockRollAdvantage: true,
        explanation,
        actors: [rollerEntry]
    });
    if (!messageId) return;

    const context = {
        rollMessageId: messageId,
        cardMessageId: message?.id ?? null,
        patientTokenId: data.tokenId ?? null,
        patientActorId: data.actorId ?? null,
        effectId: data.effectId,
        effectName: data.name || 'the injury',
        rollerActorId: roller.id,
        rollerUserId: game.user.id,
        dc,
        usedKit: useKit,
        kitItemId: kit?.item?.id ?? null,
        expectedMode: mode
    };
    // The GM may be this client (a GM player-testing); handle locally then.
    if (game.users.activeGM?.id === game.user.id) {
        pendingTreatRolls.set(messageId, context);
        return;
    }
    const sockets = api.sockets;
    if (!sockets) return showBibToast('Relay Failed', 'Blacksmith sockets unavailable — the GM will not see this treatment roll.', 'fa-solid fa-triangle-exclamation');
    try {
        await sockets.waitForReady();
        await sockets.emit(SOCKET_TREAT_ROLL, context);
    } catch (error) {
        logBib('Treatment roll relay failed', error?.message, false, false);
    }
}

/**
 * What mode Blacksmith actually resolved for this roller, read off the
 * request flags rather than reverse-engineered from the dice formula.
 * Per-actor wins over the request-level default, which is their contract.
 *
 * @returns {{mode: string|null, locked: boolean}}
 */
function requestedRollMode(payload, rollerActorId) {
    const data = payload?.messageData
        ?? game.messages.get(payload?.messageId ?? '')?.flags?.['coffee-pub-blacksmith']
        ?? null;
    if (!data) return { mode: null, locked: false };
    const mine = (data.actors ?? []).find((a) => a?.actorId === rollerActorId);
    return {
        mode: mine?.rollAdvantage ?? data.rollAdvantage ?? null,
        locked: !!data.lockRollAdvantage
    };
}

// Pull the total and the ACTIVE d20 face out of the delivered roll JSON
// (kh/kl advantage rolls mark the dropped die inactive).
function extractRollNumbers(result) {
    const total = Number(result?.total ?? NaN);
    let d20 = null;
    let sawAdvMode = 'normal';
    for (const term of result?.terms ?? []) {
        if (Number(term?.faces) !== 20) continue;
        const results = term.results ?? [];
        if (results.length > 1) {
            const mods = String(term.modifiers ?? []);
            sawAdvMode = mods.includes('kl') ? 'disadvantage' : 'advantage';
        }
        const active = results.find((r) => r.active !== false);
        d20 = Number(active?.result ?? null);
        break;
    }
    return { total, d20, rolledMode: sawAdvMode };
}

// GM side: register the context relay and resolve completed rolls.
async function registerTreatRollSocket() {
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (sockets) {
        await sockets.waitForReady();
        await sockets.register(SOCKET_TREAT_ROLL, (context) => {
            if (game.users.activeGM?.id !== game.user.id) return;
            if (!context?.rollMessageId || !context?.effectId) return;
            pendingTreatRolls.set(context.rollMessageId, context);
        });
    }
    Hooks.on('blacksmith.requestRollComplete', async (payload) => {
        if (game.users.activeGM?.id !== game.user.id) return;
        const context = pendingTreatRolls.get(payload?.messageId ?? '');
        if (!context || !payload?.result) return;
        pendingTreatRolls.delete(payload.messageId);
        try {
            await resolveTreatmentRoll(context, payload);
        } catch (error) {
            logBib('Treatment roll resolution failed', error?.message, false, false);
        }
    });
}

// All rules run here, GM-authoritative — the relayed context is treated as
// a claim, re-validated against live state before anything changes.
async function resolveTreatmentRoll(context, payload) {
    const patient = canvas?.tokens?.get(context.patientTokenId ?? '')?.actor
        ?? game.actors.get(context.patientActorId ?? '');
    if (!patient) return;
    const roller = game.actors.get(context.rollerActorId ?? '');
    const rollerName = roller?.name ?? 'Someone';

    const effect = patient.effects.get(context.effectId ?? '');
    if (!effect) {
        await postTreatmentOutcome(`${rollerName} treats ${patient.name} — but the affliction was already gone.`);
        await sweepStampsById(context.cardMessageId);
        return;
    }
    const attempts = effect.getFlag(MODULE.ID, 'treatAttempts') ?? [];
    if (roller && attempts.includes(roller.id)) {
        logBib(`Treatment roll rejected: ${rollerName} already attempted "${effect.name}"`, '', false, false);
        return;
    }

    const { total, d20, rolledMode } = extractRollNumbers(payload.result);
    if (!Number.isFinite(total)) return;

    // Blacksmith now carries the requested mode on the request flags, and
    // a locked request only renders the one button. Enforcement lives at
    // those buttons, though — processRoll is still a dumb consumer of
    // whatever got clicked — so this stays as a cheap ASSERTION: it logs a
    // mismatch and does not act on one. If it ever fires, the bug is in
    // the roll layer and this is the only place that would notice.
    const requested = requestedRollMode(payload, context.rollerActorId);
    const expected = requested.mode ?? context.expectedMode;
    if (expected && expected !== rolledMode) {
        logBib(
            `Treatment roll mode mismatch: requested ${expected}${requested.locked ? ' (locked)' : ''}, rolled ${rolledMode}`,
            requested.locked
                ? 'A locked request should not have been rollable in another mode — worth reporting to Blacksmith.'
                : 'Unlocked request, so this is GM discretion. Accepted.',
            false, false
        );
    }
    const critFumbleOn = getSettingSafe('injuryTreatmentCritFumble', true);
    const isNat20 = critFumbleOn && d20 === 20;
    const isNat1 = critFumbleOn && d20 === 1;
    // Re-derive the DC here rather than trusting the relayed one: prior
    // failures may have raised it since the player's client built the
    // request, and the GM is the only authority on that.
    const liveDc = escalatedTreatmentDc(Number(context.dc ?? 15), effect);
    const success = isNat20 || (!isNat1 && total >= liveDc);

    // Kit consumption per the Consume Kit Uses mode
    const kitMode = getSettingSafe('injuryTreatmentKitUses', 'attempt');
    if (context.usedKit && roller && context.kitItemId
        && (kitMode === 'attempt' || (kitMode === 'success' && success))) {
        const kitItem = roller.items.get(context.kitItemId);
        const uses = kitItem?.system?.uses;
        if (kitItem && Number(uses?.max) > 0) {
            try {
                await kitItem.update({ 'system.uses.spent': Math.min(Number(uses.max), Number(uses.spent ?? 0) + 1) });
            } catch (error) {
                logBib('Could not consume Healer\'s Kit use', error?.message, false, false);
            }
        }
    }

    // Captured before removal — the card badges the affliction's own icon
    const effectName = effect.name;
    const effectImg = effect.img;
    if (success) {
        await removeAffliction(patient, effect);
        if (isNat20) await adjustPatientHp(patient, +5);
        await postTreatmentOutcome({ healer: roller, patient, effectName, effectImg, outcome: isNat20 ? 'crit' : 'success' });
        await sweepStampsById(context.cardMessageId);
    } else {
        try {
            await effect.setFlag(MODULE.ID, 'treatAttempts', [...attempts, ...(roller ? [roller.id] : [])]);
            // Failures accumulate so the wound gets harder to close. A
            // fumble counts double: botching it makes a mess.
            const step = Number(getSettingSafe('injuryTreatmentDcEscalation', 0)) || 0;
            if (step > 0) {
                const failures = Number(effect.getFlag(MODULE.ID, 'treatFailures') ?? 0) || 0;
                const next = failures + (isNat1 ? 2 : 1);
                await effect.setFlag(MODULE.ID, 'treatFailures', next);
                logBib(`"${effect.name}" treatment DC is now ${liveDc + (isNat1 ? 2 : 1) * step} after ${next} failure(s)`, '', true, false);
            }
        } catch (error) {
            logBib('Could not record treatment attempt', error?.message, false, false);
        }
        if (isNat1) await adjustPatientHp(patient, -5);
        await postTreatmentOutcome({ healer: roller, patient, effectName, effectImg, outcome: isNat1 ? 'fumble' : 'fail' });
    }
}

/**
 * Rest clears treatment attempts, so a failed roll is a setback rather
 * than a permanent dead end. Without this the only way back was the test
 * harness, which is not a thing a table should need.
 */
function registerTreatmentRestReset() {
    const onRest = async (actor, result) => {
        if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
        const mode = getSettingSafe('injuryTreatmentAttemptReset', 'longRest');
        if (mode === 'never') return;
        const isLong = result?.longRest ?? (result?.type === 'long');
        if (mode === 'longRest' && !isLong) return;

        let cleared = 0;
        for (const effect of actor?.effects ?? []) {
            if (!effect.getFlag(MODULE.ID, 'treatAttempts') && !effect.getFlag(MODULE.ID, 'treatFailures')) continue;
            try {
                await effect.unsetFlag(MODULE.ID, 'treatAttempts');
                await effect.unsetFlag(MODULE.ID, 'treatFailures');
                cleared++;
            } catch (error) {
                logBib('Could not reset treatment attempts', error?.message, false, false);
            }
        }
        if (cleared) {
            logBib(`Rest cleared treatment attempts on ${cleared} affliction(s) for ${actor.name}`, '', true, false);
            showBibToast('Treatment Reset', `${actor.name} rested — their afflictions can be treated again.`, 'fa-solid fa-bed');
        }
    };
    Hooks.on('dnd5e.restCompleted', onRest);
    logBib('Watching rests to reset treatment attempts', '', true, false);
}

// One-time real HP change, clamped, outside the damage pipeline (so a
// fumbled heal can never re-trigger injury detection).
async function adjustPatientHp(actor, delta) {
    const hp = actor.system?.attributes?.hp;
    if (!hp) return;
    const next = Math.max(0, Math.min(Number(hp.max ?? 0), Number(hp.value ?? 0) + delta));
    try {
        await actor.update({ 'system.attributes.hp.value': next });
    } catch (error) {
        logBib('Could not adjust patient HP', error?.message, false, false);
    }
}

// Treatment outcomes post as a composition: who treated whom, a stamp
// saying how it went, then the narrative. Accepts a plain string for the
// odd informational case (affliction already gone). Copy uses names and
// "their" — the module can't know a character's pronouns.
export async function postTreatmentOutcome(data) {
    try {
        const parts = [{ part: 'header', icon: 'fa-solid fa-bandage', title: 'Treatment' }];

        if (typeof data === 'string') {
            parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: data }] });
        } else {
            const { healer, patient, effectName, effectImg, outcome } = data;
            const healerName = healer?.name ?? 'Someone';
            const patientName = patient?.name ?? 'the patient';
            const self = !!healer && !!patient && healer.id === patient.id;
            // Marks, not markup: a part escapes what it is given, so emphasis
            // is written the way prose text takes it.
            const strong = (s) => `**${s}**`;
            const injury = `**"${effectName}"**`;

            // Verdict first, because it decides the tone every other part
            // carries. `fail` is negative rather than a tone of its own —
            // the fixed four are read as outcomes, not as severities.
            const VERDICTS = {
                crit:   { label: 'Critical Success', icon: 'fa-solid fa-star',         tone: 'positive' },
                fumble: { label: 'Fumble',           icon: 'fa-solid fa-burst',        tone: 'negative' },
                fail:   { label: 'No Effect',        icon: 'fa-solid fa-heart-crack',  tone: 'negative' }
            };
            const verdict = VERDICTS[outcome] ?? { label: 'Treated', icon: 'fa-solid fa-bandage', tone: 'positive' };

            let narrative;
            let bonus = '';
            switch (outcome) {
                case 'crit':
                    narrative = self
                        ? `${strong(healerName)} critically heals themselves, treating their case of ${injury}.`
                        : `${strong(healerName)} critically heals ${strong(patientName)}, treating their case of ${injury}.`;
                    bonus = `A critical success! ${patientName} recovers an extra 5 HP.`;
                    break;
                case 'fumble':
                    narrative = self
                        ? `${strong(healerName)} badly fumbles treating their own ${injury}.`
                        : `${strong(healerName)} fumbles treating ${strong(patientName)}'s ${injury}.`;
                    bonus = `A natural 1! ${patientName} takes 5 damage.`;
                    break;
                case 'fail':
                    narrative = self
                        ? `${strong(healerName)} tries to treat their own ${injury} — without success.`
                        : `${strong(healerName)} tries to treat ${strong(patientName)}'s ${injury} — without success.`;
                    break;
                default:
                    narrative = self
                        ? `${strong(healerName)} successfully treats their own case of ${injury}.`
                        : `${strong(healerName)} treats ${strong(patientName)}, curing their case of ${injury}.`;
            }

            // The affliction rides the patient's portrait as an overlay, which
            // is what the old card's corner badge was. Self-treatment is ONE
            // row: the symmetric strip existed because a centred icon needed
            // something either side of it, and listing the same person twice
            // in a row list would just read as a bug.
            const patientRow = {
                img: patient?.img || 'icons/svg/mystery-man.svg',
                cover: true,
                label: patientName,
                sublabel: effectName,
                tone: verdict.tone
            };
            if (effectImg) patientRow.overlays = [effectImg];

            parts.push({
                part: 'rows',
                items: self ? [patientRow] : [
                    { img: healer?.img || 'icons/svg/mystery-man.svg', cover: true,
                      label: healerName, sublabel: 'Treating' },
                    patientRow
                ]
            });
            parts.push({ part: 'band', text: verdict.label, icon: verdict.icon, tone: verdict.tone });

            const blocks = [{ type: 'paragraph', text: narrative }];
            if (bonus) blocks.push({ type: 'paragraph', text: strong(bonus) });
            parts.push({ part: 'prose', blocks });
        }

        await postCard({
            type: 'treatment-outcome',
            theme: getSettingSafe('cardThemeInjury', 'default'),
            speaker: { alias: 'Treatment' },
            parts
        });
    } catch (error) {
        logBib('Could not post treatment outcome', error?.message, false, false);
    }
}

async function sweepStampsById(messageId) {
    const message = game.messages.get(messageId ?? '');
    if (message) await sweepTreatStamps(message);
}

// Flip treated rows to bandaid stamps in the stored message. Players cannot
// persistently edit a GM-owned ChatMessage, so when the clicker lacks update
// permission the click becomes an INTENT relayed to the active GM over the
// Blacksmith socket layer, and the GM performs the authoritative
// message.update (Foundry then syncs the new content to every client).
// The sweep itself never trusts the request: it stamps only rows whose
// effect is verifiably gone from the actor at sweep time.
const SOCKET_TREAT_STAMP = `${MODULE.ID}.treatStamp`;

async function registerTreatStampSocket() {
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets) return;
    await sockets.waitForReady();
    await sockets.register(SOCKET_TREAT_STAMP, async (payload) => {
        if (game.users.activeGM?.id !== game.user.id) return;
        const message = game.messages.get(payload?.messageId ?? '');
        if (!message) return;
        await sweepTreatStamps(message);
    });
}

async function markTreatButtonDone(message) {
    if (!message) return;
    if (message.canUserModify(game.user, 'update')) {
        await sweepTreatStamps(message);
        return;
    }
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets) return logBib('Cannot relay treat stamp: Blacksmith sockets unavailable', '', false, false);
    try {
        await sockets.waitForReady();
        await sockets.emit(SOCKET_TREAT_STAMP, { messageId: message.id });
    } catch (error) {
        logBib('Treat stamp relay failed', error?.message, false, false);
    }
}

// Sweep every treatment row in the message: any row whose effect is no
// longer on its actor loses its Treat button and gains a bandaid mark —
// the clicked row, the condition rows a bundled injury took with it, and
// rows that went stale any other way.
//
// The row is rewritten in the stored composition rather than in the
// rendered HTML, so every client re-renders to the same card.
async function sweepTreatStamps(message) {
    try {
        if (!message.canUserModify(game.user, 'update')) return;
        const state = message.getFlag(MODULE.ID, 'checkup');
        if (!state?.rows) return;
        const actor = canvas?.tokens?.get(state.tokenId ?? '')?.actor
            ?? game.actors.get(state.actorId ?? '');
        if (!actor) return;

        const card = getCard(message);
        if (!card?.parts) return;

        let changed = false;
        for (const part of card.parts) {
            if (part.part !== 'rows') continue;
            for (const row of part.items ?? []) {
                if (!row.action || actor.effects.get(row.value ?? '')) continue;
                // Treated: the control goes, and a mark takes its place so
                // the row still says what happened to it.
                delete row.action;
                delete row.actionIcon;
                delete row.moduleId;
                row.trailingIcon = 'fa-solid fa-bandage';
                row.tone = 'positive';
                changed = true;
            }
        }
        if (changed) await updateCard(message, card.parts);
    } catch (error) {
        logBib('Could not mark treatment done', error?.message, false, false);
    }
}

// ==================================================================
// ===== APPLYING AN OUTCOME ========================================
// ==================================================================
// Two things make this more than "click button, apply effect":
//
//   PICKS — "each of two party members loses 1 HP" is one card asking
//   for two decisions. The remaining count lives in the card's own
//   flags, never in a client's memory, so a refresh or a second client
//   sees the same state.
//
//   WHO MAY CLICK — the player whose character rolled gets to make the
//   card's choice. Their client cannot create effects on actors they do
//   not own, nor rewrite the GM's chat message, so the click is relayed
//   and the GM performs it. `readableBy` on the actions part is
//   presentation; the ownership check here is the one that decides.
// ==================================================================

/** Does this user own the actor whose roll produced the card? */
function userOwnsRoller(rollerActorId, userId) {
    const user = game.users.get(userId ?? '');
    const actor = game.actors.get(rollerActorId ?? '');
    if (!user || !actor) return false;
    return user.isGM || actor.testUserPermission(user, 'OWNER');
}

/**
 * Turn one button press into the actor it lands on.
 *
 * "Random" is resolved BEFORE anything is applied, for two reasons: the
 * card can then retire that person's button, and a second random pick on
 * a two-pick card cannot land on someone already chosen — which it
 * otherwise would, since the applier treats a repeat as successfully
 * applied rather than as a no-op.
 *
 * @returns {{actorId: string|null}} null when the outcome is unbound and
 *          resolves against the clicker's selection instead
 */
function resolveOutcomePick(state, value) {
    if (value && value !== 'random') return { actorId: value };
    if (value !== 'random') return { actorId: state.targetActorId ?? null };

    const taken = new Set(state.picked ?? []);
    const pool = (state.candidates ?? []).filter((c) => !taken.has(c.id));
    const from = pool.length ? pool : (state.candidates ?? []);
    if (!from.length) return { actorId: null };
    return { actorId: from[Math.floor(Math.random() * from.length)].id };
}

/**
 * Record one applied pick against the stored card and rebuild its tail.
 *
 * Callers must hold update rights — a player's click arrives here only
 * after being relayed to the GM.
 */
async function stampOutcomeApplied(message, state, appliedNames, appliedActorId) {
    const card = getCard(message);
    const at = card?.parts?.findIndex((part) => part.part === 'actions') ?? -1;
    if (at === -1) return false;

    // Names accumulate across clicks so the closing stamp names everyone,
    // and the actor ids so the same party member cannot be picked twice —
    // including by the dice, which choose from what is left.
    const next = {
        ...state,
        picksRemaining: Math.max(0, (state.picksRemaining ?? 1) - 1),
        appliedNames: [...(state.appliedNames ?? []), ...appliedNames],
        picked: appliedActorId ? [...(state.picked ?? []), appliedActorId] : (state.picked ?? [])
    };

    card.parts[at] = composeOutcomeActions(next);
    await updateCard(message, card.parts);
    await message.setFlag(MODULE.ID, 'outcome', next);
    return true;
}

const SOCKET_OUTCOME_APPLY = `${MODULE.ID}.outcomeApply`;

/** GM side: resolve apply-outcome clicks made by players. */
async function registerOutcomeApplySocket() {
    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets) return;
    await sockets.waitForReady();
    await sockets.register(SOCKET_OUTCOME_APPLY, async (payload) => {
        if (game.users.activeGM?.id !== game.user.id) return;
        const message = game.messages.get(payload?.messageId ?? '');
        if (!message) return;
        // The relay is a request, not a fact. Re-check both halves against
        // live state: the card must still have picks left (else this is a
        // stale or double click), and the requester must really own the
        // roller (else the client gate was bypassed).
        const state = message.getFlag(MODULE.ID, 'outcome');
        if (!state || state.picksRemaining <= 0) {
            logBib('Ignoring relayed outcome apply — that choice is already spent', '', true, false);
            return;
        }
        if (state.needsSelection) {
            logBib("Refused relayed outcome apply — that button resolves against the clicker's selection and is GM-only", '', false, false);
            return;
        }
        if (!userOwnsRoller(state.rollerActorId, payload?.userId)) {
            logBib(`Refused relayed outcome apply from ${game.users.get(payload?.userId ?? '')?.name ?? 'unknown user'} — they do not own the roller`, '', false, false);
            return;
        }
        await applyOutcomePick(message, state, payload?.value ?? '');
    });
}

/** Apply one pick and record it. GM side only. */
async function applyOutcomePick(message, state, value) {
    const pick = resolveOutcomePick(state, value);
    // One payload for both kinds: applyOutcomeStatus routes a card-dealing
    // outcome to the deck itself, because both arrive on the same button
    // and carry the same targeting.
    const data = { ...state.apply };
    if (state.dealscard) data.dealscard = true;
    if (state.partyMode) data.partyMode = true;
    if (pick.actorId) data.targetActorId = pick.actorId;

    const applied = await applyOutcomeStatus(data);
    if (!applied?.length) return;
    await stampOutcomeApplied(message, state, applied, pick.actorId);
}


// ************************************
// ** UTILITY Reset Bibliosoph Vars
// ************************************

function resetBibliosophVars() {
    BIBLIOSOPH.CARDTYPE = "";
    BIBLIOSOPH.CARDTYPEENCOUNTER = false;
    BIBLIOSOPH.CARDTYPEINVESTIGATION = false;
    BIBLIOSOPH.MACRO_ID = "";
}

