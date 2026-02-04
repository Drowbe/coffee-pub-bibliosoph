# Investigation System — Specification

This document specifies the expanded investigation flow, settings, chat card layout, and narrative JSON. Implementation should follow this spec.

---

## 1. Overview

When a user rolls investigation:

1. **Find something or not** — One roll (e.g. 1d100) vs a 0–100 odds setting. If they fail, show a “found nothing” narrative and stop.
2. **How many slots** — Roll to get N (e.g. 1d**maxSlots**). N is the number of *chances* to find an item (1–20).
3. **For each of N slots** — Roll to determine **rarity** (Common, Uncommon, Rare, Very Rare, Legendary) using per-rarity odds, then roll on that rarity’s **table** to get one item. Add that item to the actor’s inventory.
4. **Narrative** — Pick one “found nothing” or “found something” entry from `resources/investigation-narrative.json` (by context).
5. **Chat card** — Render header, title from JSON, separator, narrative description, then one row per found item (image + name), then “We added … to [character]'s inventory”.

There is no separate “quantity per item”; each slot yields exactly one item from one rarity table.

---

## 2. Settings Reference

All investigation-related settings (as registered in `settings.js`). Keys are `MODULE.ID`-prefixed (e.g. `investigationOdds`).

### 2.1 Master and UI

| Setting key | Type | Scope | Purpose |
|-------------|------|--------|---------|
| `investigationEnabled` | Boolean | world | Master on/off for investigation. |
| `toolbarCoffeePubInvestigationEnabled` | Boolean | user | Show Investigation on Coffee Pub toolbar. |
| `toolbarFoundryInvestigationEnabled` | Boolean | user | Show Investigation on Foundry toolbar. |
| `cardThemeInvestigation` | Choice | world | Chat card theme (e.g. `theme-default`). |
| `investigationMacro` | Choice (macros) | world | Macro used as the Investigation button (toolbar / hotbar). |

### 2.2 Find Something and Slots

| Setting key | Type | Range | Default | Purpose |
|-------------|------|--------|---------|---------|
| `investigationOdds` | Number | 0–100, step 1 | 20 | Chance to find something. Roll ≤ this value = find something; otherwise “found nothing”. |
| `investigationDice` | Number | 1–20, step 1 | 3 | **Max slots.** Number of things they might find is determined by a roll (e.g. 1d**investigationDice**), so actual slots = 1 to this value. |

### 2.3 Per-rarity table and odds

For each rarity: a **roll table** (what item) and **odds** (0–100, step 0.5) used when resolving “which rarity” for a slot. Implementation typically uses a single d100 roll and assigns bands (e.g. 0–80 Common, 80–100 Uncommon, etc.) by normalizing or stacking the five odds.

| Rarity | Table setting | Odds setting | Default odds |
|--------|----------------|--------------|--------------|
| Common | `investigationTableCommon` | `investigationOddsCommon` | 80 |
| Uncommon | `investigationTableUncommon` | `investigationOddsUncommon` | 20 |
| Rare | `investigationTableRare` | `investigationOddsRare` | 5 |
| Very Rare | `investigationTableVeryRare` | `investigationOddsVeryRare` | 2 |
| Legendary | `investigationTableLegendary` | `investigationOddsLegendary` | 0.5 |

- **Table** — Roll table choice (e.g. “Choose a Roll Table”). Table results should be document-linked Items for inventory add.
- **Odds** — Number, 0–100, step 0.5. Used to build the distribution for the per-slot rarity roll.

If a rolled rarity has no table configured or the table roll gives no valid item, that slot is skipped (no item added, no row on the card).

---

## 3. Narrative JSON

**Path:** `resources/investigation-narrative.json`

### 3.1 Structure

- **`foundNothing`** — Array of narrative entries used when the “find something” roll fails.
- **`foundSomething`** — Array of narrative entries used when the investigator finds at least one item.

Each entry has:

| Field | Type | Purpose |
|-------|------|---------|
| `title` | string | Short heading shown in the chat card (e.g. “Nothing Found”, “Search Results”). |
| `tags` | array (e.g. of strings) | Reserved for future use (e.g. biome, mood). Optional. |
| `description` | string | Paragraph text shown in the card body. |

At runtime, pick **one** entry from the appropriate array (e.g. random, or first; spec does not mandate which).

### 3.2 Example

```json
{
  "foundNothing": [
    {
      "title": "Nothing Found",
      "tags": [],
      "description": "You carefully search the area but find nothing of interest."
    }
  ],
  "foundSomething": [
    {
      "title": "Search Results",
      "tags": [],
      "description": "You carefully examine your surroundings, your gaze sweeping across the area. Your thoroughness has been advantageous."
    }
  ]
}
```

---

## 4. Chat Card Layout (Investigation)

The investigation chat card uses these zones in order (from top to bottom):

| Zone | Content |
|------|--------|
| **Header** | `[ [icon] Investigation ]` — Same as current card header (icon + “Investigation”). |
| **Title** | Title from the chosen JSON narrative entry (`title`). |
| **Separator** | A horizontal line (e.g. `--------------------------`). |
| **Narrative** | The longer text from the chosen JSON entry (`description`). |
| **Item rows** | One row per found item: `[ [image] item name ]`. Optionally show rarity (e.g. “Common …”, “Rare …”). Repeat for each slot that produced an item. |
| **Inventory line** | “We added [item1], [item2], … to [character name]'s inventory.” (e.g. “We added 3 Candles, 1 Potion to Favia Gita's inventory.”) |

- No single large “hero” image; only small per-item images in the item rows.
- If nothing found, only header, title, separator, narrative, and no item rows or inventory line.

---

## 5. Flow (Algorithm Summary)

1. **Roll find something** — e.g. `1d100`. If total **>** `investigationOdds`, use `foundNothing` narrative, render card (title + description only), stop.
2. **Roll number of slots** — e.g. `1d{investigationDice}` → N (1 to max slots).
3. **For slot i = 1..N:**
   - Roll **rarity** (e.g. 1d100) and map to one of Common / Uncommon / Rare / Very Rare / Legendary using `investigationOddsCommon`, … `investigationOddsLegendary` (e.g. normalized bands).
   - If that rarity has no table or table not set, skip slot.
   - Roll the rarity’s **table** once. If result has a document UUID for an Item, record (name, image, link, rarity, uuid) and add one of that item to the actor (same add-to-inventory rules as current implementation, e.g. user character or controlled token, delete `_id`, etc.). If no valid item, skip slot.
4. **Narrative** — Choose one entry from `foundSomething` (e.g. random).
5. **Build card** — Header, narrative title, separator, narrative description, one row per recorded finding, then inventory summary line.

---

## 6. Removed / Deprecated

- **Single investigation table** — Replaced by per-rarity tables (`investigationTableCommon`, etc.). The old `investigationTable` setting is removed.
- **“Search Descriptions” roll tables** — “Nothing Found”, “Before”, “Reveal”, “After” are no longer used; narrative comes only from `investigation-narrative.json`.
- **Per-item quantity roll** — Replaced by the slots model; each slot gives one item (no separate quantity dice per item).

---

## 7. Implementation Notes

- **Rarity distribution** — The five odds (Common through Legendary) can be normalized to sum to 100 and used as cumulative bands for a d100 roll, or implemented as a weighted table. Odds are 0–100 with step 0.5; ensure “no result” is handled if a band is 0 or table missing.
- **Actor for inventory** — Reuse current logic: `game.user.character ?? canvas.tokens?.controlled?.[0]?.actor`; if none, do not add items but may still show the card with findings (without inventory line or with a “no character” message).
- **Localization** — Setting names/hints use `MODULE.ID + '.key-Label'` and `'.key-Hint'`; ensure `lang/en.json` (and any other languages) have entries for new keys (e.g. `investigationTableCommon`, `investigationOddsCommon`, etc.).

---

## 8. Document Info

- **Spec version:** 1.0  
- **Settings source:** `scripts/settings.js` (investigation block ~645–870).  
- **Narrative source:** `resources/investigation-narrative.json`.
