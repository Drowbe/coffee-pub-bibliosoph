# Coffee Pub Bibliosoph

## Crits & Fumbles

- Phase 2 of the rolls-API integration (phase 1 — crit/fumble toasts via Blacksmith `api.rolls` — shipped in `manager-roll-toasts.js`): when a nat 20 / nat 1 lands, either auto-roll the configured critical/fumble table, or post a clickable prompt so the player gets to roll it themselves. Phase 3: "announcer" moments (biggest hit, broken records) using the Blacksmith stats API.

## Inspiration

- Migrate the Inspiration card experience into a "deck" experience that can use many types of cards — draw from a configurable deck (inspiration boons, and other card types down the road) instead of a single roll table. Deck of Many Things was removed as a standalone feature; a DOMT-style deck should return as just another deck under this system.

## Messages

- Keybinding to open the Messages window (Foundry keybindings API, default `M`).
- Localization: move hardcoded JS strings (menubar notifications, context menu labels, tooltips, splash text, dialog copy) into lang/en.json. Settings strings are already localized.

## Chat Cards

- Clean up how chat cards look when sent to the Foundry chat — they are pretty rough, especially the Insults and Praise tools. Those still render through the legacy `chat-card.hbs`/CARDDATA path; consider migrating them (and the other roll-table cards) to the Blacksmith chat card structure (`.blacksmith-card` + `card-header`/`section-content` + Chat Cards API themes), like the Messages send-to-chat escalation card already uses. When Blacksmith ships its full chat-card creation API, both paths could move onto it together.

# Coffee Pub Journals

- Allow icon cinfiguration?
- Allow sub-element style formatting (e.g. conversations)
- introduce JOURNAL styles
- nail down theme names.
- tweak journal look and feel for inside journals
- tools for insertign a narrative template into a journal?

