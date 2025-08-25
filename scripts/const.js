// ================================================================== 
// ===== EXTRACTIONS ================================================
// ================================================================== 

// Get Module Data
export async function getModuleJson(relative = "../module.json") {
    const url = new URL(relative, import.meta.url).href; // resolves relative to THIS file
    // return await foundry.utils.fetchJsonWithTimeout(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.json();
}
const moduleData = await getModuleJson();
/**
 * Extracts the last segment of a module id and uppercases it.
 * Example: "coffee-pub-blacksmith" -> "BLACKSMITH"
 */
function getModuleCodeName(moduleId) {
    if (!moduleId || typeof moduleId !== "string") return "";
    const parts = moduleId.split("-");
    return parts.at(-1)?.toUpperCase() ?? "";
}
const strName = getModuleCodeName(moduleData.id);
// Post the data
console.log(moduleData.title, `Module ID: `, moduleData.id);
console.log(moduleData.title, `Module Name: `, strName);
console.log(moduleData.title, `Module Title: `, moduleData.title);
console.log(moduleData.title, `Module Version: `, moduleData.version);
console.log(moduleData.title, `Module Author: `, moduleData.authors[0]?.name);
console.log(moduleData.title, `Module Description: `, moduleData.description);

// ================================================================== 
// ===== EXPORTS ====================================================
// ================================================================== 

// MODULE CONSTANTS
export const MODULE = {
    ID: moduleData.id, 
    NAME: strName, // Extracted from moduleData.title
    TITLE: moduleData.title,
    VERSION: moduleData.version, 
    AUTHOR: moduleData.authors[0]?.name || 'COFFEE PUB',
    DESCRIPTION: moduleData.description,
};



export const BIBLIOSOPH = {
    DEBUGON: true,
    //ID: MODULE.ID,
    MESSAGE_TEMPLATE_CARD: `modules/${MODULE.ID}/templates/chat-card.hbs`,
    WINDOW_CHAT_TEMPLATE: `modules/${MODULE.ID}/templates/dialogue-messages.hbs`,
    PATH_SOUND:`modules/${MODULE.ID}/sounds/`,
    PATH_IMAGES:`modules/${MODULE.ID}/images/`,
    PORTRAIT_NOIMAGE:`modules/${MODULE.ID}/images/portrait-noimage.webp`,
    CARDTYPE: "",
    CARDTYPEENCOUNTER: false,
    CARDTYPEINJURY: false,
    CARDTYPEINVESTIGATION: false,
    CARDTYPEGIFT: false,
    CARDTYPESHADYGOODS: false,
    CARDTYPECRIT: false,
    CARDTYPEFUMBLE: false,
    CARDTYPEBIO: false,
    CARDTYPEBEVERAGE: false,
    CARDTYPEINSULT: false,
    CARDTYPEPRAISE: false,
    CARDTYPEINSPIRATION: false,
    CARDTYPEDOMT: false,
    CARDTYPEMESSAGE: false,
    CARDTYPEWHISPER: false,
    MESSAGES_TITLE: "Message",
    MESSAGES_CONTENT: "",
    MESSAGES_FORMTITLE: "Title",
    MESSAGES_LIST_TO_PRIVATE: "",
    MACRO_ID: "",
    CHAT_TYPE_WHISPER: "WHISPER",
    CHAT_TYPE_OTHER: "OTHER",
}
