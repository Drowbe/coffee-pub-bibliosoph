# Architecture: Investigation

**Audience:** someone changing Bibliosoph's investigation flow.

What happens when a character searches a room: two independent rolls, a slot-based item draw across five rarity tables, and one merging grant into the inventory.

The flow lives in `createChatCardInvestigation()` in `scripts/bibliosoph.js`, with the inventory and currency writes in `scripts/manager-loot.js`.

---

## The flow

1. **Resolve the searcher.** `game.user.character`, falling back to the first controlled token's actor. The card names the character, not the person holding the mouse -- it is a thing that happened in the fiction -- and falls back to the user only when there is no character to name at all.
2. **Load the narrative** from `resources/investigation-narrative.json`. A failure here aborts the card, so it reports through a toast rather than only the console: the table would otherwise see nothing happen at all.
3. **Roll for coins**, independently of items.
4. **Roll to find items.** On failure the card is composed from whichever narrative pool fits what actually happened, and the flow stops.
5. **Roll the slot count**, then resolve each slot to a rarity and an item.
6. **Grant** the coins and the items, then compose the card.

The coin roll and the item roll are separate, so a search can turn up money and nothing else. That is why a failed item roll still picks from `foundSomething` when coins landed -- the narrative has to match the outcome the player can see.

---

## Rolling to find

The base rule is `1d100` against `investigationOdds`: roll at or under it and there is something to find.

With `investigationPlayerSkill` enabled, and only on dnd5e with a resolved actor, the roll instead becomes `1d100` plus the character's Intelligence modifier and proficiency bonus, tested against `100 - investigationOdds`. The character's competence moves the odds rather than the setting alone deciding.

## Slots and rarity

`investigationDice` is the **maximum** number of slots, clamped to 1-20. The actual count is `1d{investigationDice}`, so a setting of 3 yields one, two or three chances.

Each slot resolves independently:

1. The five per-rarity odds (`investigationOddsCommon` through `investigationOddsLegendary`) are normalised to sum to 100 and stacked into cumulative bands. Authored odds therefore express relative weight, not a probability that has to add up.
2. `1d100` picks the band, and so the rarity.
3. That rarity's table setting (`investigationTableCommon` and siblings) names a roll table. An unset table, a missing table, a result with no `documentUuid`, or a UUID that does not resolve to an `Item` all skip the slot silently -- no item, no row on the card.

A skipped slot is deliberately quiet. A search that finds two things out of three chances is an ordinary outcome, not an error worth telling the table about.

## Coins

`investigationCoinsOdds` gates a separate `1d100`. On success each denomination rolls independently between zero and its configured maximum (`investigationCoinsMaxPlatinum` through `investigationCoinsMaxCopper`), and a denomination with a maximum of zero never appears. If every denomination rolls zero, nothing was found.

---

## Writing to the sheet

Both writes go through Blacksmith rather than touching the actor directly.

**Items** are collected during the loop and handed to `grantFoundItems()` in a single call. A search that turns up three arrows is three arrows, and adding them one at a time is three writes to one actor that land as three rows of one. Blacksmith owns the merge because merging is harder than it looks: the row a payload becomes is not the payload -- creation fills schema defaults and normalises properties -- so comparing the two never matches. Building item data by hand and creating it directly is exactly the shape that fails.

**Currency** goes through `grantCurrency()`. Writing `system.currency.*` directly is a read-modify-write on an unlocked path, so two finds landing at once would each read the same balance and one would silently win. `grantCurrency` takes the lock and applies a delta.

Both report failures rather than swallowing them: names that could not be added are logged and surfaced in a toast telling the GM to add them by hand.

**The card lists what was found; the inventory line names only what landed.** The search turned the items up either way, so they stay on the card, but the sentence claiming they reached the sheet has to be true -- otherwise the card and the character sheet disagree with nobody the wiser.

---

## The narrative file

`resources/investigation-narrative.json` holds two arrays, `foundNothing` and `foundSomething`. Each entry carries a `title`, a `description`, and a `tags` array that nothing reads yet. One entry is picked at random from the applicable pool; the card falls back to a fixed title when a pool is empty.

Keeping the prose in a data file rather than in roll tables means a GM edits one file to reskin every search, and the narrative cannot drift from the mechanics that produced it.

---

## Card rendering

Investigation is one of two features still rendering through the legacy `chat-card.hbs` template rather than building from a typed compendium -- Quick Encounter is the other, see [architecture-encounters](architecture-encounters.md). `composeInvestigationCard()` assembles the zones in order: header, the narrative entry's title, a separator, its description, one row per found item, the coin line, and the inventory line.

---

## Boundaries

Bibliosoph owns the search flow and its narrative. Inventory and currency writes belong to Blacksmith's inventory API. Roll tables and the items they yield are the GM's own content: Bibliosoph names five tables in settings and never ships them.
