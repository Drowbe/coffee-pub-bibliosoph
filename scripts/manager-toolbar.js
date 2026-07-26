// ================================================================== 
// ===== TOOLBAR MANAGER ============================================
// ================================================================== 

// Import required dependencies
import { MODULE, BIBLIOSOPH } from './const.js';
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
    'bibliosoph-messages': {
        icon: "fa-solid fa-comments",
        name: "bibliosoph-messages",
        title: "Messages",
        zone: "communication",
        order: 1,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('messagesEnabled', true),
        onCoffeePub: () => getSetting('toolbarCoffeePubMessagesEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryMessagesEnabled', true),
        onClick: async () => {
            // Prefer the Blacksmith window registry; fall back to a direct open
            const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
            if (blacksmith?.openWindow && blacksmith.isWindowRegistered?.('bibliosoph-messages')) {
                return blacksmith.openWindow('bibliosoph-messages');
            }
            const { openMessagesWindow } = await import('./window-messages.js');
            return openMessagesWindow();
        }
    },
    'bibliosoph-investigation': {
        icon: "fa-solid fa-search",
        name: "bibliosoph-investigation",
        title: "Investigation",
        zone: "rolls",
        order: 1,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('investigationEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInvestigationEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInvestigationEnabled', false),
        onClick: () => {
            // Call the global function that handles investigation
            if (typeof window.triggerInvestigationMacro === 'function') {
                window.triggerInvestigationMacro();
            } else {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Investigation function not available", "", false, false);
            }
        }
    },
    'bibliosoph-critical': {
        icon: "fa-solid fa-burst",
        name: "bibliosoph-critical",
        title: "Critical Hit",
        zone: "rolls",
        order: 2,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('criticalToolbar', 'coffeepub') !== 'none',
        onCoffeePub: () => ['coffeepub', 'both'].includes(getSetting('criticalToolbar', 'coffeepub')),
        onFoundry: () => ['foundry', 'both'].includes(getSetting('criticalToolbar', 'coffeepub')),
        onClick: () => {
            // Manual roll of the critical table (same path as click-to-roll)
            if (typeof window.triggerCriticalRoll === 'function') {
                window.triggerCriticalRoll();
            } else {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Critical hit function not available", "", false, false);
            }
        }
    },
    'bibliosoph-fumble': {
        icon: "fa-solid fa-heart-crack",
        name: "bibliosoph-fumble",
        title: "Fumble",
        zone: "rolls",
        order: 3,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('fumbleToolbar', 'coffeepub') !== 'none',
        onCoffeePub: () => ['coffeepub', 'both'].includes(getSetting('fumbleToolbar', 'coffeepub')),
        onFoundry: () => ['foundry', 'both'].includes(getSetting('fumbleToolbar', 'coffeepub')),
        onClick: () => {
            // Manual roll of the fumble table (same path as click-to-roll)
            if (typeof window.triggerFumbleRoll === 'function') {
                window.triggerFumbleRoll();
            } else {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Fumble function not available", "", false, false);
            }
        }
    },
    'bibliosoph-injuries': {
        icon: "fa-solid fa-bandage",
        name: "bibliosoph-injuries",
        title: "Injuries",
        zone: "rolls",
        order: 4,
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
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Injuries function not available", "", false, false);
            }
        }
    },
    'bibliosoph-inspiration': {
        icon: "fa-solid fa-lightbulb",
        name: "bibliosoph-inspiration",
        title: "Inspiration",
        zone: "rolls",
        order: 7,
        moduleId: "coffee-pub-bibliosoph",
        enabled: () => getSetting('inspirationEnabled', false),
        onCoffeePub: () => getSetting('toolbarCoffeePubInspirationEnabled', true),
        onFoundry: () => getSetting('toolbarFoundryInspirationEnabled', false),
        onClick: () => {
            if (typeof window.triggerInspirationMacro === 'function') {
                window.triggerInspirationMacro();
            } else {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "Inspiration function not available", "", false, false);
            }
        }
    },
    'bibliosoph-quick-encounter': {
        icon: "fa-solid fa-swords",
        name: "bibliosoph-quick-encounter",
        title: "Quick Encounter",
        zone: "gmtools",
        order: 1,
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
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Starting toolbar registration...", "", true, false);

    // Get the Blacksmith module API (correct method from documentation)
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    
    // Check if toolbar API is available
    if (!blacksmith?.registerToolbarTool) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Blacksmith toolbar API not available. registerToolbarTool:", blacksmith?.registerToolbarTool ? "YES" : "NO", true, false);
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Available methods on blacksmith API:", Object.keys(blacksmith || {}).join(", "), true, false);
        return;
    }

    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | Blacksmith toolbar API is available", "", true, false);

    let registeredCount = 0;
    let skippedCount = 0;
    
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Processing ${Object.keys(TOOLBAR_TOOLS).length} toolbar tools`, "", true, false);

    Object.entries(TOOLBAR_TOOLS).forEach(([toolId, toolConfig]) => {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Processing tool: ${toolId}`, "", true, false);

        // Skip if already registered
        if (registeredToolIds.has(toolId)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} already registered, skipping`, "", true, false);
            skippedCount++;
            return;
        }

        // Check if tool should be enabled
        const isEnabled = toolConfig.enabled ? toolConfig.enabled() : true;
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} enabled check:`, isEnabled ? "ENABLED" : "DISABLED", true, false);

        if (toolConfig.enabled && !isEnabled) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} is disabled, skipping`, "", true, false);
            skippedCount++;
            return; // Skip disabled tools
        }

        // Check if tool is already registered in Blacksmith
        const isAlreadyRegistered = blacksmith?.isToolRegistered && blacksmith.isToolRegistered(toolId);
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} already registered in Blacksmith:`, isAlreadyRegistered ? "YES" : "NO", true, false);

        if (isAlreadyRegistered) {
            registeredToolIds.add(toolId);
            skippedCount++;
            return;
        }

        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Registering tool ${toolId}`, `Zone: ${toolConfig.zone}, Order: ${toolConfig.order}`, true, false);

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

        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Tool ${toolId} registration result:`, success ? "SUCCESS" : "FAILED", true, false);

        if (success) {
            registeredToolIds.add(toolId);
            registeredCount++;
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Successfully registered tool: ${toolId}`, "", true, false);
        } else {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Failed to register tool: ${toolId}`, "", true, false);
        }
    });

    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Registration complete. Registered: ${registeredCount}, Skipped: ${skippedCount}`, "", true, false);

    if (registeredCount > 0) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `TOOLBAR | Successfully registered ${registeredCount} toolbar tool(s)`, "", true, false);
    } else {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, "TOOLBAR | No tools were registered!", "", true, false);
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

// Export functions for use in main module
export { registerToolbarTools, unregisterToolbarTools };
