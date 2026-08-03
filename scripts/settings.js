// ================================================================== 
// ===== IMPORTS ====================================================
// ================================================================== 

// Grab the module data
import { MODULE, BIBLIOSOPH } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// ================================================================== 
// ===== EXPORTS ====================================================
// ================================================================== 


// ================================================================== 
// ===== WORKFLOW GROUPS ============================================
// ================================================================== 

const WORKFLOW_GROUPS = {
    GETTING_STARTED: 'getting-started',
};

// ================================================================== 
// ===== FUNCTIONS ==================================================
// ================================================================== 
/**
 * Helper function to register headers with reduced verbosity while preserving CSS styling
 * @param {string} id - Unique identifier for the header
 * @param {string} labelKey - Localization key for the label
 * @param {string} hintKey - Localization key for the hint
 * @param {string} level - Header level (H1, H2, H3, H4)
 * @param {string} group - Workflow group for collapsible sections
 */
function registerHeader(id, labelKey, hintKey, level = 'H2', group = null) {
    game.settings.register(MODULE.ID, `heading${level}${id}`, {
        name: MODULE.ID + `.${labelKey}`,
        hint: MODULE.ID + `.${hintKey}`,
        scope: "world",
        config: true,
        default: "",
        type: String,
        group: group
    });
}

// ================================================================== 
// ===== SETTINGS ===================================================
// ================================================================== 
  
export const registerSettings = () => {
	Hooks.once('ready', async() => {
		// Helper function to safely get Blacksmith API
		function getBlacksmith() {
			return game.modules.get('coffee-pub-blacksmith')?.api;
		}

		// Helper function to safely get Blacksmith choice arrays
		const getBlacksmithChoices = (choiceType, fallbackMessage = "No choices available") => {
			const blacksmith = getBlacksmith();
			const choices = blacksmith?.BLACKSMITH?.[choiceType];
			if (choices && Object.keys(choices).length > 0) return { ...choices };
			return { "none": fallbackMessage };
		};

		// Helper function to get Blacksmith default values
		const getBlacksmithDefault = (defaultType, fallbackValue = "default") => {
			const blacksmith = getBlacksmith();
			return blacksmith?.BLACKSMITH?.[defaultType] ?? fallbackValue;
		};

		/**
		 * Get Blacksmith theme choices for chat cards using Chat Cards API.
		 * Returns card themes with CSS class names as keys.
		 */
		async function getCardThemeChoices() {
			try {
				const blacksmith = await BlacksmithAPI.get();
				const chatCardsAPI = blacksmith?.chatCards;

				if (!chatCardsAPI) {
					console.warn(MODULE.ID + ': Blacksmith Chat Cards API not available, using fallback');
					return getCardThemeChoicesFallback();
				}

				if (typeof chatCardsAPI.getCardThemeChoicesWithClassNames !== "function") {
					console.warn(MODULE.ID + ': getCardThemeChoicesWithClassNames not available, using fallback');
					return getCardThemeChoicesFallback();
				}

				return chatCardsAPI.getCardThemeChoicesWithClassNames();
			} catch (error) {
				console.error(MODULE.ID + ': Error getting card theme choices from API:', error);
				return getCardThemeChoicesFallback();
			}
		}

		/** Fallback theme choices if Chat Cards API is unavailable. */
		function getCardThemeChoicesFallback() {
			return {
				"theme-default": "Default"
			};
		}

		const themeChoices = await getCardThemeChoices();

		// Register settings...
		// This is a system message - user should know settings are being registered
		getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.NAME, "Registering Settings...", "", false, false);
		// Debug: Post the Blacksmith choice arrays - This is debug info, only log if really needed for troubleshooting
		const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;

		// Quick Encounter window position/size. The ONLY 'client' scope in the
		// module, and deliberately so: window geometry is about this screen,
		// not this person — a laptop and a desktop want different sizes, and
		// 'client' is the only scope stored per device (localStorage) rather
		// than on the User. Everything else that used to be 'client' is 'user'.
		game.settings.register(MODULE.ID, 'quickEncounterWindowBounds', {
			scope: 'client',
			config: false,
			type: Object,
			default: { width: 1000, height: 800 },
		});
		// Quick Encounter monster cache (world; built on demand, used for fast Recommend/Roll)
		game.settings.register(MODULE.ID, 'quickEncounterCache', {
			scope: 'world',
			config: false,
			type: Object,
			default: null,
		});
		// Quick Encounter: post chat card when deploying (client; used by encounter window only)
		game.settings.register(MODULE.ID, 'quickEncounterPostChatCard', {
			scope: 'user',
			config: false,
			type: Boolean,
			default: true,
		});

		// ---------- TITLE ----------
		game.settings.register(MODULE.ID, "headingH1Bibliosoph", {
			name: MODULE.ID + '.headingH1Bibliosoph-Label',
			hint: MODULE.ID + '.headingH1Bibliosoph-Hint',
			scope: 'user',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------


		// --------------------------------------
		// -- H4: INTRODUCTION
		// --------------------------------------
		registerHeader('Introduction', 'headingH4Introduction-Label', 'headingH4Introduction-Hint', 'H4', WORKFLOW_GROUPS.GETTING_STARTED);




		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2General", {
			name: MODULE.ID + '.headingH2General-Label',
			hint: MODULE.ID + '.headingH2General-Hint',
			scope: 'user',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------


		// -- Roll Virtual Dice --
		game.settings.register(MODULE.ID, 'showDiceRolls', {
			name: MODULE.ID + '.showDiceRolls-Label',
			hint: MODULE.ID + '.showDiceRolls-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'user',
			default: false,
		});


		// ********** MESSAGING (Unified Conversations) **********

		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2Messaging", {
			name: MODULE.ID + '.headingH2Messaging-Label',
			hint: MODULE.ID + '.headingH2Messaging-Hint',
			scope: 'user',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		game.settings.register(MODULE.ID, 'messagesEnabled', {
			name: MODULE.ID + '.messagesEnabled-Label',
			hint: MODULE.ID + '.messagesEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: true,
		});
		// -- Messages Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubMessagesEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubMessagesEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubMessagesEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Messages Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryMessagesEnabled', {
			name: MODULE.ID + '.toolbarFoundryMessagesEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryMessagesEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- GM sees all conversations --
		game.settings.register(MODULE.ID, 'gmSeesAllConversations', {
			name: MODULE.ID + '.gmSeesAllConversations-Label',
			hint: MODULE.ID + '.gmSeesAllConversations-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: true,
		});
		// -- Retention: max messages per conversation --
		game.settings.register(MODULE.ID, 'retentionMaxMessages', {
			name: MODULE.ID + '.retentionMaxMessages-Label',
			hint: MODULE.ID + '.retentionMaxMessages-Hint',
			type: Number,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: 200,
			range: { min: 20, max: 1000, step: 10 },
		});
		// -- Users excluded from the Messages system --
		game.settings.register(MODULE.ID, 'messagesExcludedUsers', {
			name: MODULE.ID + '.messagesExcludedUsers-Label',
			hint: MODULE.ID + '.messagesExcludedUsers-Hint',
			type: String,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: 'Cameraman, DeveloperXXX, AuthorXXX',
		});
		// -- Hide the conversations journal folder from the sidebar --
		game.settings.register(MODULE.ID, 'hideMessagesJournal', {
			name: MODULE.ID + '.hideMessagesJournal-Label',
			hint: MODULE.ID + '.hideMessagesJournal-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: true,
		});
		// -- Auto-open the Messages window when a message arrives --
		game.settings.register(MODULE.ID, 'messageAutoOpen', {
			name: MODULE.ID + '.messageAutoOpen-Label',
			hint: MODULE.ID + '.messageAutoOpen-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'user',
			default: false,
		});
		// -- On-screen splash for incoming direct messages --
		game.settings.register(MODULE.ID, 'messageSplashEnabled', {
			name: MODULE.ID + '.messageSplashEnabled-Label',
			hint: MODULE.ID + '.messageSplashEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'user',
			default: true,
		});
		// -- On-screen splash for incoming party/group messages --
		game.settings.register(MODULE.ID, 'messageSplashGroupEnabled', {
			name: MODULE.ID + '.messageSplashGroupEnabled-Label',
			hint: MODULE.ID + '.messageSplashGroupEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'user',
			default: true,
		});
		// -- Message sounds --
		// World-scoped like every other sound in the module: the GM owns the
		// table's soundscape, so one person picks and everyone hears the same
		// thing. Silencing them individually is what the mute toggle in the
		// Messages window is for — that stays per-user.
		const messageSounds = [
			{ key: 'messageSoundAlert', def: 'modules/coffee-pub-blacksmith/sounds/interface-notification-03.mp3' },
			{ key: 'messageSoundReceive', def: 'modules/coffee-pub-blacksmith/sounds/interface-pop-01.mp3' },
			{ key: 'messageSoundSend', def: 'modules/coffee-pub-blacksmith/sounds/interface-pop-02.mp3' },
			{ key: 'messageSoundSwitch', def: 'modules/coffee-pub-blacksmith/sounds/book-open-02.mp3' },
			{ key: 'messageSoundClose', def: 'modules/coffee-pub-blacksmith/sounds/fire-candle-blow.mp3' }
		];
		for (const { key, def } of messageSounds) {
			game.settings.register(MODULE.ID, key, {
				name: MODULE.ID + '.' + key + '-Label',
				hint: MODULE.ID + '.' + key + '-Hint',
				scope: 'world',
				config: true,
				requiresReload: false,
				default: def,
				choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
			});
		}
		// -- Send-to-chat card themes (used when escalating a message to Foundry chat) --
		game.settings.register(MODULE.ID, 'cardThemePartyMessage', {
			name: MODULE.ID + '.cardThemePartyMessage-Label',
			hint: MODULE.ID + '.cardThemePartyMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		game.settings.register(MODULE.ID, 'cardThemePrivateMessage', {
			name: MODULE.ID + '.cardThemePrivateMessage-Label',
			hint: MODULE.ID + '.cardThemePrivateMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});

		// ** RANDOM TOASTS **
		// Beverage/Bio/Insult/Praise: buttons in the Messages window header;
		// results show as toasts on every client (style fixed in
		// manager-social-toasts.js). Choosing table "None" hides the button.
		const socialTableChoices = {
			...getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.'),
			none: 'None'
		};

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3RandomToasts", {
			name: MODULE.ID + '.headingH3RandomToasts-Label',
			hint: MODULE.ID + '.headingH3RandomToasts-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID,'beverageTable', {
			name: MODULE.ID + '.beverageTable-Label',
			hint: MODULE.ID + '.beverageTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: socialTableChoices
		});
		game.settings.register(MODULE.ID,'bioTable', {
			name: MODULE.ID + '.bioTable-Label',
			hint: MODULE.ID + '.bioTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: socialTableChoices
		});
		game.settings.register(MODULE.ID,'insultsTable', {
			name: MODULE.ID + '.insultsTable-Label',
			hint: MODULE.ID + '.insultsTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: socialTableChoices
		});
		game.settings.register(MODULE.ID,'praiseTable', {
			name: MODULE.ID + '.praiseTable-Label',
			hint: MODULE.ID + '.praiseTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: socialTableChoices
		});


		// Shared choice lists for the crit/fumble toast settings below.
		// Values map straight onto Blacksmith's toast API config.
		const toastSizeChoices = {
			'adapt': 'Adapt to Content',
			'small': 'Small',
			'medium': 'Medium',
			'large': 'Large',
			'fullscreen': 'Fullscreen'
		};
		const toastAnimationChoices = {
			'none': 'None',
			'pop': 'Pop — scales in with a springy bounce',
			'reveal': 'Reveal — icon, then title, then message',
			'slam': 'Slam — smashes in like a stamp',
			'shake': 'Shake — rattles in with a wobble',
			'pulse': 'Pulse — subtle breathe (persistent toasts)'
		};
		// The automation ladder: how much the module does for you.
		// off    = feature unused (toolbar button hidden, no detection)
		// manual = toolbar button only — no detection, no toasts
		// click  = detection on; toast with a roll button for the owner
		// auto   = detection on; toast + card posts automatically
		// Labels are generated per feature so each dropdown speaks its
		// own noun ("Detect injuries...", "Detect criticals...").
		const automationChoicesFor = (singular, plural) => ({
			'off': `Off: ${singular} automations disabled.`,
			'manual': `Manual ${plural}: Roll ${plural.toLowerCase()} from the toolbar.`,
			'click': `Automated Detection: Detect ${plural.toLowerCase()}, show a Toast Button to roll.`,
			'auto': `Fully Automated: Detect ${plural.toLowerCase()} and automatically roll.`
		});
		// Toolbar buttons need no settings: any Automation mode other than
		// 'off' shows the feature's button in BOTH toolbars.

		// ** CRITICAL **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH2Critical", {
			name: MODULE.ID + '.headingH2Critical-Label',
			hint: MODULE.ID + '.headingH2Critical-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// ---------- SUBHEADING: Configuration ----------
		game.settings.register(MODULE.ID, "headingH3CriticalConfiguration", {
			name: MODULE.ID + '.headingH3CriticalConfiguration-Label',
			hint: MODULE.ID + '.headingH3CriticalConfiguration-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'critAutomation', {
			name: MODULE.ID + '.critAutomation-Label',
			hint: MODULE.ID + '.critAutomation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'click',
			choices: automationChoicesFor('Critical', 'Criticals')
		});
		// Applies to crits AND fumbles. Filters on WHAT is rolling (the
		// actor type), not which account controls it.
		game.settings.register(MODULE.ID, 'rollTriggerSource', {
			name: MODULE.ID + '.rollTriggerSource-Label',
			hint: MODULE.ID + '.rollTriggerSource-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'everyone',
			choices: {
				'everyone': 'Everyone',
				'players': 'Players',
				'npcs': 'NPCs and Monsters'
			}
		});
		// ---------- SUBHEADING: Chat Card ----------
		game.settings.register(MODULE.ID, "headingH3CriticalChatCard", {
			name: MODULE.ID + '.headingH3CriticalChatCard-Label',
			hint: MODULE.ID + '.headingH3CriticalChatCard-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'cardThemeCritical', {
			name: MODULE.ID + '.cardThemeCritical-Label',
			hint: MODULE.ID + '.cardThemeCritical-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Critical Compendium (typed pages with real mechanics) --
		// Sits directly above the roll table it falls back to, because its
		// "None" option says "use the roll table below" and has to mean THIS
		// feature's table.
		game.settings.register(MODULE.ID, 'critCompendium', {
			name: MODULE.ID + '.critCompendium-Label',
			hint: MODULE.ID + '.critCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'coffee-pub-bibliosoph.criticals',
			choices: Object.assign(
				{ none: 'None — this feature posts no cards' },
				getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
			)
		});
		// ---------- SUBHEADING: Toast Design ----------
		game.settings.register(MODULE.ID, "headingH3CriticalToastDesign", {
			name: MODULE.ID + '.headingH3CriticalToastDesign-Label',
			hint: MODULE.ID + '.headingH3CriticalToastDesign-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'critToastTitle', {
			name: MODULE.ID + '.critToastTitle-Label',
			hint: MODULE.ID + '.critToastTitle-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'CRITICAL ROLL!!',
		});
		game.settings.register(MODULE.ID, 'critToastMessage', {
			name: MODULE.ID + '.critToastMessage-Label',
			hint: MODULE.ID + '.critToastMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'This is gonna hurt!',
		});
		game.settings.register(MODULE.ID, 'critToastButton', {
			name: MODULE.ID + '.critToastButton-Label',
			hint: MODULE.ID + '.critToastButton-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'Roll for the Critical Card',
		});
		game.settings.register(MODULE.ID, 'critToastSize', {
			name: MODULE.ID + '.critToastSize-Label',
			hint: MODULE.ID + '.critToastSize-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'large',
			choices: toastSizeChoices
		});
		game.settings.register(MODULE.ID, 'critToastAnimation', {
			name: MODULE.ID + '.critToastAnimation-Label',
			hint: MODULE.ID + '.critToastAnimation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'slam',
			choices: toastAnimationChoices
		});
		game.settings.register(MODULE.ID, 'critToastSound', {
			name: MODULE.ID + '.critToastSound-Label',
			hint: MODULE.ID + '.critToastSound-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'modules/coffee-pub-blacksmith/sounds/fanfare-success-1.mp3',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID, 'critToastBorderColor', {
			name: MODULE.ID + '.critToastBorderColor-Label',
			hint: MODULE.ID + '.critToastBorderColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#f5d6d6',
		});
		game.settings.register(MODULE.ID, 'critToastBackgroundColor', {
			name: MODULE.ID + '.critToastBackgroundColor-Label',
			hint: MODULE.ID + '.critToastBackgroundColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#620404',
		});
		game.settings.register(MODULE.ID, 'critToastBackgroundImage', {
			name: MODULE.ID + '.critToastBackgroundImage-Label',
			hint: MODULE.ID + '.critToastBackgroundImage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			filePicker: 'image',
			default: '',
		});

		// ** FUMBLE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH2Fumbles", {
			name: MODULE.ID + '.headingH2Fumbles-Label',
			hint: MODULE.ID + '.headingH2Fumbles-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// ---------- SUBHEADING: Configuration ----------
		game.settings.register(MODULE.ID, "headingH3FumbleConfiguration", {
			name: MODULE.ID + '.headingH3FumbleConfiguration-Label',
			hint: MODULE.ID + '.headingH3FumbleConfiguration-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'fumbleAutomation', {
			name: MODULE.ID + '.fumbleAutomation-Label',
			hint: MODULE.ID + '.fumbleAutomation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'click',
			choices: automationChoicesFor('Fumble', 'Fumbles')
		});
		// ---------- SUBHEADING: Chat Card ----------
		game.settings.register(MODULE.ID, "headingH3FumbleChatCard", {
			name: MODULE.ID + '.headingH3FumbleChatCard-Label',
			hint: MODULE.ID + '.headingH3FumbleChatCard-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'cardThemeFumble', {
			name: MODULE.ID + '.cardThemeFumble-Label',
			hint: MODULE.ID + '.cardThemeFumble-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Fumble Compendium (typed pages with real mechanics) --
		game.settings.register(MODULE.ID, 'fumbleCompendium', {
			name: MODULE.ID + '.fumbleCompendium-Label',
			hint: MODULE.ID + '.fumbleCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'coffee-pub-bibliosoph.fumbles',
			choices: Object.assign(
				{ none: 'None — this feature posts no cards' },
				getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
			)
		});
		game.settings.register(MODULE.ID, 'outcomeImageEnabled', {
			name: MODULE.ID + '.outcomeImageEnabled-Label',
			hint: MODULE.ID + '.outcomeImageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: true,
		});
		// ---------- SUBHEADING: Toast Design ----------
		game.settings.register(MODULE.ID, "headingH3FumbleToastDesign", {
			name: MODULE.ID + '.headingH3FumbleToastDesign-Label',
			hint: MODULE.ID + '.headingH3FumbleToastDesign-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'fumbleToastTitle', {
			name: MODULE.ID + '.fumbleToastTitle-Label',
			hint: MODULE.ID + '.fumbleToastTitle-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'FUMBLE!!',
		});
		game.settings.register(MODULE.ID, 'fumbleToastMessage', {
			name: MODULE.ID + '.fumbleToastMessage-Label',
			hint: MODULE.ID + '.fumbleToastMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: "Well... that didn't go as planned!",
		});
		game.settings.register(MODULE.ID, 'fumbleToastButton', {
			name: MODULE.ID + '.fumbleToastButton-Label',
			hint: MODULE.ID + '.fumbleToastButton-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'Roll for the Fumble Card',
		});
		game.settings.register(MODULE.ID, 'fumbleToastSize', {
			name: MODULE.ID + '.fumbleToastSize-Label',
			hint: MODULE.ID + '.fumbleToastSize-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'large',
			choices: toastSizeChoices
		});
		game.settings.register(MODULE.ID, 'fumbleToastAnimation', {
			name: MODULE.ID + '.fumbleToastAnimation-Label',
			hint: MODULE.ID + '.fumbleToastAnimation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'shake',
			choices: toastAnimationChoices
		});
		game.settings.register(MODULE.ID, 'fumbleToastSound', {
			name: MODULE.ID + '.fumbleToastSound-Label',
			hint: MODULE.ID + '.fumbleToastSound-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'modules/coffee-pub-blacksmith/sounds/sadtrombone.mp3',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID, 'fumbleToastBorderColor', {
			name: MODULE.ID + '.fumbleToastBorderColor-Label',
			hint: MODULE.ID + '.fumbleToastBorderColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#d6def5',
		});
		game.settings.register(MODULE.ID, 'fumbleToastBackgroundColor', {
			name: MODULE.ID + '.fumbleToastBackgroundColor-Label',
			hint: MODULE.ID + '.fumbleToastBackgroundColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#131e42',
		});
		game.settings.register(MODULE.ID, 'fumbleToastBackgroundImage', {
			name: MODULE.ID + '.fumbleToastBackgroundImage-Label',
			hint: MODULE.ID + '.fumbleToastBackgroundImage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			filePicker: 'image',
			default: '',
		});


		// ********** INJURIES **********

		// ---------- Injuries ----------
		game.settings.register(MODULE.ID, "headingH2Injuries", {
			name: MODULE.ID + '.headingH2Injuries-Label',
			hint: MODULE.ID + '.headingH2Injuries-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------


		// ---------- SUBHEADING: Configuration ----------
		game.settings.register(MODULE.ID, "headingH3InjuriesConfiguration", {
			name: MODULE.ID + '.headingH3InjuriesConfiguration-Label',
			hint: MODULE.ID + '.headingH3InjuriesConfiguration-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'injuryAutomation', {
			name: MODULE.ID + '.injuryAutomation-Label',
			hint: MODULE.ID + '.injuryAutomation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'click',
			choices: automationChoicesFor('Injury', 'Injuries')
		});
		game.settings.register(MODULE.ID, 'injuryAutoApply', {
			name: MODULE.ID + '.injuryAutoApply-Label',
			hint: MODULE.ID + '.injuryAutoApply-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID, 'injuryApplySound', {
			name: MODULE.ID + '.injuryApplySound-Label',
			hint: MODULE.ID + '.injuryApplySound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'modules/coffee-pub-blacksmith/sounds/reactions/reaction-man-pain.mp3',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID, 'injuryApplySoundVolume', {
			name: MODULE.ID + '.injuryApplySoundVolume-Label',
			hint: MODULE.ID + '.injuryApplySoundVolume-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
				min: 0,
				max: 1,
				step: 0.05,
			},
			default: 0.7,
		});
		game.settings.register(MODULE.ID, 'injuryThreshold', {
			name: MODULE.ID + '.injuryThreshold-Label',
			hint: MODULE.ID + '.injuryThreshold-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 5, max: 100, step: 5 },
			default: 50,
		});
		game.settings.register(MODULE.ID, 'injuryTriggerSource', {
			name: MODULE.ID + '.injuryTriggerSource-Label',
			hint: MODULE.ID + '.injuryTriggerSource-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'players',
			choices: {
				'everyone': 'Everyone',
				'players': 'Players',
				'npcs': 'NPCs and Monsters'
			}
		});
		// ---------- SUBHEADING: Chat Card ----------
		game.settings.register(MODULE.ID, "headingH3InjuriesChatCard", {
			name: MODULE.ID + '.headingH3InjuriesChatCard-Label',
			hint: MODULE.ID + '.headingH3InjuriesChatCard-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID,'injuryCompendium', {
			name: MODULE.ID + '.injuryCompendium-Label',
			hint: MODULE.ID + '.injuryCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'coffee-pub-bibliosoph.injuries',
			choices: getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Injury Theme --
		game.settings.register(MODULE.ID, 'cardThemeInjury', {
			name: MODULE.ID + '.cardThemeInjury-Label',
			hint: MODULE.ID + '.cardThemeInjury-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Injury Image --
		game.settings.register(MODULE.ID, 'injuryImageEnabled', {
			name: MODULE.ID + '.injuryImageEnabled-Label',
			hint: MODULE.ID + '.injuryImageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});
		// -- Injury Sound (chat card) --
		game.settings.register(MODULE.ID,'injurySound', {
			name: MODULE.ID + '.injurySound-Label',
			hint: MODULE.ID + '.injurySound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'injurySoundVolume', {
			name: MODULE.ID + '.injurySoundVolume-Label',
			hint: MODULE.ID + '.injurySoundVolume-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 0,
			max: 1,
			step: 0.05,
			},
			default: 0.7,
		});

		// ---------- SUBHEADING: Toast Design ----------
		game.settings.register(MODULE.ID, "headingH3InjuriesToastDesign", {
			name: MODULE.ID + '.headingH3InjuriesToastDesign-Label',
			hint: MODULE.ID + '.headingH3InjuriesToastDesign-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'injuryToastTitle', {
			name: MODULE.ID + '.injuryToastTitle-Label',
			hint: MODULE.ID + '.injuryToastTitle-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'INJURY!!',
		});
		game.settings.register(MODULE.ID, 'injuryToastMessage', {
			name: MODULE.ID + '.injuryToastMessage-Label',
			hint: MODULE.ID + '.injuryToastMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: '{name} took a brutal {type} hit — that may leave a mark!',
		});
		game.settings.register(MODULE.ID, 'injuryToastButton', {
			name: MODULE.ID + '.injuryToastButton-Label',
			hint: MODULE.ID + '.injuryToastButton-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'Roll for the Injury',
		});
		game.settings.register(MODULE.ID, 'injuryToastSize', {
			name: MODULE.ID + '.injuryToastSize-Label',
			hint: MODULE.ID + '.injuryToastSize-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'large',
			choices: toastSizeChoices
		});
		game.settings.register(MODULE.ID, 'injuryToastAnimation', {
			name: MODULE.ID + '.injuryToastAnimation-Label',
			hint: MODULE.ID + '.injuryToastAnimation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'shake',
			choices: toastAnimationChoices
		});
		game.settings.register(MODULE.ID, 'injuryToastSound', {
			name: MODULE.ID + '.injuryToastSound-Label',
			hint: MODULE.ID + '.injuryToastSound-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'modules/coffee-pub-blacksmith/sounds/reactions/reaction-man-pain.mp3',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID, 'injuryToastBorderColor', {
			name: MODULE.ID + '.injuryToastBorderColor-Label',
			hint: MODULE.ID + '.injuryToastBorderColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#f5ded6',
		});
		game.settings.register(MODULE.ID, 'injuryToastBackgroundColor', {
			name: MODULE.ID + '.injuryToastBackgroundColor-Label',
			hint: MODULE.ID + '.injuryToastBackgroundColor-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: new foundry.data.fields.ColorField({ required: false, blank: true }),
			default: '#4a1204',
		});
		game.settings.register(MODULE.ID, 'injuryToastBackgroundImage', {
			name: MODULE.ID + '.injuryToastBackgroundImage-Label',
			hint: MODULE.ID + '.injuryToastBackgroundImage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			filePicker: 'image',
			default: '',
		});

		// ---------- SUBHEADING: Treatment ----------
		game.settings.register(MODULE.ID, "headingH3InjuriesTreatment", {
			name: MODULE.ID + '.headingH3InjuriesTreatment-Label',
			hint: MODULE.ID + '.headingH3InjuriesTreatment-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'injuryTreatmentRolls', {
			name: MODULE.ID + '.injuryTreatmentRolls-Label',
			hint: MODULE.ID + '.injuryTreatmentRolls-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: true,
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentCritFumble', {
			name: MODULE.ID + '.injuryTreatmentCritFumble-Label',
			hint: MODULE.ID + '.injuryTreatmentCritFumble-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: true,
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentKitUses', {
			name: MODULE.ID + '.injuryTreatmentKitUses-Label',
			hint: MODULE.ID + '.injuryTreatmentKitUses-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'attempt',
			choices: {
				'attempt': 'Every Attempt: A use is spent whenever the kit helps, success or not',
				'success': 'On Success Only: Failed attempts never spend a use',
				'never': 'Never: Owning the kit is enough'
			}
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentKitNames', {
			name: MODULE.ID + '.injuryTreatmentKitNames-Label',
			hint: MODULE.ID + '.injuryTreatmentKitNames-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: "Healer's Kit"
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentAttemptReset', {
			name: MODULE.ID + '.injuryTreatmentAttemptReset-Label',
			hint: MODULE.ID + '.injuryTreatmentAttemptReset-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: 'longRest',
			choices: {
				'longRest': 'Long Rest: everyone may try again after a long rest',
				'shortRest': 'Any Rest: a short rest is enough to try again',
				'never': 'Never: one attempt per character, permanently'
			}
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentDcEscalation', {
			name: MODULE.ID + '.injuryTreatmentDcEscalation-Label',
			hint: MODULE.ID + '.injuryTreatmentDcEscalation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: Number,
			default: 0,
			range: { min: 0, max: 5, step: 1 }
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentSound', {
			name: MODULE.ID + '.injuryTreatmentSound-Label',
			hint: MODULE.ID + '.injuryTreatmentSound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'modules/coffee-pub-blacksmith/sounds/reactions/reaction-gasp.mp3',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID, 'injuryTreatmentSoundVolume', {
			name: MODULE.ID + '.injuryTreatmentSoundVolume-Label',
			hint: MODULE.ID + '.injuryTreatmentSoundVolume-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
				min: 0,
				max: 1,
				step: 0.05,
			},
			default: 0.7,
		});

		// ---------- HEADING ----------

		// ********** QUICK ENCOUNTERS **********

		// ---------- Encounters ----------
		game.settings.register(MODULE.ID, "headingH2Encounters", {
			name: MODULE.ID + '.headingH2Encounters-Label',
			hint: MODULE.ID + '.headingH2Encounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------



		// ********** ENCOUNTERS (Quick Encounter) **********
		// -- Quick Encounter (CR-aware tool) --
		game.settings.register(MODULE.ID, 'quickEncounterEnabled', {
			name: MODULE.ID + '.quickEncounterEnabled-Label',
			hint: MODULE.ID + '.quickEncounterEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: true,
		});
		game.settings.register(MODULE.ID, 'quickEncounterHabitat', {
			scope: 'user',
			config: false,
			type: String,
			default: 'Any',
		});
		game.settings.register(MODULE.ID, 'quickEncounterMinCR', {
			scope: 'user',
			config: false,
			type: Number,
			default: 0,
		});
		game.settings.register(MODULE.ID, 'quickEncounterMaxCR', {
			scope: 'user',
			config: false,
			type: Number,
			default: 30,
		});
		game.settings.register(MODULE.ID, 'quickEncounterMaxRecommendations', {
			scope: 'user',
			config: false,
			type: Number,
			default: 10,
		});
		game.settings.register(MODULE.ID, 'quickEncounterVariability', {
			scope: 'user',
			config: false,
			type: Number,
			default: 3,
		});
		game.settings.register(MODULE.ID, 'quickEncounterDetection', {
			scope: 'user',
			config: false,
			type: Number,
			default: 3,
		});
		game.settings.register(MODULE.ID, 'quickEncounterRecentIncludeNames', {
			scope: 'user',
			config: false,
			type: Object,
			default: [],
		});
		game.settings.register(MODULE.ID, 'quickEncounterRecentExcludeNames', {
			scope: 'user',
			config: false,
			type: Object,
			default: [],
		});
		game.settings.register(MODULE.ID, 'quickEncounterRememberInclude', {
			scope: 'user',
			config: false,
			type: Boolean,
			default: false,
		});
		game.settings.register(MODULE.ID, 'quickEncounterRememberedIncludeText', {
			scope: 'user',
			config: false,
			type: String,
			default: '',
		});
		game.settings.register(MODULE.ID, 'quickEncounterRememberExclude', {
			scope: 'user',
			config: false,
			type: Boolean,
			default: false,
		});
		game.settings.register(MODULE.ID, 'quickEncounterRememberedExcludeText', {
			scope: 'user',
			config: false,
			type: String,
			default: '',
		});
		game.settings.register(MODULE.ID, 'toolbarCoffeePubQuickEncounterEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubQuickEncounterEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubQuickEncounterEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: true,
		});
		game.settings.register(MODULE.ID, 'toolbarFoundryQuickEncounterEnabled', {
			name: MODULE.ID + '.toolbarFoundryQuickEncounterEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryQuickEncounterEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});

		// -- Card Style --
		game.settings.register(MODULE.ID, 'cardThemeEncounter', {
			name: MODULE.ID + '.cardThemeEncounter-Label',
			hint: MODULE.ID + '.cardThemeEncounter-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Odds of Encounter --
		game.settings.register(MODULE.ID,'encounterOdds', {
			name: MODULE.ID + '.encounterOdds-Label',
			hint: MODULE.ID + '.encounterOdds-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 0,
			max: 100,
			step: 1,
			},
			default: 20,
		});

		// -- Encounter False Sound --
		game.settings.register(MODULE.ID,'encounterFalseSound', {
			name: MODULE.ID + '.encounterFalseSound-Label',
			hint: MODULE.ID + '.encounterFalseSound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Encounter True Sound --
		game.settings.register(MODULE.ID,'encounterTrueSound', {
			name: MODULE.ID + '.encounterTrueSound-Label',
			hint: MODULE.ID + '.encounterTrueSound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Encounter Sound VOlume --
		game.settings.register(MODULE.ID,'encounterSoundVolume', {
			name: MODULE.ID + '.encounterSoundVolume-Label',
			hint: MODULE.ID + '.encounterSoundVolume-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 0,
			max: 1,
			step: 0.05,
			},
			default: 0.7,
		});


		// ********** INVESTIGATIONS **********

		// ---------- Investigations ----------
		game.settings.register(MODULE.ID, "headingH2Investigations", {
			name: MODULE.ID + '.headingH2Investigations-Label',
			hint: MODULE.ID + '.headingH2Investigations-Hint',
			scope: 'user',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------


		game.settings.register(MODULE.ID, 'investigationEnabled', {
			name: MODULE.ID + '.investigationEnabled-Label',
			hint: MODULE.ID + '.investigationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});

		game.settings.register(MODULE.ID, 'investigationPlayerSkill', {
			name: MODULE.ID + '.investigationPlayerSkill-Label',
			hint: MODULE.ID + '.investigationPlayerSkill-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: true,
		});


		// -- Investigation Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubInvestigationEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubInvestigationEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubInvestigationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Investigation Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryInvestigationEnabled', {
			name: MODULE.ID + '.toolbarFoundryInvestigationEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryInvestigationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Investigation Theme --
		game.settings.register(MODULE.ID, 'cardThemeInvestigation', {
			name: MODULE.ID + '.cardThemeInvestigation-Label',
			hint: MODULE.ID + '.cardThemeInvestigation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});

		// -- Investigation Macro --
		game.settings.register(MODULE.ID,'investigationMacro', {
			name: MODULE.ID + '.investigationMacro-Label',
			hint: MODULE.ID + '.investigationMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ---------- SUBHEADING: Currency ----------
		game.settings.register(MODULE.ID, "headingH3Currency", {
			name: MODULE.ID + '.headingH3Currency-Label',
			hint: MODULE.ID + '.headingH3Currency-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Investigation: Odds of Finding Coins --
		game.settings.register(MODULE.ID, 'investigationCoinsOdds', {
			name: MODULE.ID + '.investigationCoinsOdds-Label',
			hint: MODULE.ID + '.investigationCoinsOdds-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 20,
		});

		// -- Investigation: Max coin amounts (upper limit when rolling found coins) --
		game.settings.register(MODULE.ID, 'investigationCoinsMaxPlatinum', {
			name: MODULE.ID + '.investigationCoinsMaxPlatinum-Label',
			hint: MODULE.ID + '.investigationCoinsMaxPlatinum-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 0,
		});
		game.settings.register(MODULE.ID, 'investigationCoinsMaxGold', {
			name: MODULE.ID + '.investigationCoinsMaxGold-Label',
			hint: MODULE.ID + '.investigationCoinsMaxGold-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 10,
		});
		game.settings.register(MODULE.ID, 'investigationCoinsMaxSilver', {
			name: MODULE.ID + '.investigationCoinsMaxSilver-Label',
			hint: MODULE.ID + '.investigationCoinsMaxSilver-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 45,
		});
		game.settings.register(MODULE.ID, 'investigationCoinsMaxElectrum', {
			name: MODULE.ID + '.investigationCoinsMaxElectrum-Label',
			hint: MODULE.ID + '.investigationCoinsMaxElectrum-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 10,
		});
		game.settings.register(MODULE.ID, 'investigationCoinsMaxCopper', {
			name: MODULE.ID + '.investigationCoinsMaxCopper-Label',
			hint: MODULE.ID + '.investigationCoinsMaxCopper-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 100, step: 1 },
			default: 100,
		});






		// ---------- SUBHEADING: Items ----------
		game.settings.register(MODULE.ID, "headingH3Items", {
			name: MODULE.ID + '.headingH3Items-Label',
			hint: MODULE.ID + '.headingH3Items-Hint',
			scope: 'world',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Investigation Odds --
		game.settings.register(MODULE.ID,'investigationOdds', {
			name: MODULE.ID + '.investigationOdds-Label',
			hint: MODULE.ID + '.investigationOdds-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 0,
			max: 100,
			step: 1,
			},
			default: 20,
		});

		// -- Investigation Dice - SLOTS --
		game.settings.register(MODULE.ID,'investigationDice', {
			name: MODULE.ID + '.investigationDice-Label',
			hint: MODULE.ID + '.investigationDice-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 1,
			max: 20,
			step: 1,
			},
			default: 3,
		});








		// -- Investigation Table - COMMON --
		game.settings.register(MODULE.ID,'investigationTableCommon', {
			name: MODULE.ID + '.investigationTableCommon-Label',
			hint: MODULE.ID + '.investigationTableCommon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Investigation Odds - COMMON --
		game.settings.register(MODULE.ID,'investigationOddsCommon', {
			name: MODULE.ID + '.investigationOddsCommon-Label',
			hint: MODULE.ID + '.investigationOddsCommon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 1000, step: 1 },
			default: 1000,
		});

		// -- Investigation Table - UNCOMMON	 --
		game.settings.register(MODULE.ID,'investigationTableUncommon', {
			name: MODULE.ID + '.investigationTableUncommon-Label',
			hint: MODULE.ID + '.investigationTableUncommon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Investigation Odds - UNCOMMON --
		game.settings.register(MODULE.ID,'investigationOddsUncommon', {
			name: MODULE.ID + '.investigationOddsUncommon-Label',
			hint: MODULE.ID + '.investigationOddsUncommon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 1000, step: 1 },
			default: 120,
		});


		// -- Investigation Table - RARE	 --
		game.settings.register(MODULE.ID,'investigationTableRare', {
			name: MODULE.ID + '.investigationTableRare-Label',
			hint: MODULE.ID + '.investigationTableRare-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Investigation Odds - RARE --
		game.settings.register(MODULE.ID,'investigationOddsRare', {
			name: MODULE.ID + '.investigationOddsRare-Label',
			hint: MODULE.ID + '.investigationOddsRare-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 1000, step: 1 },
			default: 50,
		});

		// -- Investigation Table - VERY RARE	 --
		game.settings.register(MODULE.ID,'investigationTableVeryRare', {
			name: MODULE.ID + '.investigationTableVeryRare-Label',
			hint: MODULE.ID + '.investigationTableVeryRare-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Investigation Odds - VERY RARE --
		game.settings.register(MODULE.ID,'investigationOddsVeryRare', {
			name: MODULE.ID + '.investigationOddsVeryRare-Label',
			hint: MODULE.ID + '.investigationOddsVeryRare-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 1000, step: 1 },
			default: 5,
		});

		// -- Investigation Table - LEGENDARY	 --
		game.settings.register(MODULE.ID,'investigationTableLegendary', {
			name: MODULE.ID + '.investigationTableLegendary-Label',
			hint: MODULE.ID + '.investigationTableLegendary-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Investigation Odds - LEGENDARY --
		game.settings.register(MODULE.ID,'investigationOddsLegendary', {
			name: MODULE.ID + '.investigationOddsLegendary-Label',
			hint: MODULE.ID + '.investigationOddsLegendary-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: { min: 0, max: 1000, step: 1 },
			default: 1,
		});


		// ********** INSPIRATION **********

		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2Inspiration", {
			name: MODULE.ID + '.headingH2Inspiration-Label',
			hint: MODULE.ID + '.headingH2Inspiration-Hint',
			scope: 'user',
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'inspirationEnabled', {
			name: MODULE.ID + '.inspirationEnabled-Label',
			hint: MODULE.ID + '.inspirationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Inspiration Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubInspirationEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubInspirationEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubInspirationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Inspiration Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryInspirationEnabled', {
			name: MODULE.ID + '.toolbarFoundryInspirationEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryInspirationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Inspiration Theme --
		game.settings.register(MODULE.ID, 'cardThemeInspiration', {
			name: MODULE.ID + '.cardThemeInspiration-Label',
			hint: MODULE.ID + '.cardThemeInspiration-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Inspiration Deck (typed pages: the card deck) --
		// The deck is the modern source; the roll table below is the legacy
		// fallback, reached only when this is set to None.
		game.settings.register(MODULE.ID, 'inspirationCompendium', {
			name: MODULE.ID + '.inspirationCompendium-Label',
			hint: MODULE.ID + '.inspirationCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'coffee-pub-bibliosoph.inspiration',
			choices: Object.assign(
				{ none: 'None — this feature posts no cards' },
				getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
			)
		});
		// -- Inspiration Macro --
		game.settings.register(MODULE.ID,'inspirationMacro', {
			name: MODULE.ID + '.inspirationMacro-Label',
			hint: MODULE.ID + '.inspirationMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});



	});
};
