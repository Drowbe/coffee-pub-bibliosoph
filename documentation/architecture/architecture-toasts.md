# Architecture: Toasts

**Audience:** someone changing how Bibliosoph notifies players and GMs.

Every user-facing notice in Bibliosoph is a Blacksmith adaptive toast. `ui.notifications` appears only as a fallback when the toast API is absent.

There are two senders — roll toasts and social toasts — and one shared socket relay.

---

## Channels

Bibliosoph declares five channels to Blacksmith at startup, from a single list in `manager-roll-toasts.js`:

| Channel | Label | Covers |
|---|---|---|
| `crit` | Critical Hits | natural 20 announcements |
| `fumble` | Fumbles | natural 1 announcements |
| `injury` | Injuries | a hit crossing the injury threshold |
| `social` | Table Breaks | Beverage, Bio, Insult, Praise |
| `messages-group` | Group Messages | party and group conversation alerts |

**Direct messages carry no channel at all, deliberately.** A channel's only effect is that a user excluded from toasts -- a camera account, a shared table display -- sees the toast anyway unless the GM unticks it. That is a reasonable offer for the party channel and an unreasonable one for a private message, so a direct-message alert can never reach a shared screen.

Declaring them means a GM ticks a labelled box in settings instead of typing a channel name that nothing told them about. **Blacksmith stores the string and renders the label; it never learns what a critical is.**

Declaration is version-safe: builds at or below Blacksmith 13.15.0 have no `registerChannel`, and there the call is skipped and toasts still send.

An empty allow-list permits every *declared* channel, so the feature works with no GM configuration at all. The setting is how a GM narrows the set, not how they switch it on. This is what lets a camera account see crits, fumbles, injuries, and social announcements without extra setup.

---

## Roll toasts

`manager-roll-toasts.js` — the Rolls API integration.

Blacksmith classifies the roll and fires `attackResolved` on the GM client. The active GM builds the toast payload from settings and relays it over the Blacksmith socket API. Toasts are a **per-client primitive**, so each recipient — including the GM — renders locally through `api.toast.show()`.

Requires a Blacksmith build newer than 13.11.3 (`module.api.rolls`). On older builds `isAvailable()` is absent and the manager stays dormant; relayed toasts still render if another client sends them.

One socket event:

| Event | Meaning |
|---|---|
| `bibliosoph.rollToast` | GM tells clients to render a roll-outcome toast |

A toast can be *armed*: it is persistent (`duration: 0`) and clicking it performs the follow-up roll and posts the card.

**Exactly one client ever arms** — the designated roller, from `rollUserId`. That field falls back to the current user and the lane runs GM-side, so NPC crits, unowned actors and hidden rolls all resolve to the GM without needing a special case.

The GM used to arm for *every* crit as a backup in case the roller walked away. That produced two live toasts for one event and required a stand-down protocol to reconcile them — a second socket event, a generated roll id, and a map of armed toasts per client, all to undo a duplicate the code chose to create. Removed in favour of not creating the duplicate: the GM is armed for what the GM rolls.

Injury automation reuses this manager for both delivery and receipt-side click-arming — one socket, not three.

`InjuryTriggerManager.requestRoll(actor, category, target)` sends the same armed toast from the picker, so a GM asking a player to roll produces a prompt identical to one the damage threshold fired. The styling half of the payload is shared (`_applyToastStyle`) precisely so a player cannot tell which of the two reached them.

---

## Social toasts

`manager-social-toasts.js` — Beverage Break, Bio Break, Insults, and Praise.

Triggered from the Messages window header buttons. Each rolls its configured roll table and announces the result as a toast on every client, riding the same relay.

These four no longer bind macros, appear in toolbars, or post chat cards. The look is **fixed in code** — one shared style, no settings:

```
size: small, duration: 3, animation: pop,
color: #a4becc, backgroundColor: #000e14
```

Each entry declares a label, title, image (the header button image doubles as the toast image), a `tableKey` naming its roll table setting, and a sound. All four share the single `social` channel rather than one channel per gag — the point is that a GM can see them together.

---

## Convention

Every manager defines a local `toast()` helper of the same shape:

```js
function toast(title, subtitle = '', icon = 'fa-solid fa-…') {
    const api = game.modules.get('coffee-pub-blacksmith')?.api?.toast;
    if (api?.show) api.show({ title, subtitle, icon, duration: 3, moduleId: MODULE.ID });
    else ui.notifications.info(subtitle ? `${title} — ${subtitle}` : title);
}
```

Three seconds, an icon, `moduleId` stamped. Same pattern as the `log()` helper that wraps `BlacksmithUtils.postConsoleAndNotification`.
