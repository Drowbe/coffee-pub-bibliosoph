# Architecture: Bibliosoph Core

**Audience:** someone changing Bibliosoph, and the rest of the suite.

Bibliosoph is the Coffee Pub **outcomes and announcements** module. It owns authored content that fires at the table — injuries, criticals, fumbles, inspiration — plus encounters and the Messages system. It does not own character UI, and it does not own any registry: every shared service it uses belongs to Blacksmith.

See [architecture-ownership](../../../coffee-pub-blacksmith/documentation/architecture/architecture-ownership.md) for why the boundary sits where it does.

---

## Module shape

| File | Lines | Role |
|---|---|---|
| `scripts/bibliosoph.js` | 3,856 | Entry point, hooks, chat cards, treatment rolls, outcome application |
| `scripts/settings.js` | 1,706 | Settings registration and section headings |
| `scripts/window-encounter.js` | 1,479 | Quick Encounter window |
| `scripts/manager-conversations.js` | 1,367 | Journal-backed conversations |
| `scripts/window-messages.js` | 1,347 | Unified Messages window |
| `scripts/manager-encounters.js` | 804 | Quick Encounter orchestration |
| `scripts/manager-status-effects.js` | 493 | The single effect-application path, the effects classifier, the guarded delete |
| `scripts/manager-inspiration.js` | 482 | Inspiration draw/use lifecycle |
| `scripts/manager-injury-effects.js` | 462 | Canvas bursts and sounds |
| `scripts/manager-roll-toasts.js` | 375 | Crit/fumble toasts, socket relay, channel declaration |
| `scripts/manager-toolbar.js` | 288 | Toolbar tool definitions |
| `scripts/manager-injury-triggers.js` | 247 | Damage-threshold injury automation |
| `scripts/window-injury-picker.js` | 245 | Injury picker (Blacksmith Tool window) |
| `scripts/manager-injury-ticks.js` | 205 | Recurring tick damage and expiry |
| `scripts/manager-social-toasts.js` | 155 | Beverage/Bio/Insult/Praise |
| `scripts/data/*` | ~900 | Typed page models and schemas |
| `scripts/sheets/*` | ~370 | Page sheets for the three typed subtypes |

---

## Boot sequence

`const.js` fetches `module.json` at import time and derives `MODULE.ID/NAME/TITLE/VERSION` from it. There is no hardcoded module id anywhere; the code name (`BIBLIOSOPH`) is the last dash-segment of the id, uppercased.

Registration with Blacksmith happens in a `Hooks.once('ready')` block at [bibliosoph.js:88](../../scripts/bibliosoph.js#L88):

1. Bail if `coffee-pub-blacksmith` is not active.
2. `await BlacksmithAPI.waitForReady()` — globals like `BlacksmithUtils` attach after `markReadyForConsumers()`, so this keeps registration safe across build and hook orderings.
3. Resolve `registerModule` through three fallbacks (`api.registerModule`, `api.ModuleManager.registerModule`, the `BlacksmithModuleManager` global) and register id + name + version.
4. If `messagesEnabled`, initialize `ConversationManager`, register the `bibliosoph-messages` window, and register a menubar tool in the left zone.

Everything downstream assumes Blacksmith is present. Where a specific Blacksmith capability may be missing on older builds, the feature checks for the function and stays dormant rather than failing — see Rolls API and toast channels below.

---

## Blacksmith surfaces consumed

| Surface | Used for |
|---|---|
| `registerModule` | identity and version reporting |
| `registerToolbarTool` | seven Foundry toolbar buttons |
| `registerMenubarTool` | the Messages button |
| `registerWindow` / `openWindow` | `bibliosoph-messages` |
| `api.toast` + `registerChannel` | all user-facing notices |
| `api.rolls` | `attackResolved`, `damageResolved` |
| `api.sockets` | GM-authoritative relays |
| `api.compendiums` | Quick Encounter monster lookup |
| `openRequestRollDialog` + `blacksmith.requestRollComplete` | treatment Medicine rolls |
| `BlacksmithUtils.postConsoleAndNotification` | all logging |
| `BlacksmithUtils.getSettingSafely` | all setting reads |

**Bibliosoph never calls `console.log` directly** outside of a fallback branch, and never calls `ui.notifications` except as a fallback when the toast API is absent. Both patterns appear as a `log()` and `toast()` helper at the top of each manager.

---

## Toolbar

`manager-toolbar.js` defines a `TOOLBAR_TOOLS` map and registers each entry through Blacksmith, skipping any tool whose visibility setting is off and guarding against double registration.

| Tool | Zone | Order |
|---|---|---|
| Messages | communication | 1 |
| Investigation | rolls | 1 |
| Critical Hit | rolls | 2 |
| Fumble | rolls | 3 |
| Injuries | rolls | 4 |
| Check-Up | rolls | 5 |
| Inspiration | rolls | 7 |
| Quick Encounter | gmtools | 1 |

Each feature has a single visibility choice setting rather than a boolean pair; legacy macro binding was removed in 13.4.5.

---

## Settings

`settings.js` registers headings and settings in workflow groups. Headings use a `registerHeader(...)` helper whose `scope` argument controls visibility: `world` hides the heading from players, `user` shows it. A heading must be visible to exactly the people who can see something under it.

Structure is H1 (module) → H2 (major feature) → H3 (sub-area). Major features get an H2 banner with flavor text; sub-features do not get their own section.

---

## Typed journal pages

`module.json` declares three `JournalEntryPage` subtypes:

```
documentTypes.JournalEntryPage: { injury, outcome, inspiration }
```

Each has a data model in `scripts/data/*-page-model.js` and a sheet in `scripts/sheets/*-page-sheet.js`. Every mechanical field lives in `page.system` with schema validation — **nothing is parsed out of HTML.** The older metadata-block format is what allowed displayed values to drift from real ones.

The page-model structure deliberately mirrors Squire's CODEX page model so the common scaffolding can later be extracted into a shared toolkit.

---

## Chat cards and sockets

`publishChatCard()` is the **investigation path only**. Criticals, fumbles, inspiration and injuries each build their card directly from their typed compendium, which is why none of them has a `BIBLIOSOPH.CARDTYPE*` flag. That function once dispatched five card types; four have moved out, and the last one is worth watching — a dispatcher with a single consumer is a function waiting to be inlined.

Socket events, all GM-authoritative:

| Constant | Purpose |
|---|---|
| `bibliosoph.rollToast` | GM tells clients to render a roll-outcome toast |
| `bibliosoph.treatRoll` | treatment roll request |
| `bibliosoph.treatStamp` | mark a treat button resolved |
| `bibliosoph.outcomeApply` | apply an outcome to targets |
| `bibliosoph.conversation.create` | player asks a GM client to create a conversation |
| `bibliosoph.conversation.update` | player asks a GM client to update a conversation |

The recurring pattern: hooks fire on every client, so any handler that writes to a document guards with `game.user.isGM && game.users.activeGM?.id === game.user.id`. Toasts are the exception — they are a per-client primitive and every recipient renders locally.

---

## Related documents

- [architecture-injuries](architecture-injuries.md)
- [architecture-outcomes](architecture-outcomes.md)
- [architecture-inspiration](architecture-inspiration.md)
- [architecture-toasts](architecture-toasts.md)
- [architecture-encounters](architecture-encounters.md)
- [architecture-messages](architecture-messages.md)
