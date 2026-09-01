# Architecture: Quick Encounter

**Audience:** someone changing Bibliosoph's Quick Encounter builder.

A CR-aware, compendium-based encounter builder: pick a habitat and a difficulty, get a monster list, roll a detection level, post a narrative card, deploy to canvas.

Two files: `manager-encounters.js` (orchestration, 804 lines) and `window-encounter.js` (Application V2 window, 1,479 lines).

---

## The monster cache

Scanning every configured compendium on each open is too slow, so candidates are cached in a world setting (`quickEncounterCache`) with a version stamp (`ENCOUNTER_CACHE_VERSION`) for migrations.

- `buildEncounterCache(progressCallback)` populates it, capped at `MAX_ACTORS_PER_PACK` (200) per compendium.
- `getEncounterCacheStatus()` reports freshness to the window.
- CR and XP come off the actor via `getActorCR()` / `getActorXP()`; `formatCR()` renders fractions.
- `isValidEncounterActor()` filters out anything unusable.
- Token images resolve through `getActorTokenImg()`, including wildcard paths via `resolveWildcardPath()`.

Compendium selection and CR maths lean on Blacksmith (`api.compendiums`, `getMonsterCR`, `calculateEncounterDifficulty`) rather than local implementations.

---

## Habitats

`OFFICIAL_HABITATS` covers the standard set (Any, Arctic, Coastal, Desert, Forest, Grassland, …). `actorMatchesHabitat()` and `extractHabitatTags()` read environment tags off the actor to filter candidates.

---

## Building an encounter

| Function | Role |
|---|---|
| `getCandidatesWithXP(habitat)` | eligible monsters with XP resolved |
| `encounterRecommend(...)` | up to `MAX_RECOMMENDATIONS` (20) random picks, no budget applied |
| `buildEncounter(habitat, targetCR, minCR, maxCR, variability, maxExtraOptions)` | the real builder — respects CR bounds and variability |
| `encounterGetIncludeMonsters(names)` | force-include named monsters |
| `rollForEncounter(...)` | roll, then post the card |

When a rolled encounter runs out of distinct monster types, it fills by adding more of the types it already has rather than widening the CR band.

---

## Detection levels

`const.js` defines five levels, each with a label, tooltip, and narrative paragraph used verbatim on the chat card:

| Level | Label |
|---|---|
| 1 | Surprised |
| 2 | Outmatched Awareness |
| 3 | Mutual Awareness |
| 4 | Tactical Advantage |
| 5 | Undetected |

`getDetectionLevelFromAverageRoll(average)` maps the party's average Perception roll (0–20) onto that ladder: 0–3 → 1, 4–8 → 2, 9–12 → 3, 13–16 → 4, 17+ → 5. `getDetectionLevelInfo(level)` clamps and looks up.

---

## Narrative and cards

Flavour text comes from `resources/encounters-narrative.json`, selected by habitat **and time of day** (`getTimeOfDay()`, `getNarrativeEntriesForHabitatAndTime()`), with `pickRandomEncounterIntroEntry()` choosing among matches.

`buildEncounterCardData()` assembles the card; `postEncounterCardToChat()` and `postEncounterDeployCardToChat()` publish it.

---

## The window

`window-encounter.js` is Application V2, Foundry v13 only, using `HandlebarsApplicationMixin` for `_renderHTML`/`_replaceHTML`. It declares a unique `WINDOW_ENCOUNTER_APP_ID` so no other module's window can be reused.

Event handling uses a single module-level document delegation listener (`_encounterDelegationAttached`) that dispatches to the current window reference, rather than re-binding on every render.

---

## Note on the legacy system

An older encounter flow existed based on habitat macros, roll tables, and `createChatCardEncounter`. Quick Encounter replaced it. Other macro- and table-based features (investigation, gifts, beverage, and so on) were not part of that change.
