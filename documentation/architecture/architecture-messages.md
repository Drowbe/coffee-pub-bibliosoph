# Architecture: Messages & Conversations

**Status:** describes the code as of 13.4.6. Written from source, not from plans.

A unified conversation window covering the party channel and private/group messages. It replaced the older party/private message dialogs.

Two files: `manager-conversations.js` (storage and delivery, 1,367 lines) and `window-messages.js` (the window, 1,347 lines).

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

## Boundaries

Bibliosoph owns conversations. Blacksmith supplies the window base, the window registry, the menubar slot, the socket transport, and the notification primitive. Foundry supplies replication and permissions.
