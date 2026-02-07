# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [13.0.9]

### Added

- **Quick Encounter cache:** Monster data can be built and stored in a world-level cache for fast Recommend and Roll. Use "Refresh cache" in the encounter window header to build or update; status line shows count (e.g. "Cache: 1073 monsters"). When the cache is valid, Recommend and Roll use it instead of loading compendiums on each action.
- **Quick Encounter deploy by pattern:** Clicking a deployment pattern (Sequential, Circle, Line, Scatter, Grid) now deploys directly with that pattern; the separate "Deploy selected" button was removed.
- **Quick Encounter selection indicator:** Selected result cards show a checkmark badge and stronger styling (orange-tinted border/background). Selection is seeded when results load (Roll or Recommend); you can toggle cards to include or exclude them from deploy.

### Changed

- **Quick Encounter header:** The duplicate "Close" button was removed (title bar close remains). "Refresh cache" was moved into the header where Close was.
- **Quick Encounter sliders:** CR slider track and thumb now match the Odds slider (purple/magenta track, white square thumb). Both sliders update the displayed value live during drag without full re-render for better responsiveness; full re-render and save happen on mouseup (change).
- **Quick Encounter odds display:** "Odds of encounter" value updates live while dragging. Fixed "0%" and "100%" endpoints sit at the slider ends and use the same visual style as the CR slider endpoints (matching icon row).
- **Quick Encounter selection and deploy:** Selection is driven by `_selectedForDeploy` for both built encounters and recommend lists; built encounters are seeded as all selected so you can deselect before deploy. Deploy uses only selected cards (and their counts for built encounters). Deploy pattern buttons are enabled whenever there are recommendations (Handlebars context fixed with `../hasDeploySelection`).
- **Quick Encounter Recommend:** CR band widened (target ±8) and a fallback added: if no monsters fall in band, the list shows the closest by CR so Recommend always returns results when the cache has habitat matches.
- **Quick Encounter event handling:** Delegation runs on document and only handles events inside the encounter window root; all handlers use a captured `self` reference so `_onRollForEncounter`, `_onRecommend`, `_onDeploy`, etc. are called correctly. Data attributes are read with `getAttribute` for reliability.

### Fixed

- **Quick Encounter class leak:** `DEFAULT_OPTIONS` for the encounter window was merged with `mergeObject(..., { inplace: true })`, which mutated the base Application defaults and applied `window-encounter` and `bibliosoph-window` to every Foundry dialog. Merges now use `{ inplace: false }` so only the Quick Encounter window gets those classes.

## [13.0.8]

### Changed

- **Release workflow:** The GitHub Actions release zip now includes the `resources/` folder so that `investigation-narrative.json` and other resources are bundled in the published module.

## [13.0.7]

### Added

- **Investigation narrative:** Titles and descriptions now come from `resources/investigation-narrative.json`. Entries in `foundNothing` and `foundSomething` are chosen at random; each entry supports `title`, `description`, `tags`, and optional `icon` (HTML, e.g. Font Awesome).
- **Investigation coins:** Optional coin finding with its own roll.
  - New setting: Odds of Finding Coins (0–100, default 20). Roll 1d100; on success, amounts are rolled from 0 up to each max and added to the character's purse (D&D 5e currency).
  - New settings: Max Platinum, Max Gold, Max Silver, Max Electrum, Max Copper (0–100 each, with defaults 0, 10, 45, 10, 100).
  - Card shows a Coins section and a summary line when coins are added.
- **Investigation rarity weightings:** Per-rarity roll tables (Common, Uncommon, Rare, Very Rare, Legendary) and weightings on a 0–1000 scale (step 1). Weightings are normalized to pick rarity for each slot; defaults 800, 200, 50, 20, 1 so Legendary is very rare.
- **Investigation card layout:** Items grouped by rarity with section headers and icons (Common: box, Uncommon: treasure-chest, Rare: axe-battle, Very Rare: trophy, Legendary: gem, Other: crate-apple). Long item names show an ellipsis when they overflow.
- **Investigation player skill bonus:** New setting "Use Player Skill Bonus" (default on). When enabled and the game system is dnd5e, the find-items roll becomes 1d100 + Intelligence modifier + Proficiency; items are found when that total is greater than (100 − Odds of Success). When disabled, behavior is unchanged (1d100, find when total ≤ Odds of Success).
- **Investigation notification:** A short notification ("Running investigation check...") is shown at the start of an investigation so users know the check is running.
- **Localization:** New keys for investigation coins (labels, hints, summary messages), investigation notification, and rarity weighting labels/hints.

### Changed

- **Investigation flow:** Replaced with narrative + slots + per-rarity tables. Find-items uses one 1d100 (or 1d100 + INT + PROF when player skill is on); then 1dN slots (N = Upper Limit of Items); for each slot, rarity is chosen by weighted bands and one item is rolled on that rarity's table and added to inventory.
- **Investigation narrative logic:** "Found something" narrative is used whenever the character finds coins or items (or both). "Found nothing" is used only when they find neither.
- **Rarity settings:** Renamed from "odds" to "weightings" in the UI; scale changed from 0–100 (step 0.5) to 0–1000 (step 1) for finer control. Defaults updated to 800, 200, 50, 20, 1.
- **createChatCardSearch:** Now used only for Gift and Shady Goods (single table roll, single item). All investigation-specific logic removed.
- **README:** Updated with current features, product screens (encounters, investigation, party message, private message), v13-only requirements, and no emoticons.

### Removed

- **Legacy investigation:** Use of the single `investigationTable` setting; dependency on "Search Descriptions: Nothing", "Before", "Reveal", and "After" roll tables. Narrative is only from `investigation-narrative.json`; item flow uses per-rarity tables and weightings.

## [13.0.6]

### Fixed
- **Macro Bindings:** All Bibliosoph macro bindings now work with Blacksmith safe settings and macro IDs/UUIDs.
  - Rebound every macro type (encounters, investigations, gifts, shady goods, crits, fumbles, inspiration, DOMT, beverage/bio/insult/praise, party/private messages, injuries) using a centralized binder with fresh `BlacksmithUtils.getSettingSafely` reads.
  - Macro resolution now accepts id/UUID/name and retries binding (immediate + delayed) to handle late-loaded settings.
  - Added `MACRO FIX` console traces for bind/execute to aid troubleshooting.

### Changed
- **Settings Access:** Standardized all runtime settings reads in macro binding to use Blacksmith’s `getSettingSafely` helper via the existing `getSetting` wrapper.

## [13.0.5]

### Changed
- **Chat Cards:** Migrated all cards to the unified Chat Cards system in Coffee Pub Blacksmith
  - All card types (general, injury, injury selector, encounter, investigation) now use the shared Blacksmith card structure, theme API, and styling
  - Card template uses `blacksmith-card` and theme from Blacksmith's `getCardThemeChoicesWithClassNames()`; settings provide theme choices from Blacksmith
- **Chat Card Section Content:** The actions/buttons section of the chat card now only renders when it has content
  - Wrapped the section-content block in `{{#if hasSectionContent}}` in the chat card template
  - Added `hasSectionContent` to card data in general cards (action text or private recipients), injury apply cards (effect data), and injury category selector cards (category buttons)
  - Cards without actions, injury buttons, or reply options no longer show an empty section-content area

## [13.0.4] 

### Changed
- **Markdown Conversion:** Switched to Blacksmith API markdown conversion for message content
  - Replaced local `markdownToHtml` with `BlacksmithUtils.markdownToHtml`
  - Removed the local markdown utility to keep behavior centralized

## [13.0.3] - GM-Only Encounters & User Scope Migration

### Changed
- **Encounter Buttons:** All encounter toolbar buttons are now GM-only
  - Added `gmOnly: true` to all 10 encounter button configurations (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)
  - Players can no longer see or access encounter buttons in the toolbar
  - Only Game Masters can trigger random encounters
- **Encounter Settings:** All encounter-related settings are now GM-only
  - Added `restricted: true` to all encounter settings in the module configuration
  - Players can no longer see encounter settings in the module settings UI
  - Includes: global encounter settings, all encounter type settings, toolbar preferences, tables, and macros
- **Settings Scope Migration:** Migrated user preference settings from `scope: 'client'` to `scope: 'user'` (Foundry v13)
  - All toolbar visibility preferences (`toolbarCoffeePub*Enabled` and `toolbarFoundry*Enabled`) now use `scope: 'user'`
  - UI layout preferences (`privateMessageCompressedWindow`, `showDiceRolls`) now use `scope: 'user'`
  - Settings now persist across devices for each user, following them when they log in from different machines
  - Total of 32 settings migrated to user scope

### Technical
- **Foundry v13 User Scope:** Leverages new `scope: 'user'` feature introduced in FoundryVTT v13
  - User scope settings are per-user, per-world, and persist across devices
  - Replaces client scope for personal preferences that should follow the user
  - Maintains client scope for visual separator headings (no meaningful data)

## [13.0.2] - Dice Roll Control

### Added
- **Dice Roll Toggle:** Added `showDiceRolls` setting to control whether virtual dice are rolled when cards are generated
  - Client-scoped setting (per-user preference)
  - Default: enabled (true)
  - Requires Dice So Nice module for visual dice effects
  - Applies to all card types: encounters, investigations, injuries, and general roll tables
- **Private Message Compressed Layout:** Added `privateMessageCompressedWindow` setting for compact recipient display
  - Client-scoped setting (per-user preference)
  - Default: disabled (false)
  - When enabled, shows only portrait images in horizontal row (similar to party message buttons)
  - When disabled, shows full recipient cards with names and character info (3 per row)

### Changed
- **Settings Organization:** Reorganized settings structure with new "General" section
  - Added `headingH2General` heading for better settings organization
  - Moved dice roll setting to General section
- **Party Message Dialog Layout:** Moved message type buttons to horizontal row at top of dialog
  - Changed from vertical column on left side to horizontal flexbox layout at top
  - Buttons (Party Message, Party Plan, Agree, Disagree, Praise, Insult) now display in a row
  - Improved visual organization and user experience
- **Private Message Dialog:** Improved layout and functionality
  - Window width set to 600px for better sizing
  - Non-compressed layout displays 3 recipients per row with full details
  - Compressed layout displays portrait images that wrap naturally
  - Reply button in chat cards now spans full width

### Fixed
- **Dice Roll Control:** All virtual dice rolls now respect the `showDiceRolls` setting
  - Updated 7 dice roll locations to check setting before rolling
  - Applies to: general cards, injury cards, encounter checks, encounter monster quantity, investigation checks, investigation item quantity, and roll table results
- **Private Message Recipients:** Fixed recipient list to only show party members
  - Now filters to only display users with assigned characters (party members)
  - Excludes observers and users without characters
  - Improves clarity of who can receive private messages
- **Private Message Reply Functionality:** Fixed reply button to properly pre-select recipients
  - Reply button now correctly opens dialog with recipients pre-selected
  - Fixed recipient array handling to ensure proper selection state
  - Fixed compressed mode portrait sizing when replying
  - Selection state now handled consistently in activateListeners

### Removed
- **Debug Logging:** Removed all debug logging statements from production code
  - Removed DEBUG statements from injury card creation function
  - Removed button HTML matching debug code
  - Removed metadata extraction debug logging
  - Cleaned up console spam for cleaner production experience

## [13.0.1] - Quick Fix
### Fixed
- **Logging:** Was passing the wrong parameter to the loggin tool.

## [13.0.0] - v13 Migration Complete

### Important Notice
- **v13 MIGRATION COMPLETE:** This version completes the migration to FoundryVTT v13
- **Breaking Changes:** This version requires FoundryVTT v13.0.0 or later
- **v12 Support Ended:** v12.1.3-FINAL was the last version supporting FoundryVTT v12

### Changed
- **Minimum Core Version:** Updated to require FoundryVTT v13.0.0
- **Module Version:** Bumped to 13.0.0 to align with FoundryVTT v13
- **Compatibility:** Module now exclusively supports FoundryVTT v13

### Fixed
- **jQuery Removal:** Migrated all jQuery code to native DOM APIs
  - Converted `html.find()` to `querySelector()` / `querySelectorAll()`
  - Replaced jQuery event handlers (`.on()`, `.click()`) with `addEventListener()`
  - Updated jQuery DOM manipulation (`.append()`, `.val()`, `.attr()`, etc.) to native methods
  - Added jQuery detection patterns for FormApplication compatibility during migration
- **Font Awesome Migration:** Updated all Font Awesome 5 references to Font Awesome 6
  - Changed all `fas` class prefixes to `fa-solid` in JavaScript and templates
  - Updated 20 toolbar icon definitions in `manager-toolbar.js`
  - Updated 11 icon references in Handlebars templates (`chat-card.hbs`, `dialogue-messages.hbs`)
- **Toolbar Registration:** Fixed toolbar tools not appearing in Coffee Pub and Foundry toolbars
  - Moved `registerToolbarTools` import to top of file for proper scope
  - Added retry logic with multiple attempts to ensure Blacksmith API is ready
  - Improved error handling and logging for toolbar registration
- **Encounter Type Bug:** Fixed all encounter buttons rolling General encounters
  - Updated all `trigger*EncounterMacro()` functions to set correct `BIBLIOSOPH.CARDTYPE` value
  - Changed from always setting "General" to setting specific types (Cave, Desert, Water, etc.)
- **TableResult UUID:** Fixed links pointing to TableResult instead of actual documents
  - Changed from using `rollResults.results[0].uuid` (TableResult UUID) to `rollResults.results[0].documentUuid` (document UUID)
  - Links now correctly point to the actual Actor/Item documents referenced by roll tables
- **Deprecated API Usage:** Fixed deprecation warnings for TableResult properties
  - Updated from deprecated `TableResult#text` to `TableResult#name` or `TableResult#description`
  - Updated from deprecated `TableResult#documentCollection` and `TableResult#documentId` to `TableResult#documentUuid`
  - Added fallback support for v12 compatibility during transition

### Technical
- **jQuery Detection:** Added transitional jQuery detection patterns in FormApplication classes
  - Created `_getNativeElement()` helper method for consistent jQuery handling
  - Added detection in `activateListeners()` and Dialog callbacks
  - Marked as technical debt to be removed after all call sites are confirmed native DOM
- **UUID Parsing:** Improved UUID parsing to handle pack names with dots
  - Added regex-based parsing for compendium UUIDs
  - Added fallback to Foundry's `foundry.utils.parseUuid()` utility
  - Enhanced error handling for invalid UUID formats
- **Logging:** Added comprehensive logging for UUID link creation
  - Logs document UUID, link string, and name for debugging
  - Separate logging for encounter and investigation card creation
  - Logs fallback paths when deprecated properties are used

## [12.1.3] - Final v12 Release

### Important Notice
- **FINAL v12 RELEASE:** This is the final build of Coffee Pub Bibliosoph compatible with FoundryVTT v12
- **v13 Migration:** All future builds will require FoundryVTT v13 or later
- **Breaking Changes:** Users must upgrade to FoundryVTT v13 to use future versions of this module

### Changed
- **Documentation Updates:** Updated README.md and module.json to reflect v12.1.3 as the final v12 release
- **Compatibility Notice:** Added clear notice that v12.1.3 is the last version supporting FoundryVTT v12
- **Migration Preparation:** Module is now locked for v12 compatibility; v13 migration work will begin in next version

### Technical
- **Version Lock:** Module version locked at 12.1.3-FINAL for v12 compatibility
- **Future Development:** All development moving forward will target FoundryVTT v13 exclusively

## [12.1.2] - Toolbar Integration

### Added
- Complete toolbar integration with Coffee Pub Blacksmith
- 23 toolbar tools across 3 zones (communication, rolls, roleplay)
- Toolbar visibility controls for Coffee Pub and Foundry toolbars
- Support for all existing Bibliosoph features in toolbar format

#### Communication Tools
- Party Message dialog
- Private Message dialog

#### Roll Tools
- Investigation rolls
- Critical Hit rolls
- Fumble rolls
- Injuries (GM only)
- All 10 encounter types (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)

#### Roleplay Tools
- Beverage Break messages
- Bio Break messages
- Random Insults
- Random Praise
- Random Gifts
- Shady Goods
- Inspiration

### Changed
- Moved toolbar settings to proper locations in module settings
- Toolbar checkboxes now appear directly below their respective "enable" checkboxes
- All encounter tools use "rolls" zone for proper toolbar organization
- Improved settings organization and user experience

### Fixed
- Toolbar buttons not showing due to incorrect API access pattern
- Timing issues with Blacksmith API initialization
- Missing toolbar visibility settings for encounters and injuries
- Duplicate settings entries in localization files

### Technical
- Created trigger functions for all encounter types and roleplay features
- Added proper window object exposure for all toolbar functions
- Implemented proper settings validation and error handling
- Added comprehensive localization strings for all toolbar settings
- Fixed zone assignment to use valid Blacksmith toolbar zones

## [12.1.1] - Bug Fixes

### Fixed
- Fixed playSound API calls to use direct Blacksmith API access instead of helper functions
- Updated all 5 playSound calls in chat card functions to use `getBlacksmith()?.utils?.playSound()` pattern
- Removed unnecessary playSound helper function wrapper

### Technical
- All playSound calls now follow the same direct API pattern as other Blacksmith utilities
- Maintains consistency with rollCoffeePubDice and other API integrations

## [12.1.0] - MAJOR UPDATE - Blacksmith API Migration

### Added
- Full integration with Coffee Pub Blacksmith API
- Safe settings access using `getSettingSafely()` and `setSettingSafely()`
- Dynamic access to shared choice arrays (themes, macros, tables, compendiums, sounds, etc.)
- Module registration system with Blacksmith
- Real-time updates via `blacksmithUpdated` hook
- Consolidated validation system for mandatory settings
- Enhanced error handling and fallback systems

### Changed
- Migrated from custom `global.js` utilities to Blacksmith API
- Updated all console logging to use Blacksmith's `postConsoleAndNotification`
- Replaced static choice arrays with dynamic Blacksmith data
- Improved module initialization timing using proper Foundry hooks
- Enhanced settings validation and user feedback

### Removed
- Dependency on `global.js` file
- Static choice arrays and hardcoded defaults
- Individual validation notifications (replaced with consolidated system)
- Old utility functions replaced by Blacksmith equivalents

### Fixed
- Module startup crashes due to timing issues
- Settings not populating with available choices
- Multiple notification spam for missing settings
- Hardcoded default values not respecting Blacksmith configuration

### Technical
- Uses `Hooks.once('ready')` for proper initialization timing
- Implements `Hooks.on('blacksmithUpdated')` for real-time data updates
- Provides graceful fallbacks when Blacksmith API is unavailable
- Maintains backward compatibility during transition

## [0.1.03] - 2024 Initial Release

### Added
- Initial release of Coffee Pub Bibliosoph
- Card formatting system for journal entries
- HTML Blockquote integration
- Custom styling for narrative cards
- Chat window integration
- Support for Foundry VTT v11 and v12

## [0.1.02] - Settings and Controls

### Added
- Settings for cards
- Margin controls for fine-tuning card alignment in chat
- Unified card themes

## [0.1.01] - Basic Styling

### Added
- Basic styling

## [0.1.00] - Initial Release

### Added
- Initial module foundation
