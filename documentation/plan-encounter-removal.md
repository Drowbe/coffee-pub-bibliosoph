# Plan: Remove Legacy Encounter System (Macro + Table Based)

This document plans the removal of the **old** encounter system (habitat macros, roll tables, `createChatCardEncounter`) in favor of **Quick Encounter** only. Scope is limited to **encounters** (urban, dungeon, cave, desert, forest, mountain, sky, snow, water, general). Other macro/table/hook-based features (investigation, gifts, critical, fumble, beverage, etc.) are **not** changed.

**Do not change any code until this plan is approved and implementation is explicitly requested.**

---

## 1. Scope and Boundaries

### 1.1 In scope (remove or refactor)

- **Legacy encounter flow:** Habitat-specific toolbar buttons (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water) that trigger a macro → set `BIBLIOSOPH.CARDTYPEENCOUNTER` / `ENCOUNTER_TYPE` → macro executes → `publishChatCard()` → `createChatCardEncounter(strRollTableName)` (odds roll, roll tables for monster + narration, chat card).
- **Legacy encounter settings:** Per-habitat enable/macro/table and global encounter table/odds/dice settings used **only** by that flow.
- **Legacy encounter code:** Trigger functions, macro binding for encounter macros, `createChatCardEncounter`, the `CARDTYPEENCOUNTER` branch in `publishChatCard`, and any code paths used **exclusively** by the above.
- **Dead code:** e.g. `checkAndCreateMacro` (only defines encounter macro creation; not called anywhere).

### 1.2 Out of scope (keep unchanged)

- **Quick Encounter:** `manager-encounters.js`, `window-encounter.js`, `window-encounter.hbs`, `window-encounter.css`, Quick Encounter toolbar entry, deploy/roll chat cards, cache, compendium search, deployment. These stay.
- **Shared encounter settings used by Quick Encounter:**  
  - `encounterOdds` — used by Quick Encounter window (slider) and by `manager-encounters.js` roll-for-encounter. **Keep.**  
  - `cardThemeEncounter` — used by `manager-encounters.js` for encounter card theme. **Keep.**
- **Other macro/table systems:** Investigation, Gifts, Shady Goods, Critical, Fumble, Inspiration, DOMT, Beverage, Bio, Insults, Praise, Party/Private Message, Injuries. No removal or change to their macros, tables, hooks, or settings.
- **Chat card template:** `templates/chat-card.hbs` — keep. It is used by Quick Encounter for `isEncounterCard` / `encounterMonsters`. Only the **legacy** code path that built the old encounter card is removed; the template structure stays.
- **RollTable / getRollTable / createChatCardGeneral / createChatCardSearch:** Used by non-encounter features. Do not remove.

### 1.3 Settings to keep (used by Quick Encounter)

| Setting | Used by |
|--------|---------|
| `encounterOdds` | Quick Encounter window slider; `manager-encounters.js` roll-for-encounter |
| `cardThemeEncounter` | `manager-encounters.js` (buildEncounterCardData) |
| `quickEncounterEnabled` | Toolbar / Quick Encounter |
| `toolbarCoffeePubQuickEncounterEnabled` | Toolbar |
| `toolbarFoundryQuickEncounterEnabled` | Toolbar |

### 1.4 Settings to remove (legacy encounter only)

- **Global (legacy flow only):**  
  - `encounterDice` — used only in `createChatCardEncounter` for quantity roll.  
  - `encounterTableNoEncounter`, `encounterTableBefore`, `encounterTableReveal`, `encounterTableAfter` — narration tables for legacy encounter card.
- **Per-habitat (all 10):**  
  For each of General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water:  
  - `encounterEnabled*`  
  - `encounterMacro*`  
  - `encounterTable*`  
  - `toolbarCoffeePub*EncounterEnabled`  
  - `toolbarFoundry*EncounterEnabled`
- **Settings UI headings (legacy encounter section):**  
  - `headingH2Encounters`  
  - `headingH3EncounterSettings`  
  - `headingH3simpleGeneralEncounters`, `headingH3simpleCaveEncounters`, … through `headingH3simpleWaterEncounters`

---

## 2. Verification: No Other Consumers of Legacy Encounter Code

Before removal, confirm the following are **only** used by the legacy encounter flow (or are dead):

| Item | Used by | Action |
|------|---------|--------|
| `BIBLIOSOPH.CARDTYPEENCOUNTER` | `publishChatCard` (encounter branch), `createChatCardEncounter`, trigger functions, bindAllMacros encounter blocks | Remove encounter branch; remove or keep const only if still needed for Quick Encounter (Quick Encounter does not set CARDTYPEENCOUNTER). After removal, can set const to false and leave in place or remove if unused. |
| `BIBLIOSOPH.ENCOUNTER_TYPE` / `BIBLIOSOPH.CARDTYPE` (when set to encounter types) | Same as above; used to pick which roll table in `publishChatCard` | Remove when removing encounter branch. |
| `window.trigger*EncounterMacro` (10 functions) | Toolbar onClick for 10 habitat buttons | Remove; toolbar entries for those 10 removed. |
| `createChatCardEncounter(strRollTableName)` | Only from `publishChatCard` when `CARDTYPEENCOUNTER` | Remove. |
| `getMacroByIdOrName` / `getRollTable` | Many features (investigation, gifts, etc.) | **Keep.** |
| `encounterTypes` in bindAllMacros (updateSetting) | Only for encounter macro binding | Remove encounter entries from that loop (or remove loop usage for encounters). |
| `checkAndCreateMacro(settingName)` | Not called anywhere | Remove as dead code. |

**Conclusion:** Legacy encounter code is isolated to: bibliosoph.js (trigger functions, bindAllMacros encounter blocks, publishChatCard encounter branch, createChatCardEncounter, validateMandatorySettings encounter entries, checkAndCreateMacro), manager-toolbar.js (10 habitat tools), settings.js (legacy encounter settings + headings), lang/en.json (legacy encounter strings). No other module systems depend on these.

---

## 3. Removal Checklist (No Code Changes Until Approved)

### 3.1 `scripts/bibliosoph.js`

- [ ] Remove the 10 `trigger*EncounterMacro` functions (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water).
- [ ] Remove the 10 `window.trigger*EncounterMacro = ...` assignments.
- [ ] In `validateMandatorySettings`, remove the 10 encounter entries from `macroChecks` (General Encounters through Water Encounters).
- [ ] In `bindAllMacros`: remove the 10 encounter macro variables (`strGeneralMacro` … `strWaterMacro`) and the 10 enabled flags (`blnGeneralEnabled` … `blnWaterEnabled`).
- [ ] In `bindAllMacros`: remove the entire block that binds encounter macros (the 10 "ENCOUNTER CHECKS" blocks: General through Water, each with `if (bln*Enabled) { ... Macro.execute = ... }`).
- [ ] In the `updateSetting` / macro-binding logic that uses `encounterTypes`: remove the `encounterTypes` array and any loop that binds encounter macros (or remove only encounter-related entries if the loop is shared).
- [ ] In `publishChatCard`: remove the `if (BIBLIOSOPH.CARDTYPEENCOUNTER) { ... createChatCardEncounter(...) }` branch (the whole block that switches on `BIBLIOSOPH.CARDTYPE` and calls `createChatCardEncounter`).
- [ ] Remove the entire function `createChatCardEncounter(strRollTableName)`.
- [ ] Remove the entire function `checkAndCreateMacro(settingName)` (dead code; only handles encounter macro settings).
- [ ] In `resetBibliosophVars` (or equivalent): remove or leave `BIBLIOSOPH.CARDTYPEENCOUNTER = false` as appropriate (if the constant is still declared, keep reset for consistency; if constant is removed, remove reset).
- [ ] Optional: In `const.js` (BIBLIOSOPH), leave `CARDTYPEENCOUNTER: false` for now if any remaining code references it; otherwise remove after confirming no references.

### 3.2 `scripts/manager-toolbar.js`

- [ ] Remove the 10 TOOLBAR_TOOLS entries: `bibliosoph-general-encounter`, `bibliosoph-cave-encounter`, `bibliosoph-desert-encounter`, `bibliosoph-dungeon-encounter`, `bibliosoph-forest-encounter`, `bibliosoph-mountain-encounter`, `bibliosoph-sky-encounter`, `bibliosoph-snow-encounter`, `bibliosoph-urban-encounter`, `bibliosoph-water-encounter`.
- [ ] Keep `bibliosoph-quick-encounter` and `openEncounterWindow` import.

### 3.3 `scripts/settings.js`

- [ ] Remove registration for: `headingH2Encounters`, `headingH3EncounterSettings`.
- [ ] Keep: `cardThemeEncounter`, `encounterOdds` (used by Quick Encounter). Remove: `encounterDice`, `encounterTableNoEncounter`, `encounterTableBefore`, `encounterTableReveal`, `encounterTableAfter`.
- [ ] For each habitat (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water) remove:  
  - `encounterEnabled*`, `toolbarCoffeePub*EncounterEnabled`, `toolbarFoundry*EncounterEnabled`, `encounterMacro*`, `encounterTable*`, and the corresponding `headingH3simple*Encounters`.
- [ ] Ensure `encounterMacroWater` is not registered twice (there appears to be a duplicate registration around line 2221); remove the duplicate when removing encounter macro/table settings.

### 3.4 `lang/en.json`

- [ ] Remove keys for the removed settings and headings (see §1.4 and §3.3). Keep keys for: `encounterOdds`, `cardThemeEncounter`, Quick Encounter labels/hints, and any shared "Random Encounters" intro text if still used; remove keys for legacy-only labels (e.g. per-habitat tables/macros, encounterDice, encounterTableNoEncounter/Before/Reveal/After, headingH2Encounters, headingH3EncounterSettings, headingH3simple*Encounters, all encounterEnabled/encounterMacro/encounterTable/toolbar* for the 10 habitats).
- [ ] Optionally retain a single "Random Encounters" or "Quick Encounter" section heading if the settings UI still has an encounter area (e.g. for encounterOdds + cardThemeEncounter + quickEncounter); otherwise remove or repurpose.

### 3.5 Templates and styles

- [ ] **No removal** from `templates/chat-card.hbs`: the `isEncounterCard` / `encounterMonsters` structure is used by Quick Encounter. Only the legacy code path that called `createChatCardEncounter` is removed.

### 3.6 Hooks

- [ ] No encounter-specific hooks to remove beyond the macro binding in `bindAllMacros` (handled in §3.1). The generic `Hooks.on("updateSetting", ...)` that calls `bindAllMacros` stays; it will simply no longer rebind encounter macros once those settings and bindings are removed.

### 3.7 Post-removal checks

- [ ] Search codebase for: `CARDTYPEENCOUNTER`, `ENCOUNTER_TYPE` (when used for legacy flow), `createChatCardEncounter`, `triggerGeneralEncounterMacro`, `encounterMacroGeneral`, `encounterTableGeneral`, `encounterEnabledGeneral` (and other habitats). Ensure no remaining references to removed API or settings.
- [ ] Confirm other macro/table features still work: Investigation, Gifts, Shady Goods, Critical, Fumble, Inspiration, Beverage, Bio, Insults, Praise, Party/Private Message, Injuries.
- [ ] Confirm Quick Encounter: open window, Roll for encounter (uses encounterOdds), Recommend, Deploy, chat cards (use cardThemeEncounter).

---

## 4. Summary of What Gets Removed

| Category | Removed |
|----------|---------|
| **Toolbar** | 10 habitat encounter buttons (General … Water). Quick Encounter button remains. |
| **Scripts (bibliosoph.js)** | 10 trigger*EncounterMacro functions and window exports; encounter branch in publishChatCard; createChatCardEncounter; checkAndCreateMacro; encounter macro binding and variables in bindAllMacros; 10 encounter entries in validateMandatorySettings. |
| **Scripts (manager-toolbar.js)** | 10 TOOLBAR_TOOLS entries for habitat encounters. |
| **Settings** | encounterDice; encounterTableNoEncounter, Before, Reveal, After; per-habitat encounterEnabled, encounterMacro, encounterTable, toolbarCoffeePub*, toolbarFoundry*; headings headingH2Encounters, headingH3EncounterSettings, headingH3simple*Encounters. |
| **Lang** | All keys for the removed settings and headings. |
| **Kept** | encounterOdds, cardThemeEncounter; quickEncounterEnabled and Quick Encounter toolbar settings; Quick Encounter code and UI; chat-card.hbs (including isEncounterCard block); all non-encounter macros/tables/hooks. |

---

## 5. Implementation Order Suggestion

1. **Settings + lang:** Unregister and remove lang keys for legacy encounter settings and headings. This may cause console warnings for existing worlds that have those keys stored until code that reads them is removed.
2. **Toolbar:** Remove the 10 habitat encounter tools from manager-toolbar.js.
3. **bibliosoph.js:** Remove trigger functions, window exports, validateMandatorySettings encounter entries, bindAllMacros encounter variables and binding blocks, publishChatCard encounter branch, createChatCardEncounter, checkAndCreateMacro. Optionally clean CARDTYPEENCOUNTER/ENCOUNTER_TYPE if unused.
4. **Verification:** Run through checklist §3.7 and test Quick Encounter + one other macro/table feature.

---

## 6. References

- **Quick Encounter:** `scripts/manager-encounters.js`, `scripts/window-encounter.js`, `templates/window-encounter.hbs`, `styles/window-encounter.css`.
- **Legacy encounter (to remove):** `scripts/bibliosoph.js` (trigger*EncounterMacro, bindAllMacros encounter blocks, publishChatCard CARDTYPEENCOUNTER branch, createChatCardEncounter, checkAndCreateMacro, validateMandatorySettings encounter entries), `scripts/manager-toolbar.js` (10 habitat tools), `scripts/settings.js` (legacy encounter settings/headings), `lang/en.json` (legacy encounter keys).
- **Plan for Quick Encounter (additive):** `documentation/plan-encounters.md`.
