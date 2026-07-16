# Plan: Injuries Data Model — Custom JournalEntryPage Subtype

**Status:** Phase 0 complete (data rescued); Phases 1–5 not started
**Reference pattern:** Squire CODEX data-model migration — `coffee-pub-squire/documents/plan-codex-datamodel.md`, `scripts/data/codex-page-model.js`, `scripts/sheets/codex-page-sheet.js`
**Foundry docs:** [Module Sub-Types](https://foundryvtt.com/article/module-sub-types/) | [JournalEntryPage API v13](https://foundryvtt.com/api/v13/classes/foundry.documents.JournalEntryPage.html)

## Why

Injuries content historically shipped in Blacksmith compendium packs and was consumed here by
scraping journal-page HTML: `getJournalCategoryPageData()` finds a journal named after the damage
category, picks a random page, and `getHTMLMetadata()` DOM-parses a `<h2>Metadata</h2>` + `<ul>`
block back into data (`scripts/bibliosoph.js:2569`, `:2632`). Authoring requires Blacksmith's
AI-prompt → JSON → `buildInjuryJournalEntry()` pipeline; one ProseMirror hand-edit can silently
break a page's metadata block.

Blacksmith is unbundling all content packs (its `documentation/TODO-GLOBAL.md`), so the content
must move here — and the **MAJOR goal** is that users can easily create, edit, and maintain their
own injuries. Squire's CODEX already made this exact journey (HTML-as-database → typed pages) and
its plan doc documents why HTML parsing is a dead end. We copy that proven pattern.

## Phase 0 — Data rescue ✅ (July 16, 2026)

The orphaned LevelDB packs in `coffee-pub-blacksmith/packs/` were extracted with
`@foundryvtt/foundryvtt-cli` and converted to a canonical dataset:

- **`blacksmith-injuries`** (13 category journals, Metadata-block format) → 102 injuries with severity/odds/imageTitle
- **`injuries`** (25 legacy one-journal-per-injury, one-page-per-field format) → 25 injuries (no severity/odds — fields postdate them)
- **`treatments`** pack was empty; treatment text lives on each injury
- Legacy category typos normalized: `Poision` → Poison, `Lightening` → Lightning

**Result: [`resources/injuries.json`](../resources/injuries.json) — 127 injuries across 14 categories**
(Acid 11, Bludgeoning 14, Cold 9, Fire 6, Force 4, General 2, Lightning 8, Necrotic 8, Piercing 13,
Poison 8, Psychic 10, Radiant 9, Slashing 15, Thunder 10). No name+category collisions between the
two packs; every record has description, treatment, and img. This file is now the canonical source —
the Blacksmith LevelDB dirs can be deleted per its cleanup plan.

### Data format: the Blacksmith JSON-import (AI prompt) schema — decision

`injuries.json` is a JSON **array** whose entries conform exactly to the schema Blacksmith's JSON
Import tool and `prompt-injuries.txt` use: `journaltype: "injury"`, lowercase `category`/`severity`,
all values strings, keys `journaltype, category, odds, foldername, title, imagetitle, image,
description, treatment, severity, damage, duration, action, statuseffect`. Consequences:

- **Importable today, zero new code**: paste the array into Blacksmith's Import window
  (`registry-json-import-journals.js` routes `journaltype "injury"` → `buildInjuryJournalEntry()`).
- One AI/import schema everywhere — the eventual typed-page import accepts the same shape
  (fields → `system`, `title` → page name), exactly like CODEX kept its old export JSON importable.
- Future direction (idea, not scheduled): Blacksmith's import registry grows a public API so any
  module can publish its import kind into the shared Import tool; Bibliosoph would register
  "Injuries" there.

Reformatting rules applied to the 25 legacy-format records (data-derived, no invented content):
blank `severity` filled from the prompt's own damage ranges (0–4 minor, 5–8 moderate, 9–12 major);
missing `odds` set to the rescued dataset's per-severity medians (minor 40, moderate 20, major 10);
`action` normalized to the prompt's canonical "Apply the {Category} Injury"; blank `statuseffect` →
"none"; recognized status effects re-cased to the prompt's spellings ("blinded" → "Blind"); blank
`imagetitle` left blank. Non-standard legacy status effects (e.g. "Frozen in Time", "Headache",
"Bleeding", "Sluggish") kept verbatim — see Open decisions.

## Interim: bundled `injuries` compendium ✅ infrastructure (July 16, 2026)

Goal: **functional before improved** — restore the out-of-the-box injuries experience on the
current (HTML-metadata) consumer before any data-model work. Infrastructure in place:

- `module.json` declares pack `coffee-pub-bibliosoph.injuries` (JournalEntry, dnd5e, players
  observer). **Full world relaunch required** to see it.
- LevelDB stays gitignored. Committed source of truth is `packs/_source/injuries/*.json`
  (per-document extracts); the release workflow compiles `_source` → LevelDB via
  `@foundryvtt/foundryvtt-cli` before zipping `packs/` (this avoids the LevelDB-in-git churn
  Blacksmith's cleanup calls out — deliberately *not* Artificer's commit-the-LevelDB convention).
- Tooling: `npm run packs:extract` (Foundry-edited pack → `_source` JSON; run after changing pack
  content in Foundry, world closed) and `npm run packs:build` (`_source` → LevelDB; CI does this,
  running it locally overwrites the local pack).

Populating it (manual, once): relaunch world → paste `resources/injuries.json` into Blacksmith's
JSON Import tool (builds the category journals) → unlock the `Injuries` compendium → drag the
journals in → `npm run packs:extract` → commit. Then point Bibliosoph's `injuryCompendium` setting
at **Coffee Pub Bibliosoph: Injuries**. The Phase 1–5 rebuild below supersedes this pipeline later.

## Target Architecture

### Document type

`module.json` gains (requires a **full world relaunch**, not just F5):

```json
"documentTypes": { "JournalEntryPage": { "injury": {} } }
```

Type string: `coffee-pub-bibliosoph.injury` (auto-prefixed). Localization key:
`TYPES.JournalEntryPage.coffee-pub-bibliosoph.injury` → "Injury".

### Data model (`scripts/data/injury-page-model.js`)

`class InjuryPageModel extends foundry.abstract.TypeDataModel`, registered at `init`:
`CONFIG.JournalEntryPage.dataModels['coffee-pub-bibliosoph.injury'] = InjuryPageModel;`

The injury's **name is the page name** (native). Fields carry the same data as
`resources/injuries.json` with typed values (numbers as NumberFields, `title` → page name,
`image`/`imagetitle`/`statuseffect` → `img`/`imageTitle`/`statusEffect`):

| Field | Type | Notes |
|-------|------|-------|
| `category` | StringField | Damage type (Acid, Slashing, …) or "General". Drives card icon/banner and the category-selector buttons |
| `severity` | StringField | Minor / Major / Severe (free-form; legacy data has blanks) |
| `odds` | NumberField (nullable) | Selection weight. Unused by the current consumer — retained for future weighted rolls |
| `damage` | NumberField (integer, initial 0) | Hit points lost when applied |
| `duration` | NumberField (integer, initial 0) | Seconds; 0 = permanent |
| `statusEffect` | StringField | Condition name to apply with the injury ("" = none) |
| `action` | StringField | Apply-button label on the chat card |
| `treatment` | StringField | How to treat the injury (card section) |
| `description` | StringField | The card text (CODEX "summary" analog) |
| `img` | StringField | Icon path. **Lenient StringField, not FilePathField** — CODEX learned imported data with odd paths must not fail schema validation |
| `imageTitle` | StringField | Caption shown above the image |

**Free-form GM lore lives in `page.text.content`** (native text field, ProseMirror, enrichment,
search — all first-class, nothing parsed). Empty by default; the chat card never reads it.

### Sheet (`scripts/sheets/injury-page-sheet.js`)

Registered via `DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE.ID, InjuryPageSheet,
{ types: ['coffee-pub-bibliosoph.injury'], makeDefault: true })`.

Follow CODEX's implemented approach: extend
`foundry.applications.sheets.journal.JournalEntryPageTextSheet` (AppV2) and prepend an
`injuryFields` part to `VIEW_PARTS`/`EDIT_PARTS` (templates
`page-injury-fields-view.hbs` / `page-injury-fields-edit.hbs`).

- **View mode:** styled injury card — image + caption, description, treatment, details table
  (category, severity, damage, duration, status effect) — then rendered lore text.
- **Edit mode:** form inputs for system fields (category dropdown from existing values + damage-type
  list, number inputs for damage/duration/odds, image picker) + stock ProseMirror for lore.

This alone satisfies "users create/edit/maintain their own injuries": journal → Add Page → type
"Injury" → fill in a real form. No parser to break, native permissions and folders.

## Consumers simplified

| Consumer | Today | After |
|----------|-------|-------|
| `createChatCardInjury(category)` | compendium → journal-by-category-name → random page → `getHTMLMetadata()` HTML scrape | injuries journal → filter typed pages by `system.category` → random page → read `page.system` directly |
| `createChatCardInjurySelector()` | category buttons from compendium journal names | distinct `system.category` values from typed pages |
| `injuryCompendium` setting | compendium picker (`arrCompendiumChoices`) | **replaced** by `injuriesJournal` world-journal picker (CODEX `codexJournal` pattern) |
| `getJournalCategoryPageData()` + `getHTMLMetadata()` | runtime dependency | **deleted** |
| Blacksmith `buildInjuryJournalEntry()`, `journal-injury.hbs`, `prompt-injuries.txt`, INJURY import type | authoring pipeline | **deleted from Blacksmith** (Phase 5); optional AI import lives here instead |

The chat-card template itself (`templates/chat-card.hbs`, Blacksmith Chat Cards structure) is
unchanged — only where CARDDATA comes from changes.

## Migration: none (decision, same as CODEX)

No automated conversion of injury journals/compendiums already sitting in user worlds. The
**default-content import is the conversion path**: importing creates typed pages; the consumer reads
typed pages only. Rationale mirrors CODEX: removes the largest risk and effort, and the canonical
data ships with the module anyway.

- Users with the old Blacksmith compendium content lose nothing — the same content (plus the 25
  legacy-format extras) arrives via `resources/injuries.json`.
- The old `injuryCompendium` setting is dropped; release notes must say "reconfigure: set your
  Injuries journal and run Import Default Injuries."

## Phases

### Phase 1 — Model + Sheet
- [ ] `documentTypes` in `module.json`; `TYPES.JournalEntryPage.coffee-pub-bibliosoph.injury` in `lang/en.json` (world relaunch to take effect)
- [ ] `InjuryPageModel` + registration at `init`
- [ ] `InjuryPageSheet` + view/edit field templates + CSS (Blacksmith-consistent, per Coffee Pub conventions: CSS `@import` in `default.css`)
- [ ] Verify: journal "Add Page" picker shows "Injury"; create/edit/view round-trip in-game

### Phase 2 — Default content import
- [ ] `injuriesJournal` world setting (journal picker; replaces `injuryCompendium`)
- [ ] "Import Default Injuries" GM action (settings button or toolbar): reads `resources/injuries.json` (the Blacksmith import schema — see Phase 0), creates typed pages in the configured journal
- [ ] Upsert by name+category (flag `injuryKey` on imported pages, CODEX `codexUuid` pattern) so re-import updates instead of duplicating; user-authored pages untouched
- [ ] Optional: auto-prompt on first run when the journal is empty
- [ ] Interim (works today, before Phase 1): the same file pastes into Blacksmith's JSON Import tool, which builds legacy HTML-metadata journals the current consumer already reads

### Phase 3 — Consumers
- [ ] `createChatCardInjury` / `createChatCardInjurySelector` read typed pages (`page.system`) from `injuriesJournal`
- [ ] Delete `getJournalCategoryPageData()` and `getHTMLMetadata()`
- [ ] Category icon/banner switch keyed off `system.category` (unchanged logic, new source)
- [ ] Verify: toolbar/macro injury flow, category selector card, apply-injury button, status effect + damage application

### Phase 4 — Authoring polish (optional, after core proves out)
- [ ] JSON import/export window for user injury sets (CODEX import/export pattern)
- [ ] Move/adapt the AI authoring prompt (Blacksmith `prompts/prompt-injuries.txt`) to emit the `injuries.json` schema for AI-assisted authoring
- [ ] Creation window (CodexWindow-style) only if the page sheet's edit mode proves insufficient

### Phase 5 — Cross-module cleanup (coordinates with Blacksmith TODO-GLOBAL)
- [ ] Blacksmith: delete `journal-injury.hbs`, `buildInjuryJournalEntry()`, INJURY import type, `prompt-injuries.txt`, and the orphaned `packs/` dirs
- [ ] Bibliosoph: remove `injuryCompendium` setting + `en.json` strings; changelog/release notes for reconfiguration
- [ ] Injury banners currently hard-code `modules/coffee-pub-blacksmith/images/banners/…` — fine while Blacksmith is required; consider Blacksmith constants/API later

## Open decisions

1. **`statusEffect` fidelity** — today a free-form string matched against conditions at apply time.
   The rescued data contains non-standard values kept verbatim: Bleeding, Chilled to the Bone,
   Clumsy Fingers, Confused, Disoriented, "Deafened, Blind" (compound), Frozen in Time, Headache,
   Sluggish, Twitching, plus Frightened/Incapacitated (real 5e conditions absent from the prompt's
   list). Decide: map to nearest real condition, allow flavor-only effects, or make the edit sheet a
   dnd5e condition dropdown with a free-text escape hatch.
2. **Weighted selection** — `odds` is preserved in schema and data but unused; implement weighted
   random pick or drop the field at Phase 3 time.
3. **`imagetitle` backfill** — the 25 legacy-format injuries have blank image titles (field
   postdates them); backfill by hand/AI in `injuries.json` or leave blank (card just omits the
   caption).
4. **CODEX Phase 3 verification is still in progress in Squire** — inherit any sheet/base-class
   lessons it surfaces before starting Phase 1 here.
