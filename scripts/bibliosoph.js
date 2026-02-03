// ================================================================== 
// ===== GET IMPORTS AND CONSTANTS ==================================
// ================================================================== 

// Grab the module data
import { MODULE, BIBLIOSOPH  } from './const.js';
import { registerToolbarTools, unregisterToolbarTools } from './manager-toolbar.js';

// Resolve a macro reference (UUID, id, or name) to a Macro document
const getMacroByIdOrName = (macroKey) => {
    if (!macroKey) return null;

    // 1) Direct id from world collection
    let macro = game.macros.get(macroKey);
    if (macro) return macro;

    // 2) UUID (e.g., "Macro.abc123" or compendium UUID)
    if (typeof macroKey === "string" && macroKey.includes(".")) {
        if (typeof fromUuidSync === "function") {
            macro = fromUuidSync(macroKey);
            if (macro) return macro;
        }
        // If only async resolver exists, skip because we need sync assignment here.
    }

    // 3) Fallback to name lookup (legacy behavior)
    return game.macros.getName(macroKey);
};

// Lightweight logger to trace macro bindings/execution
const logMacroFix = (msg) => console.log(`MACRO FIX ${msg}`);






// ================================================================== 
// ===== BEGIN: REGISTER BLACKSMITH API =============================
// ================================================================== 
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
// Register your module with Blacksmith and then register toolbar tools
Hooks.once('ready', async () => {
    try {
        // Get the module manager
        const moduleManager = BlacksmithModuleManager;
        // Register your module
        moduleManager.registerModule(MODULE.ID, {
            name: MODULE.NAME,
            version: MODULE.VERSION
        });
        // Log success
        console.log(MODULE.ID + ' | ✅ Module ' + MODULE.NAME + ' registered with Blacksmith successfully');
        
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
                    console.error(MODULE.ID + ' | Toolbar registration error:', error);
                }
            } else if (attempts < maxAttempts) {
                // Blacksmith not ready yet, try again
                setTimeout(tryRegisterTools, checkInterval);
            } else {
                // Max attempts reached
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Failed to register tools after ${maxAttempts} attempts. Blacksmith API may not be available.`, "", false, false);
                console.error(MODULE.ID + ' | Failed to register toolbar tools - Blacksmith API not available');
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

// Open party message dialog directly (for toolbar integration)
function openPartyMessageDialog() {
    // Reset variables and set up for party message
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEMESSAGE = true;
    BIBLIOSOPH.CARDTYPE = "Message";
    BIBLIOSOPH.MESSAGES_FORMTITLE = "Party Message";
    
    // Open the dialog
    var blankForm = new BiblioWindowChat();
    blankForm.onFormSubmit = publishChatCard;
    blankForm.isPublic = true;
    blankForm.render(true);
}

// Open private message dialog directly (for toolbar integration)
function openPrivateMessageDialog() {
    // Run the same code that fires when the private message macro is clicked
    const strPrivateMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'privateMessageMacro', '') || '';
    const strPrivateMacroID = getMacroIdByName(strPrivateMacro);
    
    if (!strPrivateMacro || strPrivateMacro === '-- Choose a Macro --' || strPrivateMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Private message macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEWHISPER = true;
    BIBLIOSOPH.CARDTYPE = "Message";
    BIBLIOSOPH.MESSAGES_FORMTITLE = strPrivateMacro;
    BIBLIOSOPH.MACRO_ID = strPrivateMacroID;
    
    // Open the form and get the data
    var blankForm = new BiblioWindowChat();
    // submits calls the card function after form is submitted
    blankForm.onFormSubmit = publishChatCard;
    // SET THE FORM VARIABLES
    blankForm.isPublic = false;
    var recipientArray = ""; // not a reply
    blankForm.optionList = buildPlayerList(recipientArray);
    blankForm.render(true);
}

// Trigger investigation macro (for toolbar integration)
function triggerInvestigationMacro() {
    // Run the same code that fires when the investigation macro is clicked
    const strInvestigationMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'investigationMacro', '') || '';
    
    if (!strInvestigationMacro || strInvestigationMacro === '-- Choose a Macro --' || strInvestigationMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Investigation macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINVESTIGATION = true;
    BIBLIOSOPH.CARDTYPE = "Investigation";
    // Build the card
    publishChatCard();
}

// Trigger critical hit macro (for toolbar integration)
function triggerCriticalMacro() {
    // Run the same code that fires when the critical macro is clicked
    const strCriticalMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'criticalMacro', '') || '';
    
    if (!strCriticalMacro || strCriticalMacro === '-- Choose a Macro --' || strCriticalMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Critical hit macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPECRIT = true;
    BIBLIOSOPH.CARDTYPE = "Critical";
    // Build the card
    publishChatCard();
}

// Trigger fumble macro (for toolbar integration)
function triggerFumbleMacro() {
    // Run the same code that fires when the fumble macro is clicked
    const strFumbleMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'fumbleMacro', '') || '';
    
    if (!strFumbleMacro || strFumbleMacro === '-- Choose a Macro --' || strFumbleMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Fumble macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEFUMBLE = true;
    BIBLIOSOPH.CARDTYPE = "Fumble";
    // Build the card
    publishChatCard();
}

// Trigger injuries macro (for toolbar integration)
function triggerInjuriesMacro() {
    // Run the same code that fires when the injuries macro is clicked
    const strInjuriesMacroGlobal = BlacksmithUtils.getSettingSafely(MODULE.ID, 'injuriesMacroGlobal', '') || '';
    
    if (!strInjuriesMacroGlobal || strInjuriesMacroGlobal === '-- Choose a Macro --' || strInjuriesMacroGlobal === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Injuries macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINJURY = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger beverage macro (for toolbar integration)
function triggerBeverageMacro() {
    const strBeverageMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'beverageMacro', '') || '';
    
    if (!strBeverageMacro || strBeverageMacro === '-- Choose a Macro --' || strBeverageMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Beverage macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEBEVERAGE = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger bio macro (for toolbar integration)
function triggerBioMacro() {
    const strBioMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'bioMacro', '') || '';
    
    if (!strBioMacro || strBioMacro === '-- Choose a Macro --' || strBioMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Bio macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEBIO = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger insults macro (for toolbar integration)
function triggerInsultsMacro() {
    const strInsultsMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'insultsMacro', '') || '';
    
    if (!strInsultsMacro || strInsultsMacro === '-- Choose a Macro --' || strInsultsMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Insults macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINSULTS = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger praise macro (for toolbar integration)
function triggerPraiseMacro() {
    const strPraiseMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'praiseMacro', '') || '';
    
    if (!strPraiseMacro || strPraiseMacro === '-- Choose a Macro --' || strPraiseMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Praise macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEPRAISE = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger gift macro (for toolbar integration)
function triggerGiftMacro() {
    const strGiftMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'giftMacro', '') || '';
    
    if (!strGiftMacro || strGiftMacro === '-- Choose a Macro --' || strGiftMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Gift macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEGIFT = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger shadygoods macro (for toolbar integration)
function triggerShadygoodsMacro() {
    const strShadygoodsMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'shadygoodsMacro', '') || '';
    
    if (!strShadygoodsMacro || strShadygoodsMacro === '-- Choose a Macro --' || strShadygoodsMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Shadygoods macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPESHADYGOODS = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger inspiration macro (for toolbar integration)
function triggerInspirationMacro() {
    const strInspirationMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'inspirationMacro', '') || '';
    
    if (!strInspirationMacro || strInspirationMacro === '-- Choose a Macro --' || strInspirationMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Inspiration macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEINSPIRATION = true;
    BIBLIOSOPH.CARDTYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger general encounter macro (for toolbar integration)
function triggerGeneralEncounterMacro() {
    const strGeneralMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroGeneral', '') || '';
    
    if (!strGeneralMacro || strGeneralMacro === '-- Choose a Macro --' || strGeneralMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "General encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "General";
    BIBLIOSOPH.ENCOUNTER_TYPE = "General";
    // Build the card
    publishChatCard();
}

// Trigger cave encounter macro (for toolbar integration)
function triggerCaveEncounterMacro() {
    const strCaveMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroCave', '') || '';
    
    if (!strCaveMacro || strCaveMacro === '-- Choose a Macro --' || strCaveMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Cave encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Cave";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Cave";
    // Build the card
    publishChatCard();
}

// Trigger desert encounter macro (for toolbar integration)
function triggerDesertEncounterMacro() {
    const strDesertMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroDesert', '') || '';
    
    if (!strDesertMacro || strDesertMacro === '-- Choose a Macro --' || strDesertMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Desert encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Desert";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Desert";
    // Build the card
    publishChatCard();
}

// Trigger dungeon encounter macro (for toolbar integration)
function triggerDungeonEncounterMacro() {
    const strDungeonMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroDungeon', '') || '';
    
    if (!strDungeonMacro || strDungeonMacro === '-- Choose a Macro --' || strDungeonMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Dungeon encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Dungeon";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Dungeon";
    // Build the card
    publishChatCard();
}

// Trigger forest encounter macro (for toolbar integration)
function triggerForestEncounterMacro() {
    const strForestMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroForest', '') || '';
    
    if (!strForestMacro || strForestMacro === '-- Choose a Macro --' || strForestMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Forest encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Forest";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Forest";
    // Build the card
    publishChatCard();
}

// Trigger mountain encounter macro (for toolbar integration)
function triggerMountainEncounterMacro() {
    const strMountainMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroMountain', '') || '';
    
    if (!strMountainMacro || strMountainMacro === '-- Choose a Macro --' || strMountainMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Mountain encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Mountain";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Mountain";
    // Build the card
    publishChatCard();
}

// Trigger sky encounter macro (for toolbar integration)
function triggerSkyEncounterMacro() {
    const strSkyMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroSky', '') || '';
    
    if (!strSkyMacro || strSkyMacro === '-- Choose a Macro --' || strSkyMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Sky encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Sky";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Sky";
    // Build the card
    publishChatCard();
}

// Trigger snow encounter macro (for toolbar integration)
function triggerSnowEncounterMacro() {
    const strSnowMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroSnow', '') || '';
    
    if (!strSnowMacro || strSnowMacro === '-- Choose a Macro --' || strSnowMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Snow encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Snow";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Snow";
    // Build the card
    publishChatCard();
}

// Trigger urban encounter macro (for toolbar integration)
function triggerUrbanEncounterMacro() {
    const strUrbanMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroUrban', '') || '';
    
    if (!strUrbanMacro || strUrbanMacro === '-- Choose a Macro --' || strUrbanMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Urban encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Urban";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Urban";
    // Build the card
    publishChatCard();
}

// Trigger water encounter macro (for toolbar integration)
function triggerWaterEncounterMacro() {
    const strWaterMacro = BlacksmithUtils.getSettingSafely(MODULE.ID, 'encounterMacroWater', '') || '';
    
    if (!strWaterMacro || strWaterMacro === '-- Choose a Macro --' || strWaterMacro === 'none') {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Water encounter macro not configured", "", false, false);
        return;
    }

    // Build the chat message (same as macro click handler)
    resetBibliosophVars();
    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
    BIBLIOSOPH.CARDTYPE = "Water";
    BIBLIOSOPH.ENCOUNTER_TYPE = "Water";
    // Build the card
    publishChatCard();
}

// Make functions globally available for toolbar manager
window.openPartyMessageDialog = openPartyMessageDialog;
window.openPrivateMessageDialog = openPrivateMessageDialog;
window.triggerInvestigationMacro = triggerInvestigationMacro;
window.triggerCriticalMacro = triggerCriticalMacro;
window.triggerFumbleMacro = triggerFumbleMacro;
window.triggerInjuriesMacro = triggerInjuriesMacro;
window.triggerBeverageMacro = triggerBeverageMacro;
window.triggerBioMacro = triggerBioMacro;
window.triggerInsultsMacro = triggerInsultsMacro;
window.triggerPraiseMacro = triggerPraiseMacro;
window.triggerGiftMacro = triggerGiftMacro;
window.triggerShadygoodsMacro = triggerShadygoodsMacro;
window.triggerInspirationMacro = triggerInspirationMacro;
window.triggerGeneralEncounterMacro = triggerGeneralEncounterMacro;
window.triggerCaveEncounterMacro = triggerCaveEncounterMacro;
window.triggerDesertEncounterMacro = triggerDesertEncounterMacro;
window.triggerDungeonEncounterMacro = triggerDungeonEncounterMacro;
window.triggerForestEncounterMacro = triggerForestEncounterMacro;
window.triggerMountainEncounterMacro = triggerMountainEncounterMacro;
window.triggerSkyEncounterMacro = triggerSkyEncounterMacro;
window.triggerSnowEncounterMacro = triggerSnowEncounterMacro;
window.triggerUrbanEncounterMacro = triggerUrbanEncounterMacro;
window.triggerWaterEncounterMacro = triggerWaterEncounterMacro;



// Function to validate all mandatory settings and provide consolidated feedback
function validateMandatorySettings() {
    const missingSettings = [];
    const invalidMacros = [];
    
    // Check all mandatory macro settings
    const macroChecks = [
        { name: 'General Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroGeneral'), required: true },
        { name: 'Cave Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroCave'), required: true },
        { name: 'Desert Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroDesert'), required: true },
        { name: 'Dungeon Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroDungeon'), required: true },
        { name: 'Forest Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroForest'), required: true },
        { name: 'Mountain Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroMountain'), required: true },
        { name: 'Sky Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroSky'), required: true },
        { name: 'Snow Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroSnow'), required: true },
        { name: 'Urban Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroUrban'), required: true },
        { name: 'Water Encounters', setting: game.settings.get(MODULE.ID, 'encounterMacroWater'), required: true },
        { name: 'Investigations', setting: game.settings.get(MODULE.ID, 'investigationMacro'), required: true },
        { name: 'Gifts', setting: game.settings.get(MODULE.ID, 'giftMacro'), required: true },
        { name: 'Shady Goods', setting: game.settings.get(MODULE.ID, 'shadygoodsMacro'), required: true },
        { name: 'Critical Hits', setting: game.settings.get(MODULE.ID, 'criticalMacro'), required: true },
        { name: 'Fumbles', setting: game.settings.get(MODULE.ID, 'fumbleMacro'), required: true },
        { name: 'Inspiration', setting: game.settings.get(MODULE.ID, 'inspirationMacro'), required: true },
        { name: 'Deck of Many Things', setting: game.settings.get(MODULE.ID, 'domtMacro'), required: true },
        { name: 'Beverage Break', setting: game.settings.get(MODULE.ID, 'beverageMacro'), required: true },
        { name: 'Bio Break', setting: game.settings.get(MODULE.ID, 'bioMacro'), required: true },
        { name: 'Insults', setting: game.settings.get(MODULE.ID, 'insultsMacro'), required: true },
        { name: 'Praise', setting: game.settings.get(MODULE.ID, 'praiseMacro'), required: true },
        { name: 'Party Message', setting: game.settings.get(MODULE.ID, 'partyMessageMacro'), required: false },
        { name: 'Private Message', setting: game.settings.get(MODULE.ID, 'privateMessageMacro'), required: false },
        { name: 'General Injuries', setting: game.settings.get(MODULE.ID, 'injuriesMacroGlobal'), required: true }
    ];
    
    macroChecks.forEach(check => {
        if (check.required && (!check.setting || check.setting === '-- Choose a Macro --' || check.setting === 'none')) {
            missingSettings.push(check.name);
        } else if (check.setting && check.setting !== '-- Choose a Macro --' && check.setting !== 'none') {
            // Check if the macro actually exists
            const macro = getMacroByIdOrName(check.setting);
            if (!macro) {
                invalidMacros.push(`${check.name}: "${check.setting}"`);
            }
        }
    });
    
    // If there are issues, show consolidated notification and console details
    if (missingSettings.length > 0 || invalidMacros.length > 0) {
        // Single user notification
        BlacksmithUtils.postConsoleAndNotification(
            MODULE.NAME, 
            "Bibliosoph setup is not complete: Please set the required information in settings.", 
            "See console for more details.", 
            false, 
            true
        );
        
        // Detailed console logging
        if (missingSettings.length > 0) {
            console.warn(`BIBLIOSOPH | Missing mandatory macro settings:`, missingSettings);
        }
        if (invalidMacros.length > 0) {
            console.warn(`BIBLIOSOPH | Invalid macro names in settings:`, invalidMacros);
        }
        
        return false; // Setup incomplete
    }
    
    return true; // Setup complete
}

// *** END: BLACKSMITH API INTEGRATION ***


// -- Import special page variables --
// Register settings so they can be loaded below.
import { registerSettings } from './settings.js';
// Grab windows
import { BiblioWindowChat } from './window.js';

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
    // Module initialization - Blacksmith registration is now handled by the proper API import
    console.log(MODULE.ID + ' | Module initialized');
});

// ***** READY *****
// Hook that fires after everything is loaded and ready
// Note: Toolbar registration is now handled in the Blacksmith API registration block above

// ***** MODULE DISABLE *****
// Clean up toolbar tools when module is disabled
Hooks.once('disableModule', (moduleId) => {
    if (moduleId === 'coffee-pub-bibliosoph') {
        unregisterToolbarTools();
    }
});

// ***** CHAT CLICKS *****
Hooks.on('renderChatLog', (app, html, data) => {
    // v13: Detect and convert jQuery to native DOM if needed
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    
    const icons = nativeHtml.querySelectorAll('#optionChatType > i');
    icons.forEach(icon => {
        icon.addEventListener('click', (event) => {
            let chosenValue = event.currentTarget.getAttribute("value");
            // Handle icon click if needed
        });
    });
});

// ************************************
// ** READY
// ************************************

// Hook that fires after module loads

Hooks.on("ready", async () => {

    logMacroFix("ready hook start");

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
        
        // Validate all mandatory settings and provide consolidated feedback
        // Add a small delay to ensure UI is stable before showing notifications
        setTimeout(() => {
            validateMandatorySettings();
        }, 1000);
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

    // --- Macro binding helpers -------------------------------------------------
    const macroBindings = [];

    const bindSimpleMacro = ({ label, enabledKey, macroKey, onExecute }) => {
        const enabled = getSetting(enabledKey, false);
        const macroName = getSetting(macroKey, '');

        logMacroFix(`bind attempt: ${label} enabled=${enabled}, macro="${macroName}"`);

        if (!enabled) return;
        if (!macroName || macroName === '-- Choose a Macro --' || macroName === 'none') {
            logMacroFix(`binding skipped: ${label} macro setting empty`);
            return;
        }

        const macro = getMacroByIdOrName(macroName);
        if (!macro) {
            logMacroFix(`binding failed: no macro found for "${macroName}"`);
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${label} Macro "${macroName}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            return;
        }

        macro.execute = async () => {
            logMacroFix(`execute: ${label} macro handler reached`);
            await onExecute();
        };

        logMacroFix(`bound ${label} macro (${macroName})`);
    };

    const bindAllMacros = () => {
        // Encounter macros
        const encounterTypes = [
            { label: "Encounter General", enabledKey: 'encounterEnabledGeneral', macroKey: 'encounterMacroGeneral', type: "General" },
            { label: "Encounter Cave", enabledKey: 'encounterEnabledCave', macroKey: 'encounterMacroCave', type: "Cave" },
            { label: "Encounter Desert", enabledKey: 'encounterEnabledDesert', macroKey: 'encounterMacroDesert', type: "Desert" },
            { label: "Encounter Dungeon", enabledKey: 'encounterEnabledDungeon', macroKey: 'encounterMacroDungeon', type: "Dungeon" },
            { label: "Encounter Forest", enabledKey: 'encounterEnabledForest', macroKey: 'encounterMacroForest', type: "Forest" },
            { label: "Encounter Mountain", enabledKey: 'encounterEnabledMountain', macroKey: 'encounterMacroMountain', type: "Mountain" },
            { label: "Encounter Sky", enabledKey: 'encounterEnabledSky', macroKey: 'encounterMacroSky', type: "Sky" },
            { label: "Encounter Snow", enabledKey: 'encounterEnabledSnow', macroKey: 'encounterMacroSnow', type: "Snow" },
            { label: "Encounter Urban", enabledKey: 'encounterEnabledUrban', macroKey: 'encounterMacroUrban', type: "Urban" },
            { label: "Encounter Water", enabledKey: 'encounterEnabledWater', macroKey: 'encounterMacroWater', type: "Water" }
        ];

        encounterTypes.forEach(cfg => {
            bindSimpleMacro({
                label: cfg.label,
                enabledKey: cfg.enabledKey,
                macroKey: cfg.macroKey,
                onExecute: async () => {
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = cfg.type;
                    BIBLIOSOPH.ENCOUNTER_TYPE = cfg.type;
                    publishChatCard();
                }
            });
        });

        // Item / message macros
        bindSimpleMacro({
            label: "Investigation",
            enabledKey: 'investigationEnabled',
            macroKey: 'investigationMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEINVESTIGATION = true;
                BIBLIOSOPH.CARDTYPE = "Investigation";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Gift",
            enabledKey: 'giftEnabled',
            macroKey: 'giftMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEGIFT = true;
                BIBLIOSOPH.CARDTYPE = "Gift";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Shady Goods",
            enabledKey: 'shadygoodsEnabled',
            macroKey: 'shadygoodsMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPESHADYGOODS = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Critical Hit",
            enabledKey: 'criticalEnabled',
            macroKey: 'criticalMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPECRIT = true;
                BIBLIOSOPH.CARDTYPE = "Critical";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Fumble",
            enabledKey: 'fumbleEnabled',
            macroKey: 'fumbleMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEFUMBLE = true;
                BIBLIOSOPH.CARDTYPE = "Fumble";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Inspiration",
            enabledKey: 'inspirationEnabled',
            macroKey: 'inspirationMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEINSPIRATION = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Deck of Many Things",
            enabledKey: 'domtEnabled',
            macroKey: 'domtMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEDOMT = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Beverage",
            enabledKey: 'beverageEnabled',
            macroKey: 'beverageMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEBEVERAGE = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Bio",
            enabledKey: 'bioEnabled',
            macroKey: 'bioMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEBIO = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Insults",
            enabledKey: 'insultsEnabled',
            macroKey: 'insultsMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEINSULTS = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Praise",
            enabledKey: 'praiseEnabled',
            macroKey: 'praiseMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEPRAISE = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });

        bindSimpleMacro({
            label: "Party Message",
            enabledKey: 'partyMessageEnabled',
            macroKey: 'partyMessageMacro',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEMESSAGE = true;
                BIBLIOSOPH.CARDTYPE = "Message";
                BIBLIOSOPH.MESSAGES_FORMTITLE = "Party Message";
                const form = new BiblioWindowChat();
                form.onFormSubmit = publishChatCard;
                form.isPublic = true;
                form.render(true);
            }
        });

        bindSimpleMacro({
            label: "Private Message",
            enabledKey: 'privateMessageEnabled',
            macroKey: 'privateMessageMacro',
            onExecute: async () => {
                const macroName = getSetting('privateMessageMacro', '');
                const macroId = getMacroIdByName(macroName);
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEWHISPER = true;
                BIBLIOSOPH.CARDTYPE = "Message";
                BIBLIOSOPH.MESSAGES_FORMTITLE = macroName;
                BIBLIOSOPH.MACRO_ID = macroId;
                const form = new BiblioWindowChat();
                form.onFormSubmit = publishChatCard;
                form.isPublic = false;
                const recipientArray = "";
                form.optionList = buildPlayerList(recipientArray);
                form.render(true);
            }
        });

        bindSimpleMacro({
            label: "General Injuries",
            enabledKey: 'injuriesEnabledGlobal',
            macroKey: 'injuriesMacroGlobal',
            onExecute: async () => {
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEINJURY = true;
                BIBLIOSOPH.CARDTYPE = "General";
                publishChatCard();
            }
        });
    };

    // initial + delayed binds to catch late settings load
    bindAllMacros();
    setTimeout(bindAllMacros, 500);
    setTimeout(bindAllMacros, 2000);

    // Rebind when our settings change
    Hooks.on("updateSetting", (setting) => {
        if (setting?.namespace !== MODULE.ID) return;
        bindAllMacros();
    });

    // Resolve a macro value (name or id) to a Macro document
    // SET VARIABLES using Blacksmith's safe settings access
    var strGeneralMacro = getSetting('encounterMacroGeneral', '');
    var strCaveMacro = getSetting('encounterMacroCave', '');
    var strDesertMacro = getSetting('encounterMacroDesert', '');
    var strDungeonMacro = getSetting('encounterMacroDungeon', '');
    var strForestMacro = getSetting('encounterMacroForest', '');
    var strMountainMacro = getSetting('encounterMacroMountain', '');
    var strSkyMacro = getSetting('encounterMacroSky', '');
    var strSnowMacro = getSetting('encounterMacroSnow', '');
    var strUrbanMacro = getSetting('encounterMacroUrban', '');
    var strWaterMacro = getSetting('encounterMacroWater', '');
    var strInvestigationMacro = getSetting('investigationMacro', '');
    var strGiftMacro = getSetting('giftMacro', '');
    var strShadygoodsMacro = getSetting('shadygoodsMacro', '');
    var strCriticalMacro = getSetting('criticalMacro', '');
    var strFumbleMacro = getSetting('fumbleMacro', '');
    var strInspirationMacro = getSetting('inspirationMacro', '');
    var strDOMTMacro = getSetting('domtMacro', '');
    var strBeverageMacro = getSetting('beverageMacro', '');
    var strBioMacro = getSetting('bioMacro', '');
    var strInsultMacro = getSetting('insultsMacro', '');
    var strPraiseMacro = getSetting('praiseMacro', '');
    var strPartyMacro = getSetting('partyMessageMacro', '');
    var strPartyMacroID = getMacroIdByName(strPartyMacro);
    var strPrivateMacro = getSetting('privateMessageMacro', '');
    var strPrivateMacroID = getMacroIdByName(strPrivateMacro);

    var strInjuriesMacroGlobal = getSetting('injuriesMacroGlobal', '');
    var strInjuriesMacroGlobalID = getMacroIdByName(strInjuriesMacroGlobal);

    var blnGeneralEnabled = getSetting('encounterEnabledGeneral', false);
    var blnCaveEnabled = getSetting('encounterEnabledCave', false);
    var blnDesertEnabled = getSetting('encounterEnabledDesert', false);
    var blnDungeonEnabled = getSetting('encounterEnabledDungeon', false);
    var blnForestEnabled = getSetting('encounterEnabledForest', false);
    var blnMountainEnabled = getSetting('encounterEnabledMountain', false);
    var blnSkyEnabled = getSetting('encounterEnabledSky', false);
    var blnSnowEnabled = getSetting('encounterEnabledSnow', false);
    var blnUrbanEnabled = getSetting('encounterEnabledUrban', false);
    var blnWaterEnabled = getSetting('encounterEnabledWater', false);
    var blnPartyMessageEnabled = getSetting('partyMessageEnabled', false);
    var blnPrivateMessageEnabled = getSetting('privateMessageEnabled', false);
    var blnBeverageEnabled = getSetting('beverageEnabled', false);
    var blnBioEnabled = getSetting('bioEnabled', false);
    var blnInsultsEnabled = getSetting('insultsEnabled', false);
    var blnPraiseEnabled = getSetting('praiseEnabled', false);
    var blnGiftEnabled = getSetting('giftEnabled', false);
    var blnShadygoodsEnabled = getSetting('shadygoodsEnabled', false);
    var blnCriticalEnabled = getSetting('criticalEnabled', false);
    var blnFumbleEnabled = getSetting('fumbleEnabled', false);
    var blnInspirationEnabled = getSetting('inspirationEnabled', false);
    var blndomtEnabled = getSetting('domtEnabled', false);
    var blninjuriesEnabledGlobal = getSetting('injuriesEnabledGlobal', false);
    // NOTE: investigation settings are re-fetched inside bindInvestigation() for fresh values

    // BUTTON PRESSES IN CHAT
    document.addEventListener('click', function(event) {
        if(event.target.classList.contains('coffee-pub-bibliosoph-button-reply')) {
            //postConsoleAndNotification("Button Pressed", "Be sure to verify the recipients.", false, true, false);
            var recipients = event.target.getAttribute('data-recipient');
            var recipientArray = recipients.split(',').map(r => r.trim()).filter(r => r !== '');
            // Use the recipientArray
            //postConsoleAndNotification("Inside document.addEventListener. The recipient array: ", recipientArray, false, true, false);
            // Let's see if the sam stuff from the macro work.
            //postConsoleAndNotification("Inside document.addEventListener. The strPrivateMacro: ", strPrivateMacro, false, true, false);
            // Build the chat message
            resetBibliosophVars();
            BIBLIOSOPH.CARDTYPEWHISPER = true;
            BIBLIOSOPH.CARDTYPE = "Message";
            BIBLIOSOPH.MESSAGES_FORMTITLE  = strPrivateMacro;
            BIBLIOSOPH.MACRO_ID = strPrivateMacroID;
            // Open the form and get the data
            var blankForm = new BiblioWindowChat()
            // submits calls the card function after form is submitted
            blankForm.onFormSubmit = publishChatCard
            // sET THE FORM VARIABLES
            blankForm.isPublic = false;
            blankForm.optionList = buildPlayerList(recipientArray);
            // Ensure selectedDivs is an array for pre-selection
            blankForm.selectedDivs = Array.isArray(recipientArray) ? recipientArray : [];
            //blankForm.formTitle = 'Private Message';
            blankForm.render(true);
        }

        // CHECK FOR INJURY BUTTON
        if(event.target.classList.contains('coffee-pub-bibliosoph-button-injury')) {

            //postConsoleAndNotification("INJURY BUTTON PRESSED", "", false, false, false);

            var strEffectData = event.target.getAttribute('data-effect');
            var arrEffectData = BlacksmithUtils.stringToObject(strEffectData) || JSON.parse(strEffectData);

            //postConsoleAndNotification("arrEffectData: ", arrEffectData, false, true, false);
        
            // map the data to the token
            var strLabel = arrEffectData.name;
            var strIcon = arrEffectData.icon;
            var intDamage = arrEffectData.damage;
            var intDuration = arrEffectData.duration;
            var strStatusEffect = arrEffectData.statuseffect;

            // Apply the active effect
            applyActiveEffect(strLabel, strIcon, intDamage, intDuration, strStatusEffect)

        }

    });

    // ************* ENCOUNTER CHECKS *************
     // *** GENERAL ***
     if (blnGeneralEnabled) {
        if(strGeneralMacro) {
            let GeneralMacro = getMacroByIdOrName(strGeneralMacro);
            if(GeneralMacro) {
                GeneralMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "General";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `General Encounter: Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
                // They haven't set this macro - consolidated validation handles this
                // BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for General Encounters not set.`, "", false, false);
        }
     }
    // *** CAVE ***
    if (blnCaveEnabled) {
        if(strCaveMacro) {
            let CaveMacro = getMacroByIdOrName(strCaveMacro);
            if(CaveMacro) {
                CaveMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Cave";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strCaveMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Cave Encounters not set.`, "", false, false);
        }
    }
    // *** DESERT ***
    if (blnDesertEnabled) {
        if(strDesertMacro) {
            let DesertMacro = getMacroByIdOrName(strDesertMacro);
            if(DesertMacro) {
                DesertMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Desert";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strDesertMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Desert Encounters not set.`, "", false, false);
        }
    }   
    // *** DUNGEON ***
    if (blnDungeonEnabled) {
        if(strDungeonMacro) {
            let DungeonMacro = getMacroByIdOrName(strDungeonMacro);
            if(DungeonMacro) {
                DungeonMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Dungeon";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strDungeonMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Dungeon Encounters not set.`, "", false, false);
        }
    }   
    // *** FOREST ***
    if (blnForestEnabled) {
        if(strForestMacro) {
            let ForestMacro = getMacroByIdOrName(strForestMacro);
            if(ForestMacro) {
                ForestMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Forest";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strForestMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Forest Encounters not set.`, "", false, false);
        }
    }
    // *** MOUNTAIN ***
    if (blnMountainEnabled) {
        if(strMountainMacro) {
            let MountainMacro = getMacroByIdOrName(strMountainMacro);
            if(MountainMacro) {
                MountainMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Mountain";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strMountainMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Mountain Encounters not set.`, "", false, true);
        }
    }
    // *** SKY ***
    if (blnSkyEnabled) {
        if(strSkyMacro) {
            let SkyMacro = getMacroByIdOrName(strSkyMacro);
            if(SkyMacro) {
                SkyMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Sky";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strSkyMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Sky Encounters not set.`, "", false, true);
        }
    }
    // *** SNOW ***
    if (blnSnowEnabled) {
        if(strSnowMacro) {
            let SnowMacro = getMacroByIdOrName(strSnowMacro);
            if(SnowMacro) {
                SnowMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Snow";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strSnowMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Snow Encounters not set.`, "", false, false);
        }
    }
    // *** URBAN ***
    if (blnUrbanEnabled) {
        if(strUrbanMacro) {
            let UrbanMacro = getMacroByIdOrName(strUrbanMacro);
            if(UrbanMacro) {
                UrbanMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Urban";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strUrbanMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Urban Encounters not set.`, "", false, false);
        }
    }
    // *** WATER ***
    if (blnWaterEnabled) {
        if(strWaterMacro) {
            let WaterMacro = getMacroByIdOrName(strWaterMacro);
            if(WaterMacro) {
                WaterMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEENCOUNTER = true;
                    BIBLIOSOPH.CARDTYPE = "Water";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strWaterMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Water Encounters not set.`, "", false, false);
        }
    }
    //************* ITEM ROLLS *************
    // *** INVESTIGATION ***
    // Bind Investigation macro (fetch settings fresh each time)
    const bindInvestigation = () => {
        const enabled = getSetting('investigationEnabled', false);
        const macroKey = getSetting('investigationMacro', '');
        logMacroFix(`bind attempt: investigationEnabled=${enabled}, macro="${macroKey}"`);

        if (!enabled) return;
        if (!macroKey || macroKey === '-- Choose a Macro --' || macroKey === 'none') {
            logMacroFix("binding skipped: investigation macro setting empty");
            return;
        }

        const InvestigationMacro = getMacroByIdOrName(macroKey);
        if (InvestigationMacro) {
            logMacroFix(`bound Investigation macro (${macroKey})`);
            InvestigationMacro.execute = async () => {
                logMacroFix('execute: Investigation macro handler reached');
                resetBibliosophVars();
                BIBLIOSOPH.CARDTYPEINVESTIGATION = true;
                BIBLIOSOPH.CARDTYPE = "Investigation";
                publishChatCard();
            };
        } else {
            logMacroFix(`binding failed: no macro found for "${macroKey}"`);
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Investigation Macro "${macroKey}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
        }
    };

    // Initial and delayed bind attempts to catch late-loaded settings/choices
    bindInvestigation();
    setTimeout(bindInvestigation, 500);
    setTimeout(bindInvestigation, 2000);

    // Rebind when settings change
    Hooks.on("updateSetting", (setting) => {
        if (setting?.key === 'investigationEnabled' || setting?.key === 'investigationMacro') {
            if (setting?.namespace === MODULE.ID) {
                bindInvestigation();
            }
        }
    });
    // *** GIFTS ***
    if (blnGiftEnabled) {
        if (strGiftMacro) {
            let GiftMacro = getMacroByIdOrName(strGiftMacro);
            if(GiftMacro) {
                GiftMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Gift", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEGIFT = true;
                    BIBLIOSOPH.CARDTYPE = "Gift";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Gifts Macro "${strGiftMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Gifts not set.`, "", false, false);
        }
    }
    // *** SHADY GOODS ***
    if (blnShadygoodsEnabled) {
        if (strShadygoodsMacro) {
            let ShadygoodsMacro = getMacroByIdOrName(strShadygoodsMacro);
            if(ShadygoodsMacro) {
                ShadygoodsMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Shady Goods", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPESHADYGOODS = true;
                    BIBLIOSOPH.CARDTYPE = "Shady Goods";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Shady Goods Macro "${strShadygoodsMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Shady Goods not set.`, "", false, false);
        }
    }
    // ************* CRITS AND FUMBLES *************
    // *** CRITICAL ***
    if (blnCriticalEnabled) {
        if (strCriticalMacro) {
            let CriticalMacro = getMacroByIdOrName(strCriticalMacro);
            if(CriticalMacro) {
                CriticalMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Critical", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPECRIT = true;
                    BIBLIOSOPH.CARDTYPE = "Critical";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Critical Hits Macro "${strCriticalMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Critical Hits not set.`, "", false, false);
        }
    }
    // *** FUMBLE ***
    if (blnFumbleEnabled) {
        if(strFumbleMacro) {
            let FumbleMacro = getMacroByIdOrName(strFumbleMacro);
            if(FumbleMacro) {
                FumbleMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Fumble", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEFUMBLE = true;
                    BIBLIOSOPH.CARDTYPE = "Fumble";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Fumble Macro "${strFumbleMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Fumbles not set.`, "", false, false);
        }
    }
    // ************* CARD ROLLS *************
    // *** INSPIRATION ***
    if (blnInspirationEnabled) {
        if(strInspirationMacro) {
            let InspirationMacro = getMacroByIdOrName(strInspirationMacro);
            if(InspirationMacro) {
                InspirationMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Inspiration", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEINSPIRATION = true;
                    BIBLIOSOPH.CARDTYPE = "Inspiration";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Inspiration Macro "${strInspirationMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Inspiration not set.`, "", false, false);
        }
    }
    // *** DOMT ***
    if (blndomtEnabled) {
        if(strDOMTMacro) {
            let DOMTMacro = getMacroByIdOrName(strDOMTMacro);
            if(DOMTMacro) {
                DOMTMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Deck of Many Things", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEDOMT = true;
                    BIBLIOSOPH.CARDTYPE = "DOMT";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Deck of Many Things Macro "${strDOMTMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Deck of Many Things not set.`, "", false, false);
        }
    }
    // ************* PARTY MESSAGES *************
    // *** BEVERAGE ***
    if (blnBeverageEnabled) {
        if(strBeverageMacro) {
            let BeverageMacro = getMacroByIdOrName(strBeverageMacro);
            if(BeverageMacro) {
                BeverageMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Beverage", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEBEVERAGE = true;
                    BIBLIOSOPH.CARDTYPE = "Beverage";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Beverage Break Macro "${strBeverageMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Beverage Break not set.`, "", false, false);
        }
    }
    // *** BIO ***
    if (blnBioEnabled) {
        if(strBioMacro) {
            let BioMacro = getMacroByIdOrName(strBioMacro);
            if(BioMacro) {
                BioMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Bio", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEBIO = true;
                    BIBLIOSOPH.CARDTYPE = "Bio";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Bio Break Macro "${strBioMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Bio Break not set.`, "", false, false);
        }
    }
    // *** MESSAGES ***
    // TODO ... Insult and Praise need to go away as main buttons OR be a quick wat to jump into insulting a selected player
    // *** INSULT ***
    if (blnInsultsEnabled) {
        if(strInsultMacro) {
            let InsultMacro = getMacroByIdOrName(strInsultMacro);
            if(InsultMacro) {
                InsultMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Insult", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEINSULT = true;
                    BIBLIOSOPH.CARDTYPE = "Insult";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Insult Macro "${strInsultMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Insults not set.`, "", false, false);
        } 
    }
    // *** PRAISE ***
    if (blnPraiseEnabled) {
        if(strPraiseMacro) {
            let PraiseMacro = getMacroByIdOrName(strPraiseMacro);
            if(PraiseMacro) {
                PraiseMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Praise", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEPRAISE = true;
                    BIBLIOSOPH.CARDTYPE = "Praise";
                    // Build the card
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Praise Macro "${strPraiseMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Praise not set.`, "", false, false);
        } 
    }
    // *** Public Message ***
    if (blnPartyMessageEnabled) {
        if(strPartyMacro) {
            let PartyMacro = getMacroByIdOrName(strPartyMacro);
            if(PartyMacro) {
                PartyMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Party Message", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEMESSAGE = true;
                    BIBLIOSOPH.CARDTYPE = "Message";
                    BIBLIOSOPH.MESSAGES_FORMTITLE  = strPartyMacro;
                    BIBLIOSOPH.MACRO_ID = strPartyMacroID;
                    // Open the form and get the data
                    var blankForm = new BiblioWindowChat()
                    // submits calls the card function after form is submitted
                    blankForm.onFormSubmit = publishChatCard
                    // you can add other properties to BiblioWindowChat to configure it from here
                    // in window.js, just declare them in the constructor like these
                    // then you can access them here as below, and inside window.js as "this.foo"
                    blankForm.isPublic = true
                    //blankForm.formTitle = 'Party Message'
                    blankForm.render(true);
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Party Message Macro "${strPartyMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Party Message not set.`, "", false, false);
        } 
    }
    // *** Private Message ***
    if (blnPrivateMessageEnabled) {
        if(strPrivateMacro) {
            let PartyMacro = getMacroByIdOrName(strPrivateMacro);
            if(PartyMacro) {
                PartyMacro.execute = async () => {
                    //postConsoleAndNotification("Macro Clicked: ", "Private Message", false, true, false);
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEWHISPER = true;
                    BIBLIOSOPH.CARDTYPE = "Message";
                    BIBLIOSOPH.MESSAGES_FORMTITLE  = strPrivateMacro;
                    BIBLIOSOPH.MACRO_ID = strPrivateMacroID;
                    // Open the form and get the data
                    var blankForm = new BiblioWindowChat()
                    // submits calls the card function after form is submitted
                    blankForm.onFormSubmit = publishChatCard
                    // sET THE FORM VARIABLES
                    blankForm.isPublic = false;
                    var recipientArray = ""; // not a reply
                    blankForm.optionList = buildPlayerList(recipientArray);
                    //blankForm.formTitle = 'Private Message';
                    blankForm.render(true);
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Private Message Macro "${strPrivateMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for Private Message not set.`, "", false, false);
        } 
    }

    // *** INJURIES: GENERAL ***
    if (blninjuriesEnabledGlobal) {

        //postConsoleAndNotification("blninjuriesEnabledGlobal: ", blninjuriesEnabledGlobal, false, true, false);

        if(strInjuriesMacroGlobal) {
            let InjuryMacro = getMacroByIdOrName(strInjuriesMacroGlobal);

            //postConsoleAndNotification("InjuryMacro: ", InjuryMacro, false, true, false);

            if(InjuryMacro) {
                InjuryMacro.execute = async () => {
                    // Build the chat message
                    resetBibliosophVars();
                    BIBLIOSOPH.CARDTYPEINJURY = true;
                    BIBLIOSOPH.CARDTYPE = "General";
                    // Build the card
                    // disable the actual call until ready
                    publishChatCard();
                };
            } else {
                // User needs to know about macro configuration issues
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `"${strWaterMacro}" is not a valid macro name. Make sure there is a macro matching the name you entered in Bibliosoph settings.`, "", false, false);
            }
        } else {
            // They haven't set this macro
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Macro for General Injuries not set.`, "", false, false);
        }
    }

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

Hooks.on("renderChatMessage", (message, html) => {
    // v13: Detect and convert jQuery to native DOM if needed
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    
    const buttons = nativeHtml.querySelectorAll(".category-button");
    buttons.forEach(button => {
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



Hooks.on('updateToken', (scene, token, updateData) => {
    if (updateData.actorData) {
      const newHP = getProperty(updateData, 'actorData.system.attributes.hp.value');
      if (newHP !== undefined) {
        const actor = canvas.tokens.get(token._id).actor;
        const oldHP = actor.system.attributes.hp.value;
        if (oldHP - newHP > 5) {
          // This is debug info - only log if really needed for troubleshooting
          // console.log(`Actor ${actor.name} was hit for more than 5 HP.`);
        }
      }
    }
});

Hooks.on('createChatMessage', (msg) => {
    // Removed excessive debug logging - this was flooding the console
    // Only log critical information when needed for troubleshooting
    
   //if (msg.flavor) {
    if (msg.rolls.total) {
        const totalRoll = msg.rolls.total;
        const targetAC = 15; // Replace with appropriate function to get target's AC
        // Critical Hit
        if (totalRoll === 20) {
            ChatMessage.create({
                content: `${msg.user.name} made a critical hit!`
            });
        } 
        // Fumble
        else if (totalRoll === 1) {
            ChatMessage.create({
                content: `${msg.user.name} fumbled their attack.`
            });
        } 
        // Normal Hit
        else if (totalRoll >= targetAC) {
            ChatMessage.create({
                content: `${msg.user.name} hit their target!`
            });
        } 
        // Miss
        else {
            ChatMessage.create({
                content: `${msg.user.name} missed their target.`
            });
        }
    }
});

// ************************************
// ** PUBLISH Chat Cards
// ************************************

async function publishChatCard() {
    // Build the card
    var compiledHtml = "";
    var strInjuryCategory = "";
    var strChatType = BIBLIOSOPH.CHAT_TYPE_OTHER;
    if (BIBLIOSOPH.CARDTYPEENCOUNTER) {
         // ENCOUNTER
        var strRollTableName = "";
        switch (BIBLIOSOPH.CARDTYPE) {
            case "General":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableGeneral');
                break;
            case "Cave":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableCave');
                break;
            case "Desert":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableDesert');
                break;
            case "Dungeon":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableDungeon');
                break;
            case "Forest":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableForest');
                break;
            case "Mountain":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableMountain');
                break;
            case "Sky":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableSky');
                break;
            case "Snow":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableSnow');
                break;
            case "Urban":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableUrban');
                break;
            case "Water":
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableWater');
                break;
            default:
                strRollTableName = game.settings.get(MODULE.ID, 'encounterTableGeneral');
        }


        compiledHtml = await createChatCardEncounter(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEINVESTIGATION) {
        // SEARCH
        strRollTableName = game.settings.get(MODULE.ID, 'investigationTable');
        compiledHtml = await createChatCardSearch(strRollTableName);
    }
    else if (BIBLIOSOPH.CARDTYPEGIFT) {
        // GIFTS
        strRollTableName = game.settings.get(MODULE.ID, 'giftTable');
        compiledHtml = await createChatCardSearch(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPESHADYGOODS) {
        // SHADY GOODS
        strRollTableName = game.settings.get(MODULE.ID, 'shadygoodsTable');
        compiledHtml = await createChatCardSearch(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPECRIT) {
        // CRITICAL
        //postConsoleAndNotification("Card Type: ", "Crit", false, true, false);
        strRollTableName = game.settings.get(MODULE.ID, 'criticalTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEFUMBLE) {
        // FUMBLE
        //postConsoleAndNotification("Card Type: ", "Fumble", false, true, false);
        strRollTableName = game.settings.get(MODULE.ID, 'fumbleTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEINSPIRATION) {
        // INSPIRATION
        strRollTableName = game.settings.get(MODULE.ID, 'inspirationTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEDOMT) {
        // DECK OF MANY THINGS
        strRollTableName = game.settings.get(MODULE.ID, 'domtTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEBEVERAGE) {
        // BEVERAGE
        strRollTableName = game.settings.get(MODULE.ID, 'beverageTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEBIO) {
        // BIO
        strRollTableName = game.settings.get(MODULE.ID, 'bioTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEINSULT) {
        // INSULT
        strRollTableName = game.settings.get(MODULE.ID, 'insultsTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEPRAISE) {
        // PRAISE
        strRollTableName = game.settings.get(MODULE.ID, 'praiseTable');
        compiledHtml = await createChatCardGeneral(strRollTableName);
    } else if (BIBLIOSOPH.CARDTYPEMESSAGE) {
        // MESSAGE
        compiledHtml = await createChatCardGeneral();
    } else if (BIBLIOSOPH.CARDTYPEWHISPER) {
        // WHISPER
        // Call the chat function
        strChatType = BIBLIOSOPH.CHAT_TYPE_WHISPER;
        compiledHtml = await createChatCardGeneral();
    } else if (BIBLIOSOPH.CARDTYPEINJURY) {

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
    //user, speaker, timestamp, flavor, whisper, blind, roll, sound, emote, flags, content
    //these are the types: OTHER (Uncategorized), OOC (Out of Char), IC (In Character), EMOTE (e.g. "waves hand"), WHISPER (Private), ROLL (Dice Roll)
    // ** If a WHisper send a whisper card... all other go as a normal card.
    //postConsoleAndNotification("strChatType", strChatType, false, true, true);
    if (strChatType == BIBLIOSOPH.CHAT_TYPE_WHISPER ) {
        // IT IS A WHISPER
        let users = BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE;
        // Check if `users` is an array.
        if (!Array.isArray(users)) {
            // This is an error that could break functionality - use console.warn
            console.warn("BIBLIOSOPH | Expected 'users' to be an array, but it is not:", users);
        }
        let userids = users
            .map(u => game.users.find(us => us && us.name === u))
            .filter(u => u !== undefined && u !== null) 
            .map(u => u._id);
        if (userids.length > 0) {
            ChatMessage.create({
                user: game.user._id,
                whisper: userids,
                content: compiledHtml,
                //type: strChatType,
                speaker: ChatMessage.getSpeaker()
            });
        } else {
            // Post Debug - This is debug info, only log if really needed for troubleshooting
            // BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "No User Selected: No users to send a whisper to.", "", true, true);
        }
    } else {
        // If there is content, send it.
        if (compiledHtml){
            // IT IS A NORMAL CHAT MESSAGE
            var chatData = {
                user: game.user._id,
                content: compiledHtml,
                speaker: ChatMessage.getSpeaker()
            };
            // Send the msaage to the chat window.
            ChatMessage.create(chatData, {});
        }
    }

    // Reset everything for the next time - This is a system message
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "The card has been delivered, so we are clearing our variables for next time.", "", false, false);
    resetBibliosophVars();
}

// ************************************
// ** CREATE General Chat Card
// ************************************

async function createChatCardGeneral(strRollTableName) {  
    // User Info
    var strUserName = "";
    var strUserAvatar = "";
    var strPlayerType = "";
    var strCharacterName = "";
    // Card defaults
    var strSound = "";
    var strVolume = "0.7";
    var strTheme = "";
    var strIconStyle = "";
    var strCardTitle = ""
    var strImageBackground = "themecolor";
    // Table info
    var strTableName = "";
    var strTableImage = "";
    // Card Details
    var strTitle = "";
    var strContent = "";
    var strImage = "";
    var strAction = "";
    var strActionLabel = "";
    // NEW or Reworked Variable as part of unification
    var arrTable = "";
    var arrPrivateRecipients = [];
    var privateRecipientsCompressed = false; 
    var strRecipients = "";
    // ** Set Gloobal Data used by all **
    strUserName = game.user.name;
    strUserAvatar = game.user.avatar;
    if (game.user.isGM){
        strPlayerType = "Gamemaster";
        strCharacterName = "Cocktail Craftsman and Moderator";
    } else {
        strPlayerType = "Player";
        if(game.user.character) {
            strCharacterName = game.user.character.name;
        } else {
            strCharacterName = "No Character Set";
        }
    }
     // Set the template Specific stuff
     switch(true) {
        case (BIBLIOSOPH.CARDTYPECRIT):
            // CRITICAL
            strTheme = game.settings.get(MODULE.ID, 'cardThemeCritical');
            strSound = "modules/coffee-pub-blacksmith/sounds/reaction-yay.mp3";
            strIconStyle = "fa-burst";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEFUMBLE):
            // FUMBLE
            strTheme = game.settings.get(MODULE.ID, 'cardThemeFumble');
            strSound = "modules/coffee-pub-blacksmith/sounds/sadtrombone.mp3";
            strIconStyle = "fa-heart-crack";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEINSPIRATION):
            // INSPIRATION
            strTheme = game.settings.get(MODULE.ID, 'cardThemeInspiration');
            strSound = "modules/coffee-pub-blacksmith/sounds/spell-magic-circle.mp3";
            strIconStyle = "fa-sparkles";
            strActionLabel = "Card";
            break;
        case (BIBLIOSOPH.CARDTYPEINSULT):
            // INSULT
            strTheme = game.settings.get(MODULE.ID, 'cardThemeInsults');
            // this is from a user
            strUserName = strUserName; //where used?
            strSound = "modules/coffee-pub-blacksmith/sounds/reaction-oooooh.mp3";
            strIconStyle = "fa-person-harassing";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEPRAISE):
            // PRAISE
            strTheme = game.settings.get(MODULE.ID, 'cardThemePraise');
            strSound = "modules/coffee-pub-blacksmith/sounds/reaction-ahhhhh.mp3";
            strIconStyle = "fa-flower-tulip";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEDOMT):
            // DECK OF MANY THINGS
            strTheme = game.settings.get(MODULE.ID, 'cardThemeDOMT');
            strSound = "modules/coffee-pub-blacksmith/sounds/fanfare-harp.mp3";
            strIconStyle = "fa-cards-blank";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEBEVERAGE):
            // BEVERAGE
            strTheme = game.settings.get(MODULE.ID, 'cardThemeBeverage');
            strSound = "modules/coffee-pub-blacksmith/sounds/general-cocktail-ice.mp3";
            strIconStyle = "fa-martini-glass-citrus";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEBIO):
            // BIO
            strTheme = game.settings.get(MODULE.ID, 'cardThemeBio');
            strSound = "modules/coffee-pub-blacksmith/sounds/general-toilet-flushing.mp3";
            strIconStyle = "fa-toilet";
            strActionLabel = "Action";
            break;
        case (BIBLIOSOPH.CARDTYPEMESSAGE):
            strTheme = game.settings.get(MODULE.ID, 'cardThemePartyMessage');
            switch (true) {
                case (BIBLIOSOPH.MESSAGES_TITLE == "messageVote"):
                    strCardTitle = "Party Plan";
                    strImage = "icons/skills/social/diplomacy-handshake.webp";
                    strSound = "modules/coffee-pub-blacksmith/sounds/notification.mp3";
                    strIconStyle = "fa-solid fa-square-poll-horizontal";
                    break;
                case (BIBLIOSOPH.MESSAGES_TITLE == "messageThumbsup"):
                    strCardTitle = "Agree";
                    strImage = "icons/skills/social/thumbsup-approval-like.webp";
                    strSound = "modules/coffee-pub-blacksmith/sounds/notification.mp3";
                    strIconStyle = "fa-solid fa-thumbs-up";
                    break;
                case (BIBLIOSOPH.MESSAGES_TITLE == "messageThumbsdown"):
                    strCardTitle = "Disagree";
                    strImage = "icons/skills/social/wave-halt-stop.webp";
                    strSound = "modules/coffee-pub-blacksmith/sounds/notification.mp3";
                    strIconStyle = "fa-solid fa-thumbs-down";
                    break;
                case (BIBLIOSOPH.MESSAGES_TITLE == "messagePraise"):
                    strTheme = game.settings.get(MODULE.ID, 'cardThemePraise');
                    strCardTitle = "Praise";
                    strImage = "icons/magic/life/heart-shadow-red.webp";
                    strSound = "modules/coffee-pub-blacksmith/sounds/reaction-ahhhhh.mp3";
                    strIconStyle = "fa-flower-tulip";
                    strActionLabel = "Action";
                    break;
                case (BIBLIOSOPH.MESSAGES_TITLE == "messageInsult"):
                    strTheme = game.settings.get(MODULE.ID, 'cardThemeInsults');
                    strCardTitle = "Defamation";
                    strImage = "icons/skills/wounds/injury-face-impact-orange.webp";
                    strSound = "modules/coffee-pub-blacksmith/sounds/reaction-oooooh.mp3";
                    strIconStyle = "fa-person-harassing";
                    strActionLabel = "Action";
                    strUserName = strUserName;
                    break;
                default:
                    strCardTitle = "Party Message";
                    strImage = "";
                    strSound = "modules/coffee-pub-blacksmith/sounds/notification.mp3";
                    strIconStyle = "fa-comments-alt";
            }
            strActionLabel = "Reply";
            break;
        case (BIBLIOSOPH.CARDTYPEWHISPER):
            strTheme = game.settings.get(MODULE.ID, 'cardThemePrivateMessage');
            strCardTitle = "Private Message";
            // set the image to the user avatar
            strImage = strUserAvatar;
            strSound = "modules/coffee-pub-blacksmith/sounds/fire-candle-blow.mp3";
            strIconStyle = "fa-feather";
            strActionLabel = "";
            //strAction = "@UUID[Macro." + BIBLIOSOPH.MACRO_ID + "]{" + strCardTitle + "}";
            strAction = ""; // not using the macro now
            const privateData = buildPrivateList(BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE);
            arrPrivateRecipients = privateData.recipients;
            privateRecipientsCompressed = privateData.compressed;
            strRecipients = BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE;
            //postConsoleAndNotification("Private TO List: ", BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE, false, true, false);
            break;
        default:
            // NOTHING
            // POST DEBUG
            //postConsoleAndNotification("Card Type: ","Not Defined", false, true, false);
            return;
    }  

    // ROLL THE Table and set the data
    // debug
    if (strRollTableName){
        //There is a roll table... get the data from it.
        let arrRollTableResults = await getRollTable(strRollTableName);
        if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
            BlacksmithUtils.rollCoffeePubDice(arrRollTableResults.roll);
        }
        // postConsoleAndNotification("BIBLIOSOPH: createChatCardGeneral arrRollTableResults", arrRollTableResults, false, true, false);
        strTableName = arrRollTableResults.strTableName;
        strTableImage = arrRollTableResults.strTableImage;
        strCardTitle = arrRollTableResults.strTableName;
        strTitle = arrRollTableResults.strTitle;
        strContent = arrRollTableResults.strContent;
        strAction = arrRollTableResults.strAction;
        strImage = arrRollTableResults.strImage;
    } else {
        // Not getting data from a table, set it accordingly
        // No Tabel content so assume message
        strContent = BlacksmithUtils.markdownToHtml(BIBLIOSOPH.MESSAGES_CONTENT);
    }
    const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_CARD;
    const response = await fetch(templatePath);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);
    // Pass the data to the template
    const CARDDATA = {
        userName: strUserName,
        userAvatar: strUserAvatar,
        playerType: strPlayerType,
        characterName: strCharacterName,
        theme: strTheme,
        iconStyle: strIconStyle,
        cardTitle: strCardTitle,
        imageBackground: strImageBackground,
        title: strTitle,
        content: strContent,
        action: strAction,
        actionlabel: strActionLabel,
        image: strImage,
        tablename: strTableName,
        arrPrivateRecipients,
        privateRecipientsCompressed,
        strRecipients, //used for the hidden input for replies
        hasSectionContent: !!(strAction || (arrPrivateRecipients && arrPrivateRecipients.length)),
    }; 
    // Play the Sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // POST DEBUG
    //postConsoleAndNotification("CARDDATA.content" , CARDDATA.content, false, true, true);
    // Return the template
    return template(CARDDATA);

}


// ************************************
// ** CREATE Injury Card
// ************************************

async function createChatCardInjury(category) {  

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

    // roll some fake dice "for show" -- this is not used for anything real
    let rollIsInjury = await new Roll("1d100").evaluate();
    // Show the fake Dice So Nice roll
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
        BlacksmithUtils.rollCoffeePubDice(rollIsInjury);
    }

    // Set the defaults
    var strJournalType = "";
    var strInjuryCategory = "";
    var strInjuryFolderName = "";
    var intOdds = "";
    var strInjuryTitle = "";
    var strInjuryImageTitle = "";
    var strInjuryImage = "";
    var strInjuryDescription = "";
    var strInjuryTreatment =  "";
    var strInjurySeverity =  "";
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
        strJournalType = objInjuryData.journaltype; // not used
        strInjuryCategory = objInjuryData.category;
        strInjuryFolderName = objInjuryData.foldername; //not used
        intOdds = objInjuryData.odds // not used
        strInjuryTitle = objInjuryData.title;
        strInjuryImageTitle = objInjuryData.imagetitle; // not used
        strInjuryImage = objInjuryData.image;
        strInjuryDescription = objInjuryData.description;
        strInjuryTreatment = objInjuryData.treatment;
        strInjurySeverity = objInjuryData.severity; // not used
        intInjuryDamage = objInjuryData.damage;
        intInjuryDuration = objInjuryData.duration;
        strInjuryAction = objInjuryData.action;
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
            // Data was returned
            strInjuryDamage = intInjuryDamage + " Hit Points";
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
        
        if (!strInjuryAction) {
            strInjuryAction = "Apply Injury to Token";
        } else {
            // Data was returned
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

    // Build Effect Array
    const EFFECTDATA = {
        name: strInjuryTitle,
        icon: strInjuryImage, 
        damage: intInjuryDamage,
        duration: intInjuryDuration,
        statuseffect: strStatusEffect,
    }; 

    //postConsoleAndNotification("EFFECTDATA for the CARDDATA Array: ",EFFECTDATA, false, true, false);
    // Set the tmeplate type to encounter
    const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_CARD;
    const response = await fetch(templatePath);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);
    // Stringify the EFFECTDATA array
    var strStringifiedEFFECTDATA = BlacksmithUtils.objectToString(EFFECTDATA) || JSON.stringify(EFFECTDATA);
    //postConsoleAndNotification("EFFECTDATA converted to STRING as strStringifiedEFFECTDATA: ",strStringifiedEFFECTDATA, false, true, false);
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
        buttontext: strInjuryAction,
        statuseffect: strStatusEffect.toUpperCase(), // This one is used on the chat card
        arreffect: strStringifiedEFFECTDATA, // Stringify the EFFECTDATA array
        hasSectionContent: !!strStringifiedEFFECTDATA,
    };
    // Play the Sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // Return the template

    //postConsoleAndNotification("*** LINE 1682 CARDDATA",  CARDDATA, false, true, false);

    const compiledHtml = template(CARDDATA);
    return compiledHtml;
}




// ************************************
// ** CREATE Encounter Card
// ************************************

async function createChatCardEncounter(strRollTableName) {  
    // Set the defaults
    var strSound = "modules/coffee-pub-blacksmith/sounds/rustling-grass.mp3";
    var strVolume = "0.7";
    var intEncounterOdds = game.settings.get(MODULE.ID, 'encounterOdds');
    var intEncounterDice = "1d" + game.settings.get(MODULE.ID, 'encounterDice');
    var strTableNoEncounter = game.settings.get(MODULE.ID, 'encounterTableNoEncounter');
    var strTableReveal = game.settings.get(MODULE.ID, 'encounterTableReveal');
    var strTableBefore = game.settings.get(MODULE.ID, 'encounterTableBefore');
    var strTableAfter = game.settings.get(MODULE.ID, 'encounterTableAfter');
    var strNoEncounter = "";
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeEncounter');
    var strIconStyle = "fa-swords";
    var strType = BIBLIOSOPH.CARDTYPE + " Encounter";
    var strImageBackground = "cobblestone";
    var strDescriptionBefore = "";
    var strDescriptionReveal = "";
    var strDescriptionAfter = "";
    var strName = "";
    var strImage = "";
    var intQuantity = "";
    var strQuantity = "";
    var strTableName = "";
    var strTableImage = "";
    var strCompendiumLink = "";

    var strCompendiumName = "";
    var strCompendiumID = "";

    // See if they encounter a monster
    
    // do the real roll
    let rollIsEncounter = await new Roll("1d100").evaluate();
    const intRollIsEncounter = rollIsEncounter.total;
    // Show the fake Dice So Nice roll
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
        BlacksmithUtils.rollCoffeePubDice(rollIsEncounter);
    }
    if (intRollIsEncounter > intEncounterOdds) {
        // There is no encounter
        strSound = "modules/coffee-pub-blacksmith/sounds/rustling-grass.mp3";
        // Get the no encounter description
        let tableNoEncounter = game.tables.getName(strTableNoEncounter);
        if (!tableNoEncounter) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Encounter Descriptions (No Encounter) in settings.", "", false, false);
            return;
        }
        let rollNoEncounter = await tableNoEncounter.roll();
        strNoEncounter = rollNoEncounter.results[0].text;
        // Set the defaults
        strDescriptionBefore = strNoEncounter;
        strDescriptionReveal = "";
        strDescriptionAfter = "";
        strName = "All Clear";
        strImage = "icons/svg/pawprint.svg";
        intQuantity = "0";
        strQuantity = "";
        strTableName = strRollTableName;
        strTableImage = "";
        strCompendiumLink = "";
    }
    else
    {
        // Call roll table
        strSound = "modules/coffee-pub-blacksmith/sounds/weapon-sword-blade-swish.mp3";
        let arrTable = game.tables.getName(strRollTableName);
        if (!arrTable) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Encounter Monsters in settings.", strRollTableName, false, false);
            return;
        }
        // Get the monster
        strTableImage = arrTable.img;
        strTableName = arrTable.name;
        let rollResults = await arrTable.roll();
        // v13: Use .name instead of deprecated .text
        strName = rollResults.results[0].name || rollResults.results[0].description || rollResults.results[0].text;
        strImage = rollResults.results[0].img;
        
        // v13: Use .documentUuid to get the actual document UUID (not the TableResult UUID)
        const documentUuid = rollResults.results[0].documentUuid;
        if (documentUuid) {
            // Use the document UUID directly for the link (it contains all needed info)
            strCompendiumLink = "@UUID[" + documentUuid + "]{" + strName + "}";
            
            // Parse UUID to extract pack info if needed for validation
            // UUID format: "Compendium.pack-name.Actor.id" or "Actor.id"
            if (documentUuid.startsWith("Compendium.")) {
                // Extract compendium pack name from UUID
                // UUID format: Compendium.pack-name.documentType.id (pack-name can have dots)
                // Match pattern: Compendium.{everything}.{Actor|Item}.{id}
                const match = documentUuid.match(/^Compendium\.(.+?)\.(Actor|Item|JournalEntry|Macro|Playlist|RollTable|Scene|Item)\.(.+)$/);
                if (match) {
                    strCompendiumName = match[1]; // Pack name (may contain dots)
                    strCompendiumID = match[3]; // Document ID
                } else {
                    // Try to extract using Foundry's UUID parsing if available
                    try {
                        const parsed = foundry.utils.parseUuid(documentUuid);
                        if (parsed && parsed.collection) {
                            strCompendiumName = parsed.collection;
                            strCompendiumID = parsed.id;
                        }
                    } catch (e) {
                        // If parsing fails, continue without pack validation
                    }
                }
            } else if (documentUuid.startsWith("Actor.")) {
                // World actor
                strCompendiumName = "Actor";
                strCompendiumID = documentUuid.replace("Actor.", "");
            }
        } else {
            // Fallback for v12 compatibility (deprecated properties)
            strCompendiumName = rollResults.results[0].documentCollection || "";
        if (strCompendiumName == "Actor") {
            strCompendiumID = rollResults.results[0].documentId;
            strCompendiumLink = "@UUID[Actor." + strCompendiumID +"]{" + strName + "}";
            } else if (strCompendiumName) {
                strCompendiumID = rollResults.results[0].documentId;
            strCompendiumLink = "@UUID[Compendium." + strCompendiumName + ".Actor." + strCompendiumID +"]{" + strName + "}";
            }
        }
        
        // If we have a compendium name, verify the pack exists (optional validation)
        if (strCompendiumName && strCompendiumName !== "Actor") {
            const pack = game.packs.get(strCompendiumName);
            // Pack validation - UUID link should still work even if pack not found
        }
        
        // Get the before desription parts
        let tableDescBefore = game.tables.getName(strTableBefore);
        if (!tableDescBefore) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Encounter Descriptions (Before) in settings.", "", false, false);
            return;
        }
        let rollDescBeforeResults = await tableDescBefore.roll();
        strDescriptionBefore = rollDescBeforeResults.results[0].text;
        // Get the reveal text
        let tableDescReveal = game.tables.getName(strTableReveal);
        if (!tableDescReveal) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Encounter Descriptions (Reveal) in settings.", "", false, false);
            return;
        }
        let rollDescRevealResults = await tableDescReveal.roll();
        strDescriptionReveal = rollDescRevealResults.results[0].text;
        // Get the after desription parts
        let tableDescAfter = game.tables.getName(strTableAfter);
        if (!tableDescAfter) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Encounter Descriptions (After) in settings.", "", false, false);
            return;
        }
        let rollDescAfterResults = await tableDescAfter.roll();
        strDescriptionAfter = rollDescAfterResults.results[0].text;
        // Roll to find the number of monsters
        let rollNumMonster = await new Roll(intEncounterDice).evaluate();
        //postConsoleAndNotification("BIBLIOSOPH: rollResults" , rollResults, false, true, false);
        // show the dice.
        if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
            BlacksmithUtils.rollCoffeePubDice(rollNumMonster);
        }
        intQuantity = rollNumMonster.total;
        // make the monster plural if needed
        if (intQuantity > 1) {
            strName = strName + "s";
        }
        // make the number a word
        strQuantity = numToWord(intQuantity);
    }

    // Set the tmeplate type to encounter
    // const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_ENCOUNTER;
    const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_CARD;
    const response = await fetch(templatePath);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);

    // Pass the data to the template
    const CARDDATA = {
        theme: strTheme,
        iconStyle: strIconStyle,
        cardTitle: strType,
        imageBackground: strImageBackground,
        descriptionBefore: strDescriptionBefore,
        descriptionReveal: strDescriptionReveal,
        descriptionAfter: strDescriptionAfter, 
        title: strName,
        image: strImage,
        quantitynum: intQuantity,
        quantityword: strQuantity,
        tablename: strTableName,
        link:  strCompendiumLink
    }; 
    // Play the Sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // Return the template
    return template(CARDDATA);
}

// ************************************
// ** CREATE Investigation Card
// ************************************
async function createChatCardSearch(strRollTableName) {  
    // User Info
    var strUserName = "";
    var strUserAvatar = "";
    var strPlayerType = "";
    var strCharacterName = "";
    // Set the defaults
    var strSound = "modules/coffee-pub-blacksmith/sounds/chest-open.mp3";
    var strVolume = "0.7";
    var intSearchOdds = "";
    var intSearchDice = "1d" + game.settings.get(MODULE.ID, 'investigationDice');
    var strNoSearch = "";
    var strTheme = game.settings.get(MODULE.ID, 'cardThemeInvestigation');
    var strIconStyle = "fa-eye";
    var strType = BIBLIOSOPH.CARDTYPE;
    var strImageBackground = "themecolor";
    var strDescriptionBefore = "";
    var strDescriptionReveal = "";
    var strDescriptionAfter = "";
    // Table info
    var strTableName = "";
    var strTableImage = "";
    // Roll reuslts
    var strName = "";
    var strImage = "";
    var strDetails = "";
    var strKind = "";
    var strRarity = "";
    var strValue = "";
    var intQuantity = "";
    var strQuantity = "";
    var strInventoryAddedMessage = "";
    // Compendium or item datas
    var strCompendiumName = ""
    var strCompendiumID = ""
    var strCompendiumType = ""
    var strCompendiumLink = "";
    // Set the basics
    strUserName = game.user.name;
    strUserAvatar = game.user.avatar;
    if (game.user.isTheGM){
        strPlayerType = "Gamemaster";
        strCharacterName = "Cocktail Craftsman and Moderator";
    } else {
        strPlayerType = "Player";
        if(game.user.character) {
            strCharacterName = game.user.character.name;
        } else {
            strCharacterName = "No Character Set";
        }
    }
    // Set the odds
    if (BIBLIOSOPH.CARDTYPEINVESTIGATION){
        intSearchOdds = game.settings.get(MODULE.ID, 'investigationOdds');
        intSearchDice = "1d" + game.settings.get(MODULE.ID, 'investigationDice');
    } else {
        intSearchOdds = "100";
        intSearchDice = "1d1";
    }
    // Check to see if they beat the search odds
    let rollIsSearch = await new Roll("1d100").evaluate();
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
        BlacksmithUtils.rollCoffeePubDice(rollIsSearch);
    }
    const intRollIsSearch = rollIsSearch.total;
    //postConsoleAndNotification("intRollIsSearch", intRollIsSearch, false, true, false);
    //postConsoleAndNotification("intSearchOdds", intSearchOdds, false, true, false);
    if (intRollIsSearch > intSearchOdds) {
        // There is no Search
        strSound = "modules/coffee-pub-blacksmith/sounds/chest-open.mp3";
        // Get the no encoutner description
        let tableNoSearch = game.tables.getName("Search Descriptions: Nothing");
        if (!tableNoSearch) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Investigation Descriptions (Nothing Found) in settings.", "", false, false);
            return;
        }
        let rollNoSearch = await tableNoSearch.roll();
        strNoSearch = rollNoSearch.results[0].text;
        strDescriptionBefore = strNoSearch;
        strName = "Nothing Found";
        strImage = "icons/tools/scribal/magnifying-glass.webp";
        //strTableName = strRollTableName;
    }
    else
    {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "In the odds check...", intRollIsSearch, false, false);
        // Call roll table
        strSound = "modules/coffee-pub-blacksmith/sounds/chest-treasure.mp3";
        // let's start passing in the roll table name once this works.
        let arrTable = game.tables.getName(strRollTableName);
        if (!arrTable) {
            // POST DEBUG
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for investigation items in settings.", strRollTableName, false, false);
            return;
        }
        // Get the search item
        strTableImage = arrTable.img;
        strTableName = arrTable.name;
        let rollResults = await arrTable.roll();
        // v13: Use .name instead of deprecated .text
        strName = rollResults.results[0].name || rollResults.results[0].description || rollResults.results[0].text;
        strImage = rollResults.results[0].img;
        strCompendiumType = "Item";
        
        // v13: Use .documentUuid to get the actual document UUID (not the TableResult UUID)
        const documentUuid = rollResults.results[0].documentUuid;
        if (documentUuid) {
            // Use the document UUID directly for the link (it contains all needed info)
            strCompendiumLink = "@UUID[" + documentUuid + "]{" + strName + "}";
            
            // Parse UUID to extract compendium info if needed
            // UUID format: "Compendium.pack-name.Item.id" or "Item.id"
            if (documentUuid.startsWith("Compendium.")) {
                // Extract compendium pack name from UUID
                // UUID format: Compendium.pack-name.documentType.id (pack-name can have dots)
                // Match pattern: Compendium.{everything}.{Actor|Item}.{id}
                const match = documentUuid.match(/^Compendium\.(.+?)\.(Actor|Item|JournalEntry|Macro|Playlist|RollTable|Scene|Item)\.(.+)$/);
                if (match) {
                    strCompendiumName = match[1]; // Pack name (may contain dots)
                    strCompendiumID = match[3]; // Document ID
                } else {
                    // Try to extract using Foundry's UUID parsing if available
                    try {
                        const parsed = foundry.utils.parseUuid(documentUuid);
                        if (parsed && parsed.collection) {
                            strCompendiumName = parsed.collection;
                            strCompendiumID = parsed.id;
                        }
                    } catch (e) {
                        // If parsing fails, continue without pack validation
                    }
                }
            } else if (documentUuid.startsWith("Item.")) {
                // World item
                strCompendiumName = "Item";
                strCompendiumID = documentUuid.replace("Item.", "");
            }
        } else {
            // Fallback for v12 compatibility (deprecated properties)
            strCompendiumName = rollResults.results[0].documentCollection || "";
            strCompendiumID = rollResults.results[0].documentId;
        if (strCompendiumName == "Item"){
            // It is an item in the world
            strCompendiumLink = "@UUID[" + strCompendiumType + "." + strCompendiumID + "]{" + strName + "}";
        }else{
            // It is a compendium
            strCompendiumLink = "@UUID[Compendium." + strCompendiumName + "." + strCompendiumType + "." + strCompendiumID + "]{" + strName + "}";
            }
        }
        // const item = await game.items.get(strCompendiumID);
        var ITEMDATA = getItemDataById(strCompendiumID);
        strKind = ITEMDATA.strKind;
        strDetails = ITEMDATA.strDescritption;
        strRarity = ITEMDATA.strRarity;
        strValue = ITEMDATA.strValue;

        // Get the before desription parts
        if (BIBLIOSOPH.CARDTYPEINVESTIGATION){
            let tableDescBefore = game.tables.getName("Search Descriptions: Before");
            if (!tableDescBefore) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Investigation Descriptions (Before) in settings.", "", false, false); 
                return;
            }
            let rollDescBeforeResults = await tableDescBefore.roll();
            strDescriptionBefore = rollDescBeforeResults.results[0].text;
            // Get the reveal text
            let tableDescReveal = game.tables.getName("Search Descriptions: Reveal");
            if (!tableDescReveal) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Investigation Descriptions (Reveal) in settings.", "", false, false); 
                return;
            }
            let rollDescRevealResults = await tableDescReveal.roll();
            strDescriptionReveal = rollDescRevealResults.results[0].text;
            // Get the after desription parts
            let tableDescAfter = game.tables.getName("Search Descriptions: After");
            if (!tableDescAfter) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "You need to choose a roll table for Investigation Descriptions (After) in settings.", "", false, false); 
                return;
            }
            let rollDescAfterResults = await tableDescAfter.roll();
            strDescriptionAfter = rollDescAfterResults.results[0].text;

        } else {
            strDescriptionBefore = "";
            strDescriptionReveal = "";
            strDescriptionAfter = "";
        }

        // Roll to find the number of items


        // Roll to find the number of items
        let rollQuantity = await new Roll(intSearchDice).evaluate();
        // show the dice.
        if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
            BlacksmithUtils.rollCoffeePubDice(rollQuantity);
        }
        intQuantity = rollQuantity.total;

        // // -- Call our dice function -- 
        // var intQuantity = 0;
        // var strDiceFormula = intSearchDice;
        // BlacksmithUtils.rollCoffeePubDice(strDiceFormula).then(result => {
        //     intQuantity = result;
        // });


        // make the monster plural if needed
        if (intQuantity > 1) {
            strName = strName + "s";
        }
        // make the number a word
        strQuantity = numToWord(intQuantity);

        // Add the found item to the character's inventory (when investigation finds something)
        const uuidToAdd = rollResults?.results?.[0]?.documentUuid;
        const actor = game.user.character ?? canvas.tokens?.controlled?.[0]?.actor;
        const qty = Math.max(1, Number(intQuantity) || 1);

        if (uuidToAdd && actor) {
            try {
                const itemDoc = await fromUuid(uuidToAdd);
                if (!(itemDoc instanceof Item)) {
                    console.warn(MODULE.ID + " | UUID did not resolve to an Item:", uuidToAdd, itemDoc);
                } else {
                    const baseData = itemDoc.toObject();
                    delete baseData._id;
                    const hasQuantity = foundry.utils.getProperty(baseData, "system.quantity") !== undefined;
                    let toCreate;
                    if (hasQuantity) {
                        foundry.utils.setProperty(baseData, "system.quantity", qty);
                        toCreate = [baseData];
                    } else {
                        toCreate = Array.from({ length: qty }, () => {
                            const d = itemDoc.toObject();
                            delete d._id;
                            return d;
                        });
                    }
                    await actor.createEmbeddedDocuments("Item", toCreate);
                    const actorName = actor.name;
                    strInventoryAddedMessage = qty === 1
                        ? `1 ${strName} was added to ${actorName}'s inventory.`
                        : `${qty} ${strName} were added to ${actorName}'s inventory.`;
                }
            } catch (err) {
                console.warn(MODULE.ID + " | Could not add investigation item to inventory:", err);
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Could not add item to inventory.", err?.message ?? String(err), false, false);
            }
        }

    }

    // Set the template type to Search
    const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_CARD;
    const response = await fetch(templatePath);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);
    // Pass the data to the template
    const CARDDATA = {
        userName: strUserName,
        userAvatar: strUserAvatar,
        playerType: strPlayerType,
        characterName: strCharacterName,
        theme: strTheme,
        iconStyle: strIconStyle,
        cardTitle: strType,
        imageBackground: strImageBackground,
        descriptionBefore: strDescriptionBefore,
        descriptionReveal: strDescriptionReveal,
        descriptionAfter: strDescriptionAfter, 
        title: strName,
        image: strImage,
        quantitynum: intQuantity,
        quantityword: strQuantity,
        tablename: strTableName,
        link: strCompendiumLink,
        inventoryAddedMessage: strInventoryAddedMessage,
        // Item Specific
        kind: strKind,
        details: strDetails,
        rarity: strRarity,
        value: strValue,
    };
    // Play the Sound
    BlacksmithUtils.playSound(strSound,strVolume);
    // Return the template
    return template(CARDDATA);
}

// ************************************
// ** UTILITY Roll Table
// ************************************

async function getRollTable(tableName) {

    // resultId: The id of the rolled table result.
    // weight: The weight (probability) of this item being rolled.
    // type: The type of result.
    // text: The text that is shown when this result is rolled.
    // img: URL to an image for the result.
    // collection: The name of a collection from which to draw a specific Entity.
    // result: The id of the chosen Entity from the collection.
    // drawn: Boolean value of whether or not the result was drawn. 

    var table = game.tables.getName(tableName);

    // Check to see if the table is valid
    if (!table) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Roll Table not Found. Did you set one in settings?", "", false, false); 
        return;
    }
    
    var strRollTableImage = "";
    var strRollTableName = "";
    var strContent = "";
    var strTitle = "";
    var strAction = "";
    var intResultId = "";
    var intWeighting = "";
    var strRollType = "";
    var strImage = "";
    var arrCollection = "";
    var strResultOfEntity = "";
    var blnHasBeenDrawn = "";

    // Map the results for the returned array
    let rollResults = await table.roll({rollMode: CONST.DICE_ROLL_MODES.BLIND});
    // show the dice.
    if (game.settings.get(MODULE.ID, 'showDiceRolls')) {
        BlacksmithUtils.rollCoffeePubDice(rollResults.roll);
    }
    // Fix parse the text as needed
    strContent = rollResults.results[0].text;
    strTitle = grabTextBetweenStrings(strContent, "**", "**");
    strContent = strContent.replace('**' + strTitle + '**','');
    strAction = grabTextBetweenStrings(strContent, "##", "##");
    strContent = strContent.replace('##' + strAction + '##','');   
    strRollTableImage = table.img;
    strRollTableName = table.name;
    intResultId =  rollResults.results[0].resultId;
    intWeighting =  rollResults.results[0].weight;
    strRollType =  rollResults.results[0].type;
    strImage =  rollResults.results[0].img;
    arrCollection =  rollResults.results[0].collection;
    strResultOfEntity =  rollResults.results[0].result;
    blnHasBeenDrawn =  rollResults.results[0].drawn;
    // map the data to the returned array
    const ROLLEDRESULT = {
        strTableName: strRollTableName,
        strTableImage: strRollTableImage,
        intResultId: intResultId,
        intWeighting: intWeighting,
        strRollType: strRollType,
        strTitle: strTitle,
        strContent: strContent,
        strAction: strAction,
        strImage: strImage,
        arrCollection: arrCollection, // the table data
        strResultOfEntity: strResultOfEntity, // ???
        blnHasBeenDrawn: blnHasBeenDrawn, 
    };
    return ROLLEDRESULT;
}

// ************************************
// ** UTILITY Build Player List
// ************************************

// Fundtion to build the player list for the whisper
function buildPlayerList(recipients) {

    let strUser = game.user.name;
    let strPortrait = game.user.avatar;
    // Ensure arrRecipients is always an array
    var arrRecipients = Array.isArray(recipients) ? recipients : (recipients ? [recipients] : []);
    var defaultToCharacter = false; //"true" means the dialog will select a character to speak as by default; "false" means the dialog will select to speak as you, the player, by default.
    var activePlayersOnly = false; //"true" means the dialog is only populated with active players currently in the session; "false" means the dialog is populated with all players in the world.
    var warnIfNoTargets = true; //"true" means your whisper will not be posted if you did not select a player; "false" means your whisper will be posted for all players to see if you do not select a player.
    var userConfigCharacterOnly = true; //Changes what appears when you hover on a player's name. "true" shows only the name of the character bound to them in their User Configuration; "false" shows a list of names for all characters they own. GMs and Assistant GMs do not get character lists regardless; they're labeled with their position.
    var strSound = "modules/coffee-pub-blacksmith/sounds/fire-candle-blow.mp3";
    
    // Check if compressed window layout is enabled
    var blnCompressedWindow = BlacksmithUtils.getSettingSafely(MODULE.ID, 'privateMessageCompressedWindow', false);

    // Build the "whisper to" checkboxes
    var characters = game.actors;
    var checkOptions = "";
    var strToActors = "";
    var targets = Array.from(game.user.targets);

    if (activePlayersOnly === true) {
        var players = game.users.filter(player => player.active);
    } else {
        var players = game.users;
    }

    var whisperSpeakerID = "";
    if (game.user.character !== null && game.user.character !== undefined) {
        whisperSpeakerID = game.user.character.id
    }
    if (canvas.tokens.controlled[0] !== undefined && canvas.tokens.controlled[0].actor !== null) {
        whisperSpeakerID = canvas.tokens.controlled[0].actor.id;
    }
    if (activePlayersOnly === true) {
        var players = game.users.filter(player => player.active);
    } else {
        var players = game.users;
    }
    // Loop through the players
    players.forEach(player => {
        if (player.id !== game.user.id) {
            if (player.name !== "Cameraman" && player.name !== "DeveloperXXX" && player.name !== "AuthorXXX") {
                // Only show party members (users with assigned characters)
                if (player.character === null || player.character === undefined) {
                    return; // Skip users without characters (not party members)
                }

                var blnPlayerSelected = false;
                var checked = "";
                var strTheme = "";
                if (targets.length > 0) {
                    for (let i = 0; i < targets.length; i++) {
                        const actor = game.actors.get(targets[i].data.actorId);
                        if (actor && actor.system && actor.system.permission && actor.system.permission[player.id] !== undefined && actor.system.permission[player.id] > 2) {
                            checked = "checked";
                        }
                    }
                }
                var ownedCharacters = "";
                if (player.role == 4) {
                    ownedCharacters = "Gamemaster";
                } else if (player.role == 3) {
                    ownedCharacters = "Assistant Gamemaster";
                } else if (userConfigCharacterOnly == true && player.character !== null && player.character !== undefined) {
                    ownedCharacters = player.character.name;
                } else {
                    characters.forEach(character => {
                        if (character && character.system && character.system.permission && character.system.permission[`${player.id}`] > 2) {
                            var charName = character.name.replace(/'/g, '`');
                            var startSymbol = "; ";
                            if (ownedCharacters == "") {
                                startSymbol = "";
                            }
                            ownedCharacters += startSymbol + charName;
                        }
                    });
                }
                // Build the selectable divs - compressed or full layout
                // Note: Selection is handled in activateListeners, not in initial HTML generation
                if (blnCompressedWindow) {
                    // Compressed layout: just portrait images in horizontal row (like party buttons)
                    // Same styling as party buttons - let them wrap naturally
                    checkOptions += "<img name='selectable-div' class='bibliosoph-option-image' title='" + player.name + " (" + ownedCharacters + ")' src='" + player.avatar + "' value='" + player.name + "' />";
                } else {
                    // Full layout: portrait with name and character info
                    // Width set to ~33.33% to allow 3 per row (with gap)
                    // Note: Selection is handled in activateListeners, not in initial HTML generation
                    checkOptions += "<div name='selectable-div' id='bib-window-user-wrapper' value='" + player.name + "' class='bibliosoph-option-div' style='flex: 0 0 calc(33.33% - 5px);'>";
                    checkOptions += "   <img id='bib-window-user-portrait' src='" + player.avatar + "' />";
                    checkOptions += "   <div id='bib-window-user-nameplate-container'>";
                    checkOptions += "       <span id='bib-window-user-nameplate-name'>" + player.name + "</span>";
                    checkOptions += "       <br />";
                    checkOptions += "       <span id='bib-window-user-nameplate-description'>" + ownedCharacters + "</span>";
                    checkOptions += "   </div>";
                    checkOptions += "</div>";
                }

            }
        }
    });

    // Return the options
    return checkOptions
}

// ************************************
// ** UTILITY Whisper Private List
// ************************************

/**
 * Build private message recipient data for the template (no HTML).
 * Returns { recipients: [{ playerName, playerAvatar, characterName }, ...], compressed: boolean }.
 */
function buildPrivateList(arrPlayers) {
    const recipients = [];
    const blnCompressedList = game.settings.get(MODULE.ID, "cardLayoutPrivateMessage");

    for (let i = 0; i < arrPlayers.length; i++) {
        if (!arrPlayers[i]) continue;

        let strPlayerName = arrPlayers[i];
        let strPlayerAvatar = "";
        let strCharacterName = "";

        const tokenDetails = getUserCharacterDetails(strPlayerName);
        if (tokenDetails) {
            strCharacterName = tokenDetails.strCharacterName;
            strPlayerName = tokenDetails.strPlayerName;
            strPlayerAvatar = tokenDetails.strPlayerAvatar || "";
        } else {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "No owned tokens for this user: " + strPlayerName, "", false, false);
        }

        recipients.push({
            playerName: strPlayerName,
            playerAvatar: strPlayerAvatar,
            characterName: strCharacterName
        });
    }

    return { recipients, compressed: blnCompressedList };
}

// ************************************
// ** UTILITY Get Character Details
// ************************************

function getUserCharacterDetails(username) {
// Fetch the user from Foundry VTT's user store
let user = game.users.contents.find(u => u.name === username);

// Check if the user exists
if (user && user.character) {
    // Fetch the owned character
    let character = user.character;
    
    // Create the characterDetails object with character data
    let characterDetails = {
        strPlayerName: user.name,
        strPlayerAvatar: user.avatar, 
        strCharacterName: character.name,
        strCharacterTokenImage: character.img, // map to token
        strCharacterPortraitImage: character.img, 
        intCharacterID: character._id,       
    }
    // Return character details
    return characterDetails;
} else {
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "User with that username does not exist or the user has no character.", "", false, false); 
}
}

// ************************************
// ** UTILITY Userid by Name
// ************************************

function getUserIdByPlayerName(playerName) {
    // Find the user object for the given player name
    const user = game.users.find(u => u.name === playerName);

    if (user) {
        // Return the user's ID
        return user.id;
    } else {
        // Handle the case where the user is not found
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "User with that username does not exist or the user has no character: " + playerName, "", false, false); 
        return null;
    }
}

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
// ** UTILITY Get Item by ID
// ************************************

// This script looks up the rarity of an item knowing its id.
// To use it, simply call the function `getRarityById()` with the id of the item as the argument.
// The function will return a string containing the rarity of the item, or "Unknown" if the item is not found.
function getItemDataById(id) {
   
    // Get the item from the database.
    const item = game.items.get(id);

    // If the item is not found, return "Unknown".
    if (!item) {
        return "Unknown";
    }
    // Set the item data
    const ITEMDATA = {
        strKind: item.type,
        strDescritption: removeHTMLTags(item.system.description.value),
        strRarity: item.system.rarity,
        strValue: item.system.price.value,
        strQuantity: item.system.quantity,
    }; 

    // Return the itemdata.
    return ITEMDATA;
}

// ************************************
// ** UTILITY Get Macro ID
// ************************************
function getMacroIdByName(name) {
    // Iterate over all macros
    for(let macro of game.macros.contents) {
        // Compare macro name to input
        //if(macro.data.name === name) {
        if(macro.name === name) {
            // If the names match, return the ID
            return macro.id;
        }
    }
    // If no match was found, return null
    return null;
}

// ************************************
// ** UTILITY Check and Create Macros
// ************************************

async function checkAndCreateMacro(settingName) {
    // Grab the macro name from the settings. if it doesn't exist, create a new one
    var macroName = game.settings.get(MODULE.ID, settingName);
    console.info( "COFFEE PUB BLBIOSOPH: Checking if Macro exists. macroName = " + macroName);
    // Set the appropriate data based on encounter types
    var blnEnabled = false;
    var macroNewName = '';
    var predefinedImage = '';
    var strCommand = '// No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    if (settingName == "encounterMacroGeneral") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledGeneral");
        macroNewName = "Encounter: General"
        predefinedImage = 'icons/environment/wilderness/mine-interior-dungeon-door.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroCave") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledCave");
        macroNewName = "Encounter: Cave"
        predefinedImage = 'icons/environment/wilderness/cave-entrance-rocky.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroDesert") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledDesert");
        macroNewName = "Encounter: Desert"
        predefinedImage = 'icons/environment/wilderness/terrain-rocks-brown.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroDungeon") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledDungeon");
        macroNewName = "Encounter: Dungeon"
        predefinedImage = 'icons/environment/wilderness/tomb-entrance.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroForest") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledForest");
        macroNewName = "Encounter: Forest"
        predefinedImage = 'icons/environment/wilderness/tree-ash.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroMountain") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledMountain");
        macroNewName = "Encounter: Mountain"
        predefinedImage = 'icons/environment/wilderness/carved-standing-stone.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroSky") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledSky");
        macroNewName = "Encounter: Sky"
        predefinedImage = 'icons/environment/wilderness/cave-entrance-island.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroSnow") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledSnow");
        macroNewName = "Encounter: Snow"
        predefinedImage = 'icons/environment/wilderness/tree-spruce.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroUrban") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledUrban");
        macroNewName = "Encounter: Urban"
        predefinedImage = 'icons/environment/settlement/house-manor.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else if (settingName == "encounterMacroWater") {
        blnEnabled = game.settings.get(MODULE.ID, "encounterEnabledWater");
        macroNewName = "Encounter: Water"
        predefinedImage = 'icons/environment/wilderness/island.webp';
        strCommand = '// ' + macroName + ': No Code Needed as Bibliosoph only uses the macro as a way to trigger its code.';
    } else {
        // not one of the macros we check
        return
    }
    // IF ENABLED, do the check
    if (blnEnabled) {
        // See if the macro alreadys exists
        let doesMacroExist = game.macros.find(macro => macro.data.name === macroName);
        // If doesn't exist, make one
        if (!doesMacroExist) {
            await Macro.create({
                name: macroNewName,
                type: "script",
                img: predefinedImage,
                command: strCommand,
                flags: {},
            });

            // save updated Macro in settings
            game.settings.set(MODULE.ID, settingName, macroName);
        }
    } else {
        // Not Enabled.
    }
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
   //postConsoleAndNotification("createChatCardInjurySelector arrCategories" , arrCategories, false, true, false); 
    // build the buttons
    arrInjuryButtons = await getCategoryButtons(arrCategories);
    
    const templatePath = BIBLIOSOPH.MESSAGE_TEMPLATE_CARD;
    const response = await fetch(templatePath);
    const templateText = await response.text();
    const template = Handlebars.compile(templateText);
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
        //postConsoleAndNotification("In createChatCardInjurySelector, arrCategories comes back null or undefined." , "", false, true, false); 
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
    //postConsoleAndNotification("getCompendiumPageContent" , arrValues, false, false, false);
    // If no arrpages, return null or handle however you prefer
    if (arrValues.length === 0) {
        return null;
    }
    // Return the Array
    var arrTEMP = [];
    arrTEMP = arrValues
    //postConsoleAndNotification("createChatCardInjurySelector arrTEMP" , arrTEMP, false, true, false); 
    return arrValues;
}


// ************************************
// ** UTILITY Get Pages for a specific journal 
// ************************************


async function getJournalCategoryPageData(compendiumName,category) {


    const pack = game.packs.get(compendiumName);
    const strMatchingCategory = category.toLowerCase();


    //postConsoleAndNotification("*** getJournalCategoryPageData pack" , pack, false, true, false); 
    //postConsoleAndNotification("*** getJournalCategoryPageData strMatchingCategory" , strMatchingCategory, false, true, false); 


    if (!pack) {
        console.error(`Compendium ${compendiumName} not found`);
        return;
    }
    // Get all entries from the compendium 
    // The entries are the journals.
    const entries = await pack.getDocuments();

    //postConsoleAndNotification("*** getJournalCategoryPageData entries" , entries, false, true, false); 

    // Collect all available categories
    let arrCategoryPages = [];
    for (let entry of entries) {
        //postConsoleAndNotification("*** getJournalCategoryPageData entry" , entry, false, true, false); 
        // Look for the right journal
        if (entry.name.toLowerCase() == strMatchingCategory) {
            arrCategoryPages = entry._source.pages;
        }
    }
    // If no pages
    if (arrCategoryPages.length === 0) {
        //postConsoleAndNotification("*** getJournalCategoryPageData No Pages Found" , arrCategoryPages, false, true, false); 
        return null;
    }

    //postConsoleAndNotification("*** getJournalCategoryPageData arrCategoryPages" , arrCategoryPages, false, true, false); 

    // Randomly select a Page
    const randomPage = arrCategoryPages[Math.floor(Math.random() * arrCategoryPages.length)];

    //postConsoleAndNotification("*** getJournalCategoryPageData randomPage" , randomPage, false, true, false); 

   //postConsoleAndNotification("*** getJournalCategoryPageData randomPage.name" , randomPage.name, false, true, false); 
    //postConsoleAndNotification("*** getJournalCategoryPageData randomPage.text.content" , randomPage.text.content, false, true, false); 

    let metadataObject = getHTMLMetadata(randomPage.text.content);
    //postConsoleAndNotification("*** getJournalCategoryPageData metadataObject" , metadataObject, false, true, false); 

    return metadataObject;
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
    //postConsoleAndNotification("getInjuryDataFromJournalPages compendiumName: ", compendiumName, false, true, false);
    //postConsoleAndNotification("getInjuryDataFromJournalPages journalName: ", journalName, false, true, false);
    const pack = game.packs.get(compendiumName);
    const entries = await pack.getDocuments();
    const journalEntry = entries.find((entry) => entry.name === journalName);
    
    //postConsoleAndNotification("entries", entries, false, true, false);

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
        //postConsoleAndNotification("Journal Entry Content: ", content, false, true, false);

        let categoryPage = content.find(page => page.name === 'category');
        category = removeHTMLTags(categoryPage ? categoryPage.text.content : null);
        //postConsoleAndNotification("category: ", category, false, true, false);

        let labelPage = content.find(page => page.name === 'label');
        label = removeHTMLTags(labelPage ? labelPage.text.content : null);
        //postConsoleAndNotification("label: ", label, false, true, false);

        let iconPage = content.find(page => page.name === 'icon');
        icon = removeHTMLTags(iconPage ? iconPage.text.content : null);
        //postConsoleAndNotification("icon: ", icon, false, true, false);

        let damagePage = content.find(page => page.name === 'damage');
        damage = removeHTMLTags(damagePage ? damagePage.text.content : null);
        //postConsoleAndNotification("damage: ", damage, false, true, false);

        let durationPage = content.find(page => page.name === 'duration');
        duration = removeHTMLTags(durationPage ? durationPage.text.content : null);
        //postConsoleAndNotification("duration: ", duration, false, true, false);

        let descriptionPage = content.find(page => page.name === 'description');
        description = removeHTMLTags(descriptionPage ? descriptionPage.text.content : null);
        //postConsoleAndNotification("description: ", description, false, true, false);

        let treatmentPage = content.find(page => page.name === 'treatment');
        treatment = removeHTMLTags(treatmentPage ? treatmentPage.text.content : null);
        //postConsoleAndNotification("treatment: ", treatment, false, true, false);

        let actionPage = content.find(page => page.name === 'action');
        action = removeHTMLTags(actionPage ? actionPage.text.content : null);
        //postConsoleAndNotification("action: ", action, false, true, false);

        let statuseffectPage = content.find(page => page.name === 'status effect');
        statuseffect = removeHTMLTags(statuseffectPage ? statuseffectPage.text.content : null);
        //postConsoleAndNotification("statuseffect: ", statuseffect, false, true, false);

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
async function applyActiveEffect(strLabel, strIcon, intDamage, intDuration, strStatusEffect) {
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Applying active effects: " + strLabel, "", false, false);
    
    // Get the selected token
    const token = canvas.tokens.controlled[0];
    // If a token is selected
    if (token) {
        // --- Apply Active Effects ---
        // Prepare the array of official status effects
        const officialStatusEffects = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "exhaustion"];
        
        if (token) {
            let existingEffect = null;
            // Check if the token already has the effect
            for (let effect of token.actor.effects) {
                if (effect.name === strLabel) {
                    existingEffect = effect;
                    break;
                }
            }
            if (!existingEffect) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Applying active effects on " + token.actor.name + ": " + strLabel, "", false, false);
                // Create the effect data
                const effectData = {
                    name: strLabel,
                    icon: strIcon,
                    duration: {
                        seconds: intDuration,
                    },
                    changes: [
                        {
                            key: 'system.attributes.hp.value',
                            mode: 2,
                            value: `-${intDamage}`,
                        }
                    ],
                };
                
                // Create a clean copy of the effect data
                const cleanEffectData = foundry.utils.deepClone(effectData);
                
                // Now create the embedded document
                await token.actor.createEmbeddedDocuments("ActiveEffect", [cleanEffectData]);
                
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Applied " + strLabel + " to " + token.actor.name, "", false, false);
            } else {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Active effect already present on " + token.actor.name + ", skipping: " + strLabel, "", false, false);
            }
        }
        // --- Apply Status Effects, if needed ---
        if(game.modules.get("dfreds-convenient-effects")?.active) { 
            if (strStatusEffect && officialStatusEffects.map(eff => eff.toLowerCase()).includes(strStatusEffect.toLowerCase())) {
                let statusEffectName = strStatusEffect.charAt(0).toUpperCase() + strStatusEffect.slice(1);
                try {
                    let hasEffect = token.actor.effects.find(e => e.data.label === statusEffectName);
                    if (!hasEffect){
                        game.dfreds.effectInterface.toggleEffect(statusEffectName, token.actor);
                        console.log(`Toggled ${statusEffectName} for ${token.actor.name}`);
                        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Added status effect " + statusEffectName + " to " + token.actor.name, "", false, false);
                    } else {
                        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, token.actor.name + " already has status effect " + statusEffectName + ". Skipping adding the status effect.", "", false, false);
                    }
                } catch (err) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Error while toggling status effect " + statusEffectName + ": " + err.toString(), "", false, false);
                }
            }
        } else {
            console.log("DFreds Convenient Effects module is not installed or not active.");
        }
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
    BIBLIOSOPH.CARDTYPEGIFT = false;
    BIBLIOSOPH.CARDTYPESHADYGOODS = false;
    BIBLIOSOPH.CARDTYPECRIT = false;
    BIBLIOSOPH.CARDTYPEFUMBLE = false;
    BIBLIOSOPH.CARDTYPEBIO = false;
    BIBLIOSOPH.CARDTYPEBEVERAGE = false;
    BIBLIOSOPH.CARDTYPEINSULT = false;
    BIBLIOSOPH.CARDTYPEPRAISE = false;
    BIBLIOSOPH.CARDTYPEINSPIRATION = false;
    BIBLIOSOPH.CARDTYPEDOMT = false;
    BIBLIOSOPH.CARDTYPEMESSAGE = false;
    BIBLIOSOPH.CARDTYPEWHISPER = false;
    BIBLIOSOPH.MESSAGES_TITLE = "Message";
    BIBLIOSOPH.MESSAGES_CONTENT = "";
    BIBLIOSOPH.MESSAGES_FORMTITLE  = "";
    BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE = "";
    BIBLIOSOPH.MACRO_ID = "";
}

