// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { MODULE, BIBLIOSOPH  } from './const.js';
import { BiblioWindowChat } from './window.js';

// Helper function to safely get Blacksmith API
function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api;
}

// Helper function to get setting value using Blacksmith API
function getSetting(key, defaultValue) {
    const blacksmith = getBlacksmith();
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
                getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Private message dialog function not available", "", false, false);
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
                getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Investigation function not available", "", false, false);
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
                getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Critical hit function not available", "", false, false);
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
                getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Fumble function not available", "", false, false);
            }
        }
    }
};

// Track which tools have been registered to prevent duplicates
let registeredToolIds = new Set();

// Register toolbar tools with Blacksmith
function registerToolbarTools() {
    const blacksmith = getBlacksmith();
    
    // Check if toolbar API is available
    if (!blacksmith?.registerToolbarTool) {
        // Don't spam console with "API not available" messages
        return;
    }

    let registeredCount = 0;
    let skippedCount = 0;
    
    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        if (toolConfig.enabled && !toolConfig.enabled()) {
            skippedCount++;
            return; // Skip disabled tools
        }

        // Check if tool is already registered in Blacksmith
        if (blacksmith.isToolRegistered && blacksmith.isToolRegistered(toolId)) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
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
            onClick: toolConfig.onClick
        });

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
        } else {
            getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, `Failed to register toolbar tool: ${toolId}`, "", false, false);
        }
    });

    if (registeredCount > 0) {
        getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, `Registered ${registeredCount} toolbar tool(s)`, "", false, false);
    }
}

// Unregister all toolbar tools
function unregisterToolbarTools() {
    const blacksmith = getBlacksmith();
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
        getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Party messaging is not enabled in settings", "", false, false);
        return;
    }

    // Call the global function that handles opening the dialog
    if (typeof window.openPartyMessageDialog === 'function') {
        window.openPartyMessageDialog();
    } else {
        getBlacksmith()?.utils?.postConsoleAndNotification(MODULE.ID, "Party message dialog function not available", "", false, false);
    }
}

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
