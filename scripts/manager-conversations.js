// ==================================================================
// ===== CONVERSATION MANAGER (manager-conversations.js) ===========
// ==================================================================
// Journal-backed conversations for the unified Messages window.
// One hidden JournalEntry per conversation, one JournalEntryPage per
// message. Delivery/sync ride on Foundry document hooks — no ChatMessages,
// no chat DB. Sockets are used ONLY for the create-conversation relay to
// the GM (dispatch-targeted; payloads are not private — see plan-chat.md).
//
// Requires Blacksmith >= 13.8.5 (targeted socket emit).
// ==================================================================

import { MODULE } from './const.js';

/** Folder that holds all conversation journals (hidden from the sidebar). */
export const CONVERSATIONS_FOLDER_NAME = 'Bibliosoph Messages';

/** Socket event: player asks a GM client to create a conversation. */
export const SOCKET_CREATE_CONVERSATION = `${MODULE.ID}.conversation.create`;

/** Socket event: player asks a GM client to update a conversation (name/icon/members). */
export const SOCKET_UPDATE_CONVERSATION = `${MODULE.ID}.conversation.update`;

function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api;
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

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `MESSAGES | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | MESSAGES | ${message}`, data);
    }
}

/** Ownership level constants with safe fallbacks. */
const LEVELS = () => CONST.DOCUMENT_OWNERSHIP_LEVELS ?? { NONE: 0, OBSERVER: 2, OWNER: 3 };

/** Users that should never be conversation members (system accounts). */
const EXCLUDED_USER_PREFIXES = ['Cameraman', 'Developer', 'Author'];

function isSelectableUser(user) {
    if (!user?.name) return false;
    return !EXCLUDED_USER_PREFIXES.some((prefix) => user.name.startsWith(prefix));
}

export class ConversationManager {
    static _initialized = false;
    /** True once the GM-side socket relay handler is registered. */
    static _socketRegistered = false;

    // ==============================================================
    // ===== INITIALIZATION =========================================
    // ==============================================================

    /**
     * Initialize the conversation system. Call once from 'ready' after
     * Blacksmith is confirmed available. Safe to call more than once.
     */
    static async initialize() {
        if (this._initialized) return;
        this._initialized = true;

        this._registerDocumentHooks();
        this._registerSidebarHiding();
        await this._registerSocketRelay();

        if (game.user.isGM && game.users.activeGM?.id === game.user.id) {
            try {
                await this._ensurePartyConversation();
            } catch (error) {
                log('Failed to bootstrap party conversation', error?.message, false, false);
            }
        }
        log('ConversationManager initialized');
    }

    // ==============================================================
    // ===== FOLDER / LOOKUPS =======================================
    // ==============================================================

    static getFolder() {
        return game.folders.find((f) => f.type === 'JournalEntry' && f.name === CONVERSATIONS_FOLDER_NAME) ?? null;
    }

    /** GM only: create the hidden conversations folder if missing. */
    static async _ensureFolder() {
        let folder = this.getFolder();
        if (!folder) {
            folder = await Folder.create({
                name: CONVERSATIONS_FOLDER_NAME,
                type: 'JournalEntry',
                flags: { [MODULE.ID]: { type: 'conversations-folder' } }
            });
        }
        return folder;
    }

    /** Is this JournalEntry one of our conversations? */
    static isConversation(entry) {
        return entry?.getFlag?.(MODULE.ID, 'type') === 'conversation';
    }

    /** Is this JournalEntryPage one of our messages? */
    static isMessagePage(page) {
        return page?.getFlag?.(MODULE.ID, 'type') === 'message';
    }

    /** Conversation flag data: { kind, members, name, createdBy, created }. */
    static getInfo(entry) {
        return entry?.flags?.[MODULE.ID] ?? {};
    }

    static isMember(entry, userId = game.user.id) {
        const members = this.getInfo(entry).members ?? [];
        return members.includes(userId);
    }

    /**
     * Conversations visible to the current user, most recent activity first.
     * Party conversation is always pinned first when present.
     * GM sees all conversations only when gmSeesAllConversations is on.
     */
    static getConversations() {
        const gmSeesAll = game.user.isGM && getSetting('gmSeesAllConversations', true);
        const list = game.journal.filter((entry) => {
            if (!this.isConversation(entry)) return false;
            return this.isMember(entry) || gmSeesAll;
        });
        list.sort((a, b) => {
            const aParty = this.getInfo(a).kind === 'party' ? 1 : 0;
            const bParty = this.getInfo(b).kind === 'party' ? 1 : 0;
            if (aParty !== bParty) return bParty - aParty;
            return this.getLastActivity(b) - this.getLastActivity(a);
        });
        return list;
    }

    static getPartyConversation() {
        return game.journal.find((entry) => this.isConversation(entry) && this.getInfo(entry).kind === 'party') ?? null;
    }

    /** Timestamp of the newest message (or creation time) for sorting. */
    static getLastActivity(entry) {
        const messages = this.getMessages(entry);
        if (messages.length) return messages[messages.length - 1].timestamp;
        return this.getInfo(entry).created ?? 0;
    }

    // ==============================================================
    // ===== CONVERSATION CREATION ==================================
    // ==============================================================

    /**
     * All users a conversation can include (excludes system accounts).
     * @returns {User[]}
     */
    static getSelectableUsers() {
        return game.users.filter(isSelectableUser);
    }

    /**
     * Create a group conversation. GMs create directly; players relay the
     * request to the first active GM over the (targeted) Blacksmith socket.
     * The requester sees the new conversation appear via the
     * createJournalEntry hook, since they are an owner of the new document.
     * @param {object} data
     * @param {string[]} data.members - user ids (creator is added automatically)
     * @param {string} [data.name] - optional custom name
     * @returns {Promise<JournalEntry|null>} the entry when created locally (GM), else null
     */
    static async createConversation({ members = [], name = '', icon = '', tint = '' } = {}) {
        const memberSet = new Set(members);
        memberSet.add(game.user.id);
        const finalMembers = [...memberSet];
        if (finalMembers.length < 2) {
            ui.notifications.warn('Select at least one other member for the conversation.');
            return null;
        }

        if (game.user.isGM) {
            return this._createConversationEntry({ members: finalMembers, name, icon, tint, createdBy: game.user.id });
        }

        const activeGMs = game.users.filter((u) => u.isGM && u.active);
        if (!activeGMs.length) {
            ui.notifications.warn('A GM must be connected to start a new conversation.');
            return null;
        }

        const sockets = getBlacksmith()?.sockets;
        if (!sockets) {
            ui.notifications.error('Blacksmith sockets unavailable — cannot start a new conversation.');
            return null;
        }
        await sockets.waitForReady();
        await sockets.emit(
            SOCKET_CREATE_CONVERSATION,
            { members: finalMembers, name, icon, tint, requestedBy: game.user.id },
            { recipients: activeGMs.map((u) => u.id) }
        );
        return null;
    }

    /** Accept only #rgb / #rrggbb tints (values come from a color input). */
    static _sanitizeTint(tint) {
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tint ?? '') ? tint : '';
    }

    /** Find the existing 1:1 conversation between the current user and another user. */
    static getDirectConversation(otherUserId, userId = game.user.id) {
        return game.journal.find((entry) => {
            if (!this.isConversation(entry)) return false;
            const info = this.getInfo(entry);
            if (info.kind !== 'direct') return false;
            const members = info.members ?? [];
            return members.length === 2 && members.includes(userId) && members.includes(otherUserId);
        }) ?? null;
    }

    /**
     * Get (or lazily create) the 1:1 conversation with another user. GMs
     * create directly; players relay to the GM and wait for the document to
     * arrive. Returns null on timeout / no GM.
     */
    static async ensureDirectConversation(otherUserId) {
        const existing = this.getDirectConversation(otherUserId);
        if (existing) return existing;

        const members = [game.user.id, otherUserId];
        if (game.user.isGM) {
            return this._createConversationEntry({ members, kind: 'direct', createdBy: game.user.id });
        }

        const activeGMs = game.users.filter((u) => u.isGM && u.active);
        if (!activeGMs.length) {
            ui.notifications.warn('A GM must be connected to start this direct message.');
            return null;
        }
        const sockets = getBlacksmith()?.sockets;
        if (!sockets) return null;
        await sockets.waitForReady();

        // Listen for the relayed creation BEFORE emitting, then wait for it
        const created = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                Hooks.off('createJournalEntry', onCreate);
                resolve(null);
            }, 8000);
            const onCreate = (entry) => {
                if (!this.isConversation(entry)) return;
                const info = this.getInfo(entry);
                if (info.kind !== 'direct') return;
                const m = info.members ?? [];
                if (m.includes(game.user.id) && m.includes(otherUserId)) {
                    clearTimeout(timeout);
                    Hooks.off('createJournalEntry', onCreate);
                    resolve(entry);
                }
            };
            Hooks.on('createJournalEntry', onCreate);
        });

        await sockets.emit(
            SOCKET_CREATE_CONVERSATION,
            { members, kind: 'direct', requestedBy: game.user.id },
            { recipients: activeGMs.map((u) => u.id) }
        );
        return created;
    }

    /** GM-side: actually create the conversation JournalEntry. */
    static async _createConversationEntry({ members, name, createdBy, kind = 'group', icon = '', tint = '' }) {
        const folder = await this._ensureFolder();
        const levels = LEVELS();

        const ownership = { default: levels.NONE };
        for (const id of members) ownership[id] = levels.OWNER;

        const displayName = (name || '').trim()
            || (kind === 'direct' ? this._directName(members) : this._defaultName(members));
        const entry = await JournalEntry.create({
            name: displayName,
            folder: folder.id,
            ownership,
            flags: {
                [MODULE.ID]: {
                    type: 'conversation',
                    kind,
                    members,
                    name: displayName,
                    icon: icon || (kind === 'party' ? 'fa-solid fa-users' : kind === 'direct' ? 'fa-solid fa-user' : 'fa-solid fa-user-group'),
                    tint: this._sanitizeTint(tint),
                    createdBy,
                    created: Date.now()
                }
            }
        });
        log(`Conversation created: ${displayName}`, members);
        return entry;
    }

    /** Canonical stored name for a 1:1 ("Alice & Bob"); viewers see the other party's name. */
    static _directName(members) {
        const names = members.map((id) => game.users.get(id)?.name ?? 'Unknown').sort();
        return names.join(' & ');
    }

    static _defaultName(members) {
        const names = members
            .map((id) => game.users.get(id)?.name ?? 'Unknown')
            .filter(Boolean);
        const label = names.slice(0, 3).join(', ');
        return names.length > 3 ? `${label} +${names.length - 3}` : label;
    }

    /** UI gate: may this user edit (rename/re-icon/re-member) the conversation? */
    static canEdit(entry) {
        const info = this.getInfo(entry);
        if (info.kind === 'party') return game.user.isGM;
        if (info.kind === 'direct') return false; // 1:1s are fixed by nature
        return game.user.isGM || info.createdBy === game.user.id;
    }

    /**
     * Update a conversation's name, icon, and/or members. Membership changes
     * rewrite document ownership, so non-GM editors relay to the active GM
     * (same pattern as creation).
     * @param {JournalEntry} entry
     * @param {object} changes - { name?, icon?, members? (full new member list) }
     */
    static async updateConversation(entry, { name, icon, members, tint } = {}) {
        if (!this.isConversation(entry) || !this.canEdit(entry)) return;
        if (Array.isArray(members) && members.length < 2) {
            ui.notifications.warn('A conversation needs at least two members.');
            return;
        }

        if (game.user.isGM) {
            return this._applyConversationUpdate(entry.id, { name, icon, members, tint });
        }

        const activeGMs = game.users.filter((u) => u.isGM && u.active);
        if (!activeGMs.length) {
            ui.notifications.warn('A GM must be connected to edit a conversation.');
            return;
        }
        const sockets = getBlacksmith()?.sockets;
        if (!sockets) {
            ui.notifications.error('Blacksmith sockets unavailable — cannot edit the conversation.');
            return;
        }
        await sockets.waitForReady();
        await sockets.emit(
            SOCKET_UPDATE_CONVERSATION,
            { entryId: entry.id, name, icon, members, tint, requestedBy: game.user.id },
            { recipients: activeGMs.map((u) => u.id) }
        );
    }

    /** GM-side: apply a conversation update, including ownership for membership changes. */
    static async _applyConversationUpdate(entryId, { name, icon, members, tint, requestedBy = null }) {
        const entry = game.journal.get(entryId);
        if (!this.isConversation(entry)) return;
        const info = this.getInfo(entry);

        // Relayed request: only honor the creator (GM edits arrive directly)
        if (requestedBy && info.createdBy !== requestedBy) return;

        const update = {};
        // The Party conversation's name is owned by the Blacksmith campaign API
        const displayName = info.kind === 'party' ? '' : (name ?? '').trim();
        if (displayName && displayName !== info.name) {
            update.name = displayName;
            update[`flags.${MODULE.ID}.name`] = displayName;
        }
        if (icon && icon !== info.icon) {
            update[`flags.${MODULE.ID}.icon`] = icon;
        }
        if (tint !== undefined) {
            const clean = this._sanitizeTint(tint);
            if (clean !== (info.tint ?? '')) update[`flags.${MODULE.ID}.tint`] = clean;
        }

        // Membership: the Party conversation manages its own membership
        if (Array.isArray(members) && members.length >= 2 && info.kind !== 'party') {
            const levels = LEVELS();
            const ownership = { default: levels.NONE };
            for (const id of members) ownership[id] = levels.OWNER;
            // Explicitly drop removed members back to NONE
            for (const id of info.members ?? []) {
                if (!members.includes(id)) ownership[`-=${id}`] = null;
            }
            update.ownership = ownership;
            update[`flags.${MODULE.ID}.members`] = members;
        }

        if (!Object.keys(update).length) return entry;
        await entry.update(update);
        log(`Conversation updated: ${displayName || info.name}`);
        return entry;
    }

    /** Table-facing party name from the Blacksmith campaign API; falls back to "Party Chat". */
    static async _getPartyName() {
        try {
            const partyBlock = await getBlacksmith()?.campaign?.getParty?.();
            const name = (partyBlock?.name ?? '').trim();
            if (name) return name;
        } catch (_) { /* fall through */ }
        return 'Party Chat';
    }

    /** GM only: ensure the singleton Party conversation exists and includes everyone. */
    static async _ensurePartyConversation() {
        const allUserIds = this.getSelectableUsers().map((u) => u.id);
        const partyName = await this._getPartyName();
        let party = this.getPartyConversation();
        if (!party) {
            party = await this._createConversationEntry({
                members: allUserIds,
                name: partyName,
                createdBy: game.user.id,
                kind: 'party'
            });
            return party;
        }
        // Keep membership + ownership in sync as users are added to the world,
        // and follow the campaign party name when it changes in Blacksmith
        const info = this.getInfo(party);
        const current = new Set(info.members ?? []);
        const missing = allUserIds.filter((id) => !current.has(id));
        const update = {};
        if (missing.length) {
            const levels = LEVELS();
            const ownership = foundry.utils.deepClone(party.ownership ?? { default: levels.NONE });
            for (const id of missing) ownership[id] = levels.OWNER;
            update.ownership = ownership;
            update[`flags.${MODULE.ID}.members`] = [...current, ...missing];
        }
        if (partyName !== info.name) {
            update.name = partyName;
            update[`flags.${MODULE.ID}.name`] = partyName;
        }
        if (Object.keys(update).length) {
            await party.update(update);
            log('Party conversation refreshed', { missing, partyName });
        }
        return party;
    }

    // ==============================================================
    // ===== MESSAGES ===============================================
    // ==============================================================

    /**
     * Post a message into a conversation. Any member (owner) can post.
     * @param {JournalEntry} entry
     * @param {object} data
     * @param {string} data.markdown - raw message text (markdown)
     * @param {string} [data.tone] - message | plan | agree | disagree | praise | insult
     */
    static async postMessage(entry, { markdown, tone = 'message' } = {}) {
        const text = (markdown ?? '').trim();
        if (!entry || !text) return null;

        let html = this.renderMarkdown(text);
        // Enrich @UUID[...]{...} links (from drag & drop) into clickable content links
        try {
            const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
            html = await TE.enrichHTML(html, { async: true });
        } catch (_) { /* store unenriched HTML */ }
        const timestamp = Date.now();
        const formats = CONST.JOURNAL_ENTRY_PAGE_FORMATS ?? { HTML: 1 };

        const [page] = await entry.createEmbeddedDocuments('JournalEntryPage', [{
            name: `msg-${timestamp}-${game.user.id}`,
            type: 'text',
            text: { content: html, format: formats.HTML },
            sort: timestamp,
            flags: {
                [MODULE.ID]: {
                    type: 'message',
                    sender: game.user.id,
                    timestamp,
                    tone,
                    markdown: text
                }
            }
        }]);

        await this._trimRetention(entry);
        return page;
    }

    /**
     * Escape user input, then apply markdown so players can't inject raw HTML.
     * `&` and `<` are enough to neutralize tags; `>` stays literal so
     * blockquote syntax (replies) still reaches the markdown converter.
     */
    static renderMarkdown(text) {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;');
        let html;
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.markdownToHtml) {
            try {
                html = BlacksmithUtils.markdownToHtml(escaped);
            } catch (_) { /* fall through to plain text */ }
        }
        if (html === undefined) html = `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
        return this._renderMarkdownImages(html);
    }

    /**
     * Convert any ![alt](src) still present after markdown conversion into an
     * <img> (the converter may not support image syntax). Only http(s) URLs
     * and server-relative paths are allowed — anything else stays literal.
     */
    static _renderMarkdownImages(html) {
        return html.replace(/!\[([^\]]*)\]\(([^)\s"'<>]+)\)/g, (match, alt, src) => {
            const isWebUrl = /^https?:\/\//i.test(src);
            if (!isWebUrl && src.includes(':')) return match; // no other schemes
            const safeAlt = alt.replace(/"/g, '&quot;');
            return `<img class="bibliosoph-message-image" src="${src}" alt="${safeAlt}">`;
        });
    }

    /**
     * Messages of a conversation, oldest first.
     * @returns {Array<{id, senderId, senderName, avatar, timestamp, tone, html, isOwn}>}
     */
    static getMessages(entry) {
        if (!entry) return [];
        const pages = entry.pages.filter((p) => this.isMessagePage(p));
        const messages = pages.map((page) => {
            const flags = page.flags?.[MODULE.ID] ?? {};
            const sender = game.users.get(flags.sender);
            return {
                id: page.id,
                senderId: flags.sender,
                senderName: sender?.name ?? 'Unknown',
                avatar: sender?.avatar || 'icons/svg/mystery-man.svg',
                color: sender?.color?.css ?? sender?.color ?? '#888888',
                timestamp: flags.timestamp ?? 0,
                tone: flags.tone ?? 'message',
                html: page.text?.content ?? '',
                markdown: flags.markdown ?? '',
                isOwn: flags.sender === game.user.id,
                deleted: !!flags.deleted,
                reactions: flags.deleted ? {} : (flags.reactions ?? {})
            };
        });
        messages.sort((a, b) => a.timestamp - b.timestamp);
        return messages;
    }

    /**
     * Toggle the current user's reaction on a message. One reaction per user:
     * picking the same one removes it, picking another replaces it.
     * Any conversation member (owner of the entry) may react.
     */
    static async toggleReaction(entry, pageId, reactionKey) {
        const page = entry?.pages?.get(pageId);
        if (!page || !this.isMessagePage(page)) return;
        const current = page.flags?.[MODULE.ID]?.reactions?.[game.user.id];
        if (current === reactionKey) {
            await page.update({ [`flags.${MODULE.ID}.reactions.-=${game.user.id}`]: null });
        } else {
            await page.update({ [`flags.${MODULE.ID}.reactions.${game.user.id}`]: reactionKey });
        }
    }

    /**
     * Soft-delete a single message: the content, markdown, and reactions are
     * wiped and a "Message deleted" placeholder remains in the thread.
     * UI gates this to the author or a GM. (Retention trims still hard-delete.)
     */
    static async deleteMessage(entry, pageId) {
        const page = entry?.pages?.get(pageId);
        if (!page || !this.isMessagePage(page)) return;
        const isAuthor = page.flags?.[MODULE.ID]?.sender === game.user.id;
        if (!isAuthor && !game.user.isGM) {
            ui.notifications.warn('You can only delete your own messages.');
            return;
        }
        await page.update({
            'text.content': '',
            [`flags.${MODULE.ID}.deleted`]: true,
            [`flags.${MODULE.ID}.markdown`]: '',
            [`flags.${MODULE.ID}.-=reactions`]: null
        });
    }

    /** Delete a whole conversation. GM or creator only; the Party conversation is permanent. */
    static async deleteConversation(entry) {
        if (!this.isConversation(entry)) return;
        const info = this.getInfo(entry);
        if (info.kind === 'party') {
            ui.notifications.warn('The Party conversation cannot be deleted.');
            return;
        }
        if (!game.user.isGM && info.createdBy !== game.user.id) {
            ui.notifications.warn('Only the GM or the conversation creator can delete it.');
            return;
        }
        await entry.delete();
    }

    /** Delete oldest overflow pages beyond the GM-configured retention cap. */
    static async _trimRetention(entry) {
        const cap = Math.max(10, Number(getSetting('retentionMaxMessages', 200)) || 200);
        const pages = entry.pages
            .filter((p) => this.isMessagePage(p))
            .sort((a, b) => (a.flags?.[MODULE.ID]?.timestamp ?? 0) - (b.flags?.[MODULE.ID]?.timestamp ?? 0));
        const overflow = pages.length - cap;
        if (overflow <= 0) return;
        const ids = pages.slice(0, overflow).map((p) => p.id);
        try {
            await entry.deleteEmbeddedDocuments('JournalEntryPage', ids);
            log(`Retention: trimmed ${ids.length} old message(s) from "${entry.name}"`);
        } catch (error) {
            log('Retention trim failed', error?.message, false, false);
        }
    }

    // ==============================================================
    // ===== READ TRACKING ==========================================
    // ==============================================================

    static getLastRead(conversationId) {
        const lastRead = game.user.getFlag(MODULE.ID, 'lastRead') ?? {};
        return lastRead[conversationId] ?? 0;
    }

    static async markRead(entry) {
        if (!entry) return;
        const lastRead = foundry.utils.deepClone(game.user.getFlag(MODULE.ID, 'lastRead') ?? {});
        lastRead[entry.id] = Date.now();
        await game.user.setFlag(MODULE.ID, 'lastRead', lastRead);
    }

    static getUnreadCount(entry) {
        const lastRead = this.getLastRead(entry.id);
        return this.getMessages(entry).filter((m) => !m.isOwn && m.timestamp > lastRead).length;
    }

    // ==============================================================
    // ===== SOCKET RELAY (create-conversation only) ================
    // ==============================================================

    static async _registerSocketRelay() {
        if (this._socketRegistered) return;
        const blacksmith = getBlacksmith();
        if (!blacksmith) return;

        // sockets attach to module.api asynchronously — poll briefly
        let attempts = 0;
        while (!blacksmith.sockets && attempts < 20) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }
        const sockets = blacksmith.sockets;
        if (!sockets) {
            log('Blacksmith sockets not available; players cannot create conversations', '', false, false);
            return;
        }

        await sockets.waitForReady();
        await sockets.register(SOCKET_CREATE_CONVERSATION, async (data, senderUserId) => {
            // Targeted at active GMs (Blacksmith >= 13.8.5), but keep the
            // first-active-GM guard so exactly one client acts on all builds.
            if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
            const { members, name, icon, tint, kind, requestedBy } = data ?? {};
            if (!Array.isArray(members) || members.length < 2) return;
            const safeKind = kind === 'direct' ? 'direct' : 'group';
            // Never duplicate a 1:1 pair (e.g. both sides clicking at once)
            if (safeKind === 'direct' && members.length === 2
                && this.getDirectConversation(members[0], members[1])) return;
            await this._createConversationEntry({
                members,
                name,
                icon,
                tint,
                kind: safeKind,
                createdBy: requestedBy ?? senderUserId
            });
        });
        await sockets.register(SOCKET_UPDATE_CONVERSATION, async (data, senderUserId) => {
            if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
            const { entryId, name, icon, members, tint, requestedBy } = data ?? {};
            if (!entryId) return;
            await this._applyConversationUpdate(entryId, {
                name,
                icon,
                members,
                tint,
                requestedBy: requestedBy ?? senderUserId
            });
        });
        this._socketRegistered = true;
    }

    // ==============================================================
    // ===== LIVE SYNC / NOTIFICATIONS ==============================
    // ==============================================================

    static _registerDocumentHooks() {
        // New message posted anywhere
        Hooks.on('createJournalEntryPage', (page, _options, _userId) => {
            const entry = page?.parent;
            if (!this.isConversation(entry) || !this.isMessagePage(page)) return;
            this._onIncomingMessage(entry, page);
        });

        // New conversation appears: if this user asked for it (GM relay), focus it
        Hooks.on('createJournalEntry', async (entry) => {
            if (!this.isConversation(entry)) return;
            const win = await this._getOpenWindow();
            if (!win) return;
            if (this.getInfo(entry).createdBy === game.user.id) {
                win._activeConversationId = entry.id;
            }
            win.render(false);
        });

        // Message edited (reactions) — silent refresh, no unread/notification
        Hooks.on('updateJournalEntryPage', (page) => {
            const entry = page?.parent;
            if (!this.isConversation(entry) || !this.isMessagePage(page)) return;
            this._refreshWindow();
        });

        // Conversation renamed / membership changed / deleted
        for (const hook of ['updateJournalEntry', 'deleteJournalEntry', 'deleteJournalEntryPage']) {
            Hooks.on(hook, (doc) => {
                const entry = hook === 'deleteJournalEntryPage' ? doc?.parent : doc;
                if (!this.isConversation(entry)) return;
                this._refreshWindow();
            });
        }
    }

    static async _onIncomingMessage(entry, page) {
        const flags = page.flags?.[MODULE.ID] ?? {};
        const isOwn = flags.sender === game.user.id;
        const gmSeesAll = game.user.isGM && getSetting('gmSeesAllConversations', true);
        if (!this.isMember(entry) && !gmSeesAll) return;

        const win = await this._getOpenWindow();
        const viewingThis = win && win.activeConversationId === entry.id;

        if (viewingThis) {
            win.render(false);
            if (!isOwn) this.markRead(entry);
            return;
        }

        // Window closed or focused elsewhere: refresh list and signal
        this._refreshWindow();
        if (isOwn) return;

        const sender = game.users.get(flags.sender)?.name ?? 'Someone';
        const conversationName = this.getInfo(entry).name ?? entry.name;
        const blacksmith = getBlacksmith();
        blacksmith?.addNotification?.(
            `${sender} sent a message in "${conversationName}"`,
            'fas fa-envelope',
            5,
            MODULE.ID
        );

        const sound = getSetting('messageNotifySound', 'none');
        if (sound && sound !== 'none' && typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.playSound) {
            // Local-only playback: every receiving client runs this hook itself
            BlacksmithUtils.playSound(sound, 0.7, false, false);
        }
    }

    /** Re-render the Messages window if it is open (list + thread). */
    static async _refreshWindow() {
        const win = await this._getOpenWindow();
        win?.render(false);
    }

    static async _getOpenWindow() {
        try {
            const { MessagesWindow } = await import('./window-messages.js');
            const win = MessagesWindow.current;
            return win?.rendered ? win : null;
        } catch (_) {
            return null;
        }
    }

    // ==============================================================
    // ===== SIDEBAR HIDING =========================================
    // ==============================================================

    /** Hide the conversations folder (and its entries) from the journal sidebar. */
    static _registerSidebarHiding() {
        Hooks.on('renderJournalDirectory', (_app, html) => {
            const root = html?.jquery ? html[0] : html;
            if (!root?.querySelectorAll) return;
            const folder = this.getFolder();
            if (folder) {
                root.querySelectorAll(`li.folder[data-folder-id="${folder.id}"], li[data-uuid="${folder.uuid}"]`)
                    .forEach((el) => el.remove());
            }
            // Belt and suspenders: hide any stray conversation entries
            for (const entry of game.journal) {
                if (!this.isConversation(entry)) continue;
                root.querySelectorAll(`li[data-entry-id="${entry.id}"], li[data-document-id="${entry.id}"]`)
                    .forEach((el) => el.remove());
            }
        });
    }
}
