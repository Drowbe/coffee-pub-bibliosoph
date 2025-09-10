// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { BIBLIOSOPH } from './const.js';
import { BiblioWindowChat } from './window.js';

// Helper function to safely get Blacksmith API
function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api;
}

// Helper function to get setting value
function getSetting(key, defaultValue) {
    try {
        const value = game.settings.get('coffee-pub-bibliosoph', key) ?? defaultValue;
        // Debug: Log the setting value
        console.log(`BIBLIOSOPH DEBUG: Setting ${key} = ${value}`);
        return value;
    } catch (error) {
        // Setting not registered yet, return default
        console.log(`BIBLIOSOPH DEBUG: Setting ${key} not registered yet, using default: ${defaultValue}`);
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
    }
    // Future tools can be added here:
    // 'bibliosoph-private-message': { ... },
    // 'bibliosoph-encounter': { ... },
    // etc.
};

// Track which tools have been registered to prevent duplicates
let registeredToolIds = new Set();

// Register toolbar tools with Blacksmith
function registerToolbarTools() {
    console.log("BIBLIOSOPH DEBUG: registerToolbarTools function started");
    
    const blacksmith = getBlacksmith();
    console.log("BIBLIOSOPH DEBUG: blacksmith object:", blacksmith);
    console.log("BIBLIOSOPH DEBUG: blacksmith keys:", Object.keys(blacksmith));
    
    // Try different possible API paths
    console.log("BIBLIOSOPH DEBUG: blacksmith.api:", blacksmith?.api);
    console.log("BIBLIOSOPH DEBUG: blacksmith.registerToolbarTool:", blacksmith?.registerToolbarTool);
    console.log("BIBLIOSOPH DEBUG: blacksmith.toolbar:", blacksmith?.toolbar);
    
    // Check if toolbar API is available
    if (!blacksmith?.registerToolbarTool) {
        console.log("BIBLIOSOPH DEBUG: Blacksmith toolbar API not available");
        console.log("BIBLIOSOPH DEBUG: registerToolbarTool exists:", !!blacksmith?.registerToolbarTool);
        // Don't spam console with "API not available" messages
        return;
    }
    
    console.log("BIBLIOSOPH DEBUG: Blacksmith toolbar API is available, proceeding with registration");

    let registeredCount = 0;
    let skippedCount = 0;
    
    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        if (toolConfig.enabled) {
            const isEnabled = toolConfig.enabled();
            console.log(`BIBLIOSOPH DEBUG: Tool ${toolId} enabled check = ${isEnabled}`);
            if (!isEnabled) {
                getBlacksmith()?.utils?.postConsoleAndNotification("BIBLIOSOPH", `Tool ${toolId} is disabled in settings`, "", false, false);
                skippedCount++;
                return; // Skip disabled tools
            }
        }

        // Check if tool is already registered in Blacksmith
        if (blacksmith.isToolRegistered && blacksmith.isToolRegistered(toolId)) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
        }

        // Register the tool
        console.log(`BIBLIOSOPH DEBUG: Attempting to register tool ${toolId} with data:`, {
            icon: toolConfig.icon,
            name: toolConfig.name,
            title: toolConfig.title,
            button: true,
            visible: true,
            zone: toolConfig.zone,
            order: toolConfig.order,
            moduleId: toolConfig.moduleId,
            onClick: typeof toolConfig.onClick
        });
        
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

        console.log(`BIBLIOSOPH DEBUG: Registration result for ${toolId}:`, success);

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
            console.log(`BIBLIOSOPH DEBUG: Successfully registered ${toolId}`);
        } else {
            getBlacksmith()?.utils?.postConsoleAndNotification("BIBLIOSOPH", `Failed to register toolbar tool: ${toolId}`, "", false, false);
            console.log(`BIBLIOSOPH DEBUG: Failed to register ${toolId}`);
        }
    });

    // Debug: Always show what happened
    getBlacksmith()?.utils?.postConsoleAndNotification("BIBLIOSOPH", `Toolbar registration: ${registeredCount} registered, ${skippedCount} skipped`, "", false, false);
    
    // Debug: Check what tools are actually registered
    if (blacksmith.getRegisteredTools) {
        const allTools = blacksmith.getRegisteredTools();
        console.log("BIBLIOSOPH DEBUG: All registered tools:", allTools);
        console.log("BIBLIOSOPH DEBUG: Our tool exists:", blacksmith.isToolRegistered('bibliosoph-party-message'));
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
        getBlacksmith()?.utils?.postConsoleAndNotification("BIBLIOSOPH", "Party messaging is not enabled in settings", "", false, false);
        return;
    }

    // Call the global function that handles opening the dialog
    if (typeof window.openPartyMessageDialog === 'function') {
        window.openPartyMessageDialog();
    } else {
        getBlacksmith()?.utils?.postConsoleAndNotification("BIBLIOSOPH", "Party message dialog function not available", "", false, false);
    }
}

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
