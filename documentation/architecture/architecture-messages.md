# Architecture: Messages & Conversations

**Status:** describes the code as of 13.6.0. Written from source, not from plans.

A unified conversation window covering the party channel and private/group messages. It replaced the older party/private message dialogs.

Four files: `manager-conversations.js` (storage and delivery), `mixin-messages-thread.js` (thread behaviour shared by both windows), `window-messages.js` (the full window) and `window-messages-lite.js` (the popout).

---

## Storage model

**Journal-backed, not chat-backed.**

- One hidden `JournalEntry` per conversation, in a folder named `Bibliosoph Messages`.
- One `JournalEntryPage` per message.
- No `ChatMessage` documents and no chat database involvement at all.

Delivery and sync ride on Foundry's own document hooks — `createJournalEntry`, `createJournalEntryPage`, `updateJournalEntryPage`, `deleteJournalEntry`. Because Foundry already replicates documents to permitted clients, messages arrive without a bespoke delivery layer.

The folder is hidden from the sidebar by a style applied on `renderJournalDirectory`.

---

## Sockets

Sockets are used for **one thing only**: relaying a create or update request to a GM client, because players cannot create the journal documents themselves.

| Event | Purpose |
|---|---|
| `bibliosoph.conversation.create` | player asks a GM client to create a conversation |
| `bibliosoph.conversation.update` | player asks a GM client to update name/icon/members |
| `bibliosoph.conversation.typing` | typing indicator |

These are dispatch-targeted. **Payloads are not private** — privacy comes from document permissions on the journal entry, not from the socket.

Requires Blacksmith 13.8.5 or newer for targeted socket emit.

---

## ConversationManager

A static class, initialized from the `ready` block in `bibliosoph.js` when `messagesEnabled` is on.

**Structure**
`getFolder()` / `_ensureFolder()`, `isConversation(entry)`, `isMessagePage(page)`, `getInfo(entry)`.

**Membership and lookup**
`isMember(entry, userId)`, `getConversations()`, `getPartyConversation()`, `getSelectableUsers()`, `getDirectConversation(otherUserId)`, `ensureDirectConversation(otherUserId)`, `getLastActivity(entry)`.

**Creation**
`createConversation({members, name, icon, tint})` → `_createConversationEntry({members, name, createdBy, kind, icon, tint})`. Conversations are either `group` or direct. `_sanitizeTint()` validates colour input.

**Favorites**
`FAVORITES_KEY`, `getFavorites()`, `setFavorites(ids)`, `isFavorite(id)`, `toggleFavorite(id)`, `getFavoriteConversations()`, and the two helpers that make them correct: `_canonicalFavoriteId(id)` and `_favoriteMatches(stored, target)`.

A per-client shortlist held in `localStorage`, matching how mute, ENTER-sends and tray-collapse are already stored — no permissions, no document write per toggle, at the cost of not following the user to another browser.

An entry is either a conversation id or a `virtual:<userId>` row for a 1:1 that does not exist yet. Those two forms name the same thing once the conversation is created, which is why comparisons canonicalise rather than string-match: storage is only rewritten when `getFavoriteConversations()` prunes, so a `virtual:` entry outlives the moment its real conversation appeared. Without `_favoriteMatches`, favouriting a player and then messaging them left a favorite that could be neither recognised nor removed.

`getFavoriteConversations()` resolves the list for display — name, icon, unread count, virtual flag — drops anything no longer visible to this user, sorts by most recent activity, and prunes storage only when something actually went away.

**Notification**
`notifyUnread()` and `clearUnreadNotification()` drive a Blacksmith notification, tracked by id so it can be replaced rather than stacked.

**Sound**
`SOUND_SETTINGS`, `soundsMuted()`, `setSoundsMuted(muted)`, `playUiSound(kind)`. Mute state is a user setting; `updateSetting` is watched so a change applies live.

---

## The window

`window-messages.js`, Application V2, built on **Blacksmith's public window base and zone template**, resolved from `module.api` — never deep-imported. The module is only ever dynamically imported (from the `registerWindow` open callback, the toolbar `onClick`, and `ConversationManager`), which guarantees the base class resolves after Blacksmith has loaded.

Registered two ways:

- as a Blacksmith window under the id `bibliosoph-messages`
- as a menubar tool in the left zone (`group: general`, `groupOrder: 999`, `order: 203`), placed next to Squire's Quick Note

The menubar tool also supplies `contextMenuItems` as a **function**, which Blacksmith evaluates on each right-click — so the favorites menu is rebuilt from current state every time rather than captured at registration. Each entry opens its conversation as a popout. With no favorites yet, the menu shows a single disabled row explaining where to make one, because returning an empty array would suppress the menu entirely after the default context menu had already been prevented.

The header also hosts the four social toast buttons — Beverage Break, Bio Break, Insult, Praise — whose images double as the toast images. See [architecture-toasts](architecture-toasts.md).

---

---

## The lite popout

A second window shows one conversation and nothing else: `window-messages-lite.js`, built on **`BlacksmithToolWindowBaseV2`** rather than the standard window base, so it floats over the canvas and follows the user's Light / Dark / Glass tool theme.

Reached by the popout icon revealed on hover over a tray row, and registered as a Blacksmith window under `bibliosoph-messages-lite` so it can also be opened directly with a conversation id.

**Popouts stack, and coexist with the full window.** One popout per conversation; opening a conversation that already has one focuses it rather than building a second. Each instance takes a distinct application id (`<module>-messages-lite-<slugged conversation id>`), which both satisfies ApplicationV2's unique-id requirement and gives every conversation its own remembered position and tool theme. `MessagesLiteWindow.instances` is a `Set` rather than a Map keyed by conversation, because a popout pinned to a virtual 1:1 rewrites its own conversation id the moment that conversation is created — a key would go stale underneath it. `findFor()` matches on the canonical id so the popout is still found afterwards.

Nothing closes anything else: popping out leaves the workspace open (the tray is the only place to launch a popout from, so closing it on every pop-out would mean reopening it between each), and closing a popout closes only that popout.

**The open-window registry.** `ConversationManager` keeps a `Set` of every live surface — `registerWindow`, `unregisterWindow`, `getOpenWindows`, `getWindowsViewing(conversationId)`. This replaced a single `MessagesWindow.current` lookup; that pointer still exists, because the full window genuinely is a singleton and `openMessagesWindow` uses it to focus rather than duplicate, but it is no longer how live updates find a window.

Windows register in `_onRender`, not in their constructor: `getOpenWindows()` sweeps anything that is not `rendered`, so a window added at construction time would be purged before it ever drew.

Incoming messages repaint every open surface — whoever shows the conversation needs the message, everyone else needs their unread badges to move — and a notification is raised only when *no* window is showing it. Auto Open fires only when nothing at all is open. Unread returns to the menubar only when the last surface closes.

A popout is pinned to its conversation for life. `_activeConversationId` is an accessor whose setter refuses to be steered elsewhere — notably by the `createJournalEntry` hook, which writes that field straight onto the open window. The one legitimate change is a virtual 1:1 being promoted to a real journal entry on first send.

**What it drops:** the conversation tray, the member picker, the tone bar, the send button, and reaction chips (`SUPPORTS_REACTIONS = false`, which also removes the React submenu from the context menu). With no send button and no action bar to host a toggle, the popout overrides `_enterSends` to always return true — honouring a disabled preference would strand a message with no way to send it.

**What it keeps:** markdown, day separators, avatars, speaker colours, mentions, UUID links, inline images, the right-click menu (reply / edit / delete / send to Foundry chat), document drops, image paste and upload, the typing indicator, and ENTER-sends (SHIFT+ENTER for a newline). It adds one control of its own: a favorite star in the compact title bar, via `getToolHeaderActions()`.

---

## The thread mixin

`mixin-messages-thread.js` holds everything a thread can *do*, independent of the chrome around it.

The two windows descend from sibling Blacksmith bases, so shared behaviour cannot live in a common parent class. `ThreadBehavior(Base)` returns a subclass of whichever base it is given, and both windows wrap their own base in it.

Owned by the mixin: `MESSAGE_TONES`, `MESSAGE_REACTIONS`, `CONVERSATION_ICONS`, `getSetting`, `escapeHtml`, `formatTimestamp`, `toast`; the draft/scroll-preserving `render()`; `_bindThreadListeners`; `_send`; image upload, paste and popout; `_onDropDocument`; reactions; edit / cancel / reply; the message context menu; the typing indicator; `_sendToChat`; and `_buildThreadContext`, which produces the message list and compose state both templates consume.

Supplied by each window: its template, its styling, and the chrome around the thread. Two hooks exist for the difference — `_getDropTarget(root)` (the full window scopes drops to its main column; the popout accepts them anywhere) and `_onExtraContextMenu(event)` (the full window handles right-clicks on tray rows).

Styling is **not** shared. `window-messages.css` defines nine `--bibliosoph-msg-*` tokens as fixed dark values; `window-messages-lite.css` redefines the same tokens against the `--blacksmith-tool-*` family so the thread repaints with the tool theme, and uses `color-mix()` for accent washes where the full window's fixed `rgba()` overlays would wash out on a light surface.

## Boundaries

Bibliosoph owns conversations. Blacksmith supplies both window bases (standard and tool), the window registry, the menubar slot, the socket transport, the context menu, and the notification and toast primitives. Foundry supplies replication and permissions.
