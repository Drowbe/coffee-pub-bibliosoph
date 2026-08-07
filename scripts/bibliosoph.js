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

// Log through Blacksmith's console tool wherever possible; raw console is
// reserved for bootstrap failures where Blacksmith itself is unavailable.
function logBib(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, message, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | ${message}`, data);
    }
}

// Cached compiled chat-card template — fetched and compiled once per
// session instead of on every card.
let _compiledCardTemplate = null;
async function getCardTemplate() {
    if (!_compiledCardTemplate) {
        const response = await fetch(BIBLIOSOPH.MESSAGE_TEMPLATE_CARD);
        _compiledCardTemplate = Handlebars.compile(await response.text());
    }
    return _compiledCardTemplate;
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
    const html = await createChatCardOutcome(type, { title, rollerActorId, rollerTokenId, hitActorId, overrides });
    if (!html) {
        logBib(`No outcome found in "${compendium}"`, '', false, false);
        showBibToast(`No ${kindLabel} Found`, `"${compendium}" has no matching entries.`, 'fa-solid fa-book-open');
        return;
    }
    await ChatMessage.create({ user: game.user.id, content: html, speaker: ChatMessage.getSpeaker() });
}

// Read an outcome record off a typed page (system data is authoritative).
// Decode a card button's data-effect payload (JSON+URI, with a fallback
// for cards posted before the encoding switch). Module scope, not the
// click listener's: the apply-outcome handler lives outside that closure.
function decodeEffectPayload(raw) {
    try {
        return JSON.parse(decodeURIComponent(raw));
    } catch (_) {
        return BlacksmithUtils.stringToObject(raw);
    }
}

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
    if (!pack) return '';

    // Scan EVERY journal in the pack. The bucket journals (Butchery,
    // Carnage, Slaughter…) are organisational; each page states its own
    // severity and odds, so a renamed or added journal changes nothing.
    const entries = await pack.getDocuments();
    const candidates = entries
        .flatMap((journal) => Array.from(journal.pages ?? []))
        .map((page) => readOutcomeRecord(page))
        .filter((rec) => rec && rec.kind === type);
    if (!candidates.length) return '';

    const picked = title
        ? candidates.find((c) => c.title === title)
        : weightedPick(candidates, (c) => c.odds);
    if (!picked) { logBib(`No outcome titled "${title}"`, '', false, false); return ''; }
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

    const template = await getCardTemplate();
    const html = template({
        userName: game.user.name,
        userAvatar: game.user.avatar,
        playerType: game.user.isGM ? 'Gamemaster' : 'Player',
        characterName: game.user.isGM ? 'Cocktail Craftsman and Moderator' : (game.user.character?.name ?? 'No Character Set'),
        theme: getSettingSafe(isCrit ? 'cardThemeCritical' : 'cardThemeFumble', 'cardsdefault'),
        iconStyle: isCrit ? 'fa-burst' : 'fa-heart-crack',
        cardTitle: isCrit ? 'Critical Hit' : 'Fumble',
        title: rec.title,
        cardSubTitle: severityLabel(type, rec.severity),
        iconSubStyle: isCrit ? 'fa-burst' : 'fa-heart-crack',
        content: rec.description,
        image: getSettingSafe('outcomeImageEnabled', true) ? (rec.image || '') : '',
        imagecaption: rec.imagetitle || '',
        imageBackground: 'themecolor',
        // Mechanics, spelled out on the card
        outcomemechanics: buildOutcomeMechanics(rec, modifierLines, rounds),
        rollerActorId: rollerId,
        ...buildOutcomeApplyButtons(rec, APPLYDATA, cast),
        applyoutcomeicon: isCrit ? 'fa-burst' : 'fa-heart-crack',
        hasSectionContent: true
    });

    BlacksmithUtils.playSound(
        isCrit ? 'modules/coffee-pub-blacksmith/sounds/reaction-yay.mp3'
            : 'modules/coffee-pub-blacksmith/sounds/sadtrombone.mp3',
        '0.7'
    );
    return html;
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
 * The apply controls, which differ by who the outcome lands on:
 *   party — one button that just does it, to everyone, no selecting
 *   ally  — one button PER party member, because "you pick who gets
 *           this" is a decision the table makes out loud
 *   self  — the roller, named when we know who that is
 *   else  — the usual single button against the selected token
 */
function buildOutcomeApplyButtons(rec, applyData, cast = {}) {
    const encode = (data) => encodeURIComponent(JSON.stringify(data));

    // Card-dealing outcomes hand someone a card from the inspiration deck
    // instead of applying a status. `appliesto` still decides WHO, so this
    // reuses the same picker rather than inventing a second targeting idea.
    if (rec.dealscard) {
        const deal = (extra) => encode({ dealscard: true, name: rec.title, ...extra });
        if (rec.appliesto === 'ally' || rec.appliesto === 'party') {
            const party = getPartyActors();
            if (party.length) {
                return {
                    applyoutcomerandom: deal({ randomAlly: true }),
                    applyoutcomepicker: party.map((actor) => ({
                        name: actor.name,
                        img: actor.img || 'icons/svg/mystery-man.svg',
                        payload: deal({ targetActorId: actor.id })
                    })),
                    applyoutcomeicon: 'fa-lightbulb',
                    applyoutcomepicks: 1,
                    applyoutcomehint: 'Pick who draws a card, or let the dice decide.'
                };
            }
        }
        const named = rec.appliesto === 'self' ? cast.roller : (cast.hit ?? cast.roller);
        return {
            applyoutcome: deal({ targetActorId: named?.id ?? null }),
            applyoutcomelabel: named ? `Deal a Card to ${named.name}` : 'Deal an Inspiration Card',
            // Unbound: resolved from whoever the clicker has selected, which
            // makes it the GM's to press — see the render gate.
            applyoutcomeneedsselection: !named,
            applyoutcomehint: named ? '' : 'Select who draws, or the card goes to your own character.'
        };
    }

    if (rec.appliesto === 'party') {
        const party = getPartyActors();
        return {
            applyoutcome: encode({ ...applyData, partyMode: true }),
            applyoutcomelabel: party.length ? `Apply to the Whole Party (${party.length})` : 'Apply to the Whole Party',
            applyoutcomehint: party.length ? '' : 'No party members found — select tokens instead.'
        };
    }

    if (rec.appliesto === 'ally') {
        const party = getPartyActors();
        if (party.length) {
            // "Two party members each lose 1 HP" is one card, not two: the
            // picker stays open until `picks` choices have been made.
            const picks = picksFor(rec);
            return {
                // Some entries say "you pick", others say "GM chooses with a
                // dice roll" — offer both rather than encoding which is which.
                applyoutcomerandom: encode({ ...applyData, randomAlly: true }),
                applyoutcomepicker: party.map((actor) => ({
                    id: actor.id,
                    name: actor.name,
                    img: actor.img || 'icons/svg/mystery-man.svg',
                    payload: encode({ ...applyData, targetActorId: actor.id })
                })),
                applyoutcomeicon: applyData.kind === 'crit' ? 'fa-burst' : 'fa-heart-crack',
                applyoutcomepicks: picks,
                applyoutcomehint: picks > 1
                    ? targetHint('ally', picks)
                    : 'Pick who it lands on, or let the dice decide.'
            };
        }
    }

    // Name the person when we can, and bind the button to them: the card
    // records a specific moment, so it should not quietly re-aim at
    // whatever happens to be selected when someone gets around to clicking.
    const named = rec.appliesto === 'self' ? cast.roller
        : (rec.appliesto === 'target' ? (cast.hit ?? null) : null);
    if (named) {
        return {
            applyoutcome: encode({ ...applyData, targetActorId: named.id }),
            applyoutcomelabel: `Apply to ${named.name}`,
            applyoutcomehint: ''
        };
    }

    // Nothing to bind to, so this one applies to whatever the clicker has
    // selected on the canvas. That makes it the GM's button by nature: a
    // relayed player click would silently use the GM's selection instead.
    return {
        applyoutcome: encode(applyData),
        applyoutcomelabel: `Apply to ${targetLabel(rec.appliesto).replace(/^The /, '')}`,
        applyoutcomeneedsselection: true,
        applyoutcomehint: TARGET_HINTS[rec.appliesto] ?? ''
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
function triggerInjuriesRoll() {
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINJURY = true;
    BIBLIOSOPH.CARDTYPE = "General";
    publishChatCard();
}

// Roll an injury for a specific damage category and post the card directly
// (skipping the selector). Used by manager-roll-toasts.js for the injury
// Automation click/auto modes. `target` ({actorId, tokenId}) is the actor
// who took the damage — the card's Apply button binds to them.
export async function rollInjuryCard(category, target = null) {
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINJURY = true;
    BIBLIOSOPH.CARDTYPE = "General";
    let compiledHtml = await createChatCardInjury(category, target);
    resetBibliosophVars();
    if (!compiledHtml) return;

    // Automatically Apply Injury: with a known target, apply BEFORE posting
    // and swap the card's Apply button for the applied stamp. Runs on the
    // rolling client (the injured player in click mode, the GM in auto),
    // both of whom own the target actor. Any failure falls back to posting
    // the normal button.
    const autoApply = BlacksmithUtils.getSettingSafely(MODULE.ID, 'injuryAutoApply', false);
    if (autoApply && (target?.actorId || target?.tokenId)) {
        try {
            const doc = new DOMParser().parseFromString(compiledHtml, 'text/html');
            const button = doc.querySelector('.coffee-pub-bibliosoph-button-injury');
            const targetActor = canvas?.tokens?.get(target.tokenId ?? '')?.actor
                ?? game.actors.get(target.actorId ?? '');
            if (button && targetActor) {
                // decodeEffectPayload, not a bare JSON.parse: cards posted
                // before the encoding switch need the fallback too.
                const data = decodeEffectPayload(button.getAttribute('data-effect'));
                const applied = await applyStatusToTokens(buildInjuryApplyConfig(data, [targetActor]));
                if (applied.length) {
                    const stamp = doc.createElement('div');
                    stamp.style.cssText = 'width:100%; text-align:center; font-weight:bold; padding:5px 0;';
                    stamp.textContent = `✓ Applied to ${applied.join(', ')}`;
                    button.replaceWith(stamp);
                    for (const hint of doc.querySelectorAll('.bibliosoph-apply-hint')) hint.remove();
                    compiledHtml = doc.body.innerHTML;
                }
            }
        } catch (error) {
            logBib('Auto-apply injury failed; posting card with the button', error?.message, false, false);
        }
    }

    await ChatMessage.create({
        user: game.user.id,
        content: compiledHtml,
        speaker: ChatMessage.getSpeaker()
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
    const compiledHtml = await createChatCardTreatment(token);
    if (!compiledHtml) return;
    await ChatMessage.create({
        user: game.user.id,
        content: compiledHtml,
        speaker: ChatMessage.getSpeaker()
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
            buttonIcon: kind === 'injury' ? 'fa-bandage'
                : (kind === 'crit' || kind === 'fumble') ? 'fa-burst'
                : 'fa-sparkles',
            payload: encodeURIComponent(JSON.stringify({
                actorId: actor.id,
                tokenId: token.id,
                effectId: effect.id,
                kind,
                name: rowName,
                dc
            }))
        };
    }));

    // Four zones, fixed order: injuries (bundles), then the d20 outcomes,
    // then loose effects & conditions. Empty zones are omitted.
    const GROUP_ORDER = [
        { key: 'injury', label: 'Injuries' },
        { key: 'crit', label: 'Criticals' },
        { key: 'fumble', label: 'Fumbles' },
        { key: 'other', label: 'Effects & Conditions' }
    ];
    const treatmentgroups = GROUP_ORDER
        .map((g) => ({ label: g.label, rows: treatmentrows.filter((r) => r.kind === g.key) }))
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
    // Health bar — Crier's turn-card bands and colors
    const hpBar = pctHp === null ? null : {
        percent: Math.max(0, Math.min(100, pctHp)),
        label: `${hp.value}/${hp.max} HP`,
        color: Number(hp.value) <= 0 ? 'rgba(66, 66, 66, 0.9)'
            : pctHp >= 75 ? 'rgba(98, 150, 2, 0.9)'
            : pctHp >= 50 ? 'rgba(223, 134, 1, 0.9)'
            : pctHp >= 25 ? 'rgba(119, 40, 16, 0.9)'
            : 'rgba(119, 20, 16, 0.9)'
    };

    const template = await getCardTemplate();
    const CARDDATA = {
        theme: game.settings.get(MODULE.ID, 'cardThemeInjury'),
        iconStyle: 'fa-stethoscope',
        cardTitle: 'Check-Up',
        imageBackground: 'cobblestone',
        userName: token.name,
        userAvatar: actor.img || token.document?.texture?.src || '',
        portraitBlood,
        hpBar,
        playerType: 'Patient',
        characterName: healthDesc.charAt(0).toUpperCase() + healthDesc.slice(1),
        content: diagnosis,
        treatmentgroups,
        hasSectionContent: treatmentgroups.length > 0,
    };
    BlacksmithUtils.playSound("modules/coffee-pub-blacksmith/sounds/notification.mp3", "0.7");
    return template(CARDDATA);
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

    const card = title ? cards.find((c) => c.title === title) : weightedPick(cards, (c) => c.odds);
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

    const template = await getCardTemplate();
    const html = template({
        theme: getSettingSafe('cardThemeInspiration', 'cardsdefault'),
        iconStyle: 'fa-lightbulb',
        cardTitle: 'Inspiration',
        // No subtitle: the holder's name belongs in the recipient row
        // below, next to their portrait, not floating above the art.
        title: card.title,
        content: card.description,
        image: card.image || '',
        imagecaption: card.imagetitle || '',
        imageBackground: 'themecolor',
        // Same describer the item uses, so the draw card and the card in
        // their inventory say the same thing about what it does.
        outcomemechanics: INSPIRATION_ACTIONS.describeInspirationCard(card),
        ...buildInspirationRecipient(card, holder, cardItem),
        // With the card in their inventory, the ITEM is how it gets used —
        // a second button here would just be a way to play the card
        // without it leaving their sheet. The button survives only as the
        // fallback for a draw that reached nobody.
        ...(cardItem ? {} : {
            inspirationuse: encodeURIComponent(JSON.stringify({
                title: card.title,
                action: card.action ?? 'none',
                actionamount: card.actionamount ?? null,
                actionformula: card.actionformula ?? '',
                holderActorId: holder?.id ?? null,
                sourceUuid: card.sourceUuid ?? null
            })),
            inspirationuselabel: card.action && card.action !== 'none'
                ? `Use — ${actionButtonFor(card.action)}`
                : 'Use This Card',
            inspirationusehint: card.action && card.action !== 'none' ? actionHintFor(card.action) : ''
        }),
        hasSectionContent: true
    });

    BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/spell-magic-circle.mp3', '0.7');
    await ChatMessage.create({ user: game.user.id, content: html, speaker: ChatMessage.getSpeaker() });

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
    const template = await getCardTemplate();
    const html = template({
        theme: getSettingSafe('cardThemeInspiration', 'cardsdefault'),
        iconStyle: 'fa-lightbulb',
        cardTitle: 'Inspiration',
        title: card.title,
        content: card.description,
        image: card.image || '',
        imagecaption: card.imagetitle || '',
        imageBackground: 'themecolor',
        outcomemechanics: INSPIRATION_ACTIONS.describeInspirationCard(card, { context: 'play' }),
        // Same portrait row as the draw card, so "whose card is this" reads
        // identically whether it was just dealt or is being cashed in.
        // No note line here — the mechanics block above already states that
        // playing it discards the card, and saying it twice on one card
        // reads like the card is not sure.
        ...(holder ? {
            inspirationnotelabel: 'Played by',
            inspirationholder: holder.name,
            inspirationportrait: holder.img || 'icons/svg/mystery-man.svg'
        } : {}),
        ...buildInspirationPlayButtons(card, holder, itemUuid),
        hasSectionContent: true
    });
    BlacksmithUtils.playSound('modules/coffee-pub-blacksmith/sounds/spell-magic-circle.mp3', '0.7');
    await ChatMessage.create({
        user: game.user.id,
        content: html,
        speaker: holder ? ChatMessage.getSpeaker({ actor: holder }) : ChatMessage.getSpeaker()
    });
}

/**
 * The resolve controls. Which buttons appear comes from the card's target
 * mode, so the question "who does this land on?" is answered by clicking
 * a name rather than by remembering to select the right token first.
 *
 *   none   — one button; the table resolves the rest
 *   self   — one button, naming the holder
 *   ally   — one per party member, plus let-the-dice-decide
 *   target — one per creature they currently have targeted
 *   any    — the holder, the party, and anything targeted
 */
function buildInspirationPlayButtons(card, holder, itemUuid) {
    const mode = INSPIRATION_ACTIONS.targetModeFor(card);
    const base = {
        title: card.title,
        action: card.action ?? 'none',
        actionamount: card.actionamount ?? null,
        actionformula: card.actionformula ?? '',
        holderActorId: holder?.id ?? null,
        sourceUuid: card.sourceUuid ?? null,
        itemUuid
    };
    const encode = (extra) => encodeURIComponent(JSON.stringify({ ...base, ...extra }));
    // Inspiration is played at the table, not on the battle map: a party
    // member with no token on this scene is still a legal target.
    const party = getPartyActors({ requireToken: false });
    const targeted = Array.from(game.user?.targets ?? []).map((t) => t.actor).filter(Boolean);

    // No aiming to do: one button, and the point is the whole mechanic.
    // The mechanics block above it already states the cost, so the hint
    // stays out of the way rather than repeating it.
    if (mode === 'none') {
        return {
            inspirationuse: encode({}),
            inspirationuselabel: 'Play This Card',
            inspirationusehint: ''
        };
    }

    if (mode === 'self') {
        return {
            inspirationuse: encode({ targetActorId: holder?.id ?? null }),
            inspirationuselabel: holder ? `Use on ${holder.name}` : (actionButtonFor(card.action) || 'Use This Card'),
            inspirationusehint: ''
        };
    }

    // Candidate list, deduped, in the order the player is likeliest to
    // want: themselves first for "any", then the party, then their target.
    const candidates = [];
    const add = (actor, note = '') => {
        if (!actor || candidates.some((c) => c.actor.id === actor.id)) return;
        candidates.push({ actor, note });
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
            inspirationuse: encode({}),
            inspirationuselabel: actionButtonFor(card.action) || 'Use This Card',
            inspirationusehint: mode === 'target'
                ? 'Target a creature on the canvas, then click.'
                : actionHintFor(card.action)
        };
    }

    return {
        // Life Swap-style "call out their name" cards get a dice option
        // too, for the tables that would rather let fate pick.
        ...(mode === 'ally' && candidates.length > 1
            ? { inspirationrandom: encode({ randomAlly: true }) }
            : {}),
        inspirationpicker: candidates.map(({ actor, note }) => ({
            name: note ? `${actor.name} (${note})` : actor.name,
            img: actor.img || 'icons/svg/mystery-man.svg',
            payload: encode({ targetActorId: actor.id })
        })),
        inspirationusehint: mode === 'target'
            ? 'Pick the creature it hits.'
            : 'Pick who it lands on.'
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
            inspirationnote: game.user.isGM
                ? 'Nobody was selected, so this card went to no one. Select a token and deal again.'
                : 'You have no assigned character, so this card went nowhere. Ask the GM to deal it to you.'
        };
    }
    return {
        inspirationnotelabel: '',
        inspirationholder: holder.name,
        inspirationportrait: holder.img || 'icons/svg/mystery-man.svg',
        // Name kept separate from the sentence so the template can bold it
        // without anything having to hand-write HTML into a message string.
        inspirationcardname: card.title,
        inspirationnote: cardItem
            ? 'has been added to their inventory.'
            : 'could not be added. Add it manually.'
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
 * Resolve a played card. Reached from the card's buttons — the one the
 * item raises, and the draw card's fallback button. Narrative cards still
 * spend the point; the table resolves the rest out loud.
 */
async function useInspirationCard(buttonEl, data) {
    const { applyInspirationCard, resolveTargets } = await import('./manager-inspiration.js');
    const holder = game.actors.get(data?.holderActorId ?? '');

    // The button carries the decision. Life Swap needs the holder in the
    // list too, since swapping is between two people; everything else
    // acts on the single actor whose name got clicked. Token selection is
    // only the fallback for cards posted without a picker.
    const targetActorIds = resolveInspirationTargets(data, holder)
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
    await markCardButtonApplied(
        buttonEl,
        '.coffee-pub-bibliosoph-button-inspiration',
        [result.summary || (holder?.name ?? 'the party')]
    );
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

    // BUTTON PRESSES IN CHAT (closest() so clicks on inner icons land too)
    document.addEventListener('click', async function(event) {
        // CHECK FOR INJURY BUTTON
        const injuryButton = event.target.closest?.('.coffee-pub-bibliosoph-button-injury');
        if (injuryButton) {
            const arrEffectData = decodeEffectPayload(injuryButton.getAttribute('data-effect'));

            // Automation cards know exactly who took the damage; manual
            // selector cards fall back to click-time targeting.
            let explicitActors = null;
            if (arrEffectData.targetActorId || arrEffectData.targetTokenId) {
                const targetActor = canvas?.tokens?.get(arrEffectData.targetTokenId ?? '')?.actor
                    ?? game.actors.get(arrEffectData.targetActorId ?? '');
                if (targetActor) explicitActors = [targetActor];
            }

            const applied = await applyStatusToTokens(buildInjuryApplyConfig(arrEffectData, explicitActors));
            await markCardButtonApplied(injuryButton, '.coffee-pub-bibliosoph-button-injury', applied);
        }

        // CHECK FOR APPLY CRITICAL / FUMBLE BUTTON
        const applyOutcomeButton = event.target.closest?.('.coffee-pub-bibliosoph-button-apply-outcome');
        if (applyOutcomeButton) {
            await handleApplyOutcomeClick(applyOutcomeButton);
        }

        // CHECK FOR USE-INSPIRATION BUTTON
        const inspirationButton = event.target.closest?.('.coffee-pub-bibliosoph-button-inspiration');
        if (inspirationButton) {
            const data = decodeEffectPayload(inspirationButton.getAttribute('data-inspiration'));
            if (data) await useInspirationCard(inspirationButton, data);
        }

        // CHECK FOR APPLY TREATMENT BUTTON
        const treatButton = event.target.closest?.('.coffee-pub-bibliosoph-button-treat');
        if (treatButton) {
            const raw = treatButton.getAttribute('data-treat');
            let data = null;
            try { data = JSON.parse(decodeURIComponent(raw)); } catch (_) { /* malformed row */ }
            if (data) await treatAffliction(treatButton, data);
        }

    });

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

// ************************************
// ** HOOK TEST INJURY CHAT BUTTON
// ************************************

Hooks.on("renderChatMessageHTML", (message, html) => {
    // renderChatMessageHTML delivers a native HTMLElement; keep the jQuery
    // normalization as a belt-and-suspenders for any shimmed callers.
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    // Encounter card: GM sees linked monsters; non-GM sees plain text or "Unknown Adversaries" (detection 1-2)
    const encounterAdversaries = nativeHtml?.querySelectorAll?.('.bibliosoph-encounter-adversaries') ?? [];
    encounterAdversaries.forEach((el) => {
        const gmView = el.querySelector('.encounter-adversaries-gm-view');
        const playerView = el.querySelector('.encounter-adversaries-player-view');
        if (!gmView || !playerView) return;
        if (game.user?.isGM) {
            gmView.style.display = '';
            playerView.style.display = 'none';
        } else {
            gmView.style.display = 'none';
            playerView.style.display = '';
        }
    });

    // GM-only buttons, pruned on player clients (the card HTML is identical
    // for every viewer): applying crits/fumbles/injuries is the GM's call,
    // and on the Check-Up only injury rows are player-treatable (Medicine
    // roll) — crit/fumble/condition rows are GM dismiss-only. Surviving
    // treat buttons get a per-viewer tooltip saying exactly how THIS user
    // would roll (kit/self advantage state) — computed at render time since
    // it depends on the viewer, never baked into the shared HTML.
    if (!game.user.isGM) {
        nativeHtml?.querySelectorAll?.('.coffee-pub-bibliosoph-button-injury')?.forEach((btn) => btn.remove());
        // Crit/fumble choices — who it lands on — belong to the player whose
        // character rolled, so their client keeps the buttons and everyone
        // else loses them. Cosmetic only: the GM re-checks ownership before
        // applying anything relayed to them.
        nativeHtml?.querySelectorAll?.('.coffee-pub-bibliosoph-button-apply-outcome')?.forEach((btn) => {
            // Buttons that resolve against the clicker's canvas selection
            // stay GM-only: relayed, they would read the GM's selection, not
            // the player's, and quietly land on the wrong token.
            if (btn.dataset.needsSelection === '1') return btn.remove();
            const roller = game.actors.get(btn.dataset.rollerActor ?? '');
            if (!roller?.isOwner) btn.remove();
        });
        // Never leave the instruction behind. "Select everyone in range."
        // above nothing is a direction to someone with no way to follow it,
        // so the hint and its button live or die together.
        nativeHtml?.querySelectorAll?.('.bibliosoph-outcome-apply')?.forEach((box) => {
            if (!box.querySelector('.coffee-pub-bibliosoph-button-apply-outcome')) box.remove();
        });
        // Cards posted before that wrapper existed keep the hint as a bare
        // sibling, so sweep any that no longer sit beside something to press.
        nativeHtml?.querySelectorAll?.('.bibliosoph-apply-hint')?.forEach((hint) => {
            if (hint.closest('.bibliosoph-outcome-apply')) return;
            const actionable = hint.parentElement?.querySelector(
                '.coffee-pub-bibliosoph-button-apply-outcome, .coffee-pub-bibliosoph-button-inspiration'
            );
            if (!actionable) hint.remove();
        });
    } else {
        appendGmNotesToTooltips(nativeHtml);
    }
    nativeHtml?.querySelectorAll?.('.coffee-pub-bibliosoph-button-treat[data-kind]')?.forEach((btn) => {
        const kind = btn.dataset.kind;
        if (!game.user.isGM && kind !== 'injury') return btn.remove();
        btn.removeAttribute('title');
        btn.dataset.tooltip = game.user.isGM
            ? (kind === 'injury' ? `Treat instantly — GM discretion, no roll.${gmDcNote(btn)}`
                : kind === 'crit' ? 'Dismiss this critical (GM only).'
                : kind === 'fumble' ? 'Dismiss this fumble (GM only).'
                : 'Remove this effect and unwind its condition (GM only).')
            : buildTreatTooltip(btn);
        btn.dataset.tooltipDirection = 'UP';
    });

    const buttons = nativeHtml.querySelectorAll(".category-button");
    buttons.forEach(button => {
        // Guard against double-binding on re-renders of the same message
        if (button.dataset.bibliosophBound) return;
        button.dataset.bibliosophBound = "1";
        button.addEventListener('click', async (event) => {
        event.preventDefault();
        
        // Removed unnecessary debug logging - button clicks don't need console spam

        // Retrieve the category from button value
        let strInjuryCategory = event.currentTarget.value;
        
        // Create the card
        let compiledHtml = await createChatCardInjury(strInjuryCategory);
        
        let chatData = {
            user: game.user.id,
            content: compiledHtml,
            speaker: ChatMessage.getSpeaker()
        };

        // Delete the original chat message before creating a new one
        await message.delete();

        // Send the message to the chat window
        ChatMessage.create(chatData);
        });
    });
});


// ================================================================== 
// ===== FUNCTIONS ==================================================
// ================================================================== 

// Create and send the card
// 1. Create the card
// 2. Send the card to chat.



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
    var compiledHtml = "";
    var strInjuryCategory = "";
    var strRollTableName = "";
    if (BIBLIOSOPH.CARDTYPEINVESTIGATION) {
        // INVESTIGATION (new flow: narrative + slots + per-rarity tables)
        compiledHtml = await createChatCardInvestigation();
    }
    // Criticals, fumbles and inspiration no longer come through here: each
    // builds its own card straight from its typed compendium
    // (createChatCardOutcome / the inspiration deck). This function is now
    // only the investigation and injury path.
    else if (BIBLIOSOPH.CARDTYPEINJURY) {

        // V12 CONTEXT:
        //Atropos — 03/04/2024 6:00 AM
        // Existing chat messages are migrated so that if their style was previously the integer 4, it is now 0 so matching on the CONST.CHAT_MESSAGE_STYLES.WHISPER const will still match.
        // Atropos — 03/04/2024 6:00 AM
        // @cs96and the important reason for this change is so that users who are creating new chat messages using style: CONST.CHAT_MESSAGE_STYLES.WHISPER will obtain the correct behavior. There is no specific whisper type or style anymore - only whehter or not a message has whisper recipients.
        
        // INJURY CARD


        var compendiumName = game.settings.get(MODULE.ID, 'injuryCompendium');
        let content = await createChatCardInjurySelector(compendiumName);

        let chatData = {
            user: game.user._id,
            content: content
        };
        
        // Store the created chat message
        let chatMessage = await ChatMessage.create(chatData);
        
    }
    else
    {   
        // NOTHING
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Card Type: No Card Type Set", "", true, false);
    }
    // If there is content, send it as a normal chat message.
    // (Whisper delivery was removed with the legacy private messages — the
    // unified Messages window handles private conversations now.)
    if (compiledHtml){
        var chatData = {
            user: game.user._id,
            content: compiledHtml,
            speaker: ChatMessage.getSpeaker()
        };
        // Send the msaage to the chat window.
        ChatMessage.create(chatData, {});
    }

    // Reset everything for the next time - This is a system message
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "The card has been delivered, so we are clearing our variables for next time.", "", false, false);
    resetBibliosophVars();
}


// ************************************
// ** CREATE Injury Card
// ************************************

async function createChatCardInjury(category, target = null) {

    // Set the defaults
    var compendiumName = game.settings.get(MODULE.ID, 'injuryCompendium');
    var blnInjuryImageEnabled = game.settings.get(MODULE.ID, 'injuryImageEnabled');
    let strCategory = category; // we will use this to fileter the compendium
    var strSound = game.settings.get(MODULE.ID, 'injurySound');
    var strVolume = game.settings.get(MODULE.ID, 'injurySoundVolume');
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeInjury');
    var strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-oops-6.webp";
    var strIconStyle = "fa-droplet"; // default... specific overrides happen below.
    var iconSubStyle = "";
    var strType = BIBLIOSOPH.CARDTYPE + " Injury";
    var strImageBackground = "cobblestone";

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
    let objInjuryData = await getJournalCategoryPageData(compendiumName,strCategory) ;
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
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-acid-1.webp";
                    break;
                case "bludgeoning":
                    iconSubStyle = "fa-axe-battle";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-bludgeoning-2.webp";
                    break;
                case "cold":
                    iconSubStyle = "fa-snowflake";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-cold-4.webp";
                    break;
                case "fire":
                    iconSubStyle = "fa-fire";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-fire-6.webp";
                    break;
                case "force":
                    iconSubStyle = "fa-wind";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-force-1.webp";
                    break;
                case "lightning":
                    iconSubStyle = "fa-bolt-lightning";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-lightning-4.webp";
                    break;
                case "necrotic":
                    iconSubStyle = "fa-scythe";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-necrotic-3.webp";
                    break;
                case "piercing":
                    iconSubStyle = "fa-bow-arrow";
                     strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-piercing-1.webp";
                     break;
                case "poison":
                    iconSubStyle = "fa-flask-round-poison";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-poison-1.webp";
                    break;
                case "psychic":
                    iconSubStyle = "fa-brain";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-psychic-3.webp";
                    break;
                case "radiant":
                    iconSubStyle = "fa-bullseye";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-radiant-1.webp";
                    break;
                case "slashing":
                    iconSubStyle = "fa-knife-kitchen";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-slashing-4.webp";                    
                    break;
                case "thunder":
                    iconSubStyle = "fa-cloud-bolt";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-thunder-2.webp";
                    break;
                default:
                    iconSubStyle = "fa-droplet";
                    strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-oops-6.webp";
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

    const template = await getCardTemplate();
    // JSON + URI encoding: survives any prose that would corrupt the
    // legacy key=value|key=value format.
    var strStringifiedEFFECTDATA = encodeURIComponent(JSON.stringify(EFFECTDATA));
    //BlacksmithUtils.postConsoleAndNotification("EFFECTDATA converted to STRING as strStringifiedEFFECTDATA: ",strStringifiedEFFECTDATA, false, true, false);
    // if they have the image off in settings, hide it
    var strCardImage = "";
    if (!blnInjuryImageEnabled){
        strCardImage = "";
    } else {
        strCardImage = strInjuryImage;
    }
    // Pass the data to the template
    const CARDDATA = {
        theme: strTheme,
        iconStyle: strIconStyle, 
        // cardTitle: strInjuryCategory, // simplifying this for now
        cardTitle: strInjuryTitle,
        iconSubStyle: iconSubStyle,
        // cardSubTitle: strInjuryTitle, // simplifying this for now
        cardSubTitle: "",
        imageBackground: strImageBackground,
        imagecaption: strCardImage ? (strInjuryImageTitle || "") : "",
        title: "",
        content: strInjuryDescription,
        injurycategory: strInjuryCategory, // added for new injury category
        injurycategoryicon: iconSubStyle, // added for new injury category
        treatment: strInjuryTreatment,
        // banner: strBanner, // simplifying this for now
        banner: "",
        image: strCardImage,
        duration: strInjuryDuration,
        damage: strInjuryDamage,
        buttontext: strTargetName ? `Apply to ${strTargetName}` : strInjuryAction,
        // A real condition wins; otherwise fall back to flavour text for
        // the injuries whose "condition" was never a dnd5e one.
        statuseffect: (strStatusEffect !== 'none' ? strStatusEffect : (objInjuryData?.flavor || 'none')).toUpperCase(),
        // Roll penalties, spelled out the same way the crit/fumble cards
        // spell theirs out.
        outcomemechanics: (objInjuryData?.modifiers ?? []).map((m) => ({
            icon: 'fa-dice-d20', text: describeModifier(m)
        })).filter((line) => line.text),
        arreffect: strStringifiedEFFECTDATA, // Stringify the EFFECTDATA array
        hasSectionContent: !!strStringifiedEFFECTDATA,
    };
    // Play the Sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // Return the template

    //BlacksmithUtils.postConsoleAndNotification("*** LINE 1682 CARDDATA",  CARDDATA, false, true, false);

    const compiledHtml = template(CARDDATA);
    return compiledHtml;
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
    const strTheme = game.settings.get(MODULE.ID, 'cardThemeInvestigation');
    const strIconStyle = "fa-eye";
    const strUserName = game.user.name;
    const strUserAvatar = game.user.avatar;
    const strCharacterName = game.user.character?.name ?? "No Character Set";
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
        return "";
    }

    const foundNothingEntries = narrativeJson.foundNothing ?? [];
    const foundSomethingEntries = narrativeJson.foundSomething ?? [];
    const pickEntry = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : { title: "", tags: [], description: "" });

    const actor = game.user.character ?? canvas.tokens?.controlled?.[0]?.actor;

    // Roll: find coins or not (independent of items)
    let coinsFound = null;
    let coinsDisplayLine = "";
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
            coinsDisplayLine = coinParts.join(" · ");
            if (actor?.system?.currency) {
                try {
                    const cur = actor.system.currency;
                    await actor.update({
                        "system.currency.pp": (Number(cur.pp) || 0) + pp,
                        "system.currency.gp": (Number(cur.gp) || 0) + gp,
                        "system.currency.ep": (Number(cur.ep) || 0) + ep,
                        "system.currency.sp": (Number(cur.sp) || 0) + sp,
                        "system.currency.cp": (Number(cur.cp) || 0) + cp,
                    });
                    coinsSummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationCoinsSummary", { coins: coinParts.join(", "), character: actor.name });
                } catch (err) {
                    logBib(`Could not add coins to ${actor?.name ?? 'the actor'}`, err?.message ?? String(err), false, false);
                    showBibToast('Coins Not Added', `The coins could not be written to ${actor?.name ?? 'the character'} — add them by hand.`, 'fa-solid fa-coins');
                    coinsSummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationCoinsSummaryNoActor", {});
                }
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
        const CARDDATA = {
            isInvestigationCard: true,
            userName: strUserName,
            userAvatar: strUserAvatar,
            characterName: strCharacterName,
            theme: strTheme,
            iconStyle: strIconStyle,
            cardTitle: "Investigation",
            narrativeTitle: entry.title || (foundAnything ? "Search Results" : "Nothing Found"),
            narrativeDescription: entry.description || "",
            narrativeIcon: entry.icon || "<i class=\"fa-solid fa-dice\"></i>",
            itemsByRarity: [],
            inventorySummaryLine: "",
            coinsFound,
            coinsDisplayLine,
            coinsSummaryLine,
        };
        const template = await getCardTemplate();
        BlacksmithUtils.playSound(foundAnything ? "modules/coffee-pub-blacksmith/sounds/chest-treasure.mp3" : "modules/coffee-pub-blacksmith/sounds/chest-open.mp3", "0.7");
        return template(CARDDATA);
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
        const link = `@UUID[${documentUuid}]{${name}}`;
        const rarity = itemDoc.system?.rarity?.value ?? rarityLabel;

        if (actor) {
            try {
                const baseData = itemDoc.toObject();
                delete baseData._id;
                const hasQty = foundry.utils.getProperty(baseData, "system.quantity") !== undefined;
                if (hasQty) foundry.utils.setProperty(baseData, "system.quantity", 1);
                await actor.createEmbeddedDocuments("Item", [baseData]);
            } catch (err) {
                // The card still lists the item, so silence here would leave
                // the sheet and the card disagreeing with nobody the wiser.
                logBib(`Could not add "${name}" to ${actor?.name ?? 'the actor'}'s inventory`, err?.message ?? String(err), false, false);
                showBibToast('Item Not Added', `"${name}" could not be added to ${actor?.name ?? 'the character'} — add it by hand.`, 'fa-solid fa-sack-xmark');
            }
        }
        foundItems.push({ name, img, link, rarity });
    }

    const entry = pickEntry(foundSomethingEntries);
    let inventorySummaryLine = "";
    if (foundItems.length && actor) {
        const names = foundItems.map((f) => f.name);
        const counts = {};
        names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
        const parts = Object.entries(counts).map(([n, c]) => (c > 1 ? `${c} ${n}` : n));
        inventorySummaryLine = game.i18n.format("coffee-pub-bibliosoph.investigationInventorySummary", { items: parts.join(", "), character: actor.name });
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

    const CARDDATA = {
        isInvestigationCard: true,
        userName: strUserName,
        userAvatar: strUserAvatar,
        characterName: strCharacterName,
        theme: strTheme,
        iconStyle: strIconStyle,
        cardTitle: "Investigation",
        narrativeTitle: entry.title || "Search Results",
        narrativeDescription: entry.description || "",
        narrativeIcon: entry.icon || "<i class=\"fa-solid fa-dice\"></i>",
        itemsByRarity,
        inventorySummaryLine,
        coinsFound,
        coinsDisplayLine,
        coinsSummaryLine,
    };
    const template = await getCardTemplate();
    BlacksmithUtils.playSound("modules/coffee-pub-blacksmith/sounds/chest-treasure.mp3", "0.7");
    return template(CARDDATA);
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

// ************************************
// ** UTILITY Create Injury Selector
// ************************************

async function createChatCardInjurySelector(compendiumName) {
    
    const pack = game.packs.get(compendiumName);
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeInjury');
    var strIconStyle = "fa-skull";
    var strCardTitle = "Select Injury";
    var strTitle = "";
    var strContent = "";
    // var strButtonIcon = "";
    var strSound = "modules/coffee-pub-blacksmith/sounds/notification.mp3";
    //var strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-oops-10.webp";
    var strBanner = "modules/coffee-pub-blacksmith/images/banners/banners-damage-oops-10.webp";
    var strVolume = "0.7"
    let arrInjuryButtons = [];
    var arrCategories = [];
    // get the categories
    arrCategories = await getCompendiumJournalList(compendiumName, "category", true);
   //BlacksmithUtils.postConsoleAndNotification("createChatCardInjurySelector arrCategories" , arrCategories, false, true, false); 
    // build the buttons
    arrInjuryButtons = await getCategoryButtons(arrCategories);
    
    const template = await getCardTemplate();
    // Pass the data to the template
    const CARDDATA = {
        theme: strTheme,
        cardTitle: strCardTitle,
        iconStyle: strIconStyle,
        banner: strBanner,
        title: strTitle,
        content: strContent,
        injurybutton: arrInjuryButtons,
        hasSectionContent: !!(arrInjuryButtons && arrInjuryButtons.length),
    }; 
    // Play the sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // Return the template
    return template(CARDDATA);
} 

// ************************************
// ** UTILITY Get Category Buttons
// ************************************
// Input: Array of cateogry names
// Output: Array of icon + text for buttons.
async function getCategoryButtons(categories){

    var strButtonIcon = "";
    var arrCategories = categories;
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeInjury');
    var arrInjuryButtons = [];
    // Set the appripriate icon based on the array.
    if (arrCategories) {
        for (let category of arrCategories) {
            // get the icon
            switch(category.toLowerCase()) {
                case "acid":
                    strButtonIcon = "fa-droplet";
                     break;
                case "bludgeoning":
                    strButtonIcon = "fa-axe-battle";
                     break;
                case "cold":
                    strButtonIcon = "fa-snowflake";
                     break;
                case "fire":
                    strButtonIcon = "fa-fire";
                     break;
                case "force":
                    strButtonIcon = "fa-wind";
                     break;
                case "lightning":
                    strButtonIcon = "fa-bolt-lightning";
                     break;
                case "necrotic":
                    strButtonIcon = "fa-scythe";
                     break;
                case "piercing":
                    strButtonIcon = "fa-bow-arrow";
                     break;
                case "poison":
                    strButtonIcon = "fa-flask-round-poison";
                     break;
                case "psychic":
                    strButtonIcon = "fa-brain";
                     break;
                case "radiant":
                    strButtonIcon = "fa-bullseye";
                     break;
                case "slashing":
                    strButtonIcon = "fa-knife-kitchen";
                     break;
                case "thunder":
                    strButtonIcon = "fa-cloud-bolt";
                     break;
                default:
                    strButtonIcon = "fa-skull";
           }
            // building the object for handlebars
            let buttonObject = {
                theme: strTheme,
                category: category,
                buttonicon: strButtonIcon
            };
            // pushing the object into an array
            arrInjuryButtons.push(buttonObject);
        }
    } else {
        //BlacksmithUtils.postConsoleAndNotification("In createChatCardInjurySelector, arrCategories comes back null or undefined." , "", false, true, false); 
        return;
    }
    return arrInjuryButtons;
}

// ************************************
// ** UTILITY Get Compenium Pages [USING and WORKS]
// ************************************
// USEAGE: This returns all journals in a compendium and returns an array of their names.

async function getCompendiumJournalList(compendiumName) {
    // set vars
    const strCompendiumName = compendiumName;
    if (!strCompendiumName) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Compendium not supplied: " + strCompendiumName, "", false, false); 
        return;
    }
    // grab data
    const pack = game.packs.get(strCompendiumName);
    if (!pack) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Compendium not found: " + strCompendiumName, "", false, false); 
        return;
    }
    // Get all entries from the compendium 
    const entries = await pack.getDocuments();
    // Collect all available categories and add them to the buttons
    let arrValues = [];
    for (let entry of entries) {
        let strValue = entry.name;
        if (strValue && !arrValues.includes(strValue)) {
            arrValues.push(strValue);
        }
    }
    // Sort arrpages in alphabetical order
    arrValues.sort();
    //BlacksmithUtils.postConsoleAndNotification("getCompendiumPageContent" , arrValues, false, false, false);
    // If no arrpages, return null or handle however you prefer
    if (arrValues.length === 0) {
        return null;
    }
    // Return the Array
    var arrTEMP = [];
    arrTEMP = arrValues
    //BlacksmithUtils.postConsoleAndNotification("createChatCardInjurySelector arrTEMP" , arrTEMP, false, true, false); 
    return arrValues;
}


// ************************************
// ** UTILITY Get Pages for a specific journal 
// ************************************


// Pick one item weighted by its `odds` (1-100, higher = more common).
// Records with a missing or unusable value fall back to weight 1 rather
// than dropping out of the pool entirely.
function weightedPick(items, weightOf) {
    const weights = items.map((item) => {
        const w = Number(weightOf(item));
        return Number.isFinite(w) && w > 0 ? w : 1;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
}

// Read an injury record off a journal page, newest storage first:
//   1. system  — typed page subtype, validated by Foundry (current)
//   2. flag    — the interim format the generator stamped
//   3. HTML    — the original metadata block
// Older packs keep working; see documentation/spec-injury-schema.md.
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

async function getJournalCategoryPageData(compendiumName,category) {


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
    const picked = weightedPick(arrCandidates, (c) => c.record.odds);
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
async function treatAffliction(buttonEl, data) {
    const rollsOn = getSettingSafe('injuryTreatmentRolls', true);
    if (!game.user.isGM && rollsOn && data.kind === 'injury') {
        return requestTreatmentRoll(buttonEl, data);
    }
    const actor = canvas?.tokens?.get(data.tokenId ?? '')?.actor
        ?? game.actors.get(data.actorId ?? '');
    if (!actor) return showBibToast('Patient Not Found', 'Could not find the actor to treat.', 'fa-solid fa-triangle-exclamation');
    if (!actor.isOwner) return showBibToast('No Permission', `You cannot modify ${actor.name}.`, 'fa-solid fa-lock');

    const effect = actor.effects.get(data.effectId);
    if (!effect) {
        showBibToast('Already Gone', 'That affliction is no longer on the patient.', 'fa-solid fa-sparkles');
        await markTreatButtonDone(buttonEl);
        return;
    }
    const effectName = effect.name;
    await removeAffliction(actor, effect);
    showBibToast('Treated', `"${effectName}" removed from ${actor.name}.`, 'fa-solid fa-bandage');
    await markTreatButtonDone(buttonEl);
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
async function appendGmNotesToTooltips(root) {
    const icons = root?.querySelectorAll?.('.coffee-pub-bibliosoph-affliction-icon[data-source]') ?? [];
    for (const icon of icons) {
        const uuid = icon.dataset.source;
        if (!uuid || icon.dataset.gmNotesChecked) continue;
        icon.dataset.gmNotesChecked = '1';
        // Stash the note-free tooltip so a later refresh can rebuild
        // rather than appending the note a second time.
        icon.dataset.tooltipBase = icon.dataset.tooltip ?? '';
        await paintGmNoteTooltip(icon, uuid);
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
    document.querySelectorAll(`.coffee-pub-bibliosoph-affliction-icon[data-source="${uuid}"]`)
        .forEach((icon) => paintGmNoteTooltip(icon, uuid));
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

function buildTreatTooltip(btn) {
    if (!getSettingSafe('injuryTreatmentRolls', true)) {
        return 'Click to remove this affliction (you must own this character).';
    }
    let data = null;
    try { data = JSON.parse(decodeURIComponent(btn.getAttribute('data-treat') ?? '')); } catch (_) { /* legacy card */ }
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
function gmDcNote(buttonEl) {
    try {
        const data = JSON.parse(decodeURIComponent(buttonEl.getAttribute('data-treat') ?? ''));
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
async function requestTreatmentRoll(buttonEl, data) {
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
        cardMessageId: buttonEl.closest('[data-message-id]')?.dataset?.messageId ?? null,
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

// Treatment outcomes post as proper Blacksmith-styled cards: a centered
// [healer portrait] [bandaid] [patient portrait] strip, then the narrative
// (crit/fumble bonus as its own emphasized line). Accepts a plain string
// for the odd informational case (affliction already gone). Copy uses
// names and "their" — the module can't know a character's pronouns.
export async function postTreatmentOutcome(data) {
    try {
        const template = await getCardTemplate();
        let content = data;
        let treatoutcome = null;
        if (typeof data !== 'string') {
            const { healer, patient, effectName, effectImg, outcome } = data;
            const healerName = healer?.name ?? 'Someone';
            const patientName = patient?.name ?? 'the patient';
            const self = !!healer && !!patient && healer.id === patient.id;
            const strong = (s) => `<strong>${s}</strong>`;
            const injury = `<strong>"${effectName}"</strong>`;
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
            content = bonus ? `${narrative}<br><br>${strong(bonus)}` : narrative;
            // Self-treatment keeps the same symmetric layout — the patient's
            // portrait simply appears on both sides.
            treatoutcome = {
                healerImg: healer?.img || 'icons/svg/mystery-man.svg',
                healerName,
                patientImg: patient?.img || 'icons/svg/mystery-man.svg',
                patientName,
                afflictionImg: effectImg || null,
                afflictionName: effectName,
                icon: outcome === 'fumble' ? 'fa-burst'
                    : outcome === 'fail' ? 'fa-heart-crack'
                    : 'fa-bandage'
            };
        }
        const html = template({
            theme: getSettingSafe('cardThemeInjury', 'cardsdefault'),
            iconStyle: 'fa-bandage',
            cardTitle: 'Treatment',
            treatoutcome,
            content
        });
        await ChatMessage.create({
            user: game.user.id,
            content: html,
            speaker: { alias: 'Treatment' }
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

async function markTreatButtonDone(buttonEl) {
    const messageId = buttonEl.closest('[data-message-id]')?.dataset?.messageId;
    const message = game.messages.get(messageId ?? '');
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
// longer on its actor gets its button replaced with the bandaid stamp —
// the clicked row, the condition rows a bundled injury took with it, and
// rows that went stale any other way.
async function sweepTreatStamps(message) {
    try {
        if (!message.canUserModify(game.user, 'update')) return;
        const doc = new DOMParser().parseFromString(message.content, 'text/html');
        let changed = false;
        for (const button of Array.from(doc.querySelectorAll('.coffee-pub-bibliosoph-button-treat'))) {
            let gone = false;
            try {
                const data = JSON.parse(decodeURIComponent(button.getAttribute('data-treat') ?? ''));
                const actor = canvas?.tokens?.get(data.tokenId ?? '')?.actor
                    ?? game.actors.get(data.actorId ?? '');
                gone = !!actor && !actor.effects.get(data.effectId ?? '');
            } catch (_) { /* unreadable payload — leave the button alone */ }
            if (!gone) continue;
            const stamp = doc.createElement('div');
            stamp.style.cssText = 'flex:0 0 auto; width:40px; height:40px; display:flex; align-items:center; justify-content:center; opacity:0.6; font-size:1.1em;';
            stamp.title = 'Treated';
            stamp.innerHTML = '<i class="fa-solid fa-bandage" style="margin:0;"></i>';
            button.replaceWith(stamp);
            changed = true;
        }
        if (changed) await message.update({ content: doc.body.innerHTML });
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
//   for two decisions. The remaining count lives in the stored message
//   HTML (data-picks-remaining on the picker), never in a client's
//   memory, so a refresh or a second client sees the same state.
//
//   WHO MAY CLICK — the player whose character rolled gets to make the
//   card's choice. Their client cannot create effects on actors they do
//   not own, nor edit the GM's chat message, so the click is relayed and
//   the GM performs it. The client-side button pruning is presentation;
//   the ownership check on the GM side is the one that decides.
// ==================================================================

/** Does this user own the actor whose roll produced the card? */
function userOwnsRoller(rollerActorId, userId) {
    const user = game.users.get(userId ?? '');
    const actor = game.actors.get(rollerActorId ?? '');
    if (!user || !actor) return false;
    return user.isGM || actor.testUserPermission(user, 'OWNER');
}

/** Actor ids already chosen on this card, read back off the stored HTML. */
function pickedActorIds(message) {
    try {
        const doc = new DOMParser().parseFromString(message?.content ?? '', 'text/html');
        const picker = doc.querySelector('.bibliosoph-outcome-picker');
        return (picker?.dataset?.picksActors ?? '').split('|').filter(Boolean);
    } catch (_) {
        return [];
    }
}

/**
 * Turn "a random party member" into a named one BEFORE anything is
 * applied. Two reasons: the card can then retire that person's button, and
 * a second random pick on a two-pick card cannot land on someone already
 * chosen — which it otherwise would, since the applier treats a repeat as
 * successfully applied rather than as a no-op.
 */
function resolveOutcomePick(message, data) {
    if (!data?.randomAlly) return { data, actorId: data?.targetActorId ?? null };
    const taken = new Set(pickedActorIds(message));
    const party = getPartyActors();
    const pool = party.filter((a) => !taken.has(a.id));
    const from = pool.length ? pool : party;
    if (!from.length) return { data, actorId: null };
    const chosen = from[Math.floor(Math.random() * from.length)];
    const { randomAlly, ...rest } = data;
    return { data: { ...rest, targetActorId: chosen.id }, actorId: chosen.id };
}

/**
 * Record one applied pick against the stored card. Returns true if the
 * message was updated. Callers must hold update rights — a player's click
 * arrives here only after being relayed to the GM.
 */
async function stampOutcomeApplied(message, effectAttr, appliedNames, appliedActorId = null) {
    if (!message || !appliedNames?.length) return false;
    if (!message.canUserModify(game.user, 'update')) return false;
    try {
        const doc = new DOMParser().parseFromString(message.content, 'text/html');
        const buttons = Array.from(doc.querySelectorAll('.coffee-pub-bibliosoph-button-apply-outcome'));
        if (!buttons.length) return false;

        // Match the exact button that was clicked by its payload — with a
        // picker there is one per party member and they are not interchangeable.
        const clicked = buttons.find((b) => b.getAttribute('data-effect') === effectAttr) ?? buttons[0];
        // Both the picker and the single-button block are wrapped, so the
        // closing stamp replaces the instruction along with the control.
        // A single-button block carries no pick counts, which reads as
        // "one pick, now spent" — exactly the old behaviour.
        const picker = clicked.closest('.bibliosoph-outcome-apply');
        const total = Math.max(1, Number(picker?.dataset?.picksTotal) || 1);
        const before = Number(picker?.dataset?.picksRemaining);
        const remaining = Math.max(0, (Number.isFinite(before) && before > 0 ? before : total) - 1);

        // Names accumulate across clicks so the closing stamp names everyone.
        const previous = (picker?.dataset?.picksApplied ?? '').split('|').filter(Boolean);
        const names = [...previous, ...appliedNames];

        const takenIds = (picker?.dataset?.picksActors ?? '').split('|').filter(Boolean);
        if (appliedActorId) takenIds.push(appliedActorId);

        if (picker && remaining > 0) {
            // Retire the button just used AND the button of whoever actually
            // received it — those differ when the dice made the choice — so
            // the same party member cannot be picked twice.
            clicked.remove();
            if (appliedActorId) {
                picker.querySelector(`.coffee-pub-bibliosoph-button-apply-outcome[data-pick-actor="${appliedActorId}"]`)?.remove();
            }
            picker.dataset.picksRemaining = String(remaining);
            picker.dataset.picksApplied = names.join('|');
            picker.dataset.picksActors = takenIds.join('|');
            const hint = picker.querySelector('.bibliosoph-apply-hint');
            if (hint) hint.textContent = targetHint('ally', total, remaining);
            let progress = picker.querySelector('.bibliosoph-picks-progress');
            if (!progress) {
                progress = doc.createElement('p');
                progress.className = 'bibliosoph-picks-progress';
                progress.style.cssText = 'margin:2px 0 4px 0; font-size:0.9em; font-weight:bold; opacity:0.8;';
                picker.insertBefore(progress, picker.firstChild);
            }
            progress.textContent = `✓ So far: ${names.join(', ')}`;
            await message.update({ content: doc.body.innerHTML });
            return true;
        }

        // Every pick spent: one stamp replaces the whole picker (or the
        // lone button), and the instruction goes with it.
        const stamp = doc.createElement('div');
        stamp.style.cssText = 'width:100%; text-align:center; font-weight:bold; padding:5px 0;';
        stamp.textContent = `✓ Applied to ${names.join(', ')}`;
        (picker ?? clicked).replaceWith(stamp);
        for (const extra of buttons) if (extra.isConnected) extra.remove();
        for (const hint of doc.querySelectorAll('.bibliosoph-apply-hint')) hint.remove();
        await message.update({ content: doc.body.innerHTML });
        return true;
    } catch (error) {
        logBib('Could not record the applied outcome', error?.message, false, false);
        return false;
    }
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
        // live state: the button must still be live in the stored card (else
        // this is a stale or double click), and the requester must really own
        // the roller (else the client gate was bypassed).
        const doc = new DOMParser().parseFromString(message.content, 'text/html');
        const button = Array.from(doc.querySelectorAll('.coffee-pub-bibliosoph-button-apply-outcome'))
            .find((b) => b.getAttribute('data-effect') === payload?.effectAttr);
        if (!button) {
            logBib('Ignoring relayed outcome apply — that choice is already spent', '', true, false);
            return;
        }
        if (button.getAttribute('data-needs-selection') === '1') {
            logBib('Refused relayed outcome apply — that button resolves against the clicker\'s selection and is GM-only', '', false, false);
            return;
        }
        if (!userOwnsRoller(button.getAttribute('data-roller-actor'), payload?.userId)) {
            logBib(`Refused relayed outcome apply from ${game.users.get(payload?.userId ?? '')?.name ?? 'unknown user'} — they do not own the roller`, '', false, false);
            return;
        }
        const pick = resolveOutcomePick(message, payload?.data ?? {});
        const applied = await applyOutcomeStatus(pick.data);
        await stampOutcomeApplied(message, payload?.effectAttr, applied, pick.actorId);
    });
}

/**
 * One apply-outcome click, from whichever side of the table. The GM does
 * it directly; anyone else asks the GM to, because applying effects and
 * editing the card both need rights a player does not have.
 */
async function handleApplyOutcomeClick(buttonEl) {
    const effectAttr = buttonEl.getAttribute('data-effect');
    const data = decodeEffectPayload(effectAttr);
    if (!data) return;
    const messageId = buttonEl.closest('[data-message-id]')?.dataset?.messageId ?? '';

    if (game.user.isGM) {
        const message = game.messages.get(messageId);
        const pick = resolveOutcomePick(message, data);
        const applied = await applyOutcomeStatus(pick.data);
        await stampOutcomeApplied(message, effectAttr, applied, pick.actorId);
        return;
    }

    const sockets = game.modules.get('coffee-pub-blacksmith')?.api?.sockets;
    if (!sockets || !game.users.activeGM) {
        showBibToast('Nothing Applied', 'No GM is connected to resolve that choice.', 'fa-solid fa-triangle-exclamation');
        return;
    }
    try {
        await sockets.waitForReady();
        await sockets.emit(SOCKET_OUTCOME_APPLY, { messageId, effectAttr, data, userId: game.user.id });
    } catch (error) {
        logBib('Outcome apply relay failed', error?.message, false, false);
        showBibToast('Nothing Applied', 'That choice could not be sent to the GM.', 'fa-solid fa-triangle-exclamation');
    }
}

// After a successful apply, replace the card's button (in the stored chat
// message) with an "Applied to …" stamp so it can't fire twice and the card
// records who carries the effect. Skipped silently when the clicking user
// cannot modify the message (a non-GM clicking someone else's card) — the
// duplicate guard in the applier still protects against re-clicks.
async function markCardButtonApplied(buttonEl, buttonSelector, appliedNames) {
    if (!appliedNames?.length) return;
    try {
        const messageId = buttonEl.closest('[data-message-id]')?.dataset?.messageId;
        const message = game.messages.get(messageId ?? '');
        if (!message || !message.canUserModify(game.user, 'update')) return;
        const doc = new DOMParser().parseFromString(message.content, 'text/html');
        const buttons = Array.from(doc.querySelectorAll(buttonSelector));
        if (!buttons.length) return;
        const stamp = doc.createElement('div');
        stamp.style.cssText = 'width:100%; text-align:center; font-weight:bold; padding:5px 0;';
        stamp.textContent = `✓ Applied to ${appliedNames.join(', ')}`;
        // A pick-one card renders a button per party member; choosing one
        // resolves the whole decision, so every option is replaced by the
        // single stamp rather than leaving the rest live.
        buttons[0].replaceWith(stamp);
        for (const extra of buttons.slice(1)) extra.remove();
        // "Select the creature that was hit" is an instruction for a decision
        // that has now been made — once the stamp is down it is just noise.
        for (const hint of doc.querySelectorAll('.bibliosoph-apply-hint')) hint.remove();
        await message.update({ content: doc.body.innerHTML });
    } catch (error) {
        logBib('Could not mark card button applied', error?.message, false, false);
    }
}


// ************************************
// ** UTILITY Reset Bibliosoph Vars
// ************************************

function resetBibliosophVars() {
    BIBLIOSOPH.CARDTYPE = "";
    BIBLIOSOPH.CARDTYPEINJURY = false;
    BIBLIOSOPH.CARDTYPEENCOUNTER = false;
    BIBLIOSOPH.CARDTYPEINVESTIGATION = false;
    BIBLIOSOPH.MACRO_ID = "";
}

