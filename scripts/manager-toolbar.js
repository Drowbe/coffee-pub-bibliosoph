// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { MODULE, BIBLIOSOPH  } from './const.js';
import { BiblioWindowChat } from './window.js';
import { openEncounterWindow } from './manager-encounters.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// Helper function to get setting value using Blacksmith API
function getSetting(key, defaultValue) {
    // Use the global BlacksmithUtils object as per API documentation
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.getSettingSafely) {
        return BlacksmithUtils.getSettingSafely(MODULE.ID, key, defaultValue);
    }
    // Fallback if Blacksmith API not available
    try {
        return game.settings.get(MODULE.ID, key) ?? defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

// Toolbar tool configuration
const TOOLBAR_TOOLS = {
    'bibliosoph-party-message': {
        icon: "fa-solid fa-comments",
        name: "bibliosoph-party-message",
        title: "Party Message",
        zone: "communication",
        order: 5,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('partyMessageEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubPartyMessageEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryPartyMessageEnabled', false),
        onClick: () => {
            // Directly open party message dialog
            openPartyMessageDialog();
        }
    },
    'bibliosoph-private-message': {
        icon: "fa-solid fa-user-secret",
        name: "bibliosoph-private-message",
        title: "Private Message",
        zone: "communication",
        order: 10,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('privateMessageEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubPrivateMessageEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryPrivateMessageEnabled', false),
        onClick: () => {
            // Call the global function that handles opening the dialog
            if (typeof window.openPrivateMessageDialog === 'function') {
                window.openPrivateMessageDialog();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Private message dialog function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-investigation': {
        icon: "fa-solid fa-search",
        name: "bibliosoph-investigation",
        title: "Investigation",
        zone: "rolls",
        order: 5,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('investigationEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInvestigationEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInvestigationEnabled', false),
        onClick: () => {
            // Call the global function that handles investigation
            if (typeof window.triggerInvestigationMacro === 'function') {
                window.triggerInvestigationMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Investigation function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-critical': {
        icon: "fa-solid fa-burst",
        name: "bibliosoph-critical",
        title: "Critical Hit",
        zone: "rolls",
        order: 10,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('criticalEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubCriticalEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryCriticalEnabled', false),
        onClick: () => {
            // Call the global function that handles critical hit
            if (typeof window.triggerCriticalMacro === 'function') {
                window.triggerCriticalMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Critical hit function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-fumble': {
        icon: "fa-solid fa-heart-crack",
        name: "bibliosoph-fumble",
        title: "Fumble",
        zone: "rolls",
        order: 15,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('fumbleEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubFumbleEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryFumbleEnabled', false),
        onClick: () => {
            // Call the global function that handles fumble
            if (typeof window.triggerFumbleMacro === 'function') {
                window.triggerFumbleMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Fumble function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-injuries': {
        icon: "fa-solid fa-bandage",
        name: "bibliosoph-injuries",
        title: "Injuries",
        zone: "rolls",
        order: 20,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('injuriesEnabledGlobal', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInjuriesEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInjuriesEnabled', false),
        onClick: () => {
            // Call the global function that handles injuries
            if (typeof window.triggerInjuriesMacro === 'function') {
                window.triggerInjuriesMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Injuries function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-beverage': {
        icon: "fa-solid fa-mug-hot",
        name: "bibliosoph-beverage",
        title: "Beverage Break",
        zone: "roleplay",
        order: 5,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('beverageEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubBeverageEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryBeverageEnabled', false),
        onClick: () => {
            if (typeof window.triggerBeverageMacro === 'function') {
                window.triggerBeverageMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Beverage function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-bio': {
        icon: "fa-solid fa-restroom",
        name: "bibliosoph-bio",
        title: "Bio Break",
        zone: "roleplay",
        order: 10,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('bioEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubBioEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryBioEnabled', false),
        onClick: () => {
            if (typeof window.triggerBioMacro === 'function') {
                window.triggerBioMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Bio function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-insults': {
        icon: "fa-solid fa-face-angry",
        name: "bibliosoph-insults",
        title: "Insults",
        zone: "roleplay",
        order: 15,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('insultsEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInsultsEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInsultsEnabled', false),
        onClick: () => {
            if (typeof window.triggerInsultsMacro === 'function') {
                window.triggerInsultsMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Insults function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-praise': {
        icon: "fa-solid fa-face-smile",
        name: "bibliosoph-praise",
        title: "Praise",
        zone: "roleplay",
        order: 20,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('praiseEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubPraiseEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryPraiseEnabled', false),
        onClick: () => {
            if (typeof window.triggerPraiseMacro === 'function') {
                window.triggerPraiseMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Praise function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-gift': {
        icon: "fa-solid fa-gift",
        name: "bibliosoph-gift",
        title: "Gifts",
        zone: "roleplay",
        order: 25,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('giftEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubGiftEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryGiftEnabled', false),
        onClick: () => {
            if (typeof window.triggerGiftMacro === 'function') {
                window.triggerGiftMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Gift function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-shadygoods': {
        icon: "fa-solid fa-mask",
        name: "bibliosoph-shadygoods",
        title: "Shady Goods",
        zone: "roleplay",
        order: 30,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('shadygoodsEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubShadygoodsEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryShadygoodsEnabled', false),
        onClick: () => {
            if (typeof window.triggerShadygoodsMacro === 'function') {
                window.triggerShadygoodsMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Shadygoods function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-inspiration': {
        icon: "fa-solid fa-lightbulb",
        name: "bibliosoph-inspiration",
        title: "Inspiration",
        zone: "roleplay",
        order: 35,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('inspirationEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInspirationEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInspirationEnabled', false),
        onClick: () => {
            if (typeof window.triggerInspirationMacro === 'function') {
                window.triggerInspirationMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Inspiration function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-general-encounter': {
        icon: "fa-solid fa-dice-d20",
        name: "bibliosoph-general-encounter",
        title: "General Encounter",
        zone: "rolls",
        order: 5,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledGeneral', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubGeneralEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryGeneralEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerGeneralEncounterMacro === 'function') {
                window.triggerGeneralEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "General encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-cave-encounter': {
        icon: "fa-solid fa-mountain",
        name: "bibliosoph-cave-encounter",
        title: "Cave Encounter",
        zone: "rolls",
        order: 10,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledCave', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubCaveEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryCaveEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerCaveEncounterMacro === 'function') {
                window.triggerCaveEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Cave encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-desert-encounter': {
        icon: "fa-solid fa-sun",
        name: "bibliosoph-desert-encounter",
        title: "Desert Encounter",
        zone: "rolls",
        order: 15,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledDesert', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubDesertEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryDesertEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerDesertEncounterMacro === 'function') {
                window.triggerDesertEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Desert encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-dungeon-encounter': {
        icon: "fa-solid fa-dungeon",
        name: "bibliosoph-dungeon-encounter",
        title: "Dungeon Encounter",
        zone: "rolls",
        order: 20,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledDungeon', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubDungeonEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryDungeonEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerDungeonEncounterMacro === 'function') {
                window.triggerDungeonEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Dungeon encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-forest-encounter': {
        icon: "fa-solid fa-tree",
        name: "bibliosoph-forest-encounter",
        title: "Forest Encounter",
        zone: "rolls",
        order: 25,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledForest', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubForestEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryForestEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerForestEncounterMacro === 'function') {
                window.triggerForestEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Forest encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-mountain-encounter': {
        icon: "fa-solid fa-mountain",
        name: "bibliosoph-mountain-encounter",
        title: "Mountain Encounter",
        zone: "rolls",
        order: 30,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledMountain', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubMountainEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryMountainEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerMountainEncounterMacro === 'function') {
                window.triggerMountainEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Mountain encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-sky-encounter': {
        icon: "fa-solid fa-cloud",
        name: "bibliosoph-sky-encounter",
        title: "Sky Encounter",
        zone: "rolls",
        order: 35,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledSky', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubSkyEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundrySkyEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerSkyEncounterMacro === 'function') {
                window.triggerSkyEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Sky encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-snow-encounter': {
        icon: "fa-solid fa-snowflake",
        name: "bibliosoph-snow-encounter",
        title: "Snow Encounter",
        zone: "rolls",
        order: 40,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledSnow', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubSnowEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundrySnowEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerSnowEncounterMacro === 'function') {
                window.triggerSnowEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Snow encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-urban-encounter': {
        icon: "fa-solid fa-city",
        name: "bibliosoph-urban-encounter",
        title: "Urban Encounter",
        zone: "rolls",
        order: 45,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledUrban', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubUrbanEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryUrbanEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerUrbanEncounterMacro === 'function') {
                window.triggerUrbanEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Urban encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-water-encounter': {
        icon: "fa-solid fa-water",
        name: "bibliosoph-water-encounter",
        title: "Water Encounter",
        zone: "rolls",
        order: 50,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('encounterEnabledWater', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubWaterEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryWaterEncounterEnabled', false),
        onClick: () => {
            if (typeof window.triggerWaterEncounterMacro === 'function') {
                window.triggerWaterEncounterMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Water encounter function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-quick-encounter': {
        icon: "fa-solid fa-swords",
        name: "bibliosoph-quick-encounter",
        title: "Quick Encounter",
        zone: "rolls",
        order: 0,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,
        enabled: () => getSetting('quickEncounterEnabled', true),
        onCoffeePub: () => getSetting('toolbarCoffeePubQuickEncounterEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryQuickEncounterEnabled', false),
        onClick: () => openEncounterWindow()
    }
};

// Track which tools have been registered to prevent duplicates
let registeredToolIds = new Set();

// Register toolbar tools with Blacksmith
function registerToolbarTools() {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Starting toolbar registration...", "", true, false);
    }
    
    // Get the Blacksmith module API (correct method from documentation)
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    
    // Check if toolbar API is available
    if (!blacksmith?.registerToolbarTool) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Blacksmith toolbar API not available. registerToolbarTool:", blacksmith?.registerToolbarTool ? "YES" : "NO", true, false);
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Available methods on blacksmith API:", Object.keys(blacksmith || {}).join(", "), true, false);
        }
        return;
    }
    
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Blacksmith toolbar API is available", "", true, false);
    }

    let registeredCount = 0;
    let skippedCount = 0;
    
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Processing ${Object.keys(TOOLBAR_TOOLS).length} toolbar tools`, "", true, false);
    }
    
    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Processing tool: ${toolId}`, "", true, false);
        }
        
        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} already registered, skipping`, "", true, false);
            }
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        const isEnabled = toolConfig.enabled ? toolConfig.enabled() : true;
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} enabled check:`, isEnabled ? "ENABLED" : "DISABLED", true, false);
        }
        
        if (toolConfig.enabled && !isEnabled) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} is disabled, skipping`, "", true, false);
            }
            skippedCount++;
            return; // Skip disabled tools
        }

        // Check if tool is already registered in Blacksmith
        const isAlreadyRegistered = blacksmith?.isToolRegistered && blacksmith.isToolRegistered(toolId);
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} already registered in Blacksmith:`, isAlreadyRegistered ? "YES" : "NO", true, false);
        }
        
        if (isAlreadyRegistered) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
        }

        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Registering tool ${toolId}`, `Zone: ${toolConfig.zone}, Order: ${toolConfig.order}`, true, false);
        }

        // Get the specific toolbar settings for this tool from the configuration
        const onCoffeePub = toolConfig.onCoffeePub ? toolConfig.onCoffeePub() : true;
        const onFoundry = toolConfig.onFoundry ? toolConfig.onFoundry() : false;

        // Register the tool
        const success = blacksmith.registerToolbarTool(toolId, {
            icon: toolConfig.icon,
            name: toolConfig.name,
            title: toolConfig.title,
            button: true,           // Required for toolbar display
            visible: true,          // Required for visibility
            zone: toolConfig.zone,
            order: toolConfig.order,
            moduleId: toolConfig.moduleId,
            gmOnly: toolConfig.gmOnly || false,  // Optional: whether tool is GM-only
            leaderOnly: toolConfig.leaderOnly || false,  // Optional: whether tool is leader-only
            onCoffeePub: onCoffeePub,  // Show in Blacksmith toolbar
            onFoundry: onFoundry,  // Show in FoundryVTT toolbar
            onClick: toolConfig.onClick
        });

        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} registration result:`, success ? "SUCCESS" : "FAILED", true, false);
        }

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Successfully registered tool: ${toolId}`, "", true, false);
            }
        } else {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Failed to register tool: ${toolId}`, "", true, false);
            }
        }
    });

    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Registration complete. Registered: ${registeredCount}, Skipped: ${skippedCount}`, "", true, false);
    }
    
    if (registeredCount > 0) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Successfully registered ${registeredCount} toolbar tool(s)`, "", true, false);
        }
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | No tools were registered!", "", true, false);
        }
    }
}

// Unregister all toolbar tools
function unregisterToolbarTools() {
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    if (!blacksmith?.unregisterToolbarTool) {
        return;
    }

    Object.keys(TOOLBAR_TOOLS).forEach(toolId => {
        blacksmith.unregisterToolbarTool(toolId);
    });
    
    // Clear our tracking set
    registeredToolIds.clear();
}

// Open party message dialog directly
function openPartyMessageDialog() {
    // Check if party messaging is enabled
    if (!getSetting('partyMessageEnabled', false)) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Party messaging is not enabled in settings", "", false, false);
        }
        return;
    }

    // Call the global function that handles opening the dialog
    if (typeof window.openPartyMessageDialog === 'function') {
        window.openPartyMessageDialog();
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Party message dialog function not available", "", false, false);
        }
    }
}

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
