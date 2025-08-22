// ================================================================== 
// ===== TEST CONSOLIDATED VALIDATION ===============================
// ================================================================== 
// This script tests the new consolidated validation system
// Run this in the browser console to verify everything is working

console.log("=== BIBLIOSOPH CONSOLIDATED VALIDATION TEST ===");

// Test 1: Check if the validation function exists
if (typeof validateMandatorySettings === 'function') {
    console.log("✅ 1. validateMandatorySettings function found");
} else {
    console.log("❌ 1. validateMandatorySettings function NOT found");
}

// Test 2: Test validation with current settings
console.log("2. Testing validation with current settings:");
try {
    const isValid = validateMandatorySettings();
    console.log(`   - Validation result: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    if (!isValid) {
        console.log("   - This is expected if macros aren't configured yet");
        console.log("   - Check console for detailed list of missing/invalid settings");
    }
} catch (error) {
    console.log("   - Validation test FAILED with error:", error.message);
}

// Test 3: Check what settings are currently configured
console.log("3. Current macro settings:");
const macroSettings = [
    'encounterMacroGeneral', 'encounterMacroCave', 'encounterMacroDesert',
    'encounterMacroDungeon', 'encounterMacroForest', 'encounterMacroMountain',
    'encounterMacroSky', 'encounterMacroSnow', 'encounterMacroUrban',
    'encounterMacroWater', 'investigationMacro', 'giftMacro', 'shadygoodsMacro',
    'criticalMacro', 'fumbleMacro', 'inspirationMacro', 'domtMacro',
    'beverageMacro', 'bioMacro', 'insultsMacro', 'praiseMacro',
    'partyMessageMacro', 'privateMessageMacro', 'injuriesMacroGlobal'
];

macroSettings.forEach(setting => {
    const value = game.settings.get('coffee-pub-bibliosoph', setting);
    const status = value && value !== '-- Choose a Macro --' ? '✅' : '❌';
    console.log(`   ${status} ${setting}: ${value || 'NOT SET'}`);
});

console.log("=== TEST COMPLETE ===");
console.log("If validation shows FAILED, this is normal for a fresh installation.");
console.log("The consolidated notification should appear once, with detailed info in console.");
