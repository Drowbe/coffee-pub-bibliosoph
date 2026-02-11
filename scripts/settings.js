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

		// Quick Encounter window position/size (client; not shown in config)
		game.settings.register(MODULE.ID, 'quickEncounterWindowBounds', {
			scope: 'client',
			config: false,
			type: Object,
			default: { width: 500, height: 750 },
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
			scope: 'client',
			config: false,
			type: Boolean,
			default: true,
		});

		// ---------- TITLE ----------
		game.settings.register(MODULE.ID, "headingH1Bibliosoph", {
			name: MODULE.ID + '.headingH1Bibliosoph-Label',
			hint: MODULE.ID + '.headingH1Bibliosoph-Hint',
			scope: "world",
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
			scope: "world",
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


		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2Communications", {
			name: MODULE.ID + '.headingH2Communications-Label',
			hint: MODULE.ID + '.headingH2Communications-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

	  	// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3PartyMessage", {
			name: MODULE.ID + '.headingH3PartyMessage-Label',
			hint: MODULE.ID + '.headingH3PartyMessage-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		game.settings.register(MODULE.ID, 'partyMessageEnabled', {
			name: MODULE.ID + '.partyMessageEnabled-Label',
			hint: MODULE.ID + '.partyMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Party Message Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubPartyMessageEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubPartyMessageEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubPartyMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Party Message Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryPartyMessageEnabled', {
			name: MODULE.ID + '.toolbarFoundryPartyMessageEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryPartyMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Party Message Macro --
		game.settings.register(MODULE.ID,'partyMessageMacro', {
			name: MODULE.ID + '.partyMessageMacro-Label',
			hint: MODULE.ID + '.partyMessageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Party Message Theme --
		game.settings.register(MODULE.ID, 'cardThemePartyMessage', {
			name: MODULE.ID + '.cardThemePartyMessage-Label',
			hint: MODULE.ID + '.cardThemePartyMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3PrivateMessage", {
			name: MODULE.ID + '.headingH3PrivateMessage-Label',
			hint: MODULE.ID + '.headingH3PrivateMessage-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		
		game.settings.register(MODULE.ID, 'privateMessageEnabled', {
			name: MODULE.ID + '.privateMessageEnabled-Label',
			hint: MODULE.ID + '.privateMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Private Message Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubPrivateMessageEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubPrivateMessageEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubPrivateMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Private Message Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryPrivateMessageEnabled', {
			name: MODULE.ID + '.toolbarFoundryPrivateMessageEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryPrivateMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Private Message Macro --
		game.settings.register(MODULE.ID,'privateMessageMacro', {
			name: MODULE.ID + '.privateMessageMacro-Label',
			hint: MODULE.ID + '.privateMessageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Private Message Theme --
		game.settings.register(MODULE.ID, 'cardThemePrivateMessage', {
			name: MODULE.ID + '.cardThemePrivateMessage-Label',
			hint: MODULE.ID + '.cardThemePrivateMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});

		// -- Private Message Chat Layout --
		game.settings.register(MODULE.ID, 'cardLayoutPrivateMessage', {
			name: MODULE.ID + '.cardLayoutPrivateMessage-Label',
			hint: MODULE.ID + '.cardLayoutPrivateMessage-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});


		// -- Private Message Window Layout --
		game.settings.register(MODULE.ID, 'privateMessageCompressedWindow', {
			name: MODULE.ID + '.privateMessageCompressedWindow-Label',
			hint: MODULE.ID + '.privateMessageCompressedWindow-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'user',
			default: false,
		});



		// ** BEVERAGE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Beverage", {
			name: MODULE.ID + '.headingH3Beverage-Label',
			hint: MODULE.ID + '.headingH3Beverage-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'beverageEnabled', {
			name: MODULE.ID + '.beverageEnabled-Label',
			hint: MODULE.ID + '.beverageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Beverage Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubBeverageEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubBeverageEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubBeverageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Beverage Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryBeverageEnabled', {
			name: MODULE.ID + '.toolbarFoundryBeverageEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryBeverageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Beverage Theme --
		game.settings.register(MODULE.ID, 'cardThemeBeverage', {
			name: MODULE.ID + '.cardThemeBeverage-Label',
			hint: MODULE.ID + '.cardThemeBeverage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Beverage Table --
		game.settings.register(MODULE.ID,'beverageTable', {
			name: MODULE.ID + '.beverageTable-Label',
			hint: MODULE.ID + '.beverageTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Beverage Macro --
		game.settings.register(MODULE.ID,'beverageMacro', {
			name: MODULE.ID + '.beverageMacro-Label',
			hint: MODULE.ID + '.beverageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ** BIO **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Bio", {
			name: MODULE.ID + '.headingH3Bio-Label',
			hint: MODULE.ID + '.headingH3Bio-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'bioEnabled', {
			name: MODULE.ID + '.bioEnabled-Label',
			hint: MODULE.ID + '.bioEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Bio Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubBioEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubBioEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubBioEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Bio Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryBioEnabled', {
			name: MODULE.ID + '.toolbarFoundryBioEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryBioEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Bio Theme --
		game.settings.register(MODULE.ID, 'cardThemeBio', {
			name: MODULE.ID + '.cardThemeBio-Label',
			hint: MODULE.ID + '.cardThemeBio-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Bio Table --
		game.settings.register(MODULE.ID,'bioTable', {
			name: MODULE.ID + '.bioTable-Label',
			hint: MODULE.ID + '.bioTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Bio Macro --
		game.settings.register(MODULE.ID,'bioMacro', {
			name: MODULE.ID + '.bioMacro-Label',
			hint: MODULE.ID + '.bioMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ** INSULTS **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Insults", {
			name: MODULE.ID + '.headingH3Insults-Label',
			hint: MODULE.ID + '.headingH3Insults-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'insultsEnabled', {
			name: MODULE.ID + '.insultsEnabled-Label',
			hint: MODULE.ID + '.insultsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Insults Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubInsultsEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubInsultsEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubInsultsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Insults Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryInsultsEnabled', {
			name: MODULE.ID + '.toolbarFoundryInsultsEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryInsultsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Insults Theme --
		game.settings.register(MODULE.ID, 'cardThemeInsults', {
			name: MODULE.ID + '.cardThemeInsults-Label',
			hint: MODULE.ID + '.cardThemeInsults-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Insults Table --
		game.settings.register(MODULE.ID,'insultsTable', {
			name: MODULE.ID + '.insultsTable-Label',
			hint: MODULE.ID + '.insultsTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Insults Macro --
		game.settings.register(MODULE.ID,'insultsMacro', {
			name: MODULE.ID + '.insultsMacro-Label',
			hint: MODULE.ID + '.insultsMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// ** PRAISE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Praise", {
			name: MODULE.ID + '.headingH3Praise-Label',
			hint: MODULE.ID + '.headingH3Praise-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'praiseEnabled', {
			name: MODULE.ID + '.praiseEnabled-Label',
			hint: MODULE.ID + '.praiseEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Praise Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubPraiseEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubPraiseEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubPraiseEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Praise Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryPraiseEnabled', {
			name: MODULE.ID + '.toolbarFoundryPraiseEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryPraiseEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Praise Theme --
		game.settings.register(MODULE.ID, 'cardThemePraise', {
			name: MODULE.ID + '.cardThemePraise-Label',
			hint: MODULE.ID + '.cardThemePraise-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Praise Table --
		game.settings.register(MODULE.ID,'praiseTable', {
			name: MODULE.ID + '.praiseTable-Label',
			hint: MODULE.ID + '.praiseTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Praise Macro --
		game.settings.register(MODULE.ID,'praiseMacro', {
			name: MODULE.ID + '.praiseMacro-Label',
			hint: MODULE.ID + '.praiseMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ********** ROLL TABLES **********

		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2RollTables", {
			name: MODULE.ID + '.headingH2RollTables-Label',
			hint: MODULE.ID + '.headingH2RollTables-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});




















		// -------------------------------------
		// ** INVESTIGATION **
		// ---------- SUBHEADING ----------
			game.settings.register(MODULE.ID, "headingH3Investigation", {
			name: MODULE.ID + '.headingH3Investigation-Label',
			hint: MODULE.ID + '.headingH3Investigation-Hint',
			scope: "client",
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











		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Gifts", {
			name: MODULE.ID + '.headingH3Gifts-Label',
			hint: MODULE.ID + '.headingH3Gifts-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'giftEnabled', {
			name: MODULE.ID + '.giftEnabled-Label',
			hint: MODULE.ID + '.giftEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Gift Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubGiftEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubGiftEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubGiftEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Gift Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryGiftEnabled', {
			name: MODULE.ID + '.toolbarFoundryGiftEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryGiftEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Gift Table --
		game.settings.register(MODULE.ID,'giftTable', {
			name: MODULE.ID + '.giftTable-Label',
			hint: MODULE.ID + '.giftTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Gift Macro --
		game.settings.register(MODULE.ID,'giftMacro', {
			name: MODULE.ID + '.giftMacro-Label',
			hint: MODULE.ID + '.giftMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3ShadyGoods", {
			name: MODULE.ID + '.headingH3ShadyGoods-Label',
			hint: MODULE.ID + '.headingH3ShadyGoods-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'shadygoodsEnabled', {
			name: MODULE.ID + '.shadygoodsEnabled-Label',
			hint: MODULE.ID + '.shadygoodsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Shady Goods Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubShadygoodsEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubShadygoodsEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubShadygoodsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Shady Goods Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryShadygoodsEnabled', {
			name: MODULE.ID + '.toolbarFoundryShadygoodsEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryShadygoodsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		// -- Shady Goods Table --
		game.settings.register(MODULE.ID,'shadygoodsTable', {
			name: MODULE.ID + '.shadygoodsTable-Label',
			hint: MODULE.ID + 'shadygoodsTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Shady Goods Macro --
		game.settings.register(MODULE.ID,'shadygoodsMacro', {
			name: MODULE.ID + '.shadygoodsMacro-Label',
			hint: MODULE.ID + '.shadygoodsMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ** CRITICAL **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Critical", {
			name: MODULE.ID + '.headingH3Critical-Label',
			hint: MODULE.ID + '.headingH3Critical-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'criticalEnabled', {
			name: MODULE.ID + '.criticalEnabled-Label',
			hint: MODULE.ID + '.criticalEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Critical Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubCriticalEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubCriticalEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubCriticalEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Critical Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryCriticalEnabled', {
			name: MODULE.ID + '.toolbarFoundryCriticalEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryCriticalEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Critical Theme --
		game.settings.register(MODULE.ID, 'cardThemeCritical', {
			name: MODULE.ID + '.cardThemeCritical-Label',
			hint: MODULE.ID + '.cardThemeCritical-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- Critical Table --
		game.settings.register(MODULE.ID,'criticalTable', {
			name: MODULE.ID + '.criticalTable-Label',
			hint: MODULE.ID + '.criticalTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Critical Macro --
		game.settings.register(MODULE.ID,'criticalMacro', {
			name: MODULE.ID + '.criticalMacro-Label',
			hint: MODULE.ID + '.criticalMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// ** FUMBLE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Fumbles", {
			name: MODULE.ID + '.headingH3Fumbles-Label',
			hint: MODULE.ID + '.headingH3Fumbles-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'fumbleEnabled', {
			name: MODULE.ID + '.fumbleEnabled-Label',
			hint: MODULE.ID + '.fumbleEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Fumble Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubFumbleEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubFumbleEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubFumbleEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Fumble Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryFumbleEnabled', {
			name: MODULE.ID + '.toolbarFoundryFumbleEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryFumbleEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Fumble Theme --
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
		// -- Fumble Table --
		game.settings.register(MODULE.ID,'fumbleTable', {
			name: MODULE.ID + '.fumbleTable-Label',
			hint: MODULE.ID + '.fumbleTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Fumble Macro --
		game.settings.register(MODULE.ID,'fumbleMacro', {
			name: MODULE.ID + '.fumbleMacro-Label',
			hint: MODULE.ID + '.fumbleMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});


		// ** INSPIRATION **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Inspiration", {
			name: MODULE.ID + '.headingH3Inspiration-Label',
			hint: MODULE.ID + '.headingH3Inspiration-Hint',
			scope: "client",
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
		// -- Inspiration Table --
		game.settings.register(MODULE.ID,'inspirationTable', {
			name: MODULE.ID + '.inspirationTable-Label',
			hint: MODULE.ID + '.inspirationTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
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


		// ** DOMT **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3DOMT", {
			name: MODULE.ID + '.headingH3DOMT-Label',
			hint: MODULE.ID + '.headingH3DOMT-Hint',
			scope: "client",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'domtEnabled', {
			name: MODULE.ID + '.domtEnabled-Label',
			hint: MODULE.ID + '.domtEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- DOMT Theme --
		game.settings.register(MODULE.ID, 'cardThemeDOMT', {
			name: MODULE.ID + '.cardThemeDOMT-Label',
			hint: MODULE.ID + '.cardThemeDOMT-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
		// -- DOMT Table --
		game.settings.register(MODULE.ID,'domtTable', {
			name: MODULE.ID + '.domtTable-Label',
			hint: MODULE.ID + '.domtTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		// -- DOMT Macro --
		game.settings.register(MODULE.ID,'domtMacro', {
			name: MODULE.ID + '.domtMacro-Label',
			hint: MODULE.ID + '.domtMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
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


		// LETS MAKE IT EVENTUALLY SO I CAN BE ROLLED MANUALLY OR AUTOMATED BASED ON CRITERIA

		game.settings.register(MODULE.ID, 'injuriesEnabledGlobal', {
			name: MODULE.ID + '.injuriesEnabledGlobal-Label',
			hint: MODULE.ID + '.injuriesEnabledGlobal-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Injuries Coffee Pub Toolbar --
		game.settings.register(MODULE.ID, 'toolbarCoffeePubInjuriesEnabled', {
			name: MODULE.ID + '.toolbarCoffeePubInjuriesEnabled-Label',
			hint: MODULE.ID + '.toolbarCoffeePubInjuriesEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: true,
		});
		// -- Injuries Foundry Toolbar --
		game.settings.register(MODULE.ID, 'toolbarFoundryInjuriesEnabled', {
			name: MODULE.ID + '.toolbarFoundryInjuriesEnabled-Label',
			hint: MODULE.ID + '.toolbarFoundryInjuriesEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'user',
			default: false,
		});
		game.settings.register(MODULE.ID,'injuryCompendium', {
			name: MODULE.ID + '.injuryCompendium-Label',
			hint: MODULE.ID + '.injuryCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Compendium --',
			choices: getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
		});

		game.settings.register(MODULE.ID,'injuriesMacroGlobal', {
			name: MODULE.ID + '.injuriesMacroGlobal-Label',
			hint: MODULE.ID + '.injuriesMacroGlobal-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
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


		// -- Injury Sound --
		game.settings.register(MODULE.ID,'injurySound', {
			name: MODULE.ID + '.injurySound-Label',
			hint: MODULE.ID + '.injurySound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: getBlacksmithChoices('arrSoundChoices', 'No sounds found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Injury Sound VOlume --
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




		// ********** ENCOUNTERS **********

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
		game.settings.register(MODULE.ID, 'cardThemeEncounter', {
			name: MODULE.ID + '.cardThemeEncounter-Label',
			hint: MODULE.ID + '.cardThemeEncounter-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: 'theme-default',
			choices: themeChoices
		});
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
			scope: 'client',
			config: false,
			type: String,
			default: 'Any',
		});
		game.settings.register(MODULE.ID, 'quickEncounterMinCR', {
			scope: 'client',
			config: false,
			type: Number,
			default: 0,
		});
		game.settings.register(MODULE.ID, 'quickEncounterMaxCR', {
			scope: 'client',
			config: false,
			type: Number,
			default: 30,
		});
		game.settings.register(MODULE.ID, 'quickEncounterMaxRecommendations', {
			scope: 'client',
			config: false,
			type: Number,
			default: 10,
		});
		game.settings.register(MODULE.ID, 'quickEncounterVariability', {
			scope: 'client',
			config: false,
			type: Number,
			default: 3,
		});
		game.settings.register(MODULE.ID, 'quickEncounterDetection', {
			scope: 'client',
			config: false,
			type: Number,
			default: 3,
		});
		game.settings.register(MODULE.ID, 'quickEncounterRecentIncludeNames', {
			scope: 'client',
			config: false,
			type: Object,
			default: [],
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




	});
};
