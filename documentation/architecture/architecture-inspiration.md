# Architecture: Inspiration

**Status:** describes the code as of 13.4.6. Written from source, not from plans.

Homebrew inspiration cards. The third typed content family, after injuries and outcomes, sharing the same page-model approach.

Content lives in journal pages of subtype `coffee-pub-bibliosoph.inspiration`.

---

## The design decision that shapes everything

Drawing a card does two things: it **grants the character an inspiration point** (`system.attributes.inspiration`) and it **puts the card itself in their inventory as a real item**.

The item is the point of the whole thing. A card the player can see on their sheet, hold onto for six sessions, and cash in at the dramatic moment is a different object than a line in a chat log that has scrolled away. So the item is the trigger, not a button on a card.

The item is created as *use any time, use once*: no activation cost, one charge, and it destroys itself on the way out.

---

## Lifecycle

**DRAW** — GM discretion from the toolbar, or a critical whose `dealscard` field grants access (`dealOutcomeCard()`). Grants the point and creates the item.

**USE** — the player uses the item on their sheet. `manager-inspiration.js` intercepts `dnd5e.preUseActivity`, spends the point, and resolves the card's action.

---

## Actions

`scripts/data/inspiration-schema.js` defines the `ACTIONS` map. Each entry carries a label, a button caption, a targeting hint, an icon, and an `effect` template string with `{amount}` / `{formula}` interpolation, so the card text and the mechanic never drift apart.

| Action | Effect |
|---|---|
| `none` | Narrative only — the table resolves it |
| `healFull` | Restore a creature to full hit points |
| `setHp` | Set a creature to `{amount}` hit points |
| `percentDamage` | Roll `{formula}` for a percentage; the target loses that share of current HP |

Targeting is declared per action through `ACTION_TARGET_MODE` and resolved by `targetModeFor(card)`; modes are `none`, `self`, `ally`, `target`, `any`. `actionNeedsTarget(a)` drives whether the card prompts for a selection.

**Required fields:** `title`, `image`, `description`, `odds`.
**Optional:** `imagetitle`, `action`, `actionamount`, `actionformula`, `gmnotes`, `sourceUuid`.

---

## Flow

`triggerInspiration()` → `loadInspirationDeck()` → weighted draw by `odds` → card posted with `buildInspirationPlayButtons()` → item created on the holder.

On use: `useInspirationCard()` resolves targets through `resolveInspirationTargets()`, applies the action, and consumes both the item and the point. `buildInspirationRecipient()` renders who it landed on.

Card text is generated from the record by `describeInspirationCard()` / `describeInspirationCardHtml()` rather than authored twice.

---

## Boundaries

Bibliosoph owns the cards and their actions. Inspiration itself is a dnd5e system attribute (`system.attributes.inspiration`) — Bibliosoph reads and writes it but does not model it. Toasts and logging go through Blacksmith as everywhere else.
