// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { MODULE, BIBLIOSOPH  } from './const.js';
import { BiblioWindowChat } from './window.js';
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
        onClick: () => {
            // Call the global function that handles opening the dialog
            if (typeof window.openPrivateMessageDialog === 'function') {
                window.openPrivateMessageDialog();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Private message dialog function not available", "", false, false);
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
        onClick: () => {
            // Call the global function that handles investigation
            if (typeof window.triggerInvestigationMacro === 'function') {
                window.triggerInvestigationMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Investigation function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-critical': {
        icon: "fas fa-burst",
        name: "bibliosoph-critical",
        title: "Critical Hit",
        zone: "rolls",
        order: 10,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('criticalEnabled', false),
        onClick: () => {
            // Call the global function that handles critical hit
            if (typeof window.triggerCriticalMacro === 'function') {
                window.triggerCriticalMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Critical hit function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-fumble': {
        icon: "fas fa-heart-crack",
        name: "bibliosoph-fumble",
        title: "Fumble",
        zone: "rolls",
        order: 15,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('fumbleEnabled', false),
        onClick: () => {
            // Call the global function that handles fumble
            if (typeof window.triggerFumbleMacro === 'function') {
                window.triggerFumbleMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Fumble function not available", "", false, false);
                }
            }
        }
    },
    'bibliosoph-injuries': {
        icon: "fas fa-bandage",
        name: "bibliosoph-injuries",
        title: "Injuries",
        zone: "rolls",
        order: 20,
        moduleId: "coffee-pub-bibliosoph",
        gmOnly: true,  // Only GMs can see this tool
        enabled: () => getSetting('injuriesEnabledGlobal', false),
        onClick: () => {
            // Call the global function that handles injuries
            if (typeof window.triggerInjuriesMacro === 'function') {
                window.triggerInjuriesMacro();
            } else {
                if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Injuries function not available", "", false, false);
                }
            }
        }
    }
};

// Track which tools have been registered to prevent duplicates
let registeredToolIds = new Set();

// Register toolbar tools with Blacksmith
function registerToolbarTools() {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Starting toolbar registration...", "", true, false);
    }
    
    // Get the Blacksmith module API (correct method from documentation)
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    
    // Check if toolbar API is available
    if (!blacksmith?.registerToolbarTool) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Blacksmith toolbar API not available. registerToolbarTool:", blacksmith?.registerToolbarTool ? "YES" : "NO", true, false);
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Available methods on blacksmith API:", Object.keys(blacksmith || {}).join(", "), true, false);
        }
        return;
    }
    
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Blacksmith toolbar API is available", "", true, false);
    }

    let registeredCount = 0;
    let skippedCount = 0;
    
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Processing ${Object.keys(TOOLBAR_TOOLS).length} toolbar tools`, "", true, false);
    }
    
    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Processing tool: ${toolId}`, "", true, false);
        }
        
        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} already registered, skipping`, "", true, false);
            }
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        const isEnabled = toolConfig.enabled ? toolConfig.enabled() : true;
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} enabled check:`, isEnabled ? "ENABLED" : "DISABLED", true, false);
        }
        
        if (toolConfig.enabled && !isEnabled) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} is disabled, skipping`, "", true, false);
            }
            skippedCount++;
            return; // Skip disabled tools
        }

        // Check if tool is already registered in Blacksmith
        const isAlreadyRegistered = blacksmith?.isToolRegistered && blacksmith.isToolRegistered(toolId);
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} already registered in Blacksmith:`, isAlreadyRegistered ? "YES" : "NO", true, false);
        }
        
        if (isAlreadyRegistered) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
        }

        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Registering tool ${toolId}`, `Zone: ${toolConfig.zone}, Order: ${toolConfig.order}`, true, false);
        }

        // Get the specific toolbar settings for this tool
        let onCoffeePub = true;
        let onFoundry = false;
        
        if (toolId === 'bibliosoph-party-message') {
            onCoffeePub = getSetting('toolbarCoffeePubPartyMessageEnabled', true);
            onFoundry = getSetting('toolbarFoundryPartyMessageEnabled', false);
        } else if (toolId === 'bibliosoph-private-message') {
            onCoffeePub = getSetting('toolbarCoffeePubPrivateMessageEnabled', true);
            onFoundry = getSetting('toolbarFoundryPrivateMessageEnabled', false);
        } else if (toolId === 'bibliosoph-investigation') {
            onCoffeePub = getSetting('toolbarCoffeePubInvestigationEnabled', true);
            onFoundry = getSetting('toolbarFoundryInvestigationEnabled', false);
        } else if (toolId === 'bibliosoph-critical') {
            onCoffeePub = getSetting('toolbarCoffeePubCriticalEnabled', true);
            onFoundry = getSetting('toolbarFoundryCriticalEnabled', false);
        } else if (toolId === 'bibliosoph-fumble') {
            onCoffeePub = getSetting('toolbarCoffeePubFumbleEnabled', true);
            onFoundry = getSetting('toolbarFoundryFumbleEnabled', false);
        } else if (toolId === 'bibliosoph-injuries') {
            onCoffeePub = getSetting('toolbarCoffeePubInjuriesEnabled', true);
            onFoundry = getSetting('toolbarFoundryInjuriesEnabled', false);
        }

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
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} registration result:`, success ? "SUCCESS" : "FAILED", true, false);
        }

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Successfully registered tool: ${toolId}`, "", true, false);
            }
        } else {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Failed to register tool: ${toolId}`, "", true, false);
            }
        }
    });

    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Registration complete. Registered: ${registeredCount}, Skipped: ${skippedCount}`, "", true, false);
    }
    
    if (registeredCount > 0) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Successfully registered ${registeredCount} toolbar tool(s)`, "", true, false);
        }
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "TOOLBAR | No tools were registered!", "", true, false);
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
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Party messaging is not enabled in settings", "", false, false);
        }
        return;
    }

    // Call the global function that handles opening the dialog
    if (typeof window.openPartyMessageDialog === 'function') {
        window.openPartyMessageDialog();
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.ID, "Party message dialog function not available", "", false, false);
        }
    }
}

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
