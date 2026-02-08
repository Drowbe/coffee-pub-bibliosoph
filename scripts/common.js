// ================================================================== 
// ===== COMMON =====================================================
// ================================================================== 
//
// Put any functions or reusable code here for use in THIS module.
// This code is not shareable with other modules.
//
// Any SHARED code goes in "GLOBAL"... and each module shoudl get
// the exact same code set in it.
//
// ================================================================== 

/**
 * Log to console and optionally show notification. Uses Blacksmith when available.
 * @param {string} moduleName - e.g. MODULE.NAME
 * @param {string} msg - Short message
 * @param {string} [detail=''] - Detail/second line
 * @param {boolean} [showConsole=true] - Log to console
 * @param {boolean} [showNotification=false] - Show UI notification
 */
export function postConsoleAndNotification(moduleName, msg, detail = '', showConsole = true, showNotification = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(moduleName, msg, detail, showConsole, showNotification);
    } else {
        console.log(moduleName, msg, detail !== '' ? detail : '');
    }
}