// ================================================================== 
// ===== EXPORTS ====================================================
// ================================================================== 


export const MODULE = {
    ID: 'coffee-pub-bibliosoph',
    NAME: 'BIBLIOSOPH',
    TITLE: 'Coffee Pub Bibliosoph',
    AUTHOR: "Coffee Pub"
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
