# Chat Card Migration Plan — Bibliosoph to Blacksmith Card System

This document assesses the current Bibliosoph chat card implementation against the [Coffee Pub Blacksmith Chat Card Migration Guide](documentation/guide-chat-card-migration.md) and outlines a phased plan to migrate to the new card system.

---

## 1. Assessment

### 1.1 Current State

| Area | Current Implementation |
|------|------------------------|
| **Template** | Single `templates/chat-card.hbs` used for all card types (general, injury, encounter, investigation, party/private message, beverage, bio, insults, praise, inspiration, DOMT, critical, fumble). |
| **Structure** | Hide-header span → `<div id="cards-wrapper-{{cardStyle}}">` with no `.blacksmith-card` or theme class. Header is `<div id="cards-title-{{cardStyle}}">` with icon and title. Content uses `cards-content-light-{{cardStyle}}` and `cards-content-dark-{{cardStyle}}` for alternating sections. |
| **Themes** | 14+ settings (`cardThemePartyMessage`, `cardThemePrivateMessage`, `cardThemeBeverage`, `cardThemeBio`, `cardThemeInsults`, `cardThemePraise`, `cardThemeInvestigation`, `cardThemeCritical`, `cardThemeFumble`, `cardThemeInspiration`, `cardThemeDOMT`, `cardThemeInjury`, `cardThemeEncounter`). Choices from `getBlacksmithChoices('arrThemeChoices')` (theme IDs, not CSS class names). |
| **Rendering** | Handlebars: fetch template, compile, pass CARDDATA, return `template(CARDDATA)`. No use of `foundry.applications.handlebars.renderTemplate`. |
| **Card creation paths** | `createChatCardGeneral`, `createChatCardInjury`, `createChatCardEncounter`, `createChatCardSearch` (investigation), `createChatCardInjurySelector`. Theme chosen per card type in JS before building CARDDATA. |
| **Buttons** | Custom classes: `coffee-pub-bibliosoph-button-injury`, `coffee-pub-bibliosoph-button-reply`, `category-button`. Inline styles. Event handlers use these classes / data attributes. |
| **CSS** | Styling delegated to Blacksmith (`styles/default.css` states “ALL CSS HANDLED IN COFFEE PUB BLACKSMITH”). No Bibliosoph-specific card CSS. |
| **Dialogue window** | `templates/dialogue-messages.hbs` is the message composition form (party/private, recipients, textarea). **Not a chat card** — no structural change required for card migration. |

### 1.2 Target State (Blacksmith Card System)

| Area | Target (from guide) |
|------|---------------------|
| **Structure** | Hide-header span → `<div class="blacksmith-card {{cardTheme}}">` → `.card-header` (do not style) → `.section-content` (all content and custom styling here). |
| **Themes** | Use Chat Cards API: `chatCards.getCardThemeChoicesWithClassNames()` (and `getAnnouncementThemeChoicesWithClassNames()` only if we add announcement-style cards). Store CSS class names in settings; pass `cardTheme` directly to template. |
| **Settings** | Register in `ready` and `await registerSettings()` before reading any theme-related settings. Choices from `chatCards.getCardThemeChoicesWithClassNames()` so values are class names (e.g. `theme-default`). |
| **Content** | Use `.section-header`, `.section-subheader`, `.section-table` (row-label / row-content), `.blacksmith-chat-buttons`, `.chat-button` where applicable. Scope any custom CSS to `.blacksmith-card .section-content` and own IDs/classes. |
| **Icons** | Keep Font Awesome 6 (`fa-solid`). No change required. |
| **Event handling** | Keep `data-*` attributes; optionally adopt `.chat-button` for styling while retaining existing selectors for behavior until we standardize. |

### 1.3 Gap Summary

1. **HTML structure** — Replace `cards-wrapper-{{cardStyle}}` with `blacksmith-card` + theme class; map current header to `.card-header`; wrap all body content in a single `.section-content`; align “light”/“dark” blocks with section components (e.g. section-header, section-table) where it improves structure.
2. **Theme source** — Move from `getBlacksmithChoices('arrThemeChoices')` to Chat Cards API `getCardThemeChoicesWithClassNames()` and store class names; ensure settings are registered in `ready` and awaited.
3. **Template data** — Pass `cardTheme` (class name) into template; keep existing CARDDATA fields; use a single `cardTheme` (or split card vs announcement later if needed).
4. **Buttons** — Prefer `.blacksmith-chat-buttons` and `.chat-button` for new structure; keep `data-*` and existing behavior (injury, reply, category); add Blacksmith classes for styling or keep custom classes scoped under `.section-content`.
5. **Rendering** — Optionally switch to `foundry.applications.handlebars.renderTemplate` for consistency with the guide; if we keep fetch+compile, ensure template and data still follow the new structure.
6. **IDs** — Current template uses many `id="cards-*-{{cardStyle}}"`. Migrate to generic or scoped IDs/classes under `.section-content` (e.g. `[id^="coffee-pub-bibliosoph-"]`) to avoid conflicts and support “generic content selectors” (guide lesson 5).
7. **No legacy theme mapping** — Remove any reliance on old theme keys (e.g. `cardsdark`, `cardsgreen`); use only API theme class names.

---

## 2. Migration Plan

### Phase 1 — Settings and theme API (no template change)

**Goal:** Theme choices and values use the Chat Cards API and CSS class names; no visual change yet.

1. **Chat Cards API availability**  
   - In `scripts/settings.js`, ensure theme-dependent registration runs when Blacksmith is ready (e.g. in `ready` and after Blacksmith is available).  
   - Resolve `game.modules.get('coffee-pub-blacksmith')?.api?.chatCards` (or documented bridge). If the API is not present, keep fallback to current `getBlacksmithChoices('arrThemeChoices')` and log a warning.

2. **Switch theme choices to class names**  
   - For each `cardTheme*` setting that currently uses `getBlacksmithChoices('arrThemeChoices')`, switch to `chatCards.getCardThemeChoicesWithClassNames('card')` (or the convenience method from the guide).  
   - Set defaults to a class name (e.g. `theme-default`).  
   - If any card type is ever treated as an “announcement”, use a separate setting with `getAnnouncementThemeChoicesWithClassNames()` and do not mix card and announcement themes in one dropdown.

3. **Ensure async registration**  
   - Confirm `registerSettings` is async and that it is `await`ed in the `ready` (or equivalent) path before any code reads theme settings. This avoids “setting is not registered” and aligns with the guide.

4. **Backward compatibility**  
   - If existing saved values are theme IDs, add a one-time migration (or default) so existing worlds get a valid class name (e.g. map known IDs to class names or reset to `theme-default`).

**Deliverables:** All card theme settings use Chat Cards API and store CSS class names; registration is async and awaited; no template or JS card-creation logic changes yet.

---

### Phase 2 — Template structure (Blacksmith layout)

**Goal:** Single chat card template uses Blacksmith structure; all content under `.section-content`.

1. **Base wrapper**  
   - Keep the hide-header span.  
   - Replace the root content wrapper with:
     - `<div class="blacksmith-card {{cardTheme}}">`
     - Then `.card-header` (icon + title).
     - Then one `.section-content` wrapping the rest of the current body.

2. **Map current sections into .section-content**  
   - Sender block (user avatar, name, character): keep markup, move inside `.section-content`.  
   - Private message recipients (`arrToPrivate`), banner, subtitle, image, main content (title, content, descriptionBefore/Reveal/After): keep structure, all inside `.section-content`.  
   - Injury blocks (category, treatment, duration, damage, statuseffect), compendium link, rarity, actions: keep as-is but under `.section-content`.  
   - Use `.section-header` / `.section-subheader` where it improves semantics (e.g. “Treatment”, “Additional Details”); optional in phase 2.

3. **IDs and classes**  
   - Prefer a single prefix for Bibliosoph-specific elements (e.g. `id="bibliosoph-..."` or `class="bibliosoph-..."`) so custom CSS can use `[id^="bibliosoph-"]` or `.bibliosoph-*` under `.section-content`.  
   - Remove or reduce reliance on `{{cardStyle}}` in IDs if it was used for theming; theme is now on the wrapper.

4. **Buttons**  
   - Wrap action buttons (injury apply, reply, category buttons) in `.blacksmith-chat-buttons` and add `.chat-button` where it doesn’t break existing selectors.  
   - Retain `data-*` attributes and current classes (e.g. `coffee-pub-bibliosoph-button-injury`) for event handlers.  
   - Ensure click handlers still attach (e.g. same `renderChatMessage` or equivalent).

5. **Template data**  
   - In all `createChatCard*` paths, pass `cardTheme: strCardStyle` (or equivalent) where `strCardStyle` is the **class name** from settings (e.g. `game.settings.get(MODULE.ID, 'cardThemeInjury')`).  
   - No ID-to-class conversion if settings already store class names (Phase 1).

**Deliverables:** `chat-card.hbs` uses `blacksmith-card` + `cardTheme`, `.card-header`, and `.section-content`; all content and buttons live under `.section-content`; existing behavior (clicks, data) preserved.

---

### Phase 3 — Align with layout components (optional polish)

**Goal:** Use Blacksmith section and table components where they add value; no change to behavior.

1. **Section headers**  
   - Replace ad-hoc headings (e.g. “Treatment”, “Additional Details”) with `.section-header` or `.section-subheader` where the guide’s styling is desired.

2. **Data tables**  
   - Where we have label/value pairs (e.g. injury duration, damage, statuseffect; rarity kind/value/details), consider `.section-table` with `.row-label` and `.row-content`.  
   - Use `.label-dimmed` / `.label-highlighted` if useful.

3. **Custom CSS**  
   - If we add any module-specific card CSS, restrict it to `.blacksmith-card .section-content` and Bibliosoph IDs/classes so we do not override Blacksmith header or theme.

**Deliverables:** Consistent use of section/table components; any new CSS scoped to `.section-content`.

---

### Phase 4 — Rendering and cleanup

**Goal:** Optional use of Foundry’s template API; remove legacy theme handling.

1. **Rendering**  
   - Optionally replace fetch+Handlebars.compile with `foundry.applications.handlebars.renderTemplate(BIBLIOSOPH.MESSAGE_TEMPLATE_CARD, CARDDATA)` for consistency with the guide.  
   - Ensure CARDDATA still includes `cardTheme` and all current keys the template expects.

2. **Legacy theme handling**  
   - Remove any code that maps old theme keys (e.g. `cardsdark`, `cardsgreen`) to classes or IDs.  
   - Rely only on API theme class names.

3. **Testing**  
   - Test all card types (general, injury, encounter, investigation, party/private message, beverage, bio, insults, praise, inspiration, DOMT, critical, fumble).  
   - Test with multiple themes; confirm header and content use Blacksmith styling.  
   - Test buttons (injury apply, reply, category) and any other chat message listeners.

4. **Documentation**  
   - Update any internal docs or comments that reference the old structure or theme source.  
   - Note in CHANGELOG that chat cards now use the Blacksmith card system and theme API.

**Deliverables:** Clean rendering path, no legacy theme logic, tests passing, docs updated.

---

## 3. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Chat Cards API missing or different in some Blacksmith versions | Check API presence at runtime; fall back to current theme choices and log warning; document minimum Blacksmith version. |
| Existing worlds have theme IDs saved | One-time migration or sensible default (e.g. `theme-default`) when stored value is not a valid class name. |
| Button or link selectors break after class/ID changes | Keep existing data attributes and behavior classes; add Blacksmith classes only where selectors are updated in the same change. |
| Multiple card types and many theme settings | Migrate all theme settings in one pass (Phase 1); use a single template (Phase 2) so we don’t maintain two structures. |
| dialogue-messages.hbs mistaken for a card | Clarify in plan and code comments: dialogue-messages.hbs is the composition UI; only chat-card.hbs is migrated. |

---

## 4. Out of Scope

- **dialogue-messages.hbs** — Message composition form only; no migration to Blacksmith card structure.
- **New card types** — Adding new card types or announcement-style cards can be done after migration using the same structure and API.
- **Blacksmith CSS changes** — We use Blacksmith’s layout and themes as-is; no changes to Blacksmith repo in this plan.

---

## 5. Success Criteria

- All chat cards rendered by Bibliosoph use the structure: hide-header span → `.blacksmith-card` + theme class → `.card-header` → `.section-content` (with content).
- All card theme settings use Chat Cards API `getCardThemeChoicesWithClassNames('card')` (or convenience method) and store CSS class names.
- Settings registration is async and awaited before any theme-dependent code runs.
- No custom CSS targets `.card-header` or the card wrapper; any custom styling is under `.blacksmith-card .section-content`.
- All existing card types and button actions (injury apply, reply, category) work with at least one theme; no regression in behavior.
- No reliance on legacy theme keys; only API theme class names are used.

---

## 6. Reference

- **Migration guide:** `documentation/guide-chat-card-migration.md`
- **Current template:** `templates/chat-card.hbs`
- **Card creation:** `scripts/bibliosoph.js` — `createChatCardGeneral`, `createChatCardInjury`, `createChatCardEncounter`, `createChatCardSearch`, `createChatCardInjurySelector`
- **Theme settings:** `scripts/settings.js` — all `cardTheme*` registrations
- **Constants:** `scripts/const.js` — `BIBLIOSOPH.MESSAGE_TEMPLATE_CARD`, etc.
