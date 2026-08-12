# Coffee Pub Bibliosoph

![Foundry v13](https://img.shields.io/badge/foundry-v13-green)
![Latest Release](https://img.shields.io/github/v/release/Drowbe/coffee-pub-bibliosoph)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/Drowbe/coffee-pub-bibliosoph/release.yml)
![GitHub all releases](https://img.shields.io/github/downloads/Drowbe/coffee-pub-bibliosoph/total)
![MIT License](https://img.shields.io/badge/license-MIT-blue)

In-game player messaging with journal-backed conversations, plus authored injuries, quick encounter building, inspiration, and critical hit announcements.

## Features

### Messages

- Unified Messages window with party, group, and 1:1 conversations. Journal-backed, so they survive a chat log wipe
- **Popouts.** Hover a conversation in the tray and click the popout icon to float it in a lightweight window that follows your Light, Dark, or Glass theme. Popouts stack (one per conversation), each remembering its own position, so you can watch the party channel and a private thread side by side while you play
- **Favorites.** Heart a conversation and it joins a shortlist on the Messages menubar tool. Right-click that tool to jump straight into any of them as a popout, without opening the full window first
- @Mentions by user or character name, with partial matching and highlighted names. Mentioned players get a pulsing alert
- On-screen alerts for incoming messages, carrying the sender's portrait. Click one to open the conversation, and choose in settings whether that means the popout or the full window
- Markdown formatting, image paste and drop, document links, reactions, typing indicators, and a collapsible conversation tray

**Party Message**

![Party Message](product/bibliosoph-partymessage.webp)

**Private Message**

![Private Message](product/bibliosoph-privatemessage.webp)

### Encounter Management

The Quick Encounter tool builds a fight at the table rather than in prep. Set the party's CR and a target difficulty, let it recommend monsters from your configured compendiums or roll one for you, then deploy the result straight to the canvas. Difficulty is reported against the party's actual CR as you adjust it.

![Encounters](product/bibliosoph-encounters.webp)

### Investigation System

When enabled, Investigation runs a full search flow with narrative, optional coins, and items by rarity.

- **Narrative:** Titles and descriptions come from `resources/investigation-narrative.json`. You can add many entries to `foundNothing` and `foundSomething`; one is chosen at random each time.
- **Coins:** Optional separate roll (Odds of Finding Coins). If successful, amounts are rolled from 0 up to each configured max (Platinum, Gold, Silver, Electrum, Copper) and added to the character's purse (D&D 5e currency).
- **Items:** One 1d100 roll (or 1d100 + INT + Proficiency when "Use Player Skill Bonus" is on for dnd5e) vs Odds of Success. If successful, a number of slots (1dN, N = Upper Limit of Items) are rolled. For each slot, rarity is chosen by weighted bands (Common through Legendary) using 0–1000 weightings, then one item is rolled on that rarity's table and added to inventory.
- **Card:** Shows narrative title and description, coins found (if any), items grouped by rarity with icons, and a summary of what was added to the character.

![Investigation](product/bibliosoph-investigation.webp)

### Table Breaks

Four buttons in the Messages window header, each rolling its own configured table and announcing the result as a toast on every client: Beverage Break, Bio Break, Insult, and Praise. Any player can fire them.

### Criticals and Fumbles

Natural 20s and natural 1s draw from typed journal compendiums rather than roll tables, so an outcome carries real mechanics: severity, damage, duration, conditions, and roll modifiers that apply as genuine active effects. The roller also gets an announcement toast, configurable per outcome.

### Injuries

An authored injury deck (144 injuries across 14 categories) with damage as a percentage of max HP, a floor that stops an injury dropping anyone below 1 HP, roll penalties applied as active effects, bleed ticks, and conditions that unwind on every removal path. A GM picker deals a specific wound, rolls a random one weighted by odds, or asks the target's own player to roll for it.

### Inspiration

A deck of authored cards dealt into a character's inventory as real one-use consumables. Using the item raises a play card whose buttons pick the target, run the effect, and discard. The card is the currency, so there are no inspiration points to track.

## Installation

Install via the manifest URL in Foundry VTT:

```
https://github.com/Drowbe/coffee-pub-bibliosoph/releases/latest/download/module.json
```

### Requirements

Bibliosoph **requires [Coffee Pub Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith) 13.17.0 or newer**. Blacksmith is the core module the whole suite builds on, and Bibliosoph will not run without it. 13.17.0 specifically is what the favorites menu needs; below it, right-clicking the Messages menubar tool does nothing.

Nothing else in the suite is needed. Everything listed below is independent, and you can install as much or as little of it as you want.

### System Requirements

- Foundry VTT v13 or newer
- D&D 5e 5.5+ for full feature set (e.g. investigation coins and player skill bonus use dnd5e data)

## The Coffee Pub Suite

Bibliosoph is one module in a larger suite. Blacksmith is the core every other module builds on and the only one Bibliosoph actually requires; the rest stand alone, and you can run any combination of them.

| Module | What it does |
|---|---|
| [Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith) | **Required.** The core: quality of life, gameplay frameworks, automation, and the shared APIs the suite is built on |
| [Artificer](https://github.com/Drowbe/coffee-pub-artificer) | A crafting, recipe, and blueprint system |
| **Bibliosoph** | Player messaging, injuries, encounters, and inspiration (this module) |
| [Cartographer](https://github.com/Drowbe/coffee-pub-cartographer) | Party strategic planning and sketching |
| [Crier](https://github.com/Drowbe/coffee-pub-crier) | Combat turn announcements: turn cards, round announcements, and combat status |
| [Curator](https://github.com/Drowbe/coffee-pub-curator) | Image management: token and portrait replacement, and tile or map placement |
| [Herald](https://github.com/Drowbe/coffee-pub-herald) | Streaming and broadcast view, with a cameraman user and automatic token following |
| [Librarian](https://github.com/Drowbe/coffee-pub-librarian) | Campaign knowledge: a codex of people, places, factions and artifacts, and the quests running through them |
| [Minstrel](https://github.com/Drowbe/coffee-pub-minstrel) | Music, environment, and one-shot management |
| [Monarch](https://github.com/Drowbe/coffee-pub-monarch) | Save and load sets of enabled modules |
| [Regent](https://github.com/Drowbe/coffee-pub-regent) | Optional AI tools: Consult the Regent, plus lookup, character, assistant, encounter and narrative worksheets |
| [Scribe](https://github.com/Drowbe/coffee-pub-scribe) | Enhanced journal and chat card formatting for snippets of narrative |
| [Squire](https://github.com/Drowbe/coffee-pub-squire) | A customizable character tray, with party tools and item transfer |
| [Vault](https://github.com/Drowbe/coffee-pub-vault) | Optional assets for the suite |

## Usage Guide

### Initial Setup

1. Install and enable Coffee Pub Blacksmith and Coffee Pub Bibliosoph.
2. Configure module settings for the encounter types and features you want.

Each feature you enable adds its own toolbar button, so there is nothing to wire up by hand.

### Key Settings

- Features (encounters, investigation, messages, etc.) can be enabled or disabled individually.
- Every feature with a button chooses where it appears: the Coffee Pub toolbar, the Foundry toolbar, or both (the default). To remove a button, switch its feature off rather than hiding it from both bars.
- Investigation: configure Odds of Success, Upper Limit of Items, coin odds and max amounts, and per-rarity roll tables and weightings (0–1000 scale). Optionally enable "Use Player Skill Bonus" so the find-items roll becomes 1d100 + Intelligence modifier + Proficiency (dnd5e).
- Active effects for injuries can be configured with custom durations and effects.

### Toast Channels (streaming and camera accounts)

Blacksmith's **Toast Excluded Users** setting stops a user's client from rendering toasts at all, which is the right behaviour for a camera or stream account that cannot click a toast closed. But some announcements are exactly what a broadcast exists to capture, so Bibliosoph labels each broadcast toast with a **channel** and declares those channels to Blacksmith at startup.

**This needs no setup.** A declared channel reaches excluded users by default, so a camera account sees criticals, fumbles, injuries and table breaks out of the box. Bibliosoph declares five:

| Channel | Appears as | Toasts |
|---|---|---|
| `crit` | Critical Hits | Natural 20 announcements |
| `fumble` | Fumbles | Natural 1 announcements |
| `injury` | Injuries | Injury-threshold announcements |
| `social` | Table Breaks | Beverage Break, Bio Break, Insult, Praise |
| `messages-group` | Group Messages | Party and group conversation alerts |

**Direct messages carry no channel at all, deliberately.** A channel is an offer to put something on a shared screen, which is reasonable for the party channel and unreasonable for a private message, so a direct-message alert can never reach an excluded account.

To send *less* to a camera account, tick a narrower set in Blacksmith's **Channels Excluded Users Still See**. They appear there as labelled rows, one per declared channel. Ticking only Critical Hits and Fumbles puts the dice moments on camera while injuries and table gags stay off it. Toasts with no channel at all (local confirmations, warnings) are always suppressed for excluded users.

Two things to know:

- **Channel names are global, not namespaced.** If another module also declares `crit`, allowing it allows both. The checklist shows which module declared each row.
- **To check what a camera account will actually see**, run the test harness in [testing/test-harness-macro.js](testing/test-harness-macro.js): **Audit toast channels** under Tools reports who is excluded, what we declared, and which channels reach them; **Fire one toast per channel** broadcasts one of each so you can watch a real excluded client. Blacksmith's Debug Mode also logs each channel as it first sees one, which is the quicker way to confirm a suspected mismatch involving another module.

Channels need Blacksmith 13.15.1 or newer. On older builds the channel is ignored and excluded users see nothing, exactly as before.

## License

This module is licensed under the [MIT License](LICENSE).

## Contributing

Issues and enhancement requests are welcome.
