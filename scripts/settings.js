// ================================================================== 
// ===== IMPORTS ====================================================
// ================================================================== 

// Grab the module data
import { MODULE_TITLE, MODULE_ID, BIBLIOSOPH  } from './const.js';
// -- Import the shared GLOBAL variables --
import { COFFEEPUB, MODULE_AUTHOR } from './global.js';
// -- Load the shared GLOBAL functions --
import { registerBlacksmithUpdatedHook, postConsoleAndNotification, getActorId, resetModuleSettings} from './global.js';
// -- Import special page variables --
// none.


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
		// Register settings...
		postConsoleAndNotification("Registering Settings...", "", false, false, false) 
		// Debug: Post the variables
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.strDEFAULTCARDTHEME: ", COFFEEPUB.strDEFAULTCARDTHEME, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrTHEMECHOICES: ", COFFEEPUB.arrTHEMECHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrMACROCHOICES: ", COFFEEPUB.arrMACROCHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrTABLECHOICES: ", COFFEEPUB.arrTABLECHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrBACKGROUNDIMAGECHOICES: ", COFFEEPUB.arrBACKGROUNDIMAGECHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrICONCHOICES: ", COFFEEPUB.arrICONCHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrSOUNDCHOICES: ", COFFEEPUB.arrSOUNDCHOICES, false, true, false);
		postConsoleAndNotification("Variables in Settings. COFFEEPUB.arrCOMPENDIUMCHOICES: ", COFFEEPUB.arrCOMPENDIUMCHOICES, false, true, false);

		// ---------- TITLE ----------
		game.settings.register(MODULE_ID, "headingH1Bibliosoph", {
			name: MODULE_ID + '.headingH1Bibliosoph-Label',
			hint: MODULE_ID + '.headingH1Bibliosoph-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// ---------- HORIZANTAL RULE ----------
		/* 
		game.settings.register(MODULE_ID, "headingHRBibliosoph", {
			name: " ",
			hint: " ",
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		*/
		// -------------------------------------


		// ---------- HEADING ----------
		game.settings.register(MODULE_ID, "headingH2Communications", {
			name: MODULE_ID + '.headingH2Communications-Label',
			hint: MODULE_ID + '.headingH2Communications-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

	  	// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3PartyMessage", {
			name: MODULE_ID + '.headingH3PartyMessage-Label',
			hint: MODULE_ID + '.headingH3PartyMessage-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		game.settings.register(MODULE_ID, 'partyMessageEnabled', {
			name: MODULE_ID + '.partyMessageEnabled-Label',
			hint: MODULE_ID + '.partyMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Party Message Macro --
		game.settings.register(MODULE_ID,'partyMessageMacro', {
			name: MODULE_ID + '.partyMessageMacro-Label',
			hint: MODULE_ID + '.partyMessageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Party Message Theme --
		game.settings.register(MODULE_ID, 'cardThemePartyMessage', {
			name: MODULE_ID + '.cardThemePartyMessage-Label',
			hint: MODULE_ID + '.cardThemePartyMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3PrivateMessage", {
			name: MODULE_ID + '.headingH3PrivateMessage-Label',
			hint: MODULE_ID + '.headingH3PrivateMessage-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'privateMessageEnabled', {
			name: MODULE_ID + '.privateMessageEnabled-Label',
			hint: MODULE_ID + '.privateMessageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Private Message Macro --
		game.settings.register(MODULE_ID,'privateMessageMacro', {
			name: MODULE_ID + '.privateMessageMacro-Label',
			hint: MODULE_ID + '.privateMessageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// -- Private Message Theme --
		game.settings.register(MODULE_ID, 'cardThemePrivateMessage', {
			name: MODULE_ID + '.cardThemePrivateMessage-Label',
			hint: MODULE_ID + '.cardThemePrivateMessage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});

		// -- Private Message Layout --
		game.settings.register(MODULE_ID, 'cardLayoutPrivateMessage', {
			name: MODULE_ID + '.cardLayoutPrivateMessage-Label',
			hint: MODULE_ID + '.cardLayoutPrivateMessage-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});

		// ** BEVERAGE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Beverage", {
			name: MODULE_ID + '.headingH3Beverage-Label',
			hint: MODULE_ID + '.headingH3Beverage-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'beverageEnabled', {
			name: MODULE_ID + '.beverageEnabled-Label',
			hint: MODULE_ID + '.beverageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Beverage Theme --
		game.settings.register(MODULE_ID, 'cardThemeBeverage', {
			name: MODULE_ID + '.cardThemeBeverage-Label',
			hint: MODULE_ID + '.cardThemeBeverage-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Beverage Table --
		game.settings.register(MODULE_ID,'beverageTable', {
			name: MODULE_ID + '.beverageTable-Label',
			hint: MODULE_ID + '.beverageTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Beverage Macro --
		game.settings.register(MODULE_ID,'beverageMacro', {
			name: MODULE_ID + '.beverageMacro-Label',
			hint: MODULE_ID + '.beverageMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ** BIO **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Bio", {
			name: MODULE_ID + '.headingH3Bio-Label',
			hint: MODULE_ID + '.headingH3Bio-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'bioEnabled', {
			name: MODULE_ID + '.bioEnabled-Label',
			hint: MODULE_ID + '.bioEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Bio Theme --
		game.settings.register(MODULE_ID, 'cardThemeBio', {
			name: MODULE_ID + '.cardThemeBio-Label',
			hint: MODULE_ID + '.cardThemeBio-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Bio Table --
		game.settings.register(MODULE_ID,'bioTable', {
			name: MODULE_ID + '.bioTable-Label',
			hint: MODULE_ID + '.bioTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Bio Macro --
		game.settings.register(MODULE_ID,'bioMacro', {
			name: MODULE_ID + '.bioMacro-Label',
			hint: MODULE_ID + '.bioMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ** INSULTS **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Insults", {
			name: MODULE_ID + '.headingH3Insults-Label',
			hint: MODULE_ID + '.headingH3Insults-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'insultsEnabled', {
			name: MODULE_ID + '.insultsEnabled-Label',
			hint: MODULE_ID + '.insultsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Insults Theme --
		game.settings.register(MODULE_ID, 'cardThemeInsults', {
			name: MODULE_ID + '.cardThemeInsults-Label',
			hint: MODULE_ID + '.cardThemeInsults-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Insults Table --
		game.settings.register(MODULE_ID,'insultsTable', {
			name: MODULE_ID + '.insultsTable-Label',
			hint: MODULE_ID + '.insultsTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Insults Macro --
		game.settings.register(MODULE_ID,'insultsMacro', {
			name: MODULE_ID + '.insultsMacro-Label',
			hint: MODULE_ID + '.insultsMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// ** PRAISE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Praise", {
			name: MODULE_ID + '.headingH3Praise-Label',
			hint: MODULE_ID + '.headingH3Praise-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'praiseEnabled', {
			name: MODULE_ID + '.praiseEnabled-Label',
			hint: MODULE_ID + '.praiseEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Praise Theme --
		game.settings.register(MODULE_ID, 'cardThemePraise', {
			name: MODULE_ID + '.cardThemePraise-Label',
			hint: MODULE_ID + '.cardThemePraise-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Praise Table --
		game.settings.register(MODULE_ID,'praiseTable', {
			name: MODULE_ID + '.praiseTable-Label',
			hint: MODULE_ID + '.praiseTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Praise Macro --
		game.settings.register(MODULE_ID,'praiseMacro', {
			name: MODULE_ID + '.praiseMacro-Label',
			hint: MODULE_ID + '.praiseMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ********** ROLL TABLES **********

		// ---------- HEADING ----------
		game.settings.register(MODULE_ID, "headingH2RollTables", {
			name: MODULE_ID + '.headingH2RollTables-Label',
			hint: MODULE_ID + '.headingH2RollTables-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// ** INVESTIGATION **

		// ---------- SUBHEADING ----------
			game.settings.register(MODULE_ID, "headingH3Investigation", {
			name: MODULE_ID + '.headingH3Investigation-Label',
			hint: MODULE_ID + '.headingH3Investigation-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'investigationEnabled', {
			name: MODULE_ID + '.investigationEnabled-Label',
			hint: MODULE_ID + '.investigationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Investigation Theme --
		game.settings.register(MODULE_ID, 'cardThemeInvestigation', {
			name: MODULE_ID + '.cardThemeInvestigation-Label',
			hint: MODULE_ID + '.cardThemeInvestigation-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Investigation Odds --
		game.settings.register(MODULE_ID,'investigationOdds', {
			name: MODULE_ID + '.investigationOdds-Label',
			hint: MODULE_ID + '.investigationOdds-Hint',
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
		game.settings.register(MODULE_ID,'investigationDice', {
			name: MODULE_ID + '.investigationDice-Label',
			hint: MODULE_ID + '.investigationDice-Hint',
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
		game.settings.register(MODULE_ID,'investigationTable', {
			name: MODULE_ID + '.investigationTable-Label',
			hint: MODULE_ID + '.investigationTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Investigation Macro --
		game.settings.register(MODULE_ID,'investigationMacro', {
			name: MODULE_ID + '.investigationMacro-Label',
			hint: MODULE_ID + '.investigationMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});


		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Gifts", {
			name: MODULE_ID + '.headingH3Gifts-Label',
			hint: MODULE_ID + '.headingH3Gifts-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'giftEnabled', {
			name: MODULE_ID + '.giftEnabled-Label',
			hint: MODULE_ID + '.giftEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Gift Table --
		game.settings.register(MODULE_ID,'giftTable', {
			name: MODULE_ID + '.giftTable-Label',
			hint: MODULE_ID + '.giftTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});

		// -- Gift Macro --
		game.settings.register(MODULE_ID,'giftMacro', {
			name: MODULE_ID + '.giftMacro-Label',
			hint: MODULE_ID + '.giftMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3ShadyGoods", {
			name: MODULE_ID + '.headingH3ShadyGoods-Label',
			hint: MODULE_ID + '.headingH3ShadyGoods-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'shadygoodsEnabled', {
			name: MODULE_ID + '.shadygoodsEnabled-Label',
			hint: MODULE_ID + '.shadygoodsEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Shady Goods Table --
		game.settings.register(MODULE_ID,'shadygoodsTable', {
			name: MODULE_ID + '.shadygoodsTable-Label',
			hint: MODULE_ID + 'shadygoodsTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Shady Goods Macro --
		game.settings.register(MODULE_ID,'shadygoodsMacro', {
			name: MODULE_ID + '.shadygoodsMacro-Label',
			hint: MODULE_ID + '.shadygoodsMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ** CRITICAL **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Critical", {
			name: MODULE_ID + '.headingH3Critical-Label',
			hint: MODULE_ID + '.headingH3Critical-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'criticalEnabled', {
			name: MODULE_ID + '.criticalEnabled-Label',
			hint: MODULE_ID + '.criticalEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Critical Theme --
		game.settings.register(MODULE_ID, 'cardThemeCritical', {
			name: MODULE_ID + '.cardThemeCritical-Label',
			hint: MODULE_ID + '.cardThemeCritical-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Critical Table --
		game.settings.register(MODULE_ID,'criticalTable', {
			name: MODULE_ID + '.criticalTable-Label',
			hint: MODULE_ID + '.criticalTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Critical Macro --
		game.settings.register(MODULE_ID,'criticalMacro', {
			name: MODULE_ID + '.criticalMacro-Label',
			hint: MODULE_ID + '.criticalMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ** FUMBLE **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Fumbles", {
			name: MODULE_ID + '.headingH3Fumbles-Label',
			hint: MODULE_ID + '.headingH3Fumbles-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'fumbleEnabled', {
			name: MODULE_ID + '.fumbleEnabled-Label',
			hint: MODULE_ID + '.fumbleEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Fumble Theme --
		game.settings.register(MODULE_ID, 'cardThemeFumble', {
			name: MODULE_ID + '.cardThemeFumble-Label',
			hint: MODULE_ID + '.cardThemeFumble-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			type: String,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Fumble Table --
		game.settings.register(MODULE_ID,'fumbleTable', {
			name: MODULE_ID + '.fumbleTable-Label',
			hint: MODULE_ID + '.fumbleTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Fumble Macro --
		game.settings.register(MODULE_ID,'fumbleMacro', {
			name: MODULE_ID + '.fumbleMacro-Label',
			hint: MODULE_ID + '.fumbleMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});


		// ** INSPIRATION **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3Inspiration", {
			name: MODULE_ID + '.headingH3Inspiration-Label',
			hint: MODULE_ID + '.headingH3Inspiration-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'inspirationEnabled', {
			name: MODULE_ID + '.inspirationEnabled-Label',
			hint: MODULE_ID + '.inspirationEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- Inspiration Theme --
		game.settings.register(MODULE_ID, 'cardThemeInspiration', {
			name: MODULE_ID + '.cardThemeInspiration-Label',
			hint: MODULE_ID + '.cardThemeInspiration-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Inspiration Table --
		game.settings.register(MODULE_ID,'inspirationTable', {
			name: MODULE_ID + '.inspirationTable-Label',
			hint: MODULE_ID + '.inspirationTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- Inspiration Macro --
		game.settings.register(MODULE_ID,'inspirationMacro', {
			name: MODULE_ID + '.inspirationMacro-Label',
			hint: MODULE_ID + '.inspirationMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});


		// ** DOMT **

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3DOMT", {
			name: MODULE_ID + '.headingH3DOMT-Label',
			hint: MODULE_ID + '.headingH3DOMT-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'domtEnabled', {
			name: MODULE_ID + '.domtEnabled-Label',
			hint: MODULE_ID + '.domtEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		// -- DOMT Theme --
		game.settings.register(MODULE_ID, 'cardThemeDOMT', {
			name: MODULE_ID + '.cardThemeDOMT-Label',
			hint: MODULE_ID + '.cardThemeDOMT-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- DOMT Table --
		game.settings.register(MODULE_ID,'domtTable', {
			name: MODULE_ID + '.domtTable-Label',
			hint: MODULE_ID + '.domtTable-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		// -- DOMT Macro --
		game.settings.register(MODULE_ID,'domtMacro', {
			name: MODULE_ID + '.domtMacro-Label',
			hint: MODULE_ID + '.domtMacro-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// ********** ENCOUNTERS **********

		// ---------- HEADING ----------
		game.settings.register(MODULE_ID, "headingH2Encounters", {
			name: MODULE_ID + '.headingH2Encounters-Label',
			hint: MODULE_ID + '.headingH2Encounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Encounter Settings --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3EncounterSettings", {
			name: MODULE_ID + '.headingH3EncounterSettings-Label',
			hint: MODULE_ID + '.headingH3EncounterSettings-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Card Style --
		game.settings.register(MODULE_ID, 'cardThemeEncounter', {
			name: MODULE_ID + '.cardThemeEncounter-Label',
			hint: MODULE_ID + '.cardThemeEncounter-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});
		// -- Encounter Odds --
		game.settings.register(MODULE_ID,'encounterOdds', {
			name: MODULE_ID + '.encounterOdds-Label',
			hint: MODULE_ID + '.encounterOdds-Hint',
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
		game.settings.register(MODULE_ID,'encounterDice', {
			name: MODULE_ID + '.encounterDice-Label',
			hint: MODULE_ID + '.encounterDice-Hint',
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
		game.settings.register(MODULE_ID,'encounterTableNoEncounter', {
			name: MODULE_ID + '.encounterTableNoEncounter-Label',
			hint: MODULE_ID + '.encounterTableNoEncounter-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		}); 
		game.settings.register(MODULE_ID,'encounterTableBefore', {
			name: MODULE_ID + '.encounterTableBefore-Label',
			hint: MODULE_ID + '.encounterTableBefore-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		}); 
		game.settings.register(MODULE_ID,'encounterTableReveal', {
			name: MODULE_ID + '.encounterTableReveal-Label',
			hint: MODULE_ID + '.encounterTableReveal-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		}); 
		game.settings.register(MODULE_ID,'encounterTableAfter', {
			name: MODULE_ID + '.encounterTableAfter-Label',
			hint: MODULE_ID + '.encounterTableAfter-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		}); 
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleGeneralEncounters", {
			name: MODULE_ID + '.headingH3simpleGeneralEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleGeneralEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- General Encounter --
		game.settings.register(MODULE_ID, 'encounterEnabledGeneral', {
			name: MODULE_ID + '.encounterEnabledGeneral-Label',
			hint: MODULE_ID + '.encounterEnabledGeneral-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableGeneral', {
			name: MODULE_ID + '.encounterTableGeneral-Label',
			hint: MODULE_ID + '.encounterTableGeneral-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		}); 
		game.settings.register(MODULE_ID,'encounterMacroGeneral', {
			name: MODULE_ID + '.encounterMacroGeneral-Label',
			hint: MODULE_ID + '.encounterMacroGeneral-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// -- Cave Encounter --

		// ---------- headingH3simple ----------
		game.settings.register(MODULE_ID, "headingH3simpleCaveEncounters", {
			name: MODULE_ID + '.headingH3simpleCaveEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleCaveEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledCave', {
			name: MODULE_ID + '.encounterEnabledCave-Label',
			hint: MODULE_ID + '.encounterEnabledCave-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableCave', {
			name: MODULE_ID + '.encounterTableCave-Label',
			hint: MODULE_ID + '.encounterTableCave-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroCave', {
			name: MODULE_ID + '.encounterMacroCave-Label',
			hint: MODULE_ID + '.encounterMacroCave-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Desert Encounter --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleDesertEncounters", {
			name: MODULE_ID + '.headingH3simpleDesertEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleDesertEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledDesert', {
			name: MODULE_ID + '.encounterEnabledDesert-Label',
			hint: MODULE_ID + '.encounterEnabledDesert-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableDesert', {
			name: MODULE_ID + '.encounterTableDesert-Label',
			hint: MODULE_ID + '.encounterTableDesert-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroDesert', {
			name: MODULE_ID + '.encounterMacroDesert-Label',
			hint: MODULE_ID + '.encounterMacroDesert-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		// -- Dungeon Encounter --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleDungeonEncounters", {
			name: MODULE_ID + '.headingH3simpleDungeonEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleDungeonEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledDungeon', {
			name: MODULE_ID + '.encounterEnabledDungeon-Label',
			hint: MODULE_ID + '.encounterEnabledDungeon-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableDungeon', {
			name: MODULE_ID + '.encounterTableDungeon-Label',
			hint: MODULE_ID + '.encounterTableDungeon-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroDungeon', {
			name: MODULE_ID + '.encounterMacroDungeon-Label',
			hint: MODULE_ID + '.encounterMacroDungeon-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Forest Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleForestEncounters", {
			name: MODULE_ID + '.headingH3simpleForestEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleForestEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledForest', {
			name: MODULE_ID + '.encounterEnabledForest-Label',
			hint: MODULE_ID + '.encounterEnabledForest-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableForest', {
			name: MODULE_ID + '.encounterTableForest-Label',
			hint: MODULE_ID + '.encounterTableForest-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroForest', {
			name: MODULE_ID + '.encounterMacroForest-Label',
			hint: MODULE_ID + '.encounterMacroForest-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Mountain Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleMountainEncounters", {
			name: MODULE_ID + '.headingH3simpleMountainEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleMountainEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledMountain', {
			name: MODULE_ID + '.encounterEnabledMountain-Label',
			hint: MODULE_ID + '.encounterEnabledMountain-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableMountain', {
			name: MODULE_ID + '.encounterTableMountain-Label',
			hint: MODULE_ID + '.encounterTableMountain-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroMountain', {
			name: MODULE_ID + '.encounterMacroMountain-Label',
			hint: MODULE_ID + '.encounterMacroMountain-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Sky Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleSkyEncounters", {
			name: MODULE_ID + '.headingH3simpleSkyEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleSkyEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledSky', {
			name: MODULE_ID + '.encounterEnabledSky-Label',
			hint: MODULE_ID + '.encounterEnabledSky-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableSky', {
			name: MODULE_ID + '.encounterTableSky-Label',
			hint: MODULE_ID + '.encounterTableSky-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroSky', {
			name: MODULE_ID + '.encounterMacroSky-Label',
			hint: MODULE_ID + '.encounterMacroSky-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Snow Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleSnowEncounters", {
			name: MODULE_ID + '.headingH3simpleSnowEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleSnowEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledSnow', {
			name: MODULE_ID + '.encounterEnabledSnow-Label',
			hint: MODULE_ID + '.encounterEnabledSnow-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableSnow', {
			name: MODULE_ID + '.encounterTableSnow-Label',
			hint: MODULE_ID + '.encounterTableSnow-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroSnow', {
			name: MODULE_ID + '.encounterMacroSnow-Label',
			hint: MODULE_ID + '.encounterMacroSnow-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Urban Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleUrbanEncounters", {
			name: MODULE_ID + '.headingH3simpleUrbanEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleUrbanEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledUrban', {
			name: MODULE_ID + '.encounterEnabledUrban-Label',
			hint: MODULE_ID + '.encounterEnabledUrban-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableUrban', {
			name: MODULE_ID + '.encounterTableUrban-Label',
			hint: MODULE_ID + '.encounterTableUrban-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroUrban', {
			name: MODULE_ID + '.encounterMacroUrban-Label',
			hint: MODULE_ID + '.encounterMacroUrban-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});
		// -- Water Encounter --
		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3simpleWaterEncounters", {
			name: MODULE_ID + '.headingH3simpleWaterEncounters-Label',
			hint: MODULE_ID + '.headingH3simpleWaterEncounters-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		game.settings.register(MODULE_ID, 'encounterEnabledWater', {
			name: MODULE_ID + '.encounterEnabledWater-Label',
			hint: MODULE_ID + '.encounterEnabledWater-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'encounterTableWater', {
			name: MODULE_ID + '.encounterTableWater-Label',
			hint: MODULE_ID + '.encounterTableWater-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Table --',
			choices: COFFEEPUB.arrTABLECHOICES
		});
		game.settings.register(MODULE_ID,'encounterMacroWater', {
			name: MODULE_ID + '.encounterMacroWater-Label',
			hint: MODULE_ID + '.encounterMacroWater-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});


		// ********** INJURIES **********

		// ---------- Injuries ----------
		game.settings.register(MODULE_ID, "headingH2Injuries", {
			name: MODULE_ID + '.headingH2Injuries-Label',
			hint: MODULE_ID + '.headingH2Injuries-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------

		// -- Injury Settings --

		// ---------- SUBHEADING ----------
		game.settings.register(MODULE_ID, "headingH3InjuriesSettings", {
			name: MODULE_ID + '.headingH3InjuriesSettings-Label',
			hint: MODULE_ID + '.headingH3InjuriesSettings-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------


		// LETS MAKE IT EVENTUALLY SO I CAN BE ROLLED MANUALLY OR AUTOMATED BASED ON CRITERIA

		game.settings.register(MODULE_ID, 'injuriesEnabledGlobal', {
			name: MODULE_ID + '.injuriesEnabledGlobal-Label',
			hint: MODULE_ID + '.injuriesEnabledGlobal-Hint',
			type: Boolean,
			config: true,
			requiresReload: true,
			scope: 'world',
			default: false,
		});
		game.settings.register(MODULE_ID,'injuryCompendium', {
			name: MODULE_ID + '.injuryCompendium-Label',
			hint: MODULE_ID + '.injuryCompendium-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: '-- Choose a Roll Compendium --',
			choices: COFFEEPUB.arrCOMPENDIUMCHOICES
		});

		// -- Party Message Theme --
		game.settings.register(MODULE_ID, 'cardThemeInjury', {
			name: MODULE_ID + '.cardThemeInjury-Label',
			hint: MODULE_ID + '.cardThemeInjury-Hint',
			scope: 'world',
			config: true,
			requiresReload: false,
			default: COFFEEPUB.strDEFAULTCARDTHEME,
			choices: COFFEEPUB.arrTHEMECHOICES
		});


		// -- Injury Image --
		game.settings.register(MODULE_ID, 'injuryImageEnabled', {
			name: MODULE_ID + '.injuryImageEnabled-Label',
			hint: MODULE_ID + '.injuryImageEnabled-Hint',
			type: Boolean,
			config: true,
			requiresReload: false,
			scope: 'world',
			default: false,
		});


		// -- Injury Sound --
		game.settings.register(MODULE_ID,'injurySound', {
			name: MODULE_ID + '.injurySound-Label',
			hint: MODULE_ID + '.injurySound-Hint',
			scope: "world",
			config: true,
			requiresReload: false,
			default: 'none',
			choices: COFFEEPUB.arrSOUNDCHOICES
		});

		// -- Injury Sound VOlume --
		game.settings.register(MODULE_ID,'injurySoundVolume', {
			name: MODULE_ID + '.injurySoundVolume-Label',
			hint: MODULE_ID + '.injurySoundVolume-Hint',
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
		game.settings.register(MODULE_ID, "headingH3simpleInjuriesGlobal", {
			name: MODULE_ID + '.headingH3simpleInjuriesGlobal-Label',
			hint: MODULE_ID + '.headingH3simpleInjuriesGlobal-Hint',
			scope: "world",
			config: true,
			default: "",
			type: String,
		});
		// -------------------------------------
		
		game.settings.register(MODULE_ID,'injuriesMacroGlobal', {
			name: MODULE_ID + '.injuriesMacroGlobal-Label',
			hint: MODULE_ID + '.injuriesMacroGlobal-Hint',
			scope: "world",
			config: true,
			requiresReload: true,
			default: '-- Choose a Macro --',
			choices: COFFEEPUB.arrMACROCHOICES
		});

		


	});
};