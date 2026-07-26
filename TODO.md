# Coffee Pub Bibliosoph

## Injuries (CURRENT FOCUS — fix and test)

- Play-test the automation end to end: threshold trigger on damage application, toast to all clients, click-to-roll arming on the injured player, injury card by damage type, Apply Injury. Fix what testing surfaces.
- ~~Migrate injury detection to Blacksmith's `damageResolved` event~~ — DONE (Blacksmith shipped it same-day; manager-injury-triggers.js subscribes via `rolls.on('damageResolved')`).
- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.

## Blacksmith Requests (NEXT PRIORITY once injuries are good to go)

Send these to the Blacksmith dev, in this order — use the `documentation/request-blacksmith-damage-api.md` format (it worked):

1. **Cut a release (13.11.4+).** Everything this cycle — rolls API, `damageResolved`, toast `callToAction` — exists only on master. Bibliosoph cannot ship to anyone on published 13.11.3 until Blacksmith tags a release; pin the version dependency when both ship.
2. **Public cross-client toast delivery** — e.g. `toast.publish(config, { recipients })`. Bibliosoph rolls its own socket relay (`coffee-pub-bibliosoph.rollToast`) for crit/fumble/injury/social toasts; every Coffee Pub module that toasts cross-client will rebuild the same plumbing. Receipt-side click-arming stays per-module (functions can't cross sockets) — only the delivery belongs in Blacksmith.
3. **Stats API surface for the phase 3 announcer** — a query API (`stats.getRecord('damage-dealt')`) or, better, events (`blacksmith.stats.recordBroken`) so "biggest hit / broken record" announcements are subscribers like everything else. Request BEFORE designing phase 3 so it lands event-shaped, same playbook as `damageResolved`.
4. **MIDI attacker/item attribution on `damageResolved`** — already on Blacksmith's own TODO; nudge it along (unlocks the `{attacker}`/`{weapon}` injury toast codes above).
5. **Two developer-experience footguns (flag, not formal requests):** `rollCoffeePubDice()` fabricates a decorative 2d20 when passed nothing (caused the fake-dice bug — warn-and-skip would be safer), and `objectToString`/`stringToObject` corrupt prose containing `=` or `|` (ate the Apply-button description — deprecate in favor of JSON helpers).

## Crits & Fumbles

- ~~Phase 2 — auto-roll or click-to-roll on nat 20 / nat 1~~ — SHIPPED (Automation modes in `manager-roll-toasts.js`). Phase 3: "announcer" moments (biggest hit, broken records) using the Blacksmith stats API — blocked on Blacksmith Request #3 above.

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

