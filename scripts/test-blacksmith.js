// ================================================================== 
// ===== BLACKSMITH API TEST SCRIPT =================================
// ================================================================== 
// This script tests the Blacksmith API integration
// Run this in the browser console to verify everything is working

console.log("=== BIBLIOSOPH BLACKSMITH API TEST ===");

// Test 1: Check if Blacksmith module is available
const blacksmithModule = game.modules.get('coffee-pub-blacksmith');
console.log("1. Blacksmith module found:", blacksmithModule ? "YES" : "NO");

if (blacksmithModule) {
    console.log("   - Active:", blacksmithModule.active);
    console.log("   - Version:", blacksmithModule.version);
}

// Test 2: Check if Blacksmith API is accessible
const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
console.log("2. Blacksmith API accessible:", blacksmith ? "YES" : "NO");

if (blacksmith) {
    console.log("   - API object:", blacksmith);
    
    // Test 3: Check if utility functions are available
    console.log("3. Testing utility functions:");
    console.log("   - postConsoleAndNotification:", typeof blacksmith.utils.postConsoleAndNotification);
    console.log("   - getSettingSafely:", typeof blacksmith.utils.getSettingSafely);
    console.log("   - playSound:", typeof blacksmith.utils.playSound);
    console.log("   - getActorId:", typeof blacksmith.utils.getActorId);
    
    // Test 4: Check if BLACKSMITH object is available
    console.log("4. BLACKSMITH object available:", blacksmith.BLACKSMITH ? "YES" : "NO");
    
    if (blacksmith.BLACKSMITH) {
        console.log("   - Choice arrays:");
        console.log("     * Themes:", blacksmith.BLACKSMITH.arrThemeChoices?.length || 0, "items");
        console.log("     * Sounds:", blacksmith.BLACKSMITH.arrSoundChoices?.length || 0, "items");
        console.log("     * Tables:", blacksmith.BLACKSMITH.arrTableChoices?.length || 0, "items");
        console.log("     * Macros:", blacksmith.BLACKSMITH.arrMacroChoices?.length || 0, "items");
    }
    
    // Test 5: Test safe settings access
    console.log("5. Testing safe settings access:");
    try {
        const testSetting = blacksmith.utils.getSettingSafely('coffee-pub-bibliosoph', 'testSetting', 'DEFAULT_VALUE');
        console.log("   - Safe setting test:", testSetting);
        console.log("   - Result: SUCCESS");
    } catch (error) {
        console.log("   - Safe setting test: FAILED -", error.message);
    }
    
    // Test 6: Test console logging
    console.log("6. Testing console logging:");
    try {
        blacksmith.utils.postConsoleAndNotification("BIBLIOSOPH", "Test message from Blacksmith API", "Test data", false, false);
        console.log("   - Console logging: SUCCESS");
    } catch (error) {
        console.log("   - Console logging: FAILED -", error.message);
    }
    
} else {
    console.log("   - ERROR: Blacksmith API not accessible");
}

// Test 7: Check if module is registered
console.log("7. Module registration status:");
if (blacksmith && blacksmith.isModuleActive) {
    const isRegistered = blacksmith.isModuleActive('coffee-pub-bibliosoph');
    console.log("   - BIBLIOSOPH registered:", isRegistered ? "YES" : "NO");
} else {
    console.log("   - Cannot check registration - API incomplete");
}

console.log("=== TEST COMPLETE ===");
console.log("If all tests pass, your Blacksmith API integration is working correctly!");
console.log("If any tests fail, check the console for error messages and ensure Blacksmith is properly installed and active.");
