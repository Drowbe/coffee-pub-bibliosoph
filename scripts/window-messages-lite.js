// ==================================================================
// ===== MESSAGES LITE POPOUT (window-messages-lite.js) =============
// ==================================================================
// One conversation, a message box, and nothing else.
//
// The full Messages window is a workspace: a tray of every conversation,
// a member picker, tone stamps, reactions, export, purge. That is the
// right shape when you are managing conversations and the wrong shape
// when you are simply in one, mid-session, with a map to run.
//
// So: hover a conversation in the tray, click the popout icon, and the
// thread opens in a Tool window (BlacksmithToolWindowBaseV2) that follows
// the user's Light/Dark/Glass choice and sits over the canvas.
//
// Popouts stack — one per conversation, each with its own remembered
// position and theme — and coexist with the full window. Every open
// surface registers with ConversationManager, which is how live updates
// reach all of them.
//
// Everything the thread can DO — send, drop a document, paste an image,
// right-click a message, edit, reply, escalate to Foundry chat — comes
// from the shared thread mixin, so this file is only the wrapper.
// ==================================================================

import { MODULE } from './const.js';
import { ConversationManager } from './manager-conversations.js';
import { ThreadBehavior, toast } from './mixin-messages-thread.js';

const APP_ID = `${MODULE.ID}-messages-lite`;
const BODY_TEMPLATE = `modules/${MODULE.ID}/templates/window-messages-lite.hbs`;

function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api ?? null;
}

const BlacksmithToolWindowBaseV2 = getBlacksmith()?.BlacksmithToolWindowBaseV2
    || getBlacksmith()?.getToolWindowBaseV2?.();

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `MESSAGES LITE | ${message}`, data, debug, notify);
    }
}

const renderTemplateFn = (...args) => {
    const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    return fn(...args);
};

if (!BlacksmithToolWindowBaseV2) {
    log('BlacksmithToolWindowBaseV2 unavailable — the messages popout cannot open', '', false, false);
}

/**
 * A conversation id turned into something safe to use as an element id.
 * Foundry ids are alphanumeric, but a `virtual:<userId>` row carries a colon,
 * which breaks any unescaped `querySelector` built from it.
 */
function appIdFor(conversationId) {
    const slug = String(conversationId ?? 'none').replace(/[^a-zA-Z0-9]+/g, '-');
    return `${APP_ID}-${slug}`;
}

/**
 * Open (or focus) the lite popout for one conversation.
 *
 * Popouts stack: one per conversation, each its own window. Asking for a
 * conversation that already has a popout brings that one forward rather than
 * building a second. Because each gets a distinct application id, each also
 * remembers its own position and tool theme.
 */
export async function openMessagesLite(options = {}) {
    if (!BlacksmithToolWindowBaseV2) {
        toast('Popout unavailable', 'Blacksmith’s tool window base did not load.', 'fa-solid fa-triangle-exclamation');
        return null;
    }

    const conversationId = options.conversationId ?? null;
    if (!conversationId) {
        toast('No conversation', 'A popout needs a conversation to show.', 'fa-solid fa-comment-slash');
        return null;
    }

    const existing = MessagesLiteWindow.findFor(conversationId);
    if (existing?.rendered) return existing.render(true);

    const win = new MessagesLiteWindow({ ...options, id: appIdFor(conversationId) });
    return win.render(true);
}

/** Close every open popout. Used when the module is torn down. */
export async function closeAllMessagesLite() {
    for (const win of [...MessagesLiteWindow.instances]) {
        if (win?.rendered) await win.close();
    }
}

export class MessagesLiteWindow extends ThreadBehavior(BlacksmithToolWindowBaseV2 ?? Object) {

    /**
     * Every live popout. A Set rather than a Map keyed by conversation, because
     * a popout pinned to a virtual 1:1 changes its own conversation id the
     * moment that conversation is created — a key would go stale underneath it.
     */
    static instances = new Set();

    /**
     * The open popout for a conversation, if there is one. Matches on the
     * canonical id so a popout opened as `virtual:<userId>` is still found by
     * the real conversation id once its first message created it.
     */
    static findFor(conversationId) {
        const canonical = ConversationManager._canonicalFavoriteId(conversationId);
        for (const win of this.instances) {
            if (!win?.rendered) continue;
            const id = win._activeConversationId;
            if (id === conversationId) return win;
            if (ConversationManager._canonicalFavoriteId(id) === canonical) return win;
        }
        return null;
    }

    /** The popout is a reading-and-writing surface, not a reacting one. */
    static SUPPORTS_REACTIONS = false;

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}),
        {
            id: APP_ID,
            classes: ['bibliosoph-messages-lite'],
            position: { width: 380, height: 520 },
            window: { title: 'Messages', resizable: true, minimizable: true },
            // Popping out of a dark window into a light one is jarring, so the
            // popout starts dark. The user's own choice is remembered after that.
            toolTheme: 'dark',
            windowSizeConstraints: { minWidth: 280, minHeight: 260 }
        }
    );

    static PARTS = {
        body: { template: 'modules/coffee-pub-blacksmith/templates/window-tool-template.hbs' }
    };

    /**
     * ENTER always sends here, regardless of the shared ENTER-sends preference
     * the full window writes. The popout has no send button and no action bar
     * to put a toggle on, so honouring a disabled preference would leave a
     * window you can type into but never send from.
     */
    get _enterSends() {
        return true;
    }

    set _enterSends(_value) { /* not configurable from the popout */ }

    constructor(options = {}) {
        super(options);
        /**
         * The pinned conversation. Deliberately a plain field rather than a
         * `#private` one: the `title` getter below reads it, and Foundry may
         * ask an application for its title at points where a private field
         * would still be in its temporal dead zone and throw.
         */
        this._pinnedConversationId = options.conversationId ?? null;
        this._tone = 'message';
        this._draft = '';
        this._editing = null;
        MessagesLiteWindow.instances.add(this);
    }

    /**
     * A popout is scoped to ONE conversation for its whole life, so the setter
     * refuses to be steered elsewhere — notably by ConversationManager's
     * "a conversation you created just arrived" hook, which writes
     * `_activeConversationId` straight onto whatever window is open. The single
     * legitimate change is a virtual 1:1 being promoted to a real journal entry
     * when its first message is sent.
     */
    get _activeConversationId() {
        return this._pinnedConversationId ?? null;
    }

    set _activeConversationId(value) {
        const pinned = this._pinnedConversationId;
        const isVirtual = typeof pinned === 'string' && pinned.startsWith('virtual:');
        if (pinned && !isVirtual) return;   // pinned for life
        this._pinnedConversationId = value;
    }

    /** Used by ConversationManager to decide between re-render and notification. */
    get activeConversationId() {
        return this._activeConversationId;
    }

    /** The window title tracks the conversation, like the full window's header. */
    get title() {
        const entry = game.journal.get(this._activeConversationId);
        if (entry) return this._conversationDisplayName(entry);
        const virtualUser = this._virtualUserId ? game.users.get(this._virtualUserId) : null;
        return virtualUser?.name ?? 'Messages';
    }

    /**
     * A star in the compact title bar. Favouriting from here matters more than
     * it does in the tray: the popout is exactly where you notice you are
     * living in a conversation, and it is the surface a favorite reopens.
     */
    getToolHeaderActions() {
        const id = this._activeConversationId;
        if (!id) return [];
        const isFavorite = ConversationManager.isFavorite(id);
        return [{
            id: 'favorite',
            icon: isFavorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart',
            label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
            active: isFavorite,
            onClick: () => {
                ConversationManager.toggleFavorite(id);
                return this.render(false);
            }
        }];
    }

    // ==============================================================
    // ===== DATA ===================================================
    // ==============================================================

    async getData() {
        const entry = game.journal.get(this._activeConversationId);
        const virtualUser = this._virtualUserId ? game.users.get(this._virtualUserId) : null;
        const info = entry ? ConversationManager.getInfo(entry) : {};

        const bodyContent = await renderTemplateFn(BODY_TEMPLATE, this._buildThreadContext(entry));

        // A 1:1 shows the other player's avatar where a group shows its icon.
        let badge = `<i class="${info.icon ?? 'fa-solid fa-comments'}"></i>`;
        if (info.kind === 'direct' && (info.members ?? []).includes(game.user.id)) {
            const otherId = (info.members ?? []).find((id) => id !== game.user.id);
            const avatar = game.users.get(otherId)?.avatar;
            if (avatar) badge = `<img class="bibliosoph-messages-lite-avatar" src="${avatar}" alt="">`;
        } else if (virtualUser?.avatar) {
            badge = `<img class="bibliosoph-messages-lite-avatar" src="${virtualUser.avatar}" alt="">`;
        }

        return {
            appId: this.id,
            bodyContent,
            toolBarLeft: `${badge}<span class="bibliosoph-messages-lite-title">${this.title}</span>`
        };
    }

    // ==============================================================
    // ===== RENDER LIFECYCLE =======================================
    // ==============================================================

    async _onRender(context, options) {
        await super._onRender?.(context, options);
        // See the note in window-messages.js: the registry only keeps rendered
        // windows, so registration belongs here rather than the constructor.
        ConversationManager.registerWindow(this);
        this._attachThreadContextMenu();
        const root = this._getRoot();
        if (!root) return;
        // Everything inside the thread — compose box, drops, scrolling,
        // mark-read — is shared with the full window.
        this._bindThreadListeners(root);
    }

    async close(options) {
        MessagesLiteWindow.instances.delete(this);
        ConversationManager.unregisterWindow(this);
        this._clearTypingIndicators();

        // Closing a popout closes only that popout — nothing is summoned back.
        // Unread only returns to the menubar once no messages surface is left,
        // otherwise closing one of three popouts would badge you about a
        // conversation you can still see.
        if (!ConversationManager.getOpenWindows().length) {
            ConversationManager.playUiSound('close');
            ConversationManager.notifyUnread();
        }
        return super.close(options);
    }
}
