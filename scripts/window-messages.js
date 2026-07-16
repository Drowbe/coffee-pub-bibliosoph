// ==================================================================
// ===== MESSAGES WINDOW (window-messages.js) =======================
// ==================================================================
// Unified conversation window (party + private/group messages).
// Application V2, built on Blacksmith's public window base + zone
// template (resolved from module.api — never deep-imported).
// Storage/delivery: journal-backed conversations (manager-conversations.js).
//
// This module is only ever dynamically imported (registerWindow open(),
// toolbar onClick, ConversationManager), so the base class resolves
// after Blacksmith has loaded.
// ==================================================================

import { MODULE, BIBLIOSOPH } from './const.js';
import { ConversationManager } from './manager-conversations.js';

const APP_ID = 'coffee-pub-bibliosoph-messages';
const BLACKSMITH_TEMPLATE = 'modules/coffee-pub-blacksmith/templates/window-template.hbs';
const BODY_TEMPLATE = `modules/${MODULE.ID}/templates/window-messages.hbs`;

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

function resolveBase() {
    const api = game.modules.get('coffee-pub-blacksmith')?.api;
    const Base = api?.BlacksmithWindowBaseV2 ?? api?.getWindowBaseV2?.();
    if (!Base) throw new Error(`${MODULE.ID} | Blacksmith window base (BlacksmithWindowBaseV2) is not available`);
    return Base;
}

function getSetting(key, defaultValue) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.getSettingSafely) {
        return BlacksmithUtils.getSettingSafely(MODULE.ID, key, defaultValue);
    }
    try {
        return game.settings.get(MODULE.ID, key) ?? defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

const escapeHtml = (s) => Handlebars.escapeExpression(s ?? '');

function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return sameDay ? time : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

/** Open (or focus) the singleton Messages window. */
export function openMessagesWindow(options = {}) {
    const win = MessagesWindow.current ?? new MessagesWindow(options);
    if (options.conversationId) win._activeConversationId = options.conversationId;
    return win.render(true);
}

export class MessagesWindow extends resolveBase() {
    /** Singleton instance (also used by ConversationManager for live updates). */
    static current = null;

    static ROOT_CLASS = 'blacksmith-window-template-root';

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}),
        {
            id: APP_ID,
            classes: ['bibliosoph-messages-window'],
            position: { width: 720, height: 640 },
            window: { title: 'Messages', resizable: true, minimizable: true, icon: 'fa-solid fa-comments' },
            windowSizeConstraints: { minWidth: 520, minHeight: 420 }
        }
    );

    static PARTS = {
        body: { template: BLACKSMITH_TEMPLATE }
    };

    // Prefixed (msg-*) so delegation never collides with other Blacksmith windows.
    static ACTION_HANDLERS = {
        'msg-select-conversation': (_e, btn) => MessagesWindow.current?._selectConversation(btn.dataset.id),
        'msg-new-conversation': () => MessagesWindow.current?._openPicker(),
        'msg-cancel-picker': () => MessagesWindow.current?._closePicker(),
        'msg-toggle-member': (_e, btn) => MessagesWindow.current?._toggleMember(btn.dataset.id),
        'msg-pick-icon': (_e, btn) => MessagesWindow.current?._pickIcon(btn.dataset.icon),
        'msg-create-conversation': () => MessagesWindow.current?._createConversation(),
        'msg-tone': (_e, btn) => MessagesWindow.current?._setTone(btn.dataset.tone),
        'msg-send': () => MessagesWindow.current?._send(),
        'msg-send-to-chat': (_e, btn) => MessagesWindow.current?._sendToChat(btn.dataset.messageId),
        'msg-react': (_e, btn) => MessagesWindow.current?._toggleReaction(btn.dataset.messageId, btn.dataset.reaction)
    };

    constructor(options = {}) {
        super(options);
        MessagesWindow.current = this;
        this._activeConversationId = options.conversationId ?? null;
        this._tone = 'message';
        this._draft = '';
        /** When set, the body shows the new-conversation member picker. */
        this._picker = null;
    }

    /** Used by ConversationManager to decide between re-render and notification. */
    get activeConversationId() {
        return this._activeConversationId;
    }

    // ==============================================================
    // ===== DATA ===================================================
    // ==============================================================

    _resolveActiveConversation(conversations) {
        let active = conversations.find((c) => c.id === this._activeConversationId);
        if (!active) {
            active = conversations.find((c) => ConversationManager.getInfo(c).kind === 'party') ?? conversations[0] ?? null;
            this._activeConversationId = active?.id ?? null;
        }
        return active;
    }

    async getData() {
        const conversations = ConversationManager.getConversations();
        const active = this._resolveActiveConversation(conversations);
        const info = active ? ConversationManager.getInfo(active) : {};
        const memberNames = (info.members ?? [])
            .map((id) => game.users.get(id)?.name)
            .filter(Boolean);

        const renderTemplateFn = foundry.applications?.handlebars?.renderTemplate ?? renderTemplate;
        const bodyContent = await renderTemplateFn(BODY_TEMPLATE, this._buildBodyContext(active, conversations));

        const showCompose = !this._picker && !!active;
        const actionBarLeft = `<label class="blacksmith-window-template-action-label bibliosoph-messages-enter-label"><input type="checkbox" class="bibliosoph-messages-enter-sends" ${this._enterSends ? 'checked' : ''}> ENTER Sends</label>`;
        const actionBarRight = showCompose
            ? `<button type="button" class="blacksmith-window-btn-primary bibliosoph-messages-btn" data-action="msg-send"><i class="fa-solid fa-paper-plane"></i> Send Message</button>`
            : '';

        return {
            appId: this.id,
            showOptionBar: false,
            showHeader: true,
            showTools: false,
            showActionBar: showCompose,
            headerIcon: active ? (info.icon ?? 'fa-solid fa-comments') : 'fa-solid fa-comments',
            windowTitle: active ? (info.name ?? active.name) : 'Messages',
            subtitle: memberNames.length ? memberNames.join(', ') : 'No conversation selected',
            actionBarLeft,
            actionBarRight,
            bodyContent
        };
    }

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

    _buildBodyContext(active, conversations = []) {
        const trayItems = conversations.map((entry) => {
            const info = ConversationManager.getInfo(entry);
            return {
                id: entry.id,
                name: info.name ?? entry.name,
                icon: info.icon ?? (info.kind === 'party' ? 'fa-solid fa-users' : 'fa-solid fa-user-group'),
                tint: info.tint ?? '',
                active: entry.id === this._activeConversationId,
                unread: ConversationManager.getUnreadCount(entry),
                memberNames: (info.members ?? [])
                    .map((id) => game.users.get(id)?.name)
                    .filter(Boolean)
                    .join(', ')
            };
        });
        if (this._picker) {
            const isEdit = this._picker.mode === 'edit';
            return {
                conversations: trayItems,
                picker: {
                    name: this._picker.name,
                    tint: this._picker.tint || '#ac9f81',
                    title: isEdit ? 'Edit Conversation' : 'New Conversation',
                    titleIcon: isEdit ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-user-plus',
                    submitLabel: isEdit ? 'Save Changes' : 'Start Conversation',
                    hideMembers: !!this._picker.isParty,
                    icons: CONVERSATION_ICONS.map((icon) => ({
                        icon,
                        selected: icon === this._picker.icon
                    })),
                    users: ConversationManager.getSelectableUsers()
                        // Creating: you are always included, so don't list yourself.
                        // Editing: show everyone — the member list is authoritative.
                        .filter((u) => isEdit || u.id !== game.user.id)
                        .map((u) => ({
                            id: u.id,
                            name: u.name,
                            avatar: u.avatar || 'icons/svg/mystery-man.svg',
                            active: u.active,
                            selected: this._picker.members.has(u.id)
                        }))
                }
            };
        }

        const toneMap = Object.fromEntries(MESSAGE_TONES.map((t) => [t.key, t]));
        const reactionMap = Object.fromEntries(MESSAGE_REACTIONS.map((r) => [r.key, r]));
        const messages = active ? ConversationManager.getMessages(active).map((m) => ({
            ...m,
            timeDisplay: formatTimestamp(m.timestamp),
            toneIcon: toneMap[m.tone]?.icon ?? toneMap.message.icon,
            toneLabel: toneMap[m.tone]?.label ?? 'Message',
            showTone: m.tone !== 'message',
            reactionsDisplay: this._buildReactionsDisplay(m.reactions, reactionMap)
        })) : [];

        return {
            conversations: trayItems,
            picker: null,
            hasConversation: !!active,
            messages,
            tones: MESSAGE_TONES.map((t) => ({ ...t, active: t.key === this._tone })),
            draft: this._draft
        };
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

    // ==============================================================
    // ===== RENDER LIFECYCLE =======================================
    // ==============================================================

    async render(force = false) {
        // Preserve an in-progress draft across live re-renders
        const root = this._getRoot?.();
        const textarea = root?.querySelector?.('.bibliosoph-messages-input');
        if (textarea) this._draft = textarea.value;
        return super.render(force);
    }

    async _onRender(context, options) {
        await super._onRender?.(context, options);
        this._attachContextMenuOnce();
        const root = this._getRoot();
        if (!root) return;

        // ENTER sends (when enabled), SHIFT+ENTER inserts a newline
        const textarea = root.querySelector('.bibliosoph-messages-input');
        if (textarea && !textarea.dataset.bibliosophBound) {
            textarea.dataset.bibliosophBound = '1';
            textarea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey && this._enterSends) {
                    event.preventDefault();
                    this._send();
                }
            });
        }

        // ENTER Sends toggle (action bar)
        const enterToggle = root.querySelector('.bibliosoph-messages-enter-sends');
        if (enterToggle && !enterToggle.dataset.bibliosophBound) {
            enterToggle.dataset.bibliosophBound = '1';
            enterToggle.addEventListener('change', () => {
                this._enterSends = enterToggle.checked;
            });
        }

        // Drag & drop documents (item, actor, journal, …) → insert a UUID link
        const main = root.querySelector('.bibliosoph-messages-main');
        if (main && !main.dataset.bibliosophDropBound) {
            main.dataset.bibliosophDropBound = '1';
            main.addEventListener('dragover', (event) => {
                event.preventDefault();
                main.classList.add('bibliosoph-messages-dragover');
            });
            main.addEventListener('dragleave', (event) => {
                if (!main.contains(event.relatedTarget)) main.classList.remove('bibliosoph-messages-dragover');
            });
            main.addEventListener('drop', (event) => {
                main.classList.remove('bibliosoph-messages-dragover');
                this._onDropDocument(event);
            });
        }

        // Keep the thread pinned to the newest message
        const thread = root.querySelector('.bibliosoph-messages-thread');
        if (thread) thread.scrollTop = thread.scrollHeight;

        // Viewing a conversation marks it read
        const active = game.journal.get(this._activeConversationId);
        if (active && ConversationManager.getUnreadCount(active) > 0) {
            ConversationManager.markRead(active);
        }
    }

    async close(options) {
        if (MessagesWindow.current === this) MessagesWindow.current = null;
        return super.close(options);
    }

    // ==============================================================
    // ===== ACTIONS ================================================
    // ==============================================================

    _selectConversation(id) {
        if (!id || id === this._activeConversationId) return;
        this._activeConversationId = id;
        this._picker = null;
        this._draft = '';
        const entry = game.journal.get(id);
        if (entry) ConversationManager.markRead(entry);
        this.render(false);
    }

    _openPicker() {
        this._picker = { mode: 'create', name: '', members: new Set(), icon: CONVERSATION_ICONS[0], tint: '' };
        this.render(false);
    }

    _openEditPicker(entry) {
        const info = ConversationManager.getInfo(entry);
        this._picker = {
            mode: 'edit',
            entryId: entry.id,
            name: info.name ?? entry.name,
            icon: info.icon ?? CONVERSATION_ICONS[0],
            tint: info.tint ?? '',
            members: new Set(info.members ?? []),
            isParty: info.kind === 'party'
        };
        this.render(false);
    }

    _pickIcon(icon) {
        if (!this._picker || !CONVERSATION_ICONS.includes(icon)) return;
        this._preservePickerName();
        this._picker.icon = icon;
        this.render(false);
    }

    _preservePickerName() {
        if (!this._picker) return;
        const root = this._getRoot();
        const nameInput = root?.querySelector('.bibliosoph-messages-picker-name');
        if (nameInput) this._picker.name = nameInput.value;
        const tintInput = root?.querySelector('.bibliosoph-messages-picker-tint');
        if (tintInput) this._picker.tint = tintInput.value;
    }

    _closePicker() {
        this._picker = null;
        this.render(false);
    }

    _toggleMember(userId) {
        if (!this._picker || !userId) return;
        this._preservePickerName();
        if (this._picker.members.has(userId)) this._picker.members.delete(userId);
        else this._picker.members.add(userId);
        this.render(false);
    }

    async _createConversation() {
        if (!this._picker) return;
        this._preservePickerName();
        const name = (this._picker.name ?? '').trim();
        const members = [...this._picker.members];

        if (this._picker.mode === 'edit') {
            const entry = game.journal.get(this._picker.entryId);
            if (entry) {
                await ConversationManager.updateConversation(entry, {
                    name,
                    icon: this._picker.icon,
                    tint: this._picker.tint,
                    members: this._picker.isParty ? undefined : members
                });
            }
            this._picker = null;
            this.render(false);
            return;
        }

        if (!members.length) {
            ui.notifications.warn('Select at least one member.');
            return;
        }
        const entry = await ConversationManager.createConversation({ members, name, icon: this._picker.icon, tint: this._picker.tint });
        this._picker = null;
        // GM gets the entry back synchronously; players see it arrive (and get
        // auto-focused) via the createJournalEntry hook in ConversationManager
        if (entry) this._activeConversationId = entry.id;
        this.render(false);
    }

    _setTone(tone) {
        if (!MESSAGE_TONES.some((t) => t.key === tone)) return;
        this._tone = tone;
        this.render(false);
    }

    async _send() {
        const root = this._getRoot();
        const textarea = root?.querySelector('.bibliosoph-messages-input');
        const text = (textarea?.value ?? '').trim();
        if (!text) return;
        const entry = game.journal.get(this._activeConversationId);
        if (!entry) {
            ui.notifications.warn('Select a conversation first.');
            return;
        }
        this._draft = '';
        if (textarea) textarea.value = '';
        await ConversationManager.postMessage(entry, { markdown: text, tone: this._tone });
        this._tone = 'message';
        // Our own createJournalEntryPage hook re-renders the window
    }

    // ==============================================================
    // ===== DRAG & DROP (documents → UUID links) ===================
    // ==============================================================

    /**
     * Drop an item, actor/token, journal, roll table, … into the window:
     * builds an @UUID enricher via Blacksmith's UUID builder
     * (api.compendiums.formatLink) and inserts it at the textarea cursor.
     */
    async _onDropDocument(event) {
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
        } catch (_) {
            return;
        }
        if (!data) return;
        event.preventDefault();

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

        const textarea = this._getRoot()?.querySelector('.bibliosoph-messages-input');
        if (!textarea) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const spacer = before && !before.endsWith(' ') ? ' ' : '';
        textarea.value = `${before}${spacer}${link} ${after}`;
        const caret = (before + spacer + link + ' ').length;
        textarea.setSelectionRange(caret, caret);
        textarea.focus();
        this._draft = textarea.value;
    }

    // ==============================================================
    // ===== REACTIONS ==============================================
    // ==============================================================

    async _toggleReaction(messageId, reactionKey) {
        const entry = game.journal.get(this._activeConversationId);
        if (!entry || !messageId || !reactionKey) return;
        await ConversationManager.toggleReaction(entry, messageId, reactionKey);
        // updateJournalEntryPage hook refreshes the window
    }

    // ==============================================================
    // ===== CONTEXT MENUS (Blacksmith uiContextMenu) ===============
    // ==============================================================

    /** One document-level contextmenu listener for the app (like base click delegation). */
    static _contextMenuAttached = false;

    _attachContextMenuOnce() {
        if (MessagesWindow._contextMenuAttached) return;
        MessagesWindow._contextMenuAttached = true;
        document.addEventListener('contextmenu', (event) => {
            const win = MessagesWindow.current;
            if (!win?.rendered) return;
            const root = win._getRoot();
            if (!root?.contains?.(event.target)) return;

            const messageEl = event.target.closest('.bibliosoph-message-wrapper[data-message-id]');
            if (messageEl) {
                event.preventDefault();
                win._showMessageContextMenu(event, messageEl.dataset.messageId);
                return;
            }
            const trayEl = event.target.closest('.bibliosoph-messages-tray-item[data-id]');
            if (trayEl) {
                event.preventDefault();
                win._showConversationContextMenu(event, trayEl.dataset.id);
            }
        });
    }

    _getContextMenuApi() {
        return game.modules.get('coffee-pub-blacksmith')?.api?.uiContextMenu ?? null;
    }

    _showMessageContextMenu(event, messageId) {
        const menu = this._getContextMenuApi();
        const entry = game.journal.get(this._activeConversationId);
        if (!menu || !entry) return;
        const message = ConversationManager.getMessages(entry).find((m) => m.id === messageId);
        if (!message) return;

        const items = [
            {
                name: 'React',
                icon: 'fa-solid fa-face-smile',
                submenu: MESSAGE_REACTIONS.map((r) => ({
                    name: r.label,
                    icon: r.icon,
                    callback: () => this._toggleReaction(messageId, r.key)
                }))
            },
            {
                name: 'Send to Foundry Chat',
                icon: 'fa-solid fa-share-from-square',
                callback: () => this._sendToChat(messageId)
            }
        ];
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

    _showConversationContextMenu(event, conversationId) {
        const menu = this._getContextMenuApi();
        const entry = game.journal.get(conversationId);
        if (!menu || !entry) return;
        const info = ConversationManager.getInfo(entry);
        const canEdit = ConversationManager.canEdit(entry);
        const canDelete = info.kind !== 'party' && (game.user.isGM || info.createdBy === game.user.id);
        if (!canEdit && !canDelete) return;

        const items = [];
        if (canEdit) {
            items.push({
                name: 'Edit Conversation',
                icon: 'fa-solid fa-pen-to-square',
                description: info.kind === 'party'
                    ? 'Change the name or icon. Party membership is automatic.'
                    : 'Change the name, icon, or members.',
                callback: () => this._openEditPicker(entry)
            });
        }
        if (canDelete) {
            if (items.length) items.push({ separator: true });
            items.push({
                name: 'Delete Conversation',
                icon: 'fa-solid fa-trash',
                description: 'Removes the conversation and its history for everyone.',
                callback: () => ConversationManager.deleteConversation(entry)
            });
        }

        menu.show({
            id: 'bibliosoph-messages-context',
            x: event.clientX,
            y: event.clientY,
            zones: items
        });
    }

    // ==============================================================
    // ===== SEND TO FOUNDRY CHAT (escalation, Regent-style) ========
    // ==============================================================

    async _sendToChat(messageId) {
        const entry = game.journal.get(this._activeConversationId);
        if (!entry || !messageId) return;
        const message = ConversationManager.getMessages(entry).find((m) => m.id === messageId);
        if (!message) return;

        const info = ConversationManager.getInfo(entry);
        const isParty = info.kind === 'party';
        const theme = isParty
            ? getSetting('cardThemePartyMessage', 'theme-default')
            : getSetting('cardThemePrivateMessage', 'theme-default');

        let content;
        try {
            const response = await fetch(BIBLIOSOPH.MESSAGE_TEMPLATE_CARD);
            const template = Handlebars.compile(await response.text());
            content = template({
                userName: message.senderName,
                userAvatar: message.avatar,
                theme,
                iconStyle: isParty ? 'fa-comments-alt' : 'fa-feather',
                cardTitle: isParty ? 'Party Message' : `Private Message — ${escapeHtml(info.name ?? entry.name)}`,
                content: message.html,
                action: '',
                actionlabel: '',
                image: isParty ? '' : message.avatar,
                hasSectionContent: false
            });
        } catch (_) {
            content = `<div class="${theme}"><strong>${escapeHtml(message.senderName)}:</strong> ${message.html}</div>`;
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
        ui.notifications.info('Message sent to Foundry chat.');
    }
}
