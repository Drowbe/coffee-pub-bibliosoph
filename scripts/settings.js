// ================================================================== 
// ===== IMPORTS ====================================================
// ================================================================== 

// Grab the module data
import { MODULE, BIBLIOSOPH  } from './const.js';

// ================================================================== 
// ===== EXPORTS ====================================================
// ================================================================== 

// ================================================================== 
// ===== FUNCTIONS ==================================================
// ================================================================== 

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

		// Register settings...
		// This is a system message - user should know settings are being registered
		getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.NAME, "Registering Settings...", "", false, false);
		// Debug: Post the Blacksmith choice arrays - This is debug info, only log if really needed for troubleshooting
		const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;

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
			scope: "world",
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
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
		});

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3PrivateMessage", {
			name: MODULE.ID + '.headingH3PrivateMessage-Label',
			hint: MODULE.ID + '.headingH3PrivateMessage-Hint',
			scope: "world",
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
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Private Message Layout --
		game.settings.register(MODULE.ID, 'cardLayoutPrivateMessage', {
			name: MODULE.ID + '.cardLayoutPrivateMessage-Label',
			hint: MODULE.ID + '.cardLayoutPrivateMessage-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});

		// ** BEVERAGE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Beverage", {
			name: MODULE.ID + '.headingH3Beverage-Label',
			hint: MODULE.ID + '.headingH3Beverage-Hint',
			scope: "world",
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
		// -- Beverage Theme --
		game.settings.register(MODULE.ID, 'cardThemeBeverage', {
			name: MODULE.ID + '.cardThemeBeverage-Label',
			hint: MODULE.ID + '.cardThemeBeverage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Bio Theme --
		game.settings.register(MODULE.ID, 'cardThemeBio', {
			name: MODULE.ID + '.cardThemeBio-Label',
			hint: MODULE.ID + '.cardThemeBio-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Insults Theme --
		game.settings.register(MODULE.ID, 'cardThemeInsults', {
			name: MODULE.ID + '.cardThemeInsults-Label',
			hint: MODULE.ID + '.cardThemeInsults-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Praise Theme --
		game.settings.register(MODULE.ID, 'cardThemePraise', {
			name: MODULE.ID + '.cardThemePraise-Label',
			hint: MODULE.ID + '.cardThemePraise-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Investigation Theme --
		game.settings.register(MODULE.ID, 'cardThemeInvestigation', {
			name: MODULE.ID + '.cardThemeInvestigation-Label',
			hint: MODULE.ID + '.cardThemeInvestigation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
		// -- Investigation Dice --
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
		// -- Investigation Table --
		game.settings.register(MODULE.ID,'investigationTable', {
			name: MODULE.ID + '.investigationTable-Label',
			hint: MODULE.ID + '.investigationTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
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


		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3Gifts", {
			name: MODULE.ID + '.headingH3Gifts-Label',
			hint: MODULE.ID + '.headingH3Gifts-Hint',
			scope: "world",
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
			scope: "world",
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
			scope: "world",
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
		// -- Critical Theme --
		game.settings.register(MODULE.ID, 'cardThemeCritical', {
			name: MODULE.ID + '.cardThemeCritical-Label',
			hint: MODULE.ID + '.cardThemeCritical-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Fumble Theme --
		game.settings.register(MODULE.ID, 'cardThemeFumble', {
			name: MODULE.ID + '.cardThemeFumble-Label',
			hint: MODULE.ID + '.cardThemeFumble-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
		// -- Inspiration Theme --
		game.settings.register(MODULE.ID, 'cardThemeInspiration', {
			name: MODULE.ID + '.cardThemeInspiration-Label',
			hint: MODULE.ID + '.cardThemeInspiration-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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
			scope: "world",
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
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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

		// ********** ENCOUNTERS **********

		// ---------- HEADING ----------
		game.settings.register(MODULE.ID, "headingH2Encounters", {
			name: MODULE.ID + '.headingH2Encounters-Label',
			hint: MODULE.ID + '.headingH2Encounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Encounter Settings --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3EncounterSettings", {
			name: MODULE.ID + '.headingH3EncounterSettings-Label',
			hint: MODULE.ID + '.headingH3EncounterSettings-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Card Style --
		game.settings.register(MODULE.ID, 'cardThemeEncounter', {
			name: MODULE.ID + '.cardThemeEncounter-Label',
			hint: MODULE.ID + '.cardThemeEncounter-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Encounter Odds --
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
		// -- Encounter Dice --
		game.settings.register(MODULE.ID,'encounterDice', {
			name: MODULE.ID + '.encounterDice-Label',
			hint: MODULE.ID + '.encounterDice-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			type: Number,
			range: {
			min: 1,
			max: 30,
			step: 1,
			},
			default: 5,
		});	
		game.settings.register(MODULE.ID,'encounterTableNoEncounter', {
			name: MODULE.ID + '.encounterTableNoEncounter-Label',
			hint: MODULE.ID + '.encounterTableNoEncounter-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		}); 
		game.settings.register(MODULE.ID,'encounterTableBefore', {
			name: MODULE.ID + '.encounterTableBefore-Label',
			hint: MODULE.ID + '.encounterTableBefore-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		}); 
		game.settings.register(MODULE.ID,'encounterTableReveal', {
			name: MODULE.ID + '.encounterTableReveal-Label',
			hint: MODULE.ID + '.encounterTableReveal-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		}); 
		game.settings.register(MODULE.ID,'encounterTableAfter', {
			name: MODULE.ID + '.encounterTableAfter-Label',
			hint: MODULE.ID + '.encounterTableAfter-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		}); 
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleGeneralEncounters", {
			name: MODULE.ID + '.headingH3simpleGeneralEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleGeneralEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- General Encounter --
		game.settings.register(MODULE.ID, 'encounterEnabledGeneral', {
			name: MODULE.ID + '.encounterEnabledGeneral-Label',
			hint: MODULE.ID + '.encounterEnabledGeneral-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableGeneral', {
			name: MODULE.ID + '.encounterTableGeneral-Label',
			hint: MODULE.ID + '.encounterTableGeneral-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		}); 
		game.settings.register(MODULE.ID,'encounterMacroGeneral', {
			name: MODULE.ID + '.encounterMacroGeneral-Label',
			hint: MODULE.ID + '.encounterMacroGeneral-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Cave Encounter --

		// ---------- headingH3simple ----------
		game.settings.register(MODULE.ID, "headingH3simpleCaveEncounters", {
			name: MODULE.ID + '.headingH3simpleCaveEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleCaveEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledCave', {
			name: MODULE.ID + '.encounterEnabledCave-Label',
			hint: MODULE.ID + '.encounterEnabledCave-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableCave', {
			name: MODULE.ID + '.encounterTableCave-Label',
			hint: MODULE.ID + '.encounterTableCave-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroCave', {
			name: MODULE.ID + '.encounterMacroCave-Label',
			hint: MODULE.ID + '.encounterMacroCave-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Desert Encounter --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleDesertEncounters", {
			name: MODULE.ID + '.headingH3simpleDesertEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleDesertEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledDesert', {
			name: MODULE.ID + '.encounterEnabledDesert-Label',
			hint: MODULE.ID + '.encounterEnabledDesert-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableDesert', {
			name: MODULE.ID + '.encounterTableDesert-Label',
			hint: MODULE.ID + '.encounterTableDesert-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroDesert', {
			name: MODULE.ID + '.encounterMacroDesert-Label',
			hint: MODULE.ID + '.encounterMacroDesert-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Dungeon Encounter --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleDungeonEncounters", {
			name: MODULE.ID + '.headingH3simpleDungeonEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleDungeonEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledDungeon', {
			name: MODULE.ID + '.encounterEnabledDungeon-Label',
			hint: MODULE.ID + '.encounterEnabledDungeon-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableDungeon', {
			name: MODULE.ID + '.encounterTableDungeon-Label',
			hint: MODULE.ID + '.encounterTableDungeon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroDungeon', {
			name: MODULE.ID + '.encounterMacroDungeon-Label',
			hint: MODULE.ID + '.encounterMacroDungeon-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Forest Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleForestEncounters", {
			name: MODULE.ID + '.headingH3simpleForestEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleForestEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledForest', {
			name: MODULE.ID + '.encounterEnabledForest-Label',
			hint: MODULE.ID + '.encounterEnabledForest-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableForest', {
			name: MODULE.ID + '.encounterTableForest-Label',
			hint: MODULE.ID + '.encounterTableForest-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroForest', {
			name: MODULE.ID + '.encounterMacroForest-Label',
			hint: MODULE.ID + '.encounterMacroForest-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Mountain Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleMountainEncounters", {
			name: MODULE.ID + '.headingH3simpleMountainEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleMountainEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledMountain', {
			name: MODULE.ID + '.encounterEnabledMountain-Label',
			hint: MODULE.ID + '.encounterEnabledMountain-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableMountain', {
			name: MODULE.ID + '.encounterTableMountain-Label',
			hint: MODULE.ID + '.encounterTableMountain-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroMountain', {
			name: MODULE.ID + '.encounterMacroMountain-Label',
			hint: MODULE.ID + '.encounterMacroMountain-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Sky Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleSkyEncounters", {
			name: MODULE.ID + '.headingH3simpleSkyEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleSkyEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledSky', {
			name: MODULE.ID + '.encounterEnabledSky-Label',
			hint: MODULE.ID + '.encounterEnabledSky-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableSky', {
			name: MODULE.ID + '.encounterTableSky-Label',
			hint: MODULE.ID + '.encounterTableSky-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroSky', {
			name: MODULE.ID + '.encounterMacroSky-Label',
			hint: MODULE.ID + '.encounterMacroSky-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Snow Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleSnowEncounters", {
			name: MODULE.ID + '.headingH3simpleSnowEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleSnowEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledSnow', {
			name: MODULE.ID + '.encounterEnabledSnow-Label',
			hint: MODULE.ID + '.encounterEnabledSnow-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableSnow', {
			name: MODULE.ID + '.encounterTableSnow-Label',
			hint: MODULE.ID + '.encounterTableSnow-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroSnow', {
			name: MODULE.ID + '.encounterMacroSnow-Label',
			hint: MODULE.ID + '.encounterMacroSnow-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Urban Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleUrbanEncounters", {
			name: MODULE.ID + '.headingH3simpleUrbanEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleUrbanEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledUrban', {
			name: MODULE.ID + '.encounterEnabledUrban-Label',
			hint: MODULE.ID + '.encounterEnabledUrban-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableUrban', {
			name: MODULE.ID + '.encounterTableUrban-Label',
			hint: MODULE.ID + '.encounterTableUrban-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroUrban', {
			name: MODULE.ID + '.encounterMacroUrban-Label',
			hint: MODULE.ID + '.encounterMacroUrban-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});
		// -- Water Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3simpleWaterEncounters", {
			name: MODULE.ID + '.headingH3simpleWaterEncounters-Label',
			hint: MODULE.ID + '.headingH3simpleWaterEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE.ID, 'encounterEnabledWater', {
			name: MODULE.ID + '.encounterEnabledWater-Label',
			hint: MODULE.ID + '.encounterEnabledWater-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE.ID,'encounterTableWater', {
			name: MODULE.ID + '.encounterTableWater-Label',
			hint: MODULE.ID + '.encounterTableWater-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: getBlacksmithChoices('arrTableChoices', 'No tables found. Try reloading Foundry after all modules are enabled.')
		});
		game.settings.register(MODULE.ID,'encounterMacroWater', {
			name: MODULE.ID + '.encounterMacroWater-Label',
			hint: MODULE.ID + '.encounterMacroWater-Hint',
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

		// -- Injury Settings --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE.ID, "headingH3InjuriesSettings", {
			name: MODULE.ID + '.headingH3InjuriesSettings-Label',
			hint: MODULE.ID + '.headingH3InjuriesSettings-Hint',
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
		game.settings.register(MODULE.ID,'injuryCompendium', {
			name: MODULE.ID + '.injuryCompendium-Label',
			hint: MODULE.ID + '.injuryCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Compendium --',
			choices: getBlacksmithChoices('arrCompendiumChoices', 'No compendiums found. Try reloading Foundry after all modules are enabled.')
		});

		// -- Party Message Theme --
		game.settings.register(MODULE.ID, 'cardThemeInjury', {
			name: MODULE.ID + '.cardThemeInjury-Label',
			hint: MODULE.ID + '.cardThemeInjury-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: getBlacksmithDefault('strDefaultCardTheme', 'default'), // Get default from Blacksmith API
			choices: getBlacksmithChoices('arrThemeChoices', 'No themes found. Try reloading Foundry after all modules are enabled.')
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

		// ---------- GLOBAL INJURIES ----------
		game.settings.register(MODULE.ID, "headingH3simpleInjuriesGlobal", {
			name: MODULE.ID + '.headingH3simpleInjuriesGlobal-Label',
			hint: MODULE.ID + '.headingH3simpleInjuriesGlobal-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		
		game.settings.register(MODULE.ID,'injuriesMacroGlobal', {
			name: MODULE.ID + '.injuriesMacroGlobal-Label',
			hint: MODULE.ID + '.injuriesMacroGlobal-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: getBlacksmithChoices('arrMacroChoices', 'No macros found. Try reloading Foundry after all modules are enabled.')
		});

		


	});
};