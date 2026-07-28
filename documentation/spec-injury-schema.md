# Injury Schema & Authoring Prompt

**Status: IMPLEMENTED 2026-07-28.** All decisions resolved (Part 3) and built. This doc is the single contract for four consumers: the authoring prompt, the generator that builds journal pages, the validator, and a future Blacksmith `journal.injury` importer profile.

**Tooling** (`npm run …`):

| Script | Does |
|---|---|
| `injuries:validate` | Checks `resources/injuries.json` against Part 6. Exits non-zero on error. |
| `injuries:generate` | Validate → generate `packs/_source/injuries` → verify every page round-trips. |
| `injuries:build` | The above, then `packs:build`. **Foundry must be closed.** |

`tools/injury-schema.mjs` holds the machine-readable copy of Part 2 (categories, severities, conditions, bands) so the validator and generator cannot drift from each other. `tools/normalize-injuries.mjs` was the one-time migration onto this schema and has already been run.

**Why one doc:** the current authoring prompt's JSON template *is* the record shape of `resources/injuries.json`, which *is* what our parser reads back out of the journal metadata. Prompt, schema, and parser have always been the same contract — written down in three places and drifted in all three (the prompt says `foldername: "Blacksmith: Injuries"`, every record says `"Injuries"`; the prompt mandates one image per category, the data has five for acid; the prompt says `Blind`, dnd5e wants `blinded`). One doc, one truth.

---

## Part 1 — The record

One injury = one flat JSON object. A category's injuries are collected into one journal named for the category.

| Field | Type | Required | Semantics |
|---|---|---|---|
| `category` | string | yes | One of the 14 canonical categories (Part 2). Determines which journal the injury lands in. |
| `title` | string | yes | Display name, < 25 chars. Becomes the effect name on the token. |
| `image` | string | yes | Foundry icon path, chosen **per injury**. Becomes the effect icon and the card art. There is no category default or fallback — every injury names its own image, though two injuries may reuse the same one. |
| `description` | string | yes | The narrative, 3–5 sentences, second person. Shown on the card and stored as the effect description. |
| `treatment` | string | yes | Prose on how it may be treated. GM adjudication text; shown on the card and in the Check-Up hover. |
| `severity` | string | yes | `minor` \| `moderate` \| `major`. **Drives the treatment DC** (10 / 15 / 20) and bounds damage. |
| `damage` | integer | yes | One-time real HP lost the moment the injury is applied. Not ongoing, not a max-HP reduction. `0` = no damage. |
| `duration` | integer | yes | Seconds the effect lasts. `0` = permanent (until treated). |
| `statuseffect` | string | yes | Exactly one condition id from Part 2, or `"none"`. Lowercase, no display names. |
| `odds` | integer | yes | Relative likelihood, 1–100, within its category. Higher = more common. See D1. |
| `treatmentdc` | integer | no | Overrides the severity-derived DC. Omit unless the injury is deliberately off-band. |
| `imagetitle` | string | yes | Short evocative caption, under 5 words. Displayed on the injury card beneath the art. |

**Removed from the old format** — all three were parsed and thrown away:

- `journaltype` — constant `"injury"` across all 127 records.
- `foldername` — constant, and already drifted from the prompt.
- `action` — always `"Apply the {category} Injury"`; the generator derives it.

**Types changed:** `damage`, `duration`, `odds`, and `treatmentdc` are now real numbers, not quoted strings. The old "keep every value quoted" rule existed for a hand-import path we no longer use.

## Part 2 — Legal values

**Categories (14).** The 13 dnd5e damage types plus `general`:

`acid`, `bludgeoning`, `cold`, `fire`, `force`, `general`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`

`general` is the fallback when damage is untyped or evenly mixed — a common case in play, and today the thinnest journal (2 injuries vs slashing's 15). See D4.

**Severities (3):** `minor`, `moderate`, `major`.

**Conditions.** Exact lowercase ids only. Curated to what makes sense as an injury — the system registers others (`flying`, `concentrating`, `dodging`…) that never should be:

| id | Notes |
|---|---|
| `blinded`, `deafened`, `silenced` | Sense loss |
| `poisoned`, `diseased` | `diseased` is a pseudo-condition (see below) |
| `bleeding`, `burning` | Pseudo-conditions; ongoing damage |
| `prone`, `grappled`, `restrained` | Movement |
| `stunned` | Serious; moderate and up (warning on a minor) |
| `paralyzed`, `incapacitated`, `unconscious` | Takes the whole turn away — **major only** (validator error otherwise) |
| `exhaustion` | Leveled; applies level 1 |
| `frightened`, `charmed` | Mental |
| `petrified` | Extreme; major only, and rarely |
| | **Guidance bands** (validator warnings, calibrated to the authored corpus): odds — minor 5–75, moderate 5–40, major 1–20. Duration — minor 60–1800s, moderate 60–7200s, major 1800–86400s or 0. |
| `none` | No mechanical condition — the injury is narrative |

**Pseudo-conditions** (`bleeding`, `burning`, `diseased`) cannot be toggled in dnd5e; they ride on the injury effect itself via its `statuses` array. Our applier already handles that difference — authors just name them like any other.

**The validator, not this list, is the authority.** It checks every value against the live `CONFIG.statusEffects` plus `CONFIG.DND5E.conditionTypes` at build time, so a system update that renames an id surfaces as a failed build rather than a silent no-op at the table.

## Part 3 — Decisions (resolved 2026-07-28)

**D1 — `odds` drives selection. DECIDED: implement weighted picking. DONE.** `getJournalCategoryPageData` now takes a weighted draw on each page's `odds`; records with a missing or invalid value default to weight 1 rather than dropping out of the pool. Measured effect over 40,000 simulated rolls: the severity mix moves from 46% minor / 33% moderate / **20% major** to 64% / 26% / **10% major** — majors are now roughly as rare as the authoring always intended.

**Balance pass done (`tools/balance-injuries.mjs`).** With odds live, entries that fought their own severity were corrected: nine odds values (the worst being `Electric Shockwave`, a major at 75 that took 18% of all thunder rolls), thirteen durations (`Gravity Defiance`, a *major*, expired in 30 seconds; `Beastly Puncture Wound`, a *minor*, ran four hours), and six conditions — five minors were applying `incapacitated`, `stunned`, or `paralyzed`, taking a player's entire turn away for a light wound. The corpus was **not** rescaled: the authored medians already formed a clean 4:2:1 ladder (minor 40 / moderate 20 / major 10) and were left alone. Final mix over 60,000 simulated rolls: **67% minor / 25% moderate / 7% major**, with every category's most-likely result now a minor.

**D2 — `damage` stays flat. DECIDED: integer HP by severity band** (minor 0–4, moderate 5–8, major 9–12). It doesn't scale with level; the GM adjudicates. Revisit alongside the mechanics rebuild rather than re-authoring 127 damage values now.

**D3 — `imagetitle` is displayed. DECIDED: surface it on the injury card** beneath the art. 102 of 127 captions are already written; the field becomes required so the remaining 25 get one.

**D4 — `general` gets authored. DECIDED: write 10–12 general injuries** during the rebuild. It's the fallback for untyped or evenly-mixed damage — probably the most-rolled category — and currently has 2 entries against slashing's 15.

**D5 — `treatmentdc` stays unused. DECIDED: severity ladder only** (minor 10 / moderate 15 / major 20). The override field remains in the schema for hand-tuned outliers, but no injury authors one today.

**D6 — images are per-injury. DECIDED: every injury names its own `image`; no category defaults.** The old prompt's category→image mapping ("if CATEGORY is acid then set IMAGE to…") is retired — category images are no longer a concept. Reuse across injuries is fine, but the field is required on every record and there is no fallback. Two existing records need their art corrected as part of the rebuild: a `fire` injury using a broken-bone icon and a `necrotic` injury using a snow-gust icon.

**Images in use today**, for reference when authoring or reusing (not a mapping — just what exists):

```
acid          liquid-green · dissolve-arm-flesh · dissolve-bone-skull · dissolve-pool-bubbles · projectile-faceted-glob
bludgeoning   organ-brain-pink-purple · skull-fire-white-yellow · strike-fist-stone · maneuver-daggers-paired-orange ·
              projectile-spiral-gray · bone-broken-marrow-red
cold          air-smoke-casting · wind-weather-snow-gusts
fire          flame-burning-creature-skeleton · (bone-broken-marrow-red — MISMATCH, replace)
force         strike-fist-stone-gray
general       feet-bladed-boots-fire · construction-mason-stonecutter-sculpture
lightning     bolt-strike-forked-blue
necrotic      skull-energy-light-purple · (wind-weather-snow-gusts — MISMATCH, replace)
piercing      blade-tip-chipped-blood-red · strike-polearm-light-orange
poison        bottle-conical-corked-labeled-skull-poison-green
psychic       hypnosis-mesmerism-eye
radiant       explosion-shock-wave-teal
slashing      eye-green-pink · bone-broken-grey-red · strike-axe-blood-red · injury-stapled-flesh-tan
thunder       air-wave-gust-blue
```

## Part 4 — The generated page

Each injury becomes one journal page, **generated entirely from the record** so display and data can never disagree (today they do: Stabbing Pain's card says "Duration: 50" while its metadata says `300`).

Page order:

1. **Image** — first thing on the page.
2. **Title** (page name = `title`).
3. **Description** — the narrative.
4. **Treatment** — the prose.
5. **Metadata** — the `<h2>Metadata</h2>` + `<ul>` block the parser reads.

The separate hand-written "DETAILS" bullet list is **removed**. The metadata block is already a legible bullet list and serves as both the machine source and the human-readable mechanics. One copy, no drift.

### Typed pages (2026-07-28)

Injury pages are now the registered subtype **`coffee-pub-bibliosoph.injury`**, not text pages:

- `module.json` declares `documentTypes.JournalEntryPage.injury` (**a world relaunch is required** for Foundry to see a new document subtype).
- `scripts/data/injury-page-model.js` defines `InjuryPageModel extends TypeDataModel` — every mechanical field lives in `page.system` with **Foundry validating each write**, including closed choice lists for category, severity, and condition. Derived getters cover `treatmentDC`, `actionLabel`, `categoryLabel`, and `record`.
- `scripts/sheets/injury-page-sheet.js` gives GMs a real editing sheet (fields in edit mode, a formatted block in view mode), so **users can author their own injuries** — the reason for the move.
- The page's `name` is the title (never stored twice) and `text.content` is now free-form **GM notes**.
- `scripts/data/injury-schema.js` is the one schema definition; `tools/injury-schema.mjs` re-exports it so the Foundry runtime and the Node tools cannot drift.

The structure deliberately mirrors Squire's CODEX (`data/codex-page-model.js`, `sheets/codex-page-sheet.js`) so the two can be diffed and their common scaffolding extracted into a shared Coffee Pub toolkit later.

**Read order at runtime** (`readInjuryRecord` in `scripts/bibliosoph.js`): `system` → page flag → HTML metadata. Older packs keep working through the fallbacks; once every world is rebuilt, tiers 2 and 3 and `getHTMLMetadata` can be deleted.

## Part 5 — The authoring prompt

> You are a dungeon master with a sharp wit, writing lingering injuries for a D&D 5e (dnd5e system) campaign in Foundry VTT. An injury is what remains after a hit lands hard — it should complicate a character's life, be fun to roleplay, and carry a little humor without undercutting the danger.
>
> Generate one injury as a JSON object matching the template below. Follow every rule.
>
> **category** — one of: `acid`, `bludgeoning`, `cold`, `fire`, `force`, `general`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`. Use `general` for injuries that aren't tied to a damage type.
>
> **title** — under 25 characters. Evocative, a little playful. Do not reuse a title you have generated before.
>
> **image** — a Foundry icon path that suits **this specific injury**. Every injury has its own image; there is no per-category default. Reusing an image that another injury already uses is fine, but the field is never blank. Use a path that exists in Foundry's core icon library (`icons/…`), and make sure it matches the category's element — no snowstorms on necrotic wounds.
>
> **imagetitle** — a short evocative caption, under 5 words, shown beneath the art on the card. Suggest the injury's mood without describing the artwork.
>
> **description** — 3–5 sentences, **written in second person** ("your leg", "you feel"), present tense. Describe what the character experiences and how it hampers them. Never name a specific monster, character, or place.
>
> **treatment** — 1–3 sentences on how the injury can be tended: what a healer would do, what rest or supplies it needs. This is the GM's adjudication text, so make it actionable rather than mystical.
>
> **severity** — `minor`, `moderate`, or `major`. This sets how hard the injury is to treat, so be honest: `major` means a serious, campaign-affecting wound.
>
> **damage** — an integer: hit points lost once, immediately, when the injury lands. `minor` 0–4, `moderate` 5–8, `major` 9–12. Use `0` freely for injuries that hamper without wounding further.
>
> **duration** — an integer, in **seconds**, that the injury lasts. `0` means permanent until treated. Guidance: `minor` 60–600, `moderate` 600–3600, `major` 3600–86400 or `0`. Choose a duration that fits the fiction, not a round number.
>
> **statuseffect** — exactly one id from this list, lowercase, or `"none"`: `blinded`, `deafened`, `silenced`, `poisoned`, `diseased`, `bleeding`, `burning`, `prone`, `grappled`, `restrained`, `stunned`, `paralyzed`, `incapacitated`, `unconscious`, `exhaustion`, `frightened`, `charmed`, `petrified`. Most injuries should be `"none"` — apply a condition only when the fiction plainly demands it. Reserve `stunned`, `paralyzed`, `incapacitated`, `unconscious`, and `petrified` for `major`. Never invent a value; if nothing fits, use `"none"` and let the description carry the flavor.
>
> **odds** — an integer 1–100 for how commonly this injury should come up within its category. Nastier injuries get lower odds; `minor` injuries typically 30–75, `moderate` 15–40, `major` 1–20.
>
> Return only the JSON object, with numbers unquoted:
>
> ```json
> {
>   "category": "CATEGORY",
>   "title": "TITLE",
>   "image": "IMAGE",
>   "imagetitle": "IMAGETITLE",
>   "description": "DESCRIPTION",
>   "treatment": "TREATMENT",
>   "severity": "SEVERITY",
>   "damage": 0,
>   "duration": 0,
>   "statuseffect": "none",
>   "odds": 50
> }
> ```
>
> Now generate an injury with:
> - category: `[CATEGORY]`
> - additional direction: `[ANYTHING SPECIFIC]`

## Part 6 — Validation

The validator runs over all records before a pack build and fails loudly. Checks:

- Required fields present; no unknown fields.
- `category` in the canonical 14; `severity` in the three.
- `damage`, `duration`, `odds` are integers; `damage` within its severity band; `odds` 1–100.
- `statuseffect` is `"none"` or resolves against live `CONFIG.statusEffects` / `CONFIG.DND5E.conditionTypes`.
- `image` non-empty and the file exists on disk (no category fallback exists to cover a bad path).
- `imagetitle` non-empty, under 5 words.
- `title` unique within its category; length under 25.
- `treatmentdc`, if present, is a positive integer.

Warnings (not failures): an `odds` value far outside its severity's typical band, and a `duration` outside its severity's guidance range.

## Part 7 — Pipeline

`resources/injuries.json` (source of truth, hand-editable, git-diffable)
→ validator
→ generator (page HTML from the template in Part 4 + record stamped as a flag)
→ `packs/_source/injuries/*.json`
→ `npm run packs:build` (Foundry must be closed)
→ compendium

This removes the current two-hand-maintained-copies hazard: the pack source becomes generated output. Journal/page IDs change on rebuild, which is safe — our lookup is by journal *name* (the category) and picks a page at random, and applied effects are snapshots that never reference the journal.

**Blacksmith:** none of the above needs their importer. That matters separately, for *authoring new content* later — their Importer API (`documentation/api/api-importer.md`) is explicitly a "proposed contract, not yet guaranteed" built around kinds and profiles, where a profile yields the JSON template, the AI prompt, validation, and import. A `journal.injury` profile built from this doc would fold Part 5 and Part 6 into their tooling. Worth requesting; not worth waiting for.
