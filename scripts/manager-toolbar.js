// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { MODULE, BIBLIOSOPH  } from './const.js';
import { BiblioWindowChat } from './window.js';

// Helper function to get setting value using Blacksmith API
function getSetting(key, defaultValue) {
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    if (blacksmith?.utils?.getSettingSafely) {
        return blacksmith.utils.getSettingSafely(MODULE.ID, key, defaultValue);
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
                const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
                blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Private message dialog function not available", "", false, false);
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
                const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
                blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Investigation function not available", "", false, false);
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
                const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
                blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Critical hit function not available", "", false, false);
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
                const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
                blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Fumble function not available", "", false, false);
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
                const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
                blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Injuries function not available", "", false, false);
            }
        }
    }
};

// Track which tools have been registered to prevent duplicates
let registeredToolIds = new Set();

// Register toolbar tools with Blacksmith
function registerToolbarTools() {
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Starting toolbar registration...", "", true, false);
    
    // Check if toolbar API is available (following the official documentation pattern)
    if (!blacksmith?.registerToolbarTool) {
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Blacksmith toolbar API not available. registerToolbarTool:", blacksmith?.registerToolbarTool ? "YES" : "NO", true, false);
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Available methods on blacksmith API:", Object.keys(blacksmith || {}).join(", "), true, false);
        return;
    }
    
    blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "TOOLBAR | Blacksmith toolbar API is available", "", true, false);

    let registeredCount = 0;
    let skippedCount = 0;
    
    blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Processing ${Object.keys(TOOLBAR_TOOLS).length} toolbar tools`, "", true, false);
    
    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Processing tool: ${toolId}`, "", true, false);
        
        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} already registered, skipping`, "", true, false);
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        const isEnabled = toolConfig.enabled ? toolConfig.enabled() : true;
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} enabled check:`, isEnabled ? "ENABLED" : "DISABLED", true, false);
        
        if (toolConfig.enabled && !isEnabled) {
            blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} is disabled, skipping`, "", true, false);
            skippedCount++;
            return; // Skip disabled tools
        }

        // Check if tool is already registered in Blacksmith
        const isAlreadyRegistered = blacksmith.isToolRegistered && blacksmith.isToolRegistered(toolId);
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} already registered in Blacksmith:`, isAlreadyRegistered ? "YES" : "NO", true, false);
        
        if (isAlreadyRegistered) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
        }

        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Registering tool ${toolId}`, `Zone: ${toolConfig.zone}, Order: ${toolConfig.order}`, true, false);

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
            onClick: toolConfig.onClick
        });

        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Tool ${toolId} registration result:`, success ? "SUCCESS" : "FAILED", true, false);

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
            blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Successfully registered tool: ${toolId}`, "", true, false);
        } else {
            blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Failed to register tool: ${toolId}`, "", true, false);
        }
    });

    blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Registration complete. Registered: ${registeredCount}, Skipped: ${skippedCount}`, "", true, false);
    
    if (registeredCount > 0) {
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, `TOOLBAR | Successfully registered ${registeredCount} toolbar tool(s)`, "", true, false);
    } else {
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "TOOLBAR | No tools were registered!", "", true, false);
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
        const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Party messaging is not enabled in settings", "", false, false);
        return;
    }

    // Call the global function that handles opening the dialog
    if (typeof window.openPartyMessageDialog === 'function') {
        window.openPartyMessageDialog();
    } else {
        const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
        blacksmith?.utils?.postConsoleAndNotification(MODULE.ID, "Party message dialog function not available", "", false, false);
    }
}

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
