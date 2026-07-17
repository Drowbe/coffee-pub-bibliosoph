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

/** Socket event: ephemeral "user is typing" ping to conversation members. */
export const SOCKET_TYPING = `${MODULE.ID}.conversation.typing`;

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

/**
 * Users excluded from the Messages system, from the messagesExcludedUsers
 * setting (comma list; case-insensitive exact-or-prefix name match).
 */
function isSelectableUser(user) {
    if (!user?.name) return false;
    const raw = getSetting('messagesExcludedUsers', 'Cameraman, DeveloperXXX, AuthorXXX') ?? '';
    const tokens = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const name = user.name.toLowerCase();
    return !tokens.some((token) => name === token || name.startsWith(token));
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
        this._applySidebarHidingStyle();
        // Before any awaited setup: socket waits can stall and must never
        // delay or swallow the login unread notification.
        this.notifyUnread();

        try {
            await this._registerSocketRelay();
        } catch (error) {
            log('Socket relay registration failed', error?.message, false, false);
        }

        if (game.user.isGM && game.users.activeGM?.id === game.user.id) {
            try {
                await this._ensurePartyConversation();
            } catch (error) {
                log('Failed to bootstrap party conversation', error?.message, false, false);
            }
        }

        log('ConversationManager initialized');
    }

    /** Menubar id of the live unread-count notification, if any. */
    static _unreadNotificationId = null;

    /** Remove the unread-count notification (e.g. the Messages window opened). */
    static clearUnreadNotification() {
        if (!this._unreadNotificationId) return;
        getBlacksmith()?.removeNotification?.(this._unreadNotificationId);
        this._unreadNotificationId = null;
    }

    /**
     * Post (or refresh) the persistent unread-count notification. Called on
     * login and again when the Messages window closes with unread remaining.
     * Stays until clicked (opens Messages) or dismissed with the ×.
     */
    static notifyUnread() {
        const totalUnread = this.getConversations()
            .filter((entry) => this.isMember(entry))
            .reduce((total, entry) => total + this.getUnreadCount(entry), 0);
        this.clearUnreadNotification(); // never stack; repost refreshes the count
        log(`notifyUnread: ${totalUnread} unread`);
        if (totalUnread <= 0) return;
        const blacksmith = getBlacksmith();
        if (typeof blacksmith?.addNotification !== 'function') {
            log('notifyUnread: Blacksmith addNotification unavailable', '', false, false);
            return;
        }
        const id = blacksmith.addNotification(
            `${totalUnread} Unread Message${totalUnread === 1 ? '' : 's'}`,
            'fas fa-envelope',
            0, // persistent until clicked or dismissed
            MODULE.ID,
            {
                pulse: true,
                // Runs in Blacksmith's context — import locally, no module state
                onClick: async () => {
                    try {
                        const { openMessagesWindow } = await import('./window-messages.js');
                        openMessagesWindow();
                    } catch (_) { /* no-op */ }
                }
            }
        );
        if (!id) return;
        this._unreadNotificationId = id;
        // Pulse to draw the eye, then settle (60s for testing)
        setTimeout(() => blacksmith?.updateNotification?.(id, { pulse: false }), 60000);
    }

    // ==============================================================
    // ===== UI SOUNDS ==============================================
    // ==============================================================

    /** Setting key per sound kind (all user-scoped, Blacksmith sound paths). */
    static SOUND_SETTINGS = {
        alert: 'messageSoundAlert',
        receive: 'messageSoundReceive',
        send: 'messageSoundSend',
        switch: 'messageSoundSwitch',
        close: 'messageSoundClose'
    };

    /** Local mute toggle (the speaker button in the Messages window tray). */
    static soundsMuted() {
        try {
            return localStorage.getItem('bibliosoph-messages-muted') === 'true';
        } catch (_) {
            return false;
        }
    }

    static setSoundsMuted(muted) {
        try {
            localStorage.setItem('bibliosoph-messages-muted', muted ? 'true' : 'false');
        } catch (_) { /* no-op */ }
    }

    /** Play one of the Messages UI sounds locally, honoring the mute toggle. */
    static playUiSound(kind) {
        if (this.soundsMuted()) return;
        const settingKey = this.SOUND_SETTINGS[kind];
        if (!settingKey) return;
        const sound = getSetting(settingKey, 'none');
        if (!sound || sound === 'none') return;
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.playSound) {
            BlacksmithUtils.playSound(sound, 0.7, false, false);
        }
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
        // Keep membership + ownership in sync (new users join, excluded or
        // deleted users drop out), and follow the campaign party name
        const info = this.getInfo(party);
        const current = new Set(info.members ?? []);
        const selectable = new Set(allUserIds);
        const missing = allUserIds.filter((id) => !current.has(id));
        const removed = [...current].filter((id) => !selectable.has(id));
        const update = {};
        if (missing.length || removed.length) {
            const levels = LEVELS();
            const ownership = foundry.utils.deepClone(party.ownership ?? { default: levels.NONE });
            for (const id of missing) ownership[id] = levels.OWNER;
            for (const id of removed) {
                delete ownership[id];
                ownership[`-=${id}`] = null;
            }
            update.ownership = ownership;
            update[`flags.${MODULE.ID}.members`] = allUserIds;
        }
        if (partyName !== info.name) {
            update.name = partyName;
            update[`flags.${MODULE.ID}.name`] = partyName;
        }
        if (Object.keys(update).length) {
            await party.update(update);
            log('Party conversation refreshed', { missing, removed, partyName });
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
        let text = (markdown ?? '').trim();
        if (!entry || !text) return null;

        text = await this._linkifyBareUuids(text);
        const mentions = this._findMentions(text, entry);
        const html = await this._composeHtml(text, entry);
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
                    markdown: text,
                    mentions
                }
            }
        }]);

        await this._trimRetention(entry);
        return page;
    }

    /**
     * Convert bare pasted UUIDs (Actor.xxxx, JournalEntry.x.JournalEntryPage.y,
     * Compendium.scope.pack.Type.id, …) into @UUID[...]{Name} links. UUIDs that
     * don't resolve, and UUIDs already inside an @UUID[...] enricher, are left
     * as-is.
     */
    static async _linkifyBareUuids(text) {
        const ID = '[a-zA-Z0-9]{16}';
        const TYPES = '(?:Actor|Item|JournalEntry|JournalEntryPage|Scene|RollTable|Macro|Playlist|Cards|Adventure|Token|ActiveEffect)';
        const worldChain = `${TYPES}\\.${ID}(?:\\.${TYPES}\\.${ID})*`;
        const compendium = `Compendium\\.[\\w-]+\\.[\\w-]+(?:\\.${TYPES}\\.${ID})+`;
        // No match when preceded by [ (inside @UUID[...]), @, ., or a word char
        const re = new RegExp(`(?<![\\w\\[.@])(${compendium}|${worldChain})(?!\\w)`, 'g');

        const uuids = [...new Set(Array.from(text.matchAll(re), (m) => m[1]))];
        if (!uuids.length) return text;

        const compendiumsApi = getBlacksmith()?.compendiums;
        const replacements = new Map();
        for (const uuid of uuids) {
            let doc = null;
            try {
                doc = await fromUuid(uuid);
            } catch (_) { /* unresolvable — leave the text alone */ }
            const label = (doc?.name ?? doc?.title ?? '').replace(/[{}\[\]]/g, '').trim();
            if (!label) continue;
            replacements.set(uuid, compendiumsApi?.formatLink
                ? compendiumsApi.formatLink(uuid, label)
                : `@UUID[${uuid}]{${label}}`);
        }
        if (!replacements.size) return text;
        return text.replace(re, (match) => replacements.get(match) ?? match);
    }

    /** Markdown → enriched HTML (escape, convert, enrich @UUID content links, wrap @mentions). */
    static async _composeHtml(text, entry = null) {
        let html = this.renderMarkdown(text);
        try {
            const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
            html = await TE.enrichHTML(html, { async: true });
        } catch (_) { /* store unenriched HTML */ }
        if (entry) html = this._applyMentionHtml(html, entry);
        return html;
    }

    // ==============================================================
    // ===== @MENTIONS ==============================================
    // ==============================================================

    /**
     * Names a conversation member can be @mentioned by: their user name and
     * their assigned character's name, each resolving to the member's userId.
     */
    static _mentionTargets(entry) {
        const targets = [];
        for (const id of this.getInfo(entry).members ?? []) {
            const user = game.users.get(id);
            if (!user?.name) continue;
            targets.push({ name: user.name, userId: user.id });
            const charName = user.character?.name;
            if (charName) targets.push({ name: charName, userId: user.id });
        }
        return targets;
    }

    /**
     * Resolve one mention candidate against the targets. Exact full-name
     * matches always win; partial candidates (min 3 chars) match a prefix of
     * the full name ("@alicia" → "Alicia Panicucci"), then a prefix of any
     * word in it ("@panicucci").
     */
    static _matchTarget(candidate, targets) {
        const c = candidate.toLowerCase();
        let t = targets.find((t) => t.name.toLowerCase() === c);
        if (t) return t;
        if (c.length < 3) return null; // too short to partial-match safely
        t = targets.find((t) => t.name.toLowerCase().startsWith(c));
        if (t) return t;
        return targets.find((t) => t.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(c))) ?? null;
    }

    /**
     * Scan text for @mentions against the targets. Each @ grabs up to four
     * following words and resolves greedily, longest candidate first, so
     * "@alicia panicucci rocks" highlights "@alicia panicucci" while
     * "@alicia rocks" highlights just "@alicia".
     * @returns {Array<{index: number, length: number, userId: string}>}
     */
    static _scanMentions(text, targets) {
        if (!targets.length) return [];
        const WORD = "[\\p{L}\\p{N}'’\\-]+";
        const re = new RegExp(`(?<![\\p{L}\\p{N}@])@(${WORD}(?:[ \\t]${WORD}){0,3})`, 'gu');
        const found = [];
        for (const m of text.matchAll(re)) {
            const words = m[1].split(/[ \t]+/);
            for (let n = words.length; n >= 1; n--) {
                const candidate = words.slice(0, n).join(' ');
                const target = this._matchTarget(candidate, targets);
                if (target) {
                    found.push({ index: m.index, length: 1 + candidate.length, userId: target.userId, name: target.name });
                    break;
                }
            }
        }
        return found;
    }

    /** User ids @mentioned in raw message text (conversation members only). */
    static _findMentions(text, entry) {
        const hits = this._scanMentions(text, this._mentionTargets(entry));
        return [...new Set(hits.map((h) => h.userId))];
    }

    /**
     * Wrap @mentions in rendered HTML with a highlight span. Names are
     * matched in their HTML-escaped form since renderMarkdown escaped the text.
     */
    static _applyMentionHtml(html, entry) {
        const escName = (n) => n.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const targets = this._mentionTargets(entry).map((t) => ({ ...t, name: escName(t.name) }));
        const hits = this._scanMentions(html, targets);
        if (!hits.length) return html;
        let out = '';
        let pos = 0;
        for (const hit of hits) {
            out += html.slice(pos, hit.index);
            // Show the resolved full name even when a partial was typed
            out += `<span class="bibliosoph-mention" data-user-id="${hit.userId}">@${hit.name}</span>`;
            pos = hit.index + hit.length;
        }
        return out + html.slice(pos);
    }

    /**
     * Edit a message's content in place (author only; keeps the original
     * timestamp and tone, marks the message as edited).
     */
    static async editMessage(entry, pageId, markdown) {
        const page = entry?.pages?.get(pageId);
        if (!page || !this.isMessagePage(page)) return;
        const flags = page.flags?.[MODULE.ID] ?? {};
        if (flags.deleted || flags.sender !== game.user.id) return;
        let text = (markdown ?? '').trim();
        if (!text) return;
        text = await this._linkifyBareUuids(text);
        const html = await this._composeHtml(text, entry);
        await page.update({
            'text.content': html,
            [`flags.${MODULE.ID}.markdown`]: text,
            [`flags.${MODULE.ID}.mentions`]: this._findMentions(text, entry),
            [`flags.${MODULE.ID}.edited`]: true
        });
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
                edited: !!flags.edited,
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

    /**
     * UI gate: may this user purge a conversation's entire message history?
     * GM: anything. Members: their own 1:1s. Creators: their own groups.
     */
    static canPurge(entry) {
        const info = this.getInfo(entry);
        if (game.user.isGM) return true;
        if (info.kind === 'party') return false;
        if (info.kind === 'direct') return this.isMember(entry);
        return info.createdBy === game.user.id;
    }

    /** Hard-delete every message in a conversation (confirmation happens in the UI). */
    static async purgeMessages(entry) {
        if (!this.isConversation(entry) || !this.canPurge(entry)) return 0;
        const ids = entry.pages.filter((p) => this.isMessagePage(p)).map((p) => p.id);
        if (ids.length) await entry.deleteEmbeddedDocuments('JournalEntryPage', ids);
        log(`Purged ${ids.length} message(s) from "${entry.name}"`);
        return ids.length;
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
    // ===== IMAGE CLEANUP (GM) =====================================
    // ==============================================================

    /** The world folder message images upload into. */
    static get imageDir() {
        return `worlds/${game.world.id}/bibliosoph-messages`;
    }

    /**
     * Scan the message-images folder for files no longer referenced by any
     * live message. Returns { dir, files, orphans } or null if unavailable.
     */
    static async findOrphanImages() {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        if (!FP?.browse) return null;
        const dir = this.imageDir;

        let files = [];
        try {
            const result = await FP.browse('data', dir);
            files = result?.files ?? [];
        } catch (_) {
            return { dir, files: [], orphans: [] }; // folder doesn't exist yet
        }

        let corpus = '';
        for (const entry of game.journal) {
            if (!this.isConversation(entry)) continue;
            for (const page of entry.pages) {
                if (!this.isMessagePage(page)) continue;
                corpus += `${page.text?.content ?? ''}\n${page.flags?.[MODULE.ID]?.markdown ?? ''}\n`;
            }
        }

        const orphans = files.filter((path) => {
            const filename = decodeURIComponent(path.split('/').pop() ?? '');
            return filename && !corpus.includes(filename);
        });
        return { dir, files, orphans };
    }

    /**
     * Reclaim the space of orphaned images. Foundry provides no client file
     * deletion API, so each orphan is overwritten with a 1×1 transparent PNG
     * (a few dozen bytes). True removal requires deleting the files on disk.
     * @returns {Promise<number>} how many files were overwritten
     */
    static async reclaimOrphanImages(orphans) {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        if (!FP?.upload || !Array.isArray(orphans)) return 0;
        const blankPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        const bytes = Uint8Array.from(atob(blankPngB64), (c) => c.charCodeAt(0));

        let reclaimed = 0;
        for (const path of orphans) {
            const filename = decodeURIComponent(path.split('/').pop() ?? '');
            if (!filename) continue;
            try {
                await FP.upload('data', this.imageDir, new File([bytes], filename, { type: 'image/png' }), {}, { notify: false });
                reclaimed++;
            } catch (error) {
                log(`Image cleanup: failed to overwrite ${filename}`, error?.message, false, false);
            }
        }
        log(`Image cleanup: reclaimed ${reclaimed} orphaned file(s)`);
        return reclaimed;
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
        await sockets.register(SOCKET_TYPING, async (data, senderUserId) => {
            const { conversationId, userId } = data ?? {};
            const typerId = userId ?? senderUserId;
            if (!typerId || typerId === game.user.id) return;
            const entry = game.journal.get(conversationId);
            if (!this.isConversation(entry) || !this.isMember(entry)) return;
            const win = await this._getOpenWindow();
            if (!win || win.activeConversationId !== conversationId) return;
            win.showTypingIndicator?.(typerId);
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
    // ===== TYPING INDICATOR (ephemeral, socket-only) ==============
    // ==============================================================

    static _lastTypingEmit = 0;

    /**
     * Tell active members of a conversation that this user is typing.
     * Throttled to one ping every 2 seconds; nothing is stored anywhere.
     */
    static async emitTyping(entry) {
        if (!this.isConversation(entry)) return;
        const now = Date.now();
        if (now - this._lastTypingEmit < 2000) return;
        this._lastTypingEmit = now;

        const sockets = getBlacksmith()?.sockets;
        if (!sockets?.isReady?.()) return;
        const recipients = (this.getInfo(entry).members ?? [])
            .filter((id) => id !== game.user.id && game.users.get(id)?.active);
        if (!recipients.length) return;
        try {
            await sockets.emit(SOCKET_TYPING, { conversationId: entry.id, userId: game.user.id }, { recipients });
        } catch (_) { /* typing pings are best-effort */ }
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
            if (!isOwn) {
                this.markRead(entry);
                this.playUiSound('receive');
            }
            return;
        }

        // Window closed or focused elsewhere: refresh list and signal
        this._refreshWindow();
        if (isOwn) return;

        const senderUser = game.users.get(flags.sender);
        const isMentioned = Array.isArray(flags.mentions) && flags.mentions.includes(game.user.id);
        this._notifyIncoming(entry, senderUser, isMentioned);
        // Notification hierarchy: a mention outranks the ambient unread counter,
        // so show only the mention. The counter returns on window close / login.
        if (isMentioned) {
            this.clearUnreadNotification();
        } else {
            this.notifyUnread();
        }
        this.playUiSound('alert');

        // Auto Open: pop the window straight onto the conversation when closed
        if (!win && getSetting('messageAutoOpen', false)) {
            try {
                const { openMessagesWindow } = await import('./window-messages.js');
                openMessagesWindow({ conversationId: entry.id });
                return; // window is opening on it — no splash needed
            } catch (_) { /* fall through to splash */ }
        }

        // On-screen splash so messages can't be missed (per-kind user settings;
        // being @mentioned always splashes — it's addressed to you personally)
        const kind = this.getInfo(entry).kind;
        const splashSetting = kind === 'direct' ? 'messageSplashEnabled' : 'messageSplashGroupEnabled';
        if (isMentioned || getSetting(splashSetting, true)) {
            this._showSplash(entry, senderUser, isMentioned);
        }
    }

    /** conversationId → { id, count } for live incoming-message menubar notifications. */
    static _incomingNotifications = new Map();

    /**
     * Menubar notification for an incoming message. One per conversation:
     * a burst of messages updates the existing notification ("Alicia (3)")
     * instead of stacking one per message. Clicking opens the conversation;
     * auto-closes 10s after the LAST message in the burst.
     */
    static _notifyIncoming(entry, senderUser, mentioned = false) {
        const blacksmith = getBlacksmith();
        if (typeof blacksmith?.addNotification !== 'function') return;
        const name = senderUser?.name ?? 'Someone';

        const existing = this._incomingNotifications.get(entry.id);
        if (existing) {
            existing.count += 1;
            existing.mentioned = existing.mentioned || mentioned;
            const label = existing.mentioned ? `${name} mentioned you` : name;
            const updated = blacksmith.updateNotification?.(existing.id, {
                text: `${label} (${existing.count})`,
                icon: existing.mentioned ? 'fas fa-at' : 'fas fa-envelope',
                pulse: existing.mentioned,
                duration: 10 // restart the auto-close clock
            });
            if (updated) return;
            this._incomingNotifications.delete(entry.id); // it already went away
        }

        const conversationId = entry.id;
        // Runs in Blacksmith's context — import locally, no module state
        const id = blacksmith.addNotification(
            mentioned ? `${name} mentioned you` : name,
            mentioned ? 'fas fa-at' : 'fas fa-envelope',
            10,
            MODULE.ID,
            {
                pulse: mentioned,
                onClick: async () => {
                    ConversationManager._incomingNotifications.delete(conversationId);
                    try {
                        const { openMessagesWindow } = await import('./window-messages.js');
                        openMessagesWindow({ conversationId });
                    } catch (_) { /* no-op */ }
                },
                onDismiss: () => {
                    ConversationManager._incomingNotifications.delete(conversationId);
                }
            }
        );
        if (id) this._incomingNotifications.set(conversationId, { id, count: 1, mentioned });
    }

    /** On-screen splash for an incoming direct message; click opens the conversation. */
    static _showSplash(entry, senderUser, mentioned = false) {
        const splashId = 'bibliosoph-message-splash';
        document.getElementById(splashId)?.remove();

        const splash = document.createElement('div');
        splash.id = splashId;

        const avatar = document.createElement('img');
        avatar.src = senderUser?.avatar || 'icons/svg/mystery-man.svg';
        avatar.alt = '';
        splash.appendChild(avatar);

        const textBlock = document.createElement('div');
        textBlock.className = 'bibliosoph-splash-text';
        const title = document.createElement('div');
        title.className = 'bibliosoph-splash-title';
        title.textContent = mentioned
            ? `${senderUser?.name ?? 'Someone'} mentioned you`
            : `Message from ${senderUser?.name ?? 'Someone'}`;
        const sub = document.createElement('div');
        sub.className = 'bibliosoph-splash-sub';
        const info = this.getInfo(entry);
        sub.textContent = info.kind === 'direct'
            ? 'Click to open the conversation'
            : `in ${info.name ?? entry.name} — click to open`;
        textBlock.append(title, sub);
        splash.appendChild(textBlock);

        let dismissTimer = null;
        const dismiss = () => {
            clearTimeout(dismissTimer);
            splash.classList.remove('visible');
            setTimeout(() => splash.remove(), 400);
        };
        splash.addEventListener('click', async () => {
            dismiss();
            try {
                const { openMessagesWindow } = await import('./window-messages.js');
                openMessagesWindow({ conversationId: entry.id });
            } catch (_) { /* no-op */ }
        });

        document.body.appendChild(splash);
        requestAnimationFrame(() => splash.classList.add('visible'));
        dismissTimer = setTimeout(dismiss, 8000);
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

    /**
     * Inject a stylesheet that hides the conversations folder (and any stray
     * conversation entries) in the journal sidebar. CSS survives sidebar
     * re-renders (search, collapse, new documents), unlike DOM removal.
     * Gated by the hideMessagesJournal world setting.
     */
    static _applySidebarHidingStyle() {
        const styleId = 'bibliosoph-messages-hide-journal';
        document.getElementById(styleId)?.remove();
        if (!getSetting('hideMessagesJournal', true)) return;

        const selectors = [];
        const folder = this.getFolder();
        if (folder) {
            selectors.push(`#journal li[data-folder-id="${folder.id}"]`);
            selectors.push(`#journal li.folder[data-folder-id="${folder.id}"]`);
        }
        for (const entry of game.journal) {
            if (!this.isConversation(entry)) continue;
            selectors.push(`#journal li[data-entry-id="${entry.id}"]`);
            selectors.push(`#journal li[data-document-id="${entry.id}"]`);
        }
        if (!selectors.length) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `${selectors.join(',\n')} { display: none !important; }`;
        document.head.appendChild(style);
    }

    /** Keep the hiding style current as conversations come and go. */
    static _registerSidebarHiding() {
        Hooks.on('renderJournalDirectory', () => this._applySidebarHidingStyle());
        Hooks.on('createJournalEntry', (entry) => {
            if (this.isConversation(entry)) this._applySidebarHidingStyle();
        });
        Hooks.on('deleteJournalEntry', (entry) => {
            if (this.isConversation(entry)) this._applySidebarHidingStyle();
        });
        Hooks.on('updateSetting', (setting) => {
            if (setting?.key === `${MODULE.ID}.hideMessagesJournal`) this._applySidebarHidingStyle();
        });
    }
}
