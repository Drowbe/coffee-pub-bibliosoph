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

The header also hosts the four social toast buttons — Beverage Break, Bio Break, Insult, Praise — whose images double as the toast images. See [architecture-toasts](architecture-toasts.md).

---

---

## The lite popout

A second window shows one conversation and nothing else: `window-messages-lite.js`, built on **`BlacksmithToolWindowBaseV2`** rather than the standard window base, so it floats over the canvas and follows the user's Light / Dark / Glass tool theme.

Reached by the popout icon revealed on hover over a tray row, and registered as a Blacksmith window under `bibliosoph-messages-lite` so it can also be opened directly with a conversation id.

**Exactly one messages surface is live at a time.** Popping out closes the full window; closing the popout reopens the full window on the same conversation; opening the full window by any route (menubar, toolbar, notification click, splash click, Auto Open) closes the popout. This is a load-bearing constraint, not a preference — it is what lets both windows share `ConversationManager`'s single-window live-update path with **no change to the manager at all**. While the popout is open it claims `MessagesWindow.current`, so `_getOpenWindow()` finds it, and renders, typing indicators and mark-read all flow to it unmodified.

A popout is pinned to its conversation for life. `_activeConversationId` is an accessor whose setter refuses to be steered elsewhere — notably by the `createJournalEntry` hook, which writes that field straight onto the open window. The one legitimate change is a virtual 1:1 being promoted to a real journal entry on first send.

**What it drops:** the conversation tray, the member picker, the tone bar, and reaction chips (`SUPPORTS_REACTIONS = false`, which also removes the React submenu from the context menu).

**What it keeps:** markdown, day separators, avatars, speaker colours, mentions, UUID links, inline images, the right-click menu (reply / edit / delete / send to Foundry chat), document drops, image paste and upload, the typing indicator, and ENTER-sends.

---

## The thread mixin

`mixin-messages-thread.js` holds everything a thread can *do*, independent of the chrome around it.

The two windows descend from sibling Blacksmith bases, so shared behaviour cannot live in a common parent class. `ThreadBehavior(Base)` returns a subclass of whichever base it is given, and both windows wrap their own base in it.

Owned by the mixin: `MESSAGE_TONES`, `MESSAGE_REACTIONS`, `CONVERSATION_ICONS`, `getSetting`, `escapeHtml`, `formatTimestamp`, `toast`; the draft/scroll-preserving `render()`; `_bindThreadListeners`; `_send`; image upload, paste and popout; `_onDropDocument`; reactions; edit / cancel / reply; the message context menu; the typing indicator; `_sendToChat`; and `_buildThreadContext`, which produces the message list and compose state both templates consume.

Supplied by each window: its template, its styling, and the chrome around the thread. Two hooks exist for the difference — `_getDropTarget(root)` (the full window scopes drops to its main column; the popout accepts them anywhere) and `_onExtraContextMenu(event)` (the full window handles right-clicks on tray rows).

Styling is **not** shared. `window-messages.css` defines nine `--bibliosoph-msg-*` tokens as fixed dark values; `window-messages-lite.css` redefines the same tokens against the `--blacksmith-tool-*` family so the thread repaints with the tool theme, and uses `color-mix()` for accent washes where the full window's fixed `rgba()` overlays would wash out on a light surface.

## Boundaries

Bibliosoph owns conversations. Blacksmith supplies both window bases (standard and tool), the window registry, the menubar slot, the socket transport, the context menu, and the notification and toast primitives. Foundry supplies replication and permissions.
