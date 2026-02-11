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



/** Detection levels 1–5 for Quick Encounter (label, tooltip, narrative for chat card). */
export const DETECTION_LEVELS = [
    { level: 1, label: 'Surprised', tooltip: 'You are caught off guard.', narrative: 'You are caught completely off guard. The danger is already on you before you can react, and the moment to prepare has passed.' },
    { level: 2, label: 'Outmatched Awareness', tooltip: 'You sense danger too late.', narrative: "You sense movement just seconds too late. There's no time to adjust before the encounter closes in." },
    { level: 3, label: 'Mutual Awareness', tooltip: 'Both sides know the other is present.', narrative: "Both sides become aware of each other at nearly the same time. There's a brief, tense pause before anything happens." },
    { level: 4, label: 'Tactical Advantage', tooltip: "You detect them first, but they're not blind.", narrative: 'You spot the encounter before it fully commits. You have a moment to prepare as the situation comes into focus.' },
    { level: 5, label: 'Undetected', tooltip: "You see them. They don't see you.", narrative: 'You observe the encounter without being seen. The situation is entirely in your control.' }
];

export function getDetectionLevelInfo(level) {
    const v = Math.max(1, Math.min(5, Number(level) || 3));
    return DETECTION_LEVELS[v - 1] ?? DETECTION_LEVELS[2];
}

export const BIBLIOSOPH = {
    DEBUGON: true,
    //ID: MODULE.ID,
    MESSAGE_TEMPLATE_CARD: `modules/${MODULE.ID}/templates/chat-card.hbs`,
    INVESTIGATION_NARRATIVE_PATH: `modules/${MODULE.ID}/resources/investigation-narrative.json`,
    ENCOUNTER_NARRATIVE_PATH: `modules/${MODULE.ID}/resources/encounters-narrative.json`,
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
