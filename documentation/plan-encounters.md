# Encounter Tool Plan — Quick Encounter Manager

This document plans the new **Quick Encounter** tool for Bibliosoph: a CR-aware, compendium-based encounter builder with a configuration window and deployment to canvas. The existing roll-table encounter flow (habitat macros, roll tables, chat cards) remains unchanged.

---

## 1. Goals and Scope

### 1.1 What We Are Building

- **Toolbar entry:** A single button on the Foundry toolbar (Blacksmith toolbar) that opens the new encounter tool, registered the same way as other Bibliosoph tools (e.g. Party Message, Investigation, habitat encounters).
- **Quick encounter window:** A configuration window where the GM sets habitat, difficulty, and other criteria; sees current canvas CR (party CR / monster CR); gets a recommended set of monsters from configured compendiums; and deploys selected monsters to the canvas.
- **No change to existing encounters:** All current encounter behaviour (General/Cave/Desert/… macros, roll tables, `createChatCardEncounter`, odds roll, chat cards) stays as-is. This tool is additive.

### 1.2 Out of Scope (for this plan)

- Migrating or replacing the roll-table encounter system.
- Implementing the actual code; this document is plan-only.

---

## 2. Blacksmith API Usage (Summary)

The following are used by the encounter tool; details are in the earlier review.

| Need | Blacksmith API |
|------|----------------|
| Current party CR, monster CR, difficulty on canvas | `BlacksmithAPI.getCombatAssessment()` |
| Target difficulty from party CR + monster CR | `BlacksmithAPI.calculateEncounterDifficulty(partyCR, monsterCR)` |
| Which compendiums to search (priority order) | `BLACKSMITH.arrSelectedMonsterCompendiums` (or `arrSelectedActorCompendiums`) |
| CR parse/format (e.g. "1/2" ↔ 0.5) | Direct API after `BlacksmithAPI.get()`: `parseCR`, `formatCR` |

Compendium search and filtering (by CR, habitat, difficulty) is implemented in Bibliosoph; Blacksmith only supplies the compendium list and CR/difficulty helpers.

---

## 3. File and Naming Conventions

Use the following naming patterns for the encounter feature:

| Pattern | Purpose | Examples |
|--------|---------|----------|
| `manager-*.js` | Orchestration and high-level flow | `manager-encounters.js` |
| `utility-*.js` | Pure helpers, no UI | `utility-encounter-search.js` (compendium search/filter), optional `utility-encounter-cr.js` if we isolate CR logic |
| `window-*.js` | Application/dialog logic (Application V2) | `window-encounter.js` |
| `window-*.hbs` | Handlebars template for a window | `window-encounter.hbs` |
| `window-*.css` | Styles for a specific window | `window-encounter.css` |

- **manager-encounters.js:** Entry point; toolbar registration hook; calls Blacksmith for CR and compendium list; opens the encounter window; coordinates search and deploy. Does not contain roll-table or chat-card logic.
- **window-encounter.js / .hbs / .css:** The “Quick Encounter” configuration UI and its template and styles (Blacksmith model; see §5).
- **utility-*.js:** Optional; e.g. compendium search by CR/habitat, or CR/difficulty helpers. Can live inside `manager-encounters.js` initially and be split later.

Module entrypoint (e.g. `bibliosoph.js`) imports and uses `manager-encounters.js` (same pattern as `manager-toolbar.js`).

---

## 4. Toolbar Registration

- **Where:** Register the encounter tool in the same place and manner as other Bibliosoph toolbar tools (see `manager-toolbar.js` and the `TOOLBAR_TOOLS` pattern).
- **Behaviour:** One tool (e.g. `bibliosoph-quick-encounter`) that:
  - Is visible to GMs only (`gmOnly: true`).
  - On click: opens the Quick Encounter configuration window (the one defined by `window-encounter.js` / `.hbs`).
- **Settings:** Use a single “Encounter tool enabled” setting (and optional toolbar placement settings) consistent with other tools (e.g. `toolbarCoffeePubQuickEncounterEnabled`, `toolbarFoundryQuickEncounterEnabled`). Do not duplicate the existing per-habitat encounter settings; those remain for roll-table macros only.

---

## 5. Habitats (Official List)

Use the **official D&D 5e / compendium habitats** for the Quick Encounter tool (filters and UI):

- **Any**
- **Arctic**
- **Coastal**
- **Desert**
- **Forest**
- **Grassland**
- **Hill**
- **Mountain**
- **Planar**
- **Swamp**
- **Underdark**
- **Underwater**
- **Urban**

These are used as filter options in the configuration window and (where available) when querying or filtering actors from compendiums. Mapping from any existing Bibliosoph habitat labels (e.g. “Cave”, “Dungeon”, “Sky”, “Snow”, “Water”) to this list can be documented or implemented in a utility if we need backward-facing labels.

---

## 6. Configuration Window — Blacksmith Model

The Quick Encounter configuration window should follow the **Blacksmith model** for layout and styling so it feels consistent with other Coffee Pub tools (e.g. Image Replacements, deployment UIs).

### 6.1 Design Reference

- **Image Replacements–style window:** Header with title and “X Close”; global toggles/settings (e.g. tokens/portraits, sliders, Fuzzy Search–style options); a “current selection” area; a **search/filter** section (filter buttons, search field, clear); and a **results** section (sort, pagination, grid of cards with thumbnails and metadata/tags). Reuse or mirror the **window template and CSS** used there so the encounter window has the same structure and look (dark theme, sectioned layout, button/toggle style).
- **Pull in template and CSS:** Use the appropriate Blacksmith (or shared Coffee Pub) window template and CSS where possible—e.g. a shared Application V2 window layout and a shared stylesheet—so we don’t reinvent the layout. Bibliosoph-specific overrides or additions go in `window-encounter.css`.

### 6.2 Encounter-Specific Sections

- **Header:** Title (e.g. “Quick Encounter”), Close button.
- **Canvas CR / status:** Show current “CR situation” on the canvas (e.g. Party CR, Monster CR, current difficulty). Data from `BlacksmithAPI.getCombatAssessment()`. Optionally reuse a “CANVAS”-style indicator block (e.g. badges for counts) similar to the deployment screenshot.
- **Criteria / filters:**
  - **Habitats:** Official list (§5) as filter buttons or dropdown (e.g. “Any”, “Arctic”, … “Urban”).
  - **Difficulty:** Easy / Medium / Hard / Deadly (and optionally “target CR” or override). Use Blacksmith’s `calculateEncounterDifficulty` and party CR to suggest or validate.
  - Optional: search by name, CR range, or other compendium metadata.
- **Search / filters UI:** A “Search filters”–style area: filter chips or buttons (e.g. habitat, difficulty), optional free-text search, clear-filters action. Matches the Blacksmith search/filter pattern.
- **Results / recommendations:** A “Matching results”–style grid: each row/card = one recommended monster (thumbnail, name, CR, habitat/tags). Buttons or checkboxes to “include in deployment” or “add to deployment set”. Sort options (e.g. by CR, name, relevance). Pagination or “show N of M” as in the reference.
- **Deployment block:** See §7.

---

## 7. Deployment System — Blacksmith Journals Style

Deployment should mirror the **Blacksmith journals deployment** pattern (e.g. “09 VAULT OF THE LICH LORD” / “VAULT ANTECHAMBER” style UI).

### 7.1 Elements to Replicate

- **Deploy options:** Toggles or buttons for deployment behaviour, e.g.:
  - **SEQUENTIAL** (e.g. place one-by-one or in a defined order) vs another mode if applicable.
  - **VISIBLE** (deployed tokens visible to players) vs hidden until “Reveal”.
- **Deployable set:** Thumbnails (and names) of the monsters selected for deployment—the “recommended set” the GM has chosen. Visual state (e.g. red border) can indicate “selected for this deployment”.
- **Action buttons:**
  - **DEPLOY ALL:** Place all selected monsters (or the current recommendation set) onto the current scene as tokens.
  - **COMBAT:** Add deployed (or selected) tokens to the combat tracker / start combat as appropriate.
  - **REVEAL:** Make any hidden deployed tokens visible to players.
- **Canvas status:** A “CANVAS” area with small badges (e.g. counts: active tokens, defeated, or similar). Can be extended to show Party CR / Monster CR here if desired.

### 7.2 Implementation Notes

- Reuse or reference Blacksmith’s deployment logic and UI patterns (templates, CSS, JS) where they are exposed or documented, so behaviour and look align with “Blacksmith journals” deployment.
- Token creation and placement use Foundry’s Canvas and Scene APIs; placement can be “staged” (e.g. a default position or drag-to-place) depending on what Blacksmith does and what we want for Bibliosoph.

---

## 8. High-Level Data Flow

1. **Open tool:** User clicks the toolbar button → `manager-encounters.js` opens the Quick Encounter window (`window-encounter.js`).
2. **Load canvas state:** On open (or on scene change), call `BlacksmithAPI.getCombatAssessment()`; display Party CR, Monster CR, and difficulty in the window (and optionally in the CANVAS block).
3. **Set criteria:** User selects habitat (from official list), difficulty (and optionally target CR or name search). Optional: filters for CR range, etc.
4. **Recommend monsters:** Using `BLACKSMITH.arrSelectedMonsterCompendiums`, search compendiums in priority order; filter by habitat, CR, and difficulty (using Blacksmith CR/difficulty helpers where useful); return a recommended set and show it in the “Matching results” grid.
5. **Select for deployment:** User selects which recommended monsters (and quantities) to deploy. Selected items appear in the deployment block (thumbnails + DEPLOY ALL / COMBAT / REVEAL).
6. **Deploy:** User clicks DEPLOY ALL (and optionally COMBAT / REVEAL). Manager or a small utility creates tokens from the selected actors and places them on the current scene; COMBAT/REVEAL actions follow the Blacksmith journals–style behaviour as far as applicable.

---

## 9. Dependencies and Loading

- **Blacksmith:** Required for this feature (combat assessment, compendium list, and optionally shared window/deployment UI). Consider declaring `coffee-pub-blacksmith` as a library or required dependency in `module.json` for the encounter tool; keep runtime checks so the rest of Bibliosoph still runs if Blacksmith is missing.
- **Application V2:** All new windows/dialogs (e.g. `window-encounter.js`) use the Application V2 framework; no Application V1.
- **Script loading:** `manager-encounters.js` is imported from the main entrypoint (e.g. `bibliosoph.js`). `window-encounter.js` and any `utility-*.js` are imported by the manager or the main entrypoint as needed. Add any new scripts to `module.json` `esmodules` if they are top-level entrypoints.

---

## 10. Deliverables Checklist (Implementation Phase)

- [ ] **manager-encounters.js** — Orchestrator; toolbar registration; opens encounter window; calls Blacksmith for CR and compendium list; coordinates search and deploy.
- [ ] **window-encounter.js** — Application V2 for Quick Encounter; uses `window-encounter.hbs`.
- [ ] **window-encounter.hbs** — Template following Blacksmith window model (header, CR block, filters, results grid, deployment block).
- [ ] **window-encounter.css** — Styles for the encounter window (and overrides); align with Blacksmith window CSS.
- [ ] **Toolbar** — One “Quick Encounter” tool registered (e.g. in same flow as `manager-toolbar.js` or from `manager-encounters.js`).
- [ ] **Habitats** — Official list (Any, Arctic, Coastal, … Urban) used in UI and filtering.
- [ ] **Search/filter** — Compendium search using `arrSelectedMonsterCompendiums`; filter by habitat, difficulty, CR.
- [ ] **Recommendations** — Grid of recommended monsters with select-for-deployment and deployment block (thumbnails, DEPLOY ALL, COMBAT, REVEAL, CANVAS indicators).
- [ ] **Deploy to canvas** — Create tokens from selected actors; place on current scene; optional COMBAT/REVEAL behaviour.
- [ ] **No change** to existing roll-table encounter macros, tables, or `createChatCardEncounter`.

---

## 11. References

- Blacksmith API (Core): [API: Core Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith/wiki/API:-Core-Blacksmith) — Compendium Configuration API, Combat assessment API.
- Blacksmith model UI: Image Replacements window (search filters, matching results grid, toggles).
- Blacksmith journals deployment: Deployment panel (SEQUENTIAL, VISIBLE, thumbnails, DEPLOY ALL, COMBAT, REVEAL, CANVAS badges).
- Existing Bibliosoph toolbar: `scripts/manager-toolbar.js` (TOOLBAR_TOOLS, registration pattern).
- Existing encounter flow (unchanged): `createChatCardEncounter`, habitat macros, roll tables in `scripts/bibliosoph.js`.
