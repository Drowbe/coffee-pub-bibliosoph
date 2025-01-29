# Coffee Pub Bibliosoph

![Foundry v12](https://img.shields.io/badge/foundry-v12-green)
![Latest Release](https://img.shields.io/github/v/release/Drowbe/coffee-pub-bibliosoph)
![MIT License](https://img.shields.io/badge/license-MIT-blue)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/Drowbe/coffee-pub-bibliosoph/release.yml)
![GitHub all releases](https://img.shields.io/github/downloads/Drowbe/coffee-pub-bibliosoph/total)

A comprehensive chat and encounter management module for Foundry VTT, designed to enhance your game's narrative and mechanical elements through a variety of specialized chat cards and automated features.

## ⚡ Features

- **Dynamic Chat System**
  - Public and private messaging system with recipient selection
  - Customizable chat cards for various game events
  - Reply functionality built into chat messages

- **Encounter Management**
  - Specialized encounter generators for different environments:
    - General, Cave, Desert, Dungeon, Forest
    - Mountain, Sky, Snow, Urban, Water
  - Configurable through macros for each environment type

- **Character Interactions**
  - Investigation system
  - Gift and shady goods mechanics
  - Beverage system
  - Character biography integration
  - Insult and praise mechanics
  - Party messaging system

- **Game Event Handlers**
  - Critical hit and fumble card generation
  - Inspiration tracking
  - Deck of Many Things integration
  - Injury system with active effect application
  - Status effect management

## 📦 Installation

You can install this module by using the following manifest URL in Foundry VTT:
```
https://github.com/Drowbe/coffee-pub-bibliosoph/releases/latest/download/module.json
```

### Requirements and Recommendations

#### Required Module
- [Coffee Pub Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith) - Core module providing shared functionality for all Coffee Pub modules

#### Recommended Modules
- [Coffee Pub Crier](https://github.com/Drowbe/coffee-pub-crier) - Enhances combat turn announcements and notifications
- [Coffee Pub Scribe](https://github.com/Drowbe/coffee-pub-scribe) - Provides advanced text formatting and storytelling tools

### System Requirements
- Foundry VTT v12 (required)
- Compatible with v13 (future release)

## Module Integration

Coffee Pub Bibliosoph is part of the Coffee Pub suite of modules, designed to work together seamlessly:

- **Blacksmith** (Required): Provides core functionality and shared resources
- **Bibliosoph**: Handles chat and encounter management
- **Crier**: Manages combat announcements and notifications
- **Scribe**: Offers enhanced text formatting and storytelling tools

Each module can function independently (except for the Blacksmith requirement) but they're designed to complement each other for a fuller experience.

## 📖 Usage Guide

### Initial Setup
1. Install and enable both Coffee Pub Blacksmith and Coffee Pub Bibliosoph
2. Configure the module settings for your desired encounter types and features
3. Set up the corresponding macros for each enabled feature

### Key Features Configuration
- Each feature (encounters, messages, etc.) can be individually enabled/disabled
- Macro names can be customized in the module settings
- Active effects for injuries can be configured with custom durations and effects

## 📄 License

This module is licensed under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to submit issues and enhancement requests!