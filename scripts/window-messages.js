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

import { MODULE } from './const.js';
import { ConversationManager } from './manager-conversations.js';
import { SOCIAL_TOASTS, isSocialToastEnabled, triggerSocialToast } from './manager-social-toasts.js';
import {
    ThreadBehavior,
    MESSAGE_TONES,
    MESSAGE_REACTIONS,
    CONVERSATION_ICONS,
    getSetting,
    escapeHtml,
    toast
} from './mixin-messages-thread.js';

// Re-exported so the constants keep their historical import path.
export { MESSAGE_TONES, MESSAGE_REACTIONS, CONVERSATION_ICONS };

const APP_ID = 'coffee-pub-bibliosoph-messages';
const BLACKSMITH_TEMPLATE = 'modules/coffee-pub-blacksmith/templates/window-template.hbs';
const BODY_TEMPLATE = `modules/${MODULE.ID}/templates/window-messages.hbs`;

function resolveBase() {
    const api = game.modules.get('coffee-pub-blacksmith')?.api;
    const Base = api?.BlacksmithWindowBaseV2 ?? api?.getWindowBaseV2?.();
    if (!Base) throw new Error(`${MODULE.ID} | Blacksmith window base (BlacksmithWindowBaseV2) is not available`);
    return Base;
}

/**
 * Open (or focus) the Messages window. Still a singleton — there is one
 * workspace — but it now runs alongside any open popouts rather than
 * dismissing them.
 */
export async function openMessagesWindow(options = {}) {
    const win = MessagesWindow.current ?? new MessagesWindow(options);
    if (options.conversationId) win._activeConversationId = options.conversationId;
    ConversationManager.clearUnreadNotification();
    return win.render(true);
}

export class MessagesWindow extends ThreadBehavior(resolveBase()) {
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
        'msg-select-conversation': (_e, btn, app) => app?._selectConversation(btn.dataset.id),
        'msg-new-conversation': (_e, _btn, app) => app?._openPicker(),
        'msg-cancel-picker': (_e, _btn, app) => app?._closePicker(),
        'msg-toggle-member': (_e, btn, app) => app?._toggleMember(btn.dataset.id),
        'msg-pick-icon': (_e, btn, app) => app?._pickIcon(btn.dataset.icon),
        'msg-create-conversation': (_e, _btn, app) => app?._createConversation(),
        'msg-tone': (_e, btn, app) => app?._setTone(btn.dataset.tone),
        'msg-send': (_e, _btn, app) => app?._send(),
        'msg-send-to-chat': (_e, btn, app) => app?._sendToChat(btn.dataset.messageId),
        'msg-react': (_e, btn, app) => app?._toggleReaction(btn.dataset.messageId, btn.dataset.reaction),
        'msg-toggle-mute': (_e, _btn, app) => app?._toggleMute(),
        'msg-toggle-tray': (_e, _btn, app) => app?._toggleTray(),
        'msg-toggle-autoopen': (_e, _btn, app) => app?._toggleAutoOpen(),
        'msg-purge-messages': (_e, _btn, app) => app?._purgeMessages(),
        'msg-export-messages': (_e, _btn, app) => app?._exportMessages(),
        'msg-clean-images': (_e, _btn, app) => app?._cleanImages(),
        'msg-popout': (event, btn, app) => {
            event.stopPropagation();   // do not also select the row
            app?._popOut(btn.dataset.id);
        },
        'msg-social-toast': (_e, btn) => triggerSocialToast(btn.dataset.social)
    };

    constructor(options = {}) {
        super(options);
        MessagesWindow.current = this;
        this._activeConversationId = options.conversationId ?? null;
        this._tone = 'message';
        this._draft = '';
        /** When set, the body shows the new-conversation member picker. */
        this._picker = null;
        /** Message id currently being edited (compose box in edit mode). */
        this._editing = null;
    }

    /** Used by ConversationManager to decide between re-render and notification. */
    get activeConversationId() {
        return this._activeConversationId;
    }

    // ==============================================================
    // ===== DATA ===================================================
    // ==============================================================

    _resolveActiveConversation(conversations) {
        const virtualUserId = this._virtualUserId;
        if (virtualUserId) {
            // If the real 1:1 exists by now (created on first message), switch to it
            const real = ConversationManager.getDirectConversation(virtualUserId);
            if (real) {
                this._activeConversationId = real.id;
                return real;
            }
            if (game.users.get(virtualUserId)) return null; // stay on the empty virtual thread
            this._activeConversationId = null;
        }
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
        const virtualUser = this._virtualUserId ? game.users.get(this._virtualUserId) : null;
        const info = active ? ConversationManager.getInfo(active) : {};
        const memberNames = (info.members ?? [])
            .map((id) => game.users.get(id)?.name)
            .filter(Boolean);

        const renderTemplateFn = foundry.applications?.handlebars?.renderTemplate ?? renderTemplate;
        const bodyContent = await renderTemplateFn(BODY_TEMPLATE, this._buildBodyContext(active, conversations));

        const showCompose = !this._picker && (!!active || !!virtualUser);
        const muted = ConversationManager.soundsMuted();
        const autoOpen = getSetting('messageAutoOpen', false);
        const barButtons = [
            `<a class="bibliosoph-messages-bar-btn ${muted ? 'muted' : ''}" data-action="msg-toggle-mute" title="${muted ? 'Sounds muted — click to unmute' : 'Sounds on — click to mute'}"><i class="fa-solid ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i></a>`,
            `<a class="bibliosoph-messages-bar-btn ${autoOpen ? 'active' : ''}" data-action="msg-toggle-autoopen" title="${autoOpen ? 'Auto Open is on — window opens when a message arrives' : 'Auto Open is off — click to open this window automatically when a message arrives'}"><i class="fa-solid fa-window-restore"></i></a>`
        ];
        if (active) {
            barButtons.push(`<a class="bibliosoph-messages-bar-btn" data-action="msg-export-messages" title="Export this conversation as HTML"><i class="fa-solid fa-file-arrow-down"></i></a>`);
            if (ConversationManager.canPurge(active)) {
                barButtons.push(`<a class="bibliosoph-messages-bar-btn bibliosoph-messages-bar-btn-danger" data-action="msg-purge-messages" title="Delete all messages in this conversation"><i class="fa-solid fa-trash"></i></a>`);
            }
        }
        if (game.user.isGM) {
            barButtons.push(`<a class="bibliosoph-messages-bar-btn" data-action="msg-clean-images" title="Clean unused message images (GM)"><i class="fa-solid fa-broom"></i></a>`);
        }
        const actionBarLeft = `<label class="blacksmith-window-template-action-label bibliosoph-messages-enter-label"><input type="checkbox" class="bibliosoph-messages-enter-sends" ${this._enterSends ? 'checked' : ''}> ENTER Sends</label><span class="bibliosoph-messages-bar-group">${barButtons.join('')}</span>`;
        const actionBarRight = showCompose
            ? `<button type="button" class="blacksmith-window-btn-primary bibliosoph-messages-btn" data-action="msg-send"><i class="fa-solid ${this._editing ? 'fa-pen' : 'fa-paper-plane'}"></i> ${this._editing ? 'Save Edit' : 'Send Message'}</button>`
            : '';

        let windowTitle = 'Messages';
        let headerIcon = 'fa-solid fa-comments';
        let subtitle = 'No conversation selected';
        // 1:1 chats show the other player's avatar instead of an icon
        // (swapped into the header icon slot in _onRender)
        this._headerAvatar = null;
        if (active) {
            windowTitle = this._conversationDisplayName(active);
            headerIcon = info.icon ?? 'fa-solid fa-comments';
            subtitle = info.kind === 'direct' ? 'Direct message' : (memberNames.join(', ') || '');
            if (info.kind === 'direct' && (info.members ?? []).includes(game.user.id)) {
                const otherId = (info.members ?? []).find((id) => id !== game.user.id);
                this._headerAvatar = game.users.get(otherId)?.avatar || null;
            }
        } else if (virtualUser) {
            windowTitle = virtualUser.name;
            headerIcon = 'fa-solid fa-user';
            subtitle = 'Direct message';
            this._headerAvatar = virtualUser.avatar || null;
        }

        return {
            appId: this.id,
            showOptionBar: false,
            showHeader: true,
            showTools: false,
            showActionBar: showCompose,
            headerIcon,
            windowTitle,
            subtitle,
            headerRight: this._buildSocialButtons(),
            actionBarLeft,
            actionBarRight,
            bodyContent
        };
    }

    /**
     * Social toast buttons (beverage/bio/insult/praise) for the header's
     * right slot. Each shows only when its feature is enabled; clicking
     * rolls the feature's table and toasts the result to every client.
     */
    _buildSocialButtons() {
        const buttons = Object.entries(SOCIAL_TOASTS)
            .filter(([kind]) => isSocialToastEnabled(kind))
            .map(([kind, config]) => `
                <button type="button" class="bibliosoph-messages-social-button"
                    data-action="msg-social-toast" data-social="${kind}"
                    data-tooltip="${config.label}" aria-label="${config.label}">
                    <img src="${config.image}" alt="">
                </button>`)
            .join('');
        return buttons ? `<div class="bibliosoph-messages-social-buttons">${buttons}</div>` : '';
    }

    /** Per-client: conversation tray collapsed to an icon rail. */
    get _trayCollapsed() {
        try {
            return localStorage.getItem('bibliosoph-messages-tray-collapsed') === 'true';
        } catch (_) {
            return false;
        }
    }

    set _trayCollapsed(value) {
        try {
            localStorage.setItem('bibliosoph-messages-tray-collapsed', value ? 'true' : 'false');
        } catch (_) { /* no-op */ }
    }

    _toggleTray() {
        this._trayCollapsed = !this._trayCollapsed;
        this.render(false);
    }

    _buildBodyContext(active, conversations = []) {
        const { trayGroups, trayPlayers } = this._buildTrayItems(conversations);
        if (this._picker) {
            const isEdit = this._picker.mode === 'edit';
            return {
                trayGroups,
                trayPlayers,
                showTrayDivider: trayGroups.length > 0 && trayPlayers.length > 0,
                trayCollapsed: this._trayCollapsed,
                picker: {
                    name: this._picker.name,
                    tint: this._picker.tint || '#ac9f81',
                    title: isEdit ? 'Edit Conversation' : 'New Conversation',
                    titleIcon: isEdit ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-user-plus',
                    submitLabel: isEdit ? 'Save Changes' : 'Start Conversation',
                    hideMembers: !!this._picker.isParty,
                    // Party name is owned by the Blacksmith campaign API
                    hideName: !!this._picker.isParty,
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

        // The message list and compose state come from the shared mixin —
        // the tray and tone bar are this window's own.
        return {
            trayGroups,
            trayPlayers,
            showTrayDivider: trayGroups.length > 0 && trayPlayers.length > 0,
            trayCollapsed: this._trayCollapsed,
            picker: null,
            tones: MESSAGE_TONES.map((t) => ({ ...t, active: t.key === this._tone })),
            ...this._buildThreadContext(active)
        };
    }

    /**
     * Tray zones:
     * - Groups (top): Party first, then member groups by activity, then
     *   (GM see-all) other people's groups.
     * - Players (bottom): one 1:1 row per user — GM(s) first, then
     *   alphabetical, using the player's avatar. Rows without an existing
     *   conversation are virtual and get created on first message. GM
     *   see-all also lists other people's 1:1s at the end.
     */
    _buildTrayItems(conversations) {
        const meId = game.user.id;
        const party = [];
        const directs = [];
        const groups = [];
        const otherGroups = [];
        const otherDirects = [];
        for (const entry of conversations) {
            const info = ConversationManager.getInfo(entry);
            const mine = ConversationManager.isMember(entry);
            if (info.kind === 'party') party.push(entry);
            else if (info.kind === 'direct') (mine ? directs : otherDirects).push(entry);
            else (mine ? groups : otherGroups).push(entry); // non-member = gmSeesAllConversations
        }

        const entryItem = (entry, overrides = {}) => {
            const info = ConversationManager.getInfo(entry);
            return {
                id: entry.id,
                name: this._conversationDisplayName(entry),
                icon: info.icon ?? 'fa-solid fa-user-group',
                avatar: '',
                tint: info.tint ?? '',
                active: entry.id === this._activeConversationId,
                unread: ConversationManager.getUnreadCount(entry),
                favorite: ConversationManager.isFavorite(entry.id),
                memberNames: (info.members ?? [])
                    .map((id) => game.users.get(id)?.name)
                    .filter(Boolean)
                    .join(', '),
                ...overrides
            };
        };

        // 1:1 rows: existing conversations plus a virtual row per remaining user
        const otherIdOf = (entry) => (ConversationManager.getInfo(entry).members ?? []).find((id) => id !== meId);
        const haveDirect = new Set(directs.map(otherIdOf));
        const directRows = [
            ...directs.map((entry) => ({ user: game.users.get(otherIdOf(entry)), entry })),
            ...ConversationManager.getSelectableUsers()
                .filter((u) => u.id !== meId && !haveDirect.has(u.id))
                .map((user) => ({ user, entry: null }))
        ].sort((a, b) => {
            const aGM = a.user?.isGM ? 0 : 1;
            const bGM = b.user?.isGM ? 0 : 1;
            if (aGM !== bGM) return aGM - bGM;
            return (a.user?.name ?? '').localeCompare(b.user?.name ?? '');
        });

        const trayGroups = [
            ...party.map((entry) => entryItem(entry)),
            ...groups.map((entry) => entryItem(entry)),
            ...otherGroups.map((entry) => entryItem(entry))
        ];
        const trayPlayers = [
            ...directRows.map(({ user, entry }) => entry
                ? entryItem(entry, {
                    name: user?.name ?? this._conversationDisplayName(entry),
                    avatar: user?.avatar || 'icons/svg/mystery-man.svg'
                })
                : {
                    id: `virtual:${user.id}`,
                    name: user.name,
                    icon: 'fa-solid fa-user',
                    avatar: user.avatar || 'icons/svg/mystery-man.svg',
                    tint: '',
                    active: `virtual:${user.id}` === this._activeConversationId,
                    unread: 0,
                    favorite: ConversationManager.isFavorite(`virtual:${user.id}`),
                    memberNames: `Direct message with ${user.name}`
                }),
            // GM see-all: 1:1s between other people ("Alice & Bob")
            ...otherDirects.map((entry) => entryItem(entry))
        ];
        return { trayGroups, trayPlayers };
    }

    // ==============================================================
    // ===== RENDER LIFECYCLE =======================================
    // ==============================================================

    async _onRender(context, options) {
        await super._onRender?.(context, options);
        // Registered on render rather than in the constructor: the registry
        // sweeps anything not yet rendered, so a window added at construction
        // time would be purged before it ever drew.
        ConversationManager.registerWindow(this);
        this._attachThreadContextMenu();
        const root = this._getRoot();
        if (!root) return;

        // 1:1 chat: swap the header FA icon for the other player's avatar
        if (this._headerAvatar) {
            const iconBox = root.querySelector('.blacksmith-window-template-header-icon');
            if (iconBox) {
                const img = document.createElement('img');
                img.className = 'bibliosoph-messages-header-avatar';
                img.src = this._headerAvatar;
                img.alt = '';
                iconBox.replaceChildren(img);
            }
        }

        // ENTER Sends toggle (action bar)
        const enterToggle = root.querySelector('.bibliosoph-messages-enter-sends');
        if (enterToggle && !enterToggle.dataset.bibliosophBound) {
            enterToggle.dataset.bibliosophBound = '1';
            enterToggle.addEventListener('change', () => {
                this._enterSends = enterToggle.checked;
            });
        }

        // Thread wiring (compose box, drops, scrolling, mark-read) is shared
        // with the lite popout and lives in the thread mixin.
        this._bindThreadListeners(root);
    }

    async close(options) {
        if (MessagesWindow.current === this) MessagesWindow.current = null;
        ConversationManager.unregisterWindow(this);
        // Unread only returns to the menubar once nothing is left showing it:
        // closing the workspace while popouts are still floating is not the
        // moment to badge someone about a conversation they can still see.
        if (!ConversationManager.getOpenWindows().length) {
            ConversationManager.playUiSound('close');
            ConversationManager.notifyUnread();
        }
        return super.close(options);
    }

    /**
     * Float a conversation out into its own popout.
     *
     * The workspace deliberately stays open behind it. Popouts stack, and the
     * tray is the only place to launch one from — closing the workspace on
     * every pop-out would mean reopening it between each, which fights the
     * whole point of being able to watch two conversations at once. Close it
     * yourself when you want the screen back.
     */
    async _popOut(conversationId) {
        const id = conversationId ?? this._activeConversationId;
        if (!id) return;
        try {
            const { openMessagesLite } = await import('./window-messages-lite.js');
            await openMessagesLite({ conversationId: id });
        } catch (error) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(
                    MODULE.NAME, 'MESSAGES | Popping out failed', error, false, false);
            }
            toast('Could not pop out', 'See the console for details.', 'fa-solid fa-triangle-exclamation');
        }
    }

    // ==============================================================
    // ===== ACTIONS ================================================
    // ==============================================================

    _selectConversation(id) {
        if (!id || id === this._activeConversationId) return;
        this._activeConversationId = id;
        this._picker = null;
        this._draft = '';
        this._editing = null;
        this._skipDraftCapture = true;
        this._clearTypingIndicators();
        const entry = game.journal.get(id);
        if (entry) ConversationManager.markRead(entry);
        ConversationManager.playUiSound('switch');
        this.render(false);
    }

    _toggleMute() {
        ConversationManager.setSoundsMuted(!ConversationManager.soundsMuted());
        this.render(false);
    }

    /** Flip the messageAutoOpen user setting from the window's action bar. */
    async _toggleAutoOpen() {
        const current = getSetting('messageAutoOpen', false);
        try {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils?.setSettingSafely) {
                await BlacksmithUtils.setSettingSafely(MODULE.ID, 'messageAutoOpen', !current);
            } else {
                await game.settings.set(MODULE.ID, 'messageAutoOpen', !current);
            }
        } catch (_) { /* setting unavailable — leave as-is */ }
        this.render(false);
    }

    /** Delete all messages in the active conversation, after an "are you sure". */
    async _purgeMessages() {
        const entry = game.journal.get(this._activeConversationId);
        if (!entry || !ConversationManager.canPurge(entry)) return;
        const name = this._conversationDisplayName(entry);
        const count = ConversationManager.getMessages(entry).length;
        if (!count) {
            ui.notifications.info('There are no messages to delete.');
            return;
        }

        let confirmed = false;
        const content = `<p>Delete all <b>${count}</b> message${count === 1 ? '' : 's'} in <b>${escapeHtml(name)}</b>?</p><p>This removes the history for <b>everyone</b> and cannot be undone.</p>`;
        const DialogV2 = foundry.applications?.api?.DialogV2;
        try {
            confirmed = DialogV2?.confirm
                ? await DialogV2.confirm({ window: { title: 'Delete Messages' }, content, rejectClose: false })
                : await Dialog.confirm({ title: 'Delete Messages', content });
        } catch (_) {
            confirmed = false;
        }
        if (!confirmed) return;

        await ConversationManager.purgeMessages(entry);
        ui.notifications.info(`Deleted all messages in "${name}".`);
        // deleteJournalEntryPage hooks re-render the window
    }

    /**
     * GM: find images in the messages upload folder that no live message
     * references, and reclaim their space (Foundry has no file-deletion API,
     * so orphans are overwritten with a tiny blank PNG).
     */
    async _cleanImages() {
        if (!game.user.isGM) return;
        const scan = await ConversationManager.findOrphanImages();
        if (!scan) {
            ui.notifications.error('File browsing is unavailable in this Foundry version.');
            return;
        }
        if (!scan.orphans.length) {
            ui.notifications.info(`No unused images found (${scan.files.length} file${scan.files.length === 1 ? '' : 's'} in the messages folder, all referenced).`);
            return;
        }

        const names = scan.orphans.slice(0, 15)
            .map((p) => `<li>${escapeHtml(decodeURIComponent(p.split('/').pop() ?? ''))}</li>`)
            .join('');
        const more = scan.orphans.length > 15 ? `<li>…and ${scan.orphans.length - 15} more</li>` : '';
        const content = `<p><b>${scan.orphans.length}</b> uploaded image${scan.orphans.length === 1 ? ' is' : 's are'} no longer referenced by any message:</p>
            <ul>${names}${more}</ul>
            <p>Foundry modules cannot delete files, so cleaning replaces each with a tiny blank image to reclaim its space. To remove the files entirely, delete them from <code>${scan.dir}</code> on the server.</p>`;

        let confirmed = false;
        const DialogV2 = foundry.applications?.api?.DialogV2;
        try {
            confirmed = DialogV2?.confirm
                ? await DialogV2.confirm({ window: { title: 'Clean Unused Images' }, content, rejectClose: false })
                : await Dialog.confirm({ title: 'Clean Unused Images', content });
        } catch (_) {
            confirmed = false;
        }
        if (!confirmed) return;

        const reclaimed = await ConversationManager.reclaimOrphanImages(scan.orphans);
        ui.notifications.info(`Reclaimed ${reclaimed} unused image${reclaimed === 1 ? '' : 's'}.`);
    }

    /** Export the active conversation's history as a standalone HTML file. */
    _exportMessages() {
        const entry = game.journal.get(this._activeConversationId);
        if (!entry) return;
        const info = ConversationManager.getInfo(entry);
        const name = this._conversationDisplayName(entry);
        const memberNames = (info.members ?? [])
            .map((id) => game.users.get(id)?.name)
            .filter(Boolean)
            .join(', ');
        const messages = ConversationManager.getMessages(entry);

        const rows = messages.map((m) => {
            const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
            if (m.deleted) {
                return `<div class="msg deleted"><div class="meta"><span class="sender">${escapeHtml(m.senderName)}</span><span class="time">${time}</span></div><div class="content"><i>Message deleted</i></div></div>`;
            }
            return `<div class="msg"><div class="meta"><span class="sender" style="color:${m.color}">${escapeHtml(m.senderName)}</span><span class="time">${time}</span></div><div class="content">${m.html}</div></div>`;
        }).join('\n');

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)} — Messages</title>
<style>
    body { font-family: system-ui, sans-serif; background: #232323; color: #e0e0e0; max-width: 800px; margin: 24px auto; padding: 0 16px; }
    h1 { color: #ac9f81; border-bottom: 1px solid #444; padding-bottom: 8px; }
    .exportmeta { color: #999; font-size: 0.9em; margin-bottom: 20px; }
    .msg { border: 1px solid #3a3a3a; border-left: 3px solid #555; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px; }
    .msg.deleted { opacity: 0.6; }
    .meta { display: flex; justify-content: space-between; font-size: 0.85em; color: #999; margin-bottom: 4px; }
    .sender { font-weight: bold; }
    .content img { max-width: 100%; border-radius: 4px; }
    .content blockquote { border-left: 3px solid #555; margin: 0 0 6px 0; padding: 2px 8px; color: #999; }
    a.content-link { color: #ac9f81; text-decoration: none; }
</style>
</head>
<body>
<h1>${escapeHtml(name)}</h1>
<div class="exportmeta">Members: ${escapeHtml(memberNames)}<br>Exported: ${new Date().toLocaleString()} &mdash; ${messages.length} message${messages.length === 1 ? '' : 's'}</div>
${rows}
</body>
</html>`;

        const filename = `messages-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`;
        const save = foundry.utils?.saveDataToFile ?? globalThis.saveDataToFile;
        if (typeof save !== 'function') {
            ui.notifications.error('Export helper unavailable in this Foundry version.');
            return;
        }
        save(html, 'text/html', filename);
        ui.notifications.info(`Exported ${messages.length} message${messages.length === 1 ? '' : 's'} to "${filename}".`);
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

    // ==============================================================
    // ===== CONTEXT MENUS (Blacksmith uiContextMenu) ===============
    // ==============================================================

    /** The conversation tray is the full window's own right-click surface. */
    _onExtraContextMenu(event) {
        const trayEl = event.target.closest?.('.bibliosoph-messages-tray-item[data-id]');
        if (!trayEl) return false;
        this._showConversationContextMenu(event, trayEl.dataset.id);
        return true;
    }

    _showConversationContextMenu(event, conversationId) {
        const menu = this._getContextMenuApi();
        if (!menu || !conversationId) return;

        // A virtual 1:1 row has no journal entry behind it yet. It can still be
        // favorited — wanting quick access to someone you have not messaged
        // yet is reasonable — so only the entry-backed actions are gated.
        const entry = game.journal.get(conversationId) ?? null;
        const info = entry ? ConversationManager.getInfo(entry) : {};
        const canEdit = entry ? ConversationManager.canEdit(entry) : false;
        // 1:1s regenerate as virtual rows, so deleting one just clears history — GM only
        const canDelete = entry && info.kind !== 'party'
            && (game.user.isGM || (info.kind !== 'direct' && info.createdBy === game.user.id));

        // Favouriting is a personal shortcut rather than a permission, so it is
        // always offered and the menu opens even where nothing else is allowed.
        const isFavorite = ConversationManager.isFavorite(conversationId);
        const items = [{
            name: isFavorite ? 'Remove Favorite' : 'Add Favorite',
            icon: isFavorite ? 'fa-solid fa-heart-crack' : 'fa-solid fa-heart',
            description: isFavorite
                ? 'Take it off the Messages menubar right-click menu.'
                : 'Reach it from the Messages menubar with a right-click.',
            callback: () => this._toggleFavorite(conversationId)
        }];

        const entryActions = [];
        if (canEdit) {
            entryActions.push({
                name: 'Edit Conversation',
                icon: 'fa-solid fa-pen-to-square',
                description: info.kind === 'party'
                    ? 'Change the name or icon. Party membership is automatic.'
                    : 'Change the name, icon, or members.',
                callback: () => this._openEditPicker(entry)
            });
        }
        if (canDelete) {
            entryActions.push({
                name: 'Delete Conversation',
                icon: 'fa-solid fa-trash',
                description: 'Removes the conversation and its history for everyone.',
                callback: () => ConversationManager.deleteConversation(entry)
            });
        }
        if (entryActions.length) items.push({ separator: true }, ...entryActions);

        menu.show({
            id: 'bibliosoph-messages-context',
            x: event.clientX,
            y: event.clientY,
            zones: items
        });
    }

    /** Heart or unheart a conversation, then repaint so the tray follows. */
    async _toggleFavorite(conversationId) {
        const nowFavorite = await ConversationManager.toggleFavorite(conversationId);
        const entry = game.journal.get(ConversationManager._canonicalFavoriteId(conversationId));
        const name = entry ? ConversationManager.displayName(entry) : 'Conversation';
        toast(
            nowFavorite ? 'Added to favorites' : 'Removed from favorites',
            nowFavorite ? `${name} — right-click Messages on the menubar to jump back` : name,
            nowFavorite ? 'fa-solid fa-heart' : 'fa-solid fa-heart-crack'
        );
        this.render(false);
    }
}
