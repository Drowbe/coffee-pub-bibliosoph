# Coffee Pub Bibliosoph

## Crits & Fumbles

- Automate rolling from the crit and fumble tables when a player rolls a natural 20 / natural 1. The placeholder `createChatMessage` hook in bibliosoph.js (announces "X made a critical hit!") was the start of this — it currently never fires (`msg.rolls.total` reads off an array) and should be replaced with a real implementation: detect nat 20 / nat 1 on attack rolls, roll the configured critical/fumble table, and post the card automatically.

## Messages

- Keybinding to open the Messages window (Foundry keybindings API, default `M`).
- Localization: move hardcoded JS strings (menubar notifications, context menu labels, tooltips, splash text, dialog copy) into lang/en.json. Settings strings are already localized.

# Coffee Pub Journals

- Allow icon cinfiguration?
- Allow sub-element style formatting (e.g. conversations)
- introduce JOURNAL styles
- nail down theme names.
- tweak journal look and feel for inside journals
- tools for insertign a narrative template into a journal?

