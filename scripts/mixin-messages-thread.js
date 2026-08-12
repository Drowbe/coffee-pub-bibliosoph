// ==================================================================
// ===== MESSAGES THREAD BEHAVIOUR (mixin-messages-thread.js) =======
// ==================================================================
// Everything a conversation thread can DO, independent of the window
// chrome it happens to be wearing.
//
// Two windows show the same thread:
//   - MessagesWindow      — full view, on BlacksmithWindowBaseV2
//   - MessagesLiteWindow  — popped-out single conversation, on
//                           BlacksmithToolWindowBaseV2
//
// Those two Blacksmith bases are siblings, not ancestors, so the shared
// behaviour cannot live in a common parent class. It lives here instead,
// as a mixin: `ThreadBehavior(Base)` returns a subclass of whichever
// base you hand it. Send, drop, paste, upload, context menu, editing,
// reply, escalation to Foundry chat and the thread half of the render
// context are all written once and worn by both.
//
// What each window supplies for itself: its template, its styling, and
// whatever chrome sits around the thread (tray, tone bar, action bar).
// ==================================================================

import { MODULE } from './const.js';
import { ConversationManager } from './manager-conversations.js';

// ------------------------------------------------------------------
// Shared constants. These live here rather than in window-messages.js
// because the mixin needs them and window-messages.js imports the
// mixin — putting them the other way around is a cycle.
// ------------------------------------------------------------------

/** Tone stamps for individual messages (the old six message types). */
export const MESSAGE_TONES = [
    { key: 'message', icon: 'fa-solid fa-envelope', label: 'Message' },
    { key: 'plan', icon: 'fa-solid fa-chess', label: 'Party Plan' },
    { key: 'agree', icon: 'fa-solid fa-thumbs-up', label: 'Agree' },
    { key: 'disagree', icon: 'fa-solid fa-thumbs-down', label: 'Disagree' },
    { key: 'praise', icon: 'fa-solid fa-heart', label: 'Praise' },
    { key: 'insult', icon: 'fa-solid fa-face-angry', label: 'Insult' }
];

/** Reactions users can put on other people's messages (context menu). */
export const MESSAGE_REACTIONS = [
    { key: 'like', icon: 'fa-solid fa-thumbs-up', label: 'Like' },
    { key: 'dislike', icon: 'fa-solid fa-thumbs-down', label: 'Dislike' },
    { key: 'love', icon: 'fa-solid fa-heart', label: 'Love' },
    { key: 'laugh', icon: 'fa-solid fa-face-laugh', label: 'Laugh' },
    { key: 'huh', icon: 'fa-solid fa-circle-question', label: 'Huh?' }
];

/** Icons a user can pick when creating a conversation. */
export const CONVERSATION_ICONS = [
    'fa-solid fa-user-group', 'fa-solid fa-users', 'fa-solid fa-comments', 'fa-solid fa-scroll',
    'fa-solid fa-map', 'fa-solid fa-dice-d20', 'fa-solid fa-shield-halved', 'fa-solid fa-crown',
    'fa-solid fa-skull', 'fa-solid fa-dragon', 'fa-solid fa-hat-wizard', 'fa-solid fa-flask',
    'fa-solid fa-eye', 'fa-solid fa-moon', 'fa-solid fa-paw', 'fa-solid fa-gem'
];

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

export function getSetting(key, defaultValue) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.getSettingSafely) {
        return BlacksmithUtils.getSettingSafely(MODULE.ID, key, defaultValue);
    }
    try {
        return game.settings.get(MODULE.ID, key) ?? defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

export const escapeHtml = (s) => Handlebars.escapeExpression(s ?? '');

export function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return sameDay ? time : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

/**
 * Every user-facing notice rides Blacksmith's adaptive toast, falling back
 * to a Foundry notification only when the API is absent.
 */
export function toast(title, subtitle = '', icon = 'fa-solid fa-comments') {
    const api = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (api?.show) api.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    else ui.notifications.warn(subtitle ? `${title} — ${subtitle}` : title);
}

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `MESSAGES THREAD | ${message}`, data, debug, notify);
    }
}

const renderTemplateFn = (...args) => {
    const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    return fn(...args);
};

// ------------------------------------------------------------------
// The mixin
// ------------------------------------------------------------------

/**
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 *        A Blacksmith window base (standard or tool).
 * @returns {typeof Base} the base, extended with thread behaviour.
 */
export function ThreadBehavior(Base) {
    return class MessagesThread extends Base {

        /**
         * Whether this window offers reactions. The full window does; the
         * lite popout deliberately does not, so its context menu drops the
         * React submenu and its thread omits reaction chips.
         */
        static SUPPORTS_REACTIONS = true;

        // ==========================================================
        // ===== CONVERSATION IDENTITY ==============================
        // ==========================================================

        /** The other user's id when a virtual (not-yet-created) 1:1 is selected. */
        get _virtualUserId() {
            const id = this._activeConversationId;
            return typeof id === 'string' && id.startsWith('virtual:') ? id.slice('virtual:'.length) : null;
        }

        /** Viewer-facing name: a 1:1 shows the other person's name. */
        _conversationDisplayName(entry) {
            const info = ConversationManager.getInfo(entry);
            if (info.kind === 'direct' && (info.members ?? []).includes(game.user.id)) {
                const otherId = (info.members ?? []).find((id) => id !== game.user.id);
                return game.users.get(otherId)?.name ?? info.name ?? entry.name;
            }
            return info.name ?? entry.name;
        }

        // ==========================================================
        // ===== THREAD CONTEXT =====================================
        // ==========================================================

        /** Day-separator label for a timestamp: Today, Yesterday, or the date. */
        _dayLabelFor(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            const options = { month: 'long', day: 'numeric' };
            if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
            return date.toLocaleDateString(undefined, options);
        }

        /** Group raw {userId: reactionKey} into chips: icon, count, names, mine. */
        _buildReactionsDisplay(reactions = {}, reactionMap) {
            const groups = new Map();
            for (const [userId, key] of Object.entries(reactions)) {
                const def = reactionMap[key];
                if (!def) continue;
                if (!groups.has(key)) groups.set(key, { ...def, count: 0, users: [], mine: false });
                const group = groups.get(key);
                group.count++;
                group.users.push(game.users.get(userId)?.name ?? 'Unknown');
                if (userId === game.user.id) group.mine = true;
            }
            return [...groups.values()].map((g) => ({ ...g, userNames: g.users.join(', ') }));
        }

        /**
         * The thread half of the render context: the message list plus the
         * compose-box state. Both windows feed this into their own template;
         * neither one cares about the other's chrome.
         */
        _buildThreadContext(active) {
            const virtualUser = this._virtualUserId ? game.users.get(this._virtualUserId) : null;
            const toneMap = Object.fromEntries(MESSAGE_TONES.map((t) => [t.key, t]));
            const reactionMap = Object.fromEntries(MESSAGE_REACTIONS.map((r) => [r.key, r]));
            const showReactions = this.constructor.SUPPORTS_REACTIONS;
            let lastDayLabel = '';

            const messages = active ? ConversationManager.getMessages(active).map((m) => {
                const dayLabel = this._dayLabelFor(m.timestamp);
                const showDay = dayLabel !== lastDayLabel;
                lastDayLabel = dayLabel;
                return {
                    ...m,
                    timeDisplay: formatTimestamp(m.timestamp),
                    dayLabel: showDay ? dayLabel : null,
                    toneIcon: toneMap[m.tone]?.icon ?? toneMap.message.icon,
                    toneLabel: toneMap[m.tone]?.label ?? 'Message',
                    showTone: m.tone !== 'message',
                    reactionsDisplay: showReactions ? this._buildReactionsDisplay(m.reactions, reactionMap) : []
                };
            }) : [];

            return {
                hasConversation: !!active || !!virtualUser,
                editing: !!this._editing,
                messages,
                draft: this._draft
            };
        }

        // ==========================================================
        // ===== COMPOSE PREFERENCES ================================
        // ==========================================================

        /** Whether ENTER sends the message (persisted locally, like Regent). */
        get _enterSends() {
            try {
                return localStorage.getItem('bibliosoph-messages-enter-sends') !== 'false';
            } catch (_) {
                return true;
            }
        }

        set _enterSends(value) {
            try {
                localStorage.setItem('bibliosoph-messages-enter-sends', value ? 'true' : 'false');
            } catch (_) { /* no-op */ }
        }

        // ==========================================================
        // ===== RENDER LIFECYCLE ===================================
        // ==========================================================

        /**
         * Capture the in-progress draft and the thread scroll position before
         * the DOM is rebuilt, so a live re-render (someone else posted) never
         * eats what you were typing or throws you back to the top.
         */
        async render(force = false) {
            const root = this._getRoot?.();

            // Unless this render was triggered by code that deliberately set
            // the draft itself (start/cancel editing, conversation switch)
            if (this._skipDraftCapture) {
                this._skipDraftCapture = false;
            } else {
                const textarea = root?.querySelector?.('.bibliosoph-messages-input');
                if (textarea) this._draft = textarea.value;
            }

            const thread = root?.querySelector?.('.bibliosoph-messages-thread');
            if (thread) {
                this._threadScrollSaved = thread.scrollTop;
                this._threadWasPinned = thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 80;
            } else {
                this._threadScrollSaved = null;
                this._threadWasPinned = true;
            }

            return super.render(force);
        }

        /**
         * Wire up everything inside the thread body. Safe to call on every
         * render — each listener is guarded by a dataset flag so repeated
         * renders never stack duplicates.
         */
        _bindThreadListeners(root) {
            if (!root) return;

            // ENTER sends (when enabled), SHIFT+ENTER inserts a newline
            const textarea = root.querySelector('.bibliosoph-messages-input');
            if (textarea && !textarea.dataset.bibliosophBound) {
                textarea.dataset.bibliosophBound = '1';
                textarea.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' && !event.shiftKey && this._enterSends) {
                        event.preventDefault();
                        this._send();
                    } else if (event.key === 'Escape' && this._editing) {
                        event.preventDefault();
                        event.stopPropagation();
                        this._cancelEditing();
                    }
                });
                // Paste a screenshot / image from the clipboard → upload + insert
                textarea.addEventListener('paste', (event) => {
                    const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type?.startsWith('image/'));
                    if (!files.length) return; // plain text pastes proceed normally
                    event.preventDefault();
                    this._insertUploadedImages(files);
                });
                // Let conversation members know we're typing (throttled, ephemeral)
                textarea.addEventListener('input', () => {
                    const entry = game.journal.get(this._activeConversationId);
                    if (entry) ConversationManager.emitTyping(entry);
                });
            }

            // Drag & drop documents (item, actor, journal, …) → insert a UUID link
            const dropTarget = this._getDropTarget(root);
            if (dropTarget && !dropTarget.dataset.bibliosophDropBound) {
                dropTarget.dataset.bibliosophDropBound = '1';
                dropTarget.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    dropTarget.classList.add('bibliosoph-messages-dragover');
                });
                dropTarget.addEventListener('dragleave', (event) => {
                    if (!dropTarget.contains(event.relatedTarget)) dropTarget.classList.remove('bibliosoph-messages-dragover');
                });
                dropTarget.addEventListener('drop', (event) => {
                    dropTarget.classList.remove('bibliosoph-messages-dragover');
                    this._onDropDocument(event);
                });
            }

            // Thread scrolling: jump straight to the bottom on load / conversation
            // switch. On same-conversation re-renders, restore the saved position
            // first (the rebuilt DOM starts at the top), then — only if the user
            // was already near the bottom — glide the short distance to the
            // newest message. Readers scrolled up into history stay put.
            const thread = root.querySelector('.bibliosoph-messages-thread');
            if (thread) {
                const conversationChanged = this._lastScrolledConversation !== this._activeConversationId;
                this._lastScrolledConversation = this._activeConversationId;
                if (conversationChanged) {
                    this._pinThreadToBottom(thread, true);
                } else {
                    if (typeof this._threadScrollSaved === 'number') thread.scrollTop = this._threadScrollSaved;
                    if (this._threadWasPinned !== false) this._pinThreadToBottom(thread, false);
                }

                // Click an image in a message → full-size popout
                if (!thread.dataset.bibliosophImgBound) {
                    thread.dataset.bibliosophImgBound = '1';
                    thread.addEventListener('click', (event) => {
                        const img = event.target.closest?.('.bibliosoph-message-content img');
                        if (img?.src) this._openImagePopout(img.src);
                    });
                }
            }

            // Viewing a conversation marks it read
            const active = game.journal.get(this._activeConversationId);
            if (active && ConversationManager.getUnreadCount(active) > 0) {
                ConversationManager.markRead(active);
            }

            // After sending/saving your own message, put the cursor back in the
            // compose box (one-shot — never steals focus on incoming messages)
            if (this._refocusCompose) {
                this._refocusCompose = false;
                root.querySelector('.bibliosoph-messages-input')?.focus();
            }
        }

        /**
         * Where drops land. The full window scopes them to the main column so
         * the tray stays a drop-free zone; the lite popout is all thread, so
         * the whole root accepts.
         */
        _getDropTarget(root) {
            return root.querySelector('.bibliosoph-messages-main') ?? root;
        }

        // ==========================================================
        // ===== TYPING INDICATOR (incoming) ========================
        // ==========================================================

        /** Show "X is typing…" for ~4s; updates the DOM directly (no re-render). */
        showTypingIndicator(userId) {
            this._typing ??= new Map();
            clearTimeout(this._typing.get(userId));
            this._typing.set(userId, setTimeout(() => {
                this._typing.delete(userId);
                this._renderTypingLine();
            }, 4000));
            this._renderTypingLine();
        }

        _clearTypingIndicators() {
            for (const timer of this._typing?.values() ?? []) clearTimeout(timer);
            this._typing?.clear();
            this._renderTypingLine();
        }

        _renderTypingLine() {
            const el = this._getRoot()?.querySelector('.bibliosoph-messages-typing');
            if (!el) return;
            const names = [...(this._typing?.keys() ?? [])]
                .map((id) => game.users.get(id)?.name)
                .filter(Boolean);
            el.textContent = names.length === 0
                ? ''
                : names.length === 1
                    ? `${names[0]} is typing…`
                    : `${names.join(' and ')} are typing…`;
            el.classList.toggle('visible', names.length > 0);
        }

        // ==========================================================
        // ===== SENDING ============================================
        // ==========================================================

        async _send() {
            const root = this._getRoot();
            const textarea = root?.querySelector('.bibliosoph-messages-input');
            const text = (textarea?.value ?? '').trim();
            if (!text) return;

            let entry = game.journal.get(this._activeConversationId);
            // First message in a virtual 1:1: create the conversation lazily
            const virtualUserId = this._virtualUserId;
            if (!entry && virtualUserId) {
                entry = await ConversationManager.ensureDirectConversation(virtualUserId);
                if (entry) this._activeConversationId = entry.id;
            }
            if (!entry) {
                if (!virtualUserId) toast('No conversation selected', 'Pick one before sending.', 'fa-solid fa-comment-slash');
                return; // keep the draft — nothing was sent
            }

            this._draft = '';
            if (textarea) textarea.value = '';
            // The hook-triggered re-render should hand focus back to the compose box
            this._refocusCompose = true;

            // Edit mode: update the existing message instead of posting a new one
            if (this._editing) {
                const messageId = this._editing;
                this._editing = null;
                await ConversationManager.editMessage(entry, messageId, text);
                ConversationManager.playUiSound('send');
                return; // updateJournalEntryPage hook re-renders the window
            }

            await ConversationManager.postMessage(entry, { markdown: text, tone: this._tone ?? 'message' });
            this._tone = 'message';
            ConversationManager.playUiSound('send');
            // Our own createJournalEntryPage hook re-renders the window
        }

        /**
         * Pin the thread scroll to the bottom, resiliently: once now, once on the
         * next frame (after layout settles), and again whenever an avatar or
         * message image finishes loading and grows the thread.
         */
        _pinThreadToBottom(thread, instant = false) {
            const scroll = (behavior) => {
                try {
                    thread.scrollTo({ top: thread.scrollHeight, behavior });
                } catch (_) {
                    thread.scrollTop = thread.scrollHeight;
                }
            };
            scroll(instant ? 'auto' : 'smooth');
            requestAnimationFrame(() => scroll(instant ? 'auto' : 'smooth'));
            for (const img of thread.querySelectorAll('img')) {
                if (!img.complete) img.addEventListener('load', () => scroll('auto'), { once: true });
            }
        }

        // ==========================================================
        // ===== IMAGES =============================================
        // ==========================================================

        /** Open Foundry's image popout (handles both the V2 and legacy signatures). */
        _openImagePopout(src) {
            const Popout = foundry.applications?.apps?.ImagePopout ?? globalThis.ImagePopout;
            if (!Popout) return;
            try {
                new Popout({ src, window: { title: 'Image' } }).render(true);
            } catch (_) {
                try {
                    new Popout(src, { title: 'Image' }).render(true);
                } catch (_) { /* give up quietly */ }
            }
        }

        /** Does this path/URL look like an image file? */
        _isImagePath(path) {
            return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(path ?? '');
        }

        /**
         * Upload a pasted/dropped image File to the world's storage
         * (worlds/<world>/bibliosoph-messages/) and return its path.
         * Requires the core "Upload New Files" permission.
         */
        async _uploadImageFile(file) {
            if (!file?.type?.startsWith('image/')) return null;
            if (!game.user.can('FILES_UPLOAD')) {
                toast('Upload not permitted', 'You can still link images by path or URL.', 'fa-solid fa-image-slash');
                return null;
            }
            const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
            if (!FP?.upload) {
                toast('Upload unavailable', 'This Foundry version cannot upload files.', 'fa-solid fa-triangle-exclamation');
                return null;
            }

            const dir = `worlds/${game.world.id}/bibliosoph-messages`;
            try {
                await FP.createDirectory('data', dir);
            } catch (_) { /* directory already exists */ }

            const ext = ((file.name?.split('.').pop() || file.type.split('/')[1] || 'png')
                .toLowerCase().replace(/[^a-z0-9]/g, '')) || 'png';
            const base = ((file.name ? file.name.replace(/\.[^.]*$/, '') : 'paste')
                .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'image';
            const filename = `${base}-${Date.now()}.${ext}`;

            try {
                const upload = new File([file], filename, { type: file.type });
                const result = await FP.upload('data', dir, upload, {}, { notify: false });
                return result?.path ?? `${dir}/${filename}`;
            } catch (error) {
                log('Image upload failed', error, false, false);
                toast('Image upload failed', 'See the console for details.', 'fa-solid fa-triangle-exclamation');
                return null;
            }
        }

        /** Upload each image file and insert markdown image syntax for it. */
        async _insertUploadedImages(files) {
            for (const file of files) {
                const path = await this._uploadImageFile(file);
                if (path) this._insertAtCursor(`![image](${path})`);
            }
        }

        /** Insert text at the compose textarea's cursor and refocus. */
        _insertAtCursor(text) {
            const textarea = this._getRoot()?.querySelector('.bibliosoph-messages-input');
            if (!textarea) return;
            const start = textarea.selectionStart ?? textarea.value.length;
            const end = textarea.selectionEnd ?? textarea.value.length;
            const before = textarea.value.slice(0, start);
            const after = textarea.value.slice(end);
            const spacer = before && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
            textarea.value = `${before}${spacer}${text} ${after}`;
            const caret = (before + spacer + text + ' ').length;
            textarea.setSelectionRange(caret, caret);
            textarea.focus();
            this._draft = textarea.value;
        }

        // ==========================================================
        // ===== DRAG & DROP (documents → UUID links) ===============
        // ==========================================================

        /**
         * Drop into the window:
         * - documents (item, actor/token, journal, roll table, …) → @UUID link via
         *   Blacksmith's UUID builder (api.compendiums.formatLink)
         * - images (Foundry file paths or web URLs) → markdown image syntax
         */
        async _onDropDocument(event) {
            // OS file drop (e.g. an image from the desktop): upload, then insert
            const droppedFiles = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type?.startsWith('image/'));
            if (droppedFiles.length) {
                event.preventDefault();
                await this._insertUploadedImages(droppedFiles);
                return;
            }

            const raw = event.dataTransfer.getData('text/plain');
            let data = null;
            try {
                data = JSON.parse(raw);
            } catch (_) { /* not JSON — maybe a plain URL/path */ }

            if (!data) {
                // Plain text drop (e.g. an image URL from a browser or a file path)
                const uri = (event.dataTransfer.getData('text/uri-list') || raw || '').split('\n')[0]?.trim();
                if (uri && this._isImagePath(uri)) {
                    event.preventDefault();
                    this._insertAtCursor(`![image](${uri})`);
                }
                return;
            }
            event.preventDefault();

            // Image drops from Foundry UIs (file picker, tiles) carry a src/path
            const imagePath = data.texture?.src ?? data.src ?? data.path ?? null;
            if (!data.uuid && imagePath && this._isImagePath(imagePath)) {
                this._insertAtCursor(`![image](${imagePath})`);
                return;
            }

            // Foundry drag data carries a uuid for documents; tokens carry their actor
            let uuid = data.uuid ?? (data.type && data.id ? `${data.type}.${data.id}` : null);
            if (!uuid) return;

            let doc = null;
            try {
                doc = await fromUuid(uuid);
            } catch (_) { /* leave doc null */ }
            // Dropped token: link the actor rather than the token document
            if (doc?.documentName === 'Token' && doc.actor) {
                doc = doc.actor;
                uuid = doc.uuid;
            }
            const label = doc?.name ?? data.name ?? 'Link';

            const compendiums = game.modules.get('coffee-pub-blacksmith')?.api?.compendiums;
            const link = compendiums?.formatLink
                ? compendiums.formatLink(uuid, label)
                : `@UUID[${uuid}]{${label}}`;
            this._insertAtCursor(link);
        }

        // ==========================================================
        // ===== REACTIONS ==========================================
        // ==========================================================

        async _toggleReaction(messageId, reactionKey) {
            const entry = game.journal.get(this._activeConversationId);
            if (!entry || !messageId || !reactionKey) return;
            await ConversationManager.toggleReaction(entry, messageId, reactionKey);
            // updateJournalEntryPage hook refreshes the window
        }

        // ==========================================================
        // ===== EDITING & REPLY ====================================
        // ==========================================================

        /** Load one of your own messages into the compose box for editing. */
        async _startEditing(messageId) {
            const entry = game.journal.get(this._activeConversationId);
            const message = entry ? ConversationManager.getMessages(entry).find((m) => m.id === messageId) : null;
            if (!message?.isOwn || message.deleted) return;
            this._editing = messageId;
            this._draft = message.markdown || '';
            this._skipDraftCapture = true;
            await this.render(false);
            const textarea = this._getRoot()?.querySelector('.bibliosoph-messages-input');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }

        _cancelEditing() {
            if (!this._editing) return;
            this._editing = null;
            this._draft = '';
            this._skipDraftCapture = true;
            this.render(false);
        }

        /** Quote a message into the compose box as a markdown blockquote. */
        _replyTo(messageId) {
            const entry = game.journal.get(this._activeConversationId);
            const message = entry ? ConversationManager.getMessages(entry).find((m) => m.id === messageId) : null;
            if (!message) return;
            const source = (message.markdown || message.html.replace(/<[^>]+>/g, '')).trim();
            const quoted = source.split('\n').map((line) => `> ${line}`).join('\n');
            const prefix = `> **${message.senderName}** wrote:\n${quoted}\n\n`;

            const textarea = this._getRoot()?.querySelector('.bibliosoph-messages-input');
            if (!textarea) return;
            textarea.value = prefix + textarea.value;
            this._draft = textarea.value;
            const caret = textarea.value.length;
            textarea.setSelectionRange(caret, caret);
            textarea.focus();
        }

        // ==========================================================
        // ===== CONTEXT MENUS (Blacksmith uiContextMenu) ===========
        // ==========================================================

        /**
         * Bound per instance on this window's own element, mirroring how the
         * Blacksmith base binds click delegation. The previous implementation
         * used one document-level listener dispatched through a class-static
         * "current window" pointer, which cannot serve two window classes.
         */
        _attachThreadContextMenu() {
            const root = this.element;
            if (!root || this._threadContextBoundTo === root) return;
            this._threadContextBoundTo = root;
            root.addEventListener('contextmenu', (event) => {
                const messageEl = event.target.closest?.('.bibliosoph-message-wrapper[data-message-id]');
                if (messageEl) {
                    event.preventDefault();
                    this._showMessageContextMenu(event, messageEl.dataset.messageId);
                    return;
                }
                // Window-specific extras (the full window's conversation tray)
                if (this._onExtraContextMenu(event)) event.preventDefault();
            });
        }

        /** Override to handle right-clicks outside the message list. */
        _onExtraContextMenu(_event) {
            return false;
        }

        _getContextMenuApi() {
            return game.modules.get('coffee-pub-blacksmith')?.api?.uiContextMenu ?? null;
        }

        _showMessageContextMenu(event, messageId) {
            const menu = this._getContextMenuApi();
            const entry = game.journal.get(this._activeConversationId);
            if (!menu || !entry) return;
            const message = ConversationManager.getMessages(entry).find((m) => m.id === messageId);
            if (!message || message.deleted) return; // placeholders have no actions

            const items = [
                {
                    name: 'Reply',
                    icon: 'fa-solid fa-reply',
                    callback: () => this._replyTo(messageId)
                }
            ];
            if (message.isOwn) {
                items.push({
                    name: 'Edit Message',
                    icon: 'fa-solid fa-pen',
                    callback: () => this._startEditing(messageId)
                });
            }
            if (this.constructor.SUPPORTS_REACTIONS) {
                items.push({
                    name: 'React',
                    icon: 'fa-solid fa-face-smile',
                    submenu: MESSAGE_REACTIONS.map((r) => ({
                        name: r.label,
                        icon: r.icon,
                        callback: () => this._toggleReaction(messageId, r.key)
                    }))
                });
            }
            items.push({
                name: 'Send to Foundry Chat',
                icon: 'fa-solid fa-share-from-square',
                callback: () => this._sendToChat(messageId)
            });
            if (message.isOwn || game.user.isGM) {
                items.push({ separator: true });
                items.push({
                    name: 'Delete Message',
                    icon: 'fa-solid fa-trash',
                    callback: () => ConversationManager.deleteMessage(entry, messageId)
                });
            }

            menu.show({ id: 'bibliosoph-messages-context', x: event.clientX, y: event.clientY, zones: items });
        }

        // ==========================================================
        // ===== SEND TO FOUNDRY CHAT (escalation, Regent-style) ====
        // ==========================================================

        async _sendToChat(messageId) {
            const entry = game.journal.get(this._activeConversationId);
            if (!entry || !messageId) return;
            const message = ConversationManager.getMessages(entry).find((m) => m.id === messageId);
            if (!message) return;

            const info = ConversationManager.getInfo(entry);
            const isParty = info.kind === 'party';
            // Settings store Blacksmith Chat Cards API class names (see settings.js)
            const cardTheme = isParty
                ? getSetting('cardThemePartyMessage', 'theme-default')
                : getSetting('cardThemePrivateMessage', 'theme-default');

            let content;
            try {
                content = await renderTemplateFn(`modules/${MODULE.ID}/templates/chat-card-message.hbs`, {
                    cardTheme,
                    icon: info.icon ?? 'fa-solid fa-comments',
                    title: this._conversationDisplayName(entry),
                    senderName: message.senderName,
                    timeDisplay: formatTimestamp(message.timestamp),
                    content: message.html
                });
            } catch (_) {
                content = `<div class="blacksmith-card ${cardTheme}"><div class="section-content"><strong>${escapeHtml(message.senderName)}:</strong> ${message.html}</div></div>`;
            }

            const chatData = {
                content,
                speaker: ChatMessage.getSpeaker()
            };
            if (!isParty) {
                const recipients = (info.members ?? []).filter((id) => game.users.get(id));
                if (recipients.length) chatData.whisper = recipients;
            }
            await ChatMessage.create(chatData);
            toast('Sent to Foundry chat', '', 'fa-solid fa-share-from-square');
        }
    };
}
