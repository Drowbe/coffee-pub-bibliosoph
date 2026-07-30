# Inspiration Card Schema

The third typed content family, after injuries and criticals/fumbles. Same
shape as its siblings — a JSON authoring source, a validator, a generator,
a typed journal page subtype, a data model, and a sheet — but a different
lifecycle, because a card is a **thing a player holds** rather than a thing
that happens to them.

- Authoring source: `resources/inspiration.json`
- Machine-readable schema: `scripts/data/inspiration-schema.js`
- Page model: `scripts/data/inspiration-page-model.js`
- Sheet: `scripts/sheets/inspiration-page-sheet.js`
- Generator: `tools/build-inspiration-journals.mjs`
- Compendium: `coffee-pub-bibliosoph.inspiration`

---

## Part 1 — The lifecycle

```
DRAW ──► card item lands in the character's inventory
              │
              │  (sits there indefinitely — hours, sessions, whole arcs)
              ▼
USE THE ITEM ──► the play card is raised in chat
              │
              ▼
CLICK A BUTTON ──► the action runs · the card is discarded
```

**The card is the currency.** Holding it is the right to play it; playing
it spends it. There is no separate point.

This is deliberate, and it is a reversal of an earlier design. The first
version granted a dnd5e inspiration point on draw and spent it on play.
That could not work: `system.attributes.inspiration` is a `BooleanField`,
so a character holding four cards had one point, and playing any one card
left the other three unplayable. Two pieces of state for one fact, where
one of them physically could not represent a hand.

Bibliosoph therefore **never reads or writes** `system.attributes.inspiration`
as part of this lifecycle. The pip stays free for whatever else a table
uses inspiration for. The single exception is the `grantInspiration`
*action*, where handing over a point is a card's own stated effect.

### Why the item, and not a chat button

A chat card scrolls away. An item does not. The card a player can see on
their sheet, sit on for six sessions and cash in at the dramatic moment is
a different object from a line in a log, and that difference is the whole
point of the feature.

### Nothing is spent until a button is clicked

Using the item does **not** consume it. `dnd5e.preUseActivity` vetoes the
activity outright and posts the Bibliosoph play card in its place, so the
charge, the item and the play are all still on the table. Opening a card
and thinking better of it costs nothing.

---

## Part 2 — Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | The page name. Never stored twice. |
| `image` | string | yes | Card art. Becomes the item's icon too. |
| `imagetitle` | string | no | Short caption under the art. |
| `description` | string | yes | The card's prose, second person. |
| `odds` | int 1–100 | yes | Relative weight in a random draw. |
| `action` | enum | no | Automatable effect; see Part 3. Defaults to `none`. |
| `actionamount` | int | no | For `setHp`. |
| `actionformula` | string | no | For `percentDamage` (e.g. `1d10*10`). |
| `appliesto` | enum | no | Overrides the derived target mode; see Part 4. |
| `gmnotes` | string | no | Shipped guidance on running the card. |

---

## Part 3 — Actions

Deliberately few and boring. Each is a state change with **no judgement in
it**. Anything requiring a decision belongs in the prose, because a button
that guessed at "distribute 5 points among your attributes" would be worse
than no button.

| `action` | Does | Params |
|---|---|---|
| `none` | Nothing — the table resolves it | — |
| `healFull` | Restores the target to full HP | — |
| `setHp` | Sets the target to N hit points | `actionamount` |
| `percentDamage` | Rolls a formula for a percentage; target loses that share of current HP | `actionformula` |
| `swapHp` | Swaps current HP between two characters; overflow becomes temp HP | — |
| `longRest` | A genuine dnd5e long rest | — |
| `grantInspiration` | Grants a dnd5e inspiration point | — |

`longRest` is worth a note: it calls `actor.longRest()` with
`newDay: true` (anything less silently skips daily-recharge items),
`request: true` (the card is the authorisation, so the "Allow Rests"
player setting must not block it), `advanceTime: false` (the card is
instant), and `chat: true` so dnd5e's own summary is the receipt. A falsy
return means it was refused, and the card and the play both survive.

---

## Part 4 — Targeting

Which buttons the play card shows comes from the **action**, because the
action already tells us: you cannot swap health with yourself, and "reduce
their health by 80%" is not aimed at a party member.

| Mode | Derived from | Buttons on the play card |
|---|---|---|
| `none` | `action: none` | One — *Play This Card* |
| `self` | `longRest` | One, naming the holder |
| `ally` | `swapHp` | One per *other* party member, plus Random |
| `target` | `percentDamage` | One per currently targeted creature |
| `any` | `healFull`, `setHp`, `grantInspiration` | The holder, the party, and anything targeted |

A card may override with `appliesto` if it ever needs to disagree with its
action. `targetModeFor(card)` honours the override and otherwise derives.

Targets are **per-user**, so they are resolved on the client that clicked
and travel as actor ids. Actions that reach onto another player's sheet
(Life Swap) relay to the active GM, who re-checks that the card is still
held before writing anything.

---

## Part 5 — The generated item

Drawing creates a dnd5e consumable on the character:

- `type: consumable`, subtype `trinket`, rarity `veryRare`, quantity 1
- `uses: { max: '1', autoDestroy: true }` — one charge
- one **utility activity**, `activation.type: 'special'` (no action cost =
  usable any time), consuming `itemUses: 1`
- description: the art, caption, prose, a **What This Does** mechanics
  list, and an `@UUID` link back to the deck page
- flagged `coffee-pub-bibliosoph.inspirationCard` with the **whole** card,
  not just its mechanics

The flag carries art and prose because the play card renders straight from
it, and it must keep working if the deck page is later renamed, moved, or
the compendium unlinked. On play, `freshenCard()` prefers the live deck
page when `sourceUuid` still resolves, so a GM who rewords a card sees the
change on cards already dealt.

There is deliberately **no** `system.description.chat`: dnd5e's own usage
card never posts, so it would be dead data on every item.

---

## Part 6 — Dealing

| Who | Clicks the toolbar | Gets |
|---|---|---|
| GM | Deal dialog | Every card with art, kind and draw odds, plus *Deal a Random Card* |
| Player | — | An immediate weighted draw to their own character |

The GM is *dealing*, usually deliberately ("you get Smite for that"); the
player is *drawing* their own luck. Same button, and the thing each of them
wants is one click.

Crits can also deal: an outcome with `dealscard: true` hands a card to
whoever its `appliesto` names. That is the one place the three content
families connect.

---

## Part 7 — Validation

Reuses the sibling families' rules where they apply: `odds` 1–100, art must
resolve, `imagetitle` under five words. Action-specific:

- `actionamount` required and positive for `setHp`
- `actionformula` required and parseable for `percentDamage`
- an `action` outside the enum is an error
- `appliesto` outside `TARGET_MODES` is an error

---

## Part 8 — Deliberately not done

- **Multi-deck support.** The long-term goal is decks as a concept —
  inspiration boons, a Deck of Many Things, whatever a table invents —
  drawn from a configurable deck rather than one hard-wired compendium.
  The schema does not yet carry a deck identity.
- **Discard piles / shuffling.** Draws are independent weighted picks; a
  card can be drawn twice and nothing tracks what has been seen.
- **Expiry.** A held card is held forever.
