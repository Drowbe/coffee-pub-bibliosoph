# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
