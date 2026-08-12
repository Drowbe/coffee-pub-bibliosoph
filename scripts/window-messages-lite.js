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
// thread moves into a Tool window (BlacksmithToolWindowBaseV2) that
// follows the user's Light/Dark/Glass choice and sits over the canvas.
// The full window closes behind it — exactly one messages surface is
// ever live, which is what lets both share ConversationManager's
// single-window live-update path untouched.
//
// Everything the thread can DO — send, drop a document, paste an image,
// right-click a message, edit, reply, escalate to Foundry chat — comes
// from the shared thread mixin, so this file is only the wrapper.
// ==================================================================

import { MODULE } from './const.js';
import { ConversationManager } from './manager-conversations.js';
import { MessagesWindow } from './window-messages.js';
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
 * Open (or focus) the lite popout for one conversation.
 * Asking for a different conversation replaces the current popout rather
 * than stacking a second one.
 */
export async function openMessagesLite(options = {}) {
    if (!BlacksmithToolWindowBaseV2) {
        toast('Popout unavailable', 'Blacksmith’s tool window base did not load.', 'fa-solid fa-triangle-exclamation');
        return null;
    }

    const existing = MessagesLiteWindow.current;
    if (existing?.rendered) {
        const sameConversation = !options.conversationId
            || options.conversationId === existing._activeConversationId;
        if (sameConversation) return existing.render(true);
        // Different conversation: retire the old popout without reopening the
        // full window behind it, then fall through and build the new one.
        existing._restoreFullOnClose = false;
        await existing.close();
    }

    // Exactly one messages surface at a time. Reaching the popout directly
    // (registered window id, a macro) must retire the full window the same
    // way the tray's popout icon does.
    const full = MessagesWindow.current;
    if (full?.rendered && !(full instanceof MessagesLiteWindow)) {
        full._poppingOut = true;   // a hand-off: no close sound, no unread toast
        await full.close();
    }

    const win = new MessagesLiteWindow(options);
    return win.render(true);
}

export class MessagesLiteWindow extends ThreadBehavior(BlacksmithToolWindowBaseV2 ?? Object) {

    /** Singleton instance — only one popout exists at a time. */
    static current = null;

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

    // Prefixed (msglite-*) so delegation never collides with the full window.
    static ACTION_HANDLERS = {
        'msglite-send': (_e, _btn, app) => app?._send()
    };

    constructor(options = {}) {
        super(options);
        MessagesLiteWindow.current = this;
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
        this._restoreFullOnClose = true;
        // ConversationManager reaches the open messages surface through
        // MessagesWindow.current. While the popout is up, it IS that surface,
        // which is what keeps live updates flowing with no change to the
        // manager. Cleared again in close().
        MessagesWindow.current = this;
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
        this._attachThreadContextMenu();
        const root = this._getRoot();
        if (!root) return;
        // Everything inside the thread — compose box, drops, scrolling,
        // mark-read — is shared with the full window.
        this._bindThreadListeners(root);
    }

    async close(options) {
        if (MessagesLiteWindow.current === this) MessagesLiteWindow.current = null;
        if (MessagesWindow.current === this) MessagesWindow.current = null;
        this._clearTypingIndicators();

        const restore = this._restoreFullOnClose !== false;
        const conversationId = this._activeConversationId;
        const result = await super.close(options);

        // Closing the popout is how you get back to the full view. When the
        // full window is what closed US (see openMessagesWindow), it is
        // already on its way in and must not be reopened here.
        if (restore) {
            try {
                const { openMessagesWindow } = await import('./window-messages.js');
                await openMessagesWindow({ conversationId });
            } catch (error) {
                log('Could not restore the full Messages window', error, false, false);
            }
        }
        return result;
    }
}
