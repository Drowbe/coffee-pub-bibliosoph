# Plan: Unified Messages Window (Conversations)

Replaces the old party/private message dialogs with a single, Regent-style conversation
window. **No Foundry chat involvement** for storage or delivery — the chat log stays
clean and conversations survive session chat wipes.

## Decisions (locked)

| Decision | Answer |
|---|---|
| Application framework | ApplicationV2 via `api.BlacksmithWindowBaseV2` (from `module.api`, never deep imports) |
| Storage / delivery | Hidden journal-backed conversations (no ChatMessages, no chat DB) |
| GM excluded from player conversations? | GM world setting (`gmSeesAllConversations`) |
| Retention | GM-controlled: per-conversation message cap (default 200) + purge-all |
| Macros | Killed entirely (settings + handlers removed) |
| Toolbar | One "Messages" button (replaces party + private buttons) |
| Send to Foundry chat | Per-message button, like Regent's "Send to Chat" |
| Unread signaling | Blacksmith menubar notification area (`api.addNotification`) + toolbar badge |

## Architecture

### Storage: journal-backed conversations

- A module-owned folder (e.g. **"Bibliosoph Messages"**), hidden from the journal
  sidebar via a `renderJournalDirectory` hook.
- **One `JournalEntry` per conversation.** Entry flags:
  `{ type: 'conversation', kind: 'party' | 'group', members: [userId], name, createdBy, created }`
- **One `JournalEntryPage` (text) per message.** Page flags:
  `{ sender: userId, timestamp, tone, markdown }`; `text.content` holds the rendered
  HTML; `sort` = timestamp for ordering.
- **Ownership**: members get OWNER on the conversation entry; everyone else NONE.
  Members can therefore post (create pages) and trim without a GM online.
- **The Party conversation** is a singleton (`kind: 'party'`, members = all users),
  bootstrapped by the first active GM client on `ready` if missing.

Why journals win over a world-setting blob:

1. **Delivery is free** — document create/update hooks fire on every connected client;
   open windows append live. No sockets in the delivery path.
2. **Persistence is free** — survives reloads, sessions, and chat wipes; offline
   members see history at next login.
3. **Incremental sync** — each message broadcasts one small page create, not a rewrite
   of the whole store. No concurrent-write clobbering, no rewrite amplification.
4. **Retention is natural** — trim = delete oldest pages; purge = delete pages/entries.

Honest caveats (documented, accepted):

- Foundry sends world data to all clients and enforces read permission in the UI, so a
  console-savvy player could dig out messages. Same is true of core whispers. Fine for
  a table of friends; not cryptographic secrecy.
- GM users bypass document ownership entirely, so `gmSeesAllConversations = false` is a
  **UI contract** (GM's window doesn't list those conversations), not hard secrecy.

### Conversation creation (the only GM-relay step)

Players typically can't create JournalEntries. Creating a conversation is relayed once
to the GM via Blacksmith sockets:

- SocketLib path: `sockets.getSocket().executeAsGM('bibliosoph.createConversation', …)`.
- Fallback (native transport has no `executeAsGM`): `sockets.emit(…)` received by all,
  acted on only by the **first active GM** (`game.users.activeGM`-style guard).
- If no GM is connected, show a clear notification ("A GM must be online to start a new
  conversation"). Posting into existing conversations never needs a GM.

> **Note on Blacksmith sockets:** as of Blacksmith **13.8.5**, `emit(…, { userId |
> recipients })` targeting works (routes through SocketLib `executeAsUser` /
> `executeForUsers`; native fallback filters on receipt). Targeting is
> **dispatch-level filtering, not wire-level privacy** — payloads still reach every
> connected client's socket listener, so treat every `emit` payload as publicly
> visible. This plan uses sockets only for the create-conversation relay (GM-guarded,
> carries nothing secret), targeted with `{recipients: [gmIds]}` so other clients
> aren't woken. Delivery, sync, and notifications all ride on document hooks.
> Bibliosoph therefore requires Blacksmith >= 13.8.5.

### Live updates, unread, notifications

- Register (via Blacksmith HookManager) `createJournalEntryPage`,
  `deleteJournalEntryPage`, `updateJournalEntry`, `deleteJournalEntry` filtered to our
  folder/flags.
- Window open → append/re-render the affected thread; scroll pinned to bottom.
- Window closed (or other conversation focused) → increment unread and:
  - `api.addNotification("New message from <name>", "fas fa-envelope", 5, MODULE.ID)`
  - optional local sound (client setting) via Blacksmith sound helpers
  - unread badge on the toolbar icon / conversation list rows.
- **Read tracking**: per-user `lastRead[conversationId] = timestamp` stored on the
  user's own User flags (own-document writes are always permitted; syncs free).

### Retention

- World setting `retentionMaxMessages` (default **200**, GM-adjustable).
- Enforced opportunistically by the **sender's client** after posting (members are
  owners, so they may delete the oldest overflow pages).
- GM-only actions in the window: purge a conversation, purge all, delete a conversation.

### Send to Foundry chat (escalation)

Per-message action button (Regent pattern). Posts that single message as a normal
Bibliosoph chat card via the existing card path, honoring the kept
`cardThemePartyMessage` / `cardThemePrivateMessage` themes. Party-sourced messages post
public; group-sourced messages post as whispers to the members. This is the **only**
remaining ChatMessage code path.

## Window design (ApplicationV2, Blacksmith zone contract)

New `scripts/window-messages.js`, `class MessagesWindow extends api.BlacksmithWindowBaseV2`
(resolved from `module.api`). Registered via `api.registerWindow('bibliosoph-messages', …)`
on `ready`; toolbar tool calls `api.openWindow('bibliosoph-messages')`.

| Zone | Content |
|---|---|
| Header | Icon + "Messages"; subtitle = active conversation name + member avatars |
| Option bar | Conversation switcher: pinned **Party** + groups sorted by activity; "+ New" |
| Body | Scrolling thread (sender avatar, name, timestamp, tone stamp, rendered markdown); per-message hover actions: **Send to Chat**, (GM/author) delete |
| Tools | Hidden initially (future: search) |
| Action bar | Compose: tone buttons (message/plan/agree/disagree/praise/insult), textarea (ENTER sends, SHIFT+ENTER newline), Send; GM: purge/manage |

Implementation notes (per Blacksmith guidance docs):

- `data-action` + document-level delegation only; no inline `<script>`/`onclick` in
  injected body HTML; no body queries in `activateListeners`.
- Safe `DEFAULT_OPTIONS` merge; `windowSizeConstraints` for min size; scroll
  save/restore from the base class; unique app id `coffee-pub-bibliosoph-messages`.
- Markdown via `BlacksmithUtils.markdownToHtml` on send (store raw markdown in flags,
  rendered HTML in page content).
- New-conversation flow reuses the member-picker concept (user list with avatars),
  excluding system users; respects `gmSeesAllConversations` (adds GM to members list
  display when on).

## Settings

**New**

| Setting | Scope | Default | Notes |
|---|---|---|---|
| `messagesEnabled` | world | true | Master switch (replaces partyMessageEnabled + privateMessageEnabled) |
| `toolbarCoffeePubMessagesEnabled` | world | true | Single tool replaces the two old pairs |
| `toolbarFoundryMessagesEnabled` | world | true | |
| `gmSeesAllConversations` | world (GM) | true | Off = GM window hides conversations GM isn't a member of |
| `retentionMaxMessages` | world (GM) | 200 | Per conversation |
| `messageNotifySound` / volume | client | subtle default | Local only |

**Kept**: `cardThemePartyMessage`, `cardThemePrivateMessage` (escalation cards only).

**Killed**: `partyMessageMacro`, `privateMessageMacro`, `partyMessageEnabled`,
`privateMessageEnabled`, both old toolbar setting pairs, `cardLayoutPrivateMessage`,
`privateMessageCompressedWindow`. Localization strings pruned to match.

## Removal list (legacy)

- `scripts/window.js` (`BiblioWindowChat`) and its template (`WINDOW_CHAT_TEMPLATE`).
- `openPartyMessageDialog` / `openPrivateMessageDialog` and both macro execution
  handlers in `bibliosoph.js`.
- `buildPlayerList`, `buildPrivateList`, and the message branches of
  `createChatCardGeneral` (except what the escalation card needs).
- `BIBLIOSOPH.MESSAGES_*`, `CARDTYPEMESSAGE`, `CARDTYPEWHISPER` global state in
  `const.js`.
- Old party/private toolbar tool registrations in `manager-toolbar.js` (replaced by the
  single Messages tool).

## Phases

1. **Foundation** — `manager-conversations.js`: folder/entry/page CRUD, party
   bootstrap, GM-relay create, ownership management, retention trim, read tracking.
   New settings registered; old ones removed.
2. **Window** — `window-messages.js` + `templates/window-messages.hbs`: zones, thread
   render, compose, tones, markdown, new-conversation picker. `registerWindow` +
   single toolbar tool.
3. **Live sync & signaling** — document hooks → live thread updates; unread counts;
   menubar notifications; optional sound; sidebar folder hiding.
4. **GM & escalation** — Send-to-Chat per message; GM purge/manage actions;
   `gmSeesAllConversations` filtering.
5. **Cleanup** — remove all legacy code/settings/templates/localization; update
   README/CHANGELOG; verify in Foundry v13.

## Deferred (decide case by case later)

- Typing indicators (would use sockets; broadcast-only is fine for this).
- Edit own messages after send.
- Conversation rename / leave / add members after creation.
- Thread search (Tools zone).
- Pagination/lazy-load for very long threads (retention cap makes this low priority).
