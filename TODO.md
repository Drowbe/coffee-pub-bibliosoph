# Coffee Pub Bibliosoph

## Injuries (NEXT FOCUS — the data model)

These three are facets of one job, and it is the keystone: everything in the injury system currently rides on loosely-typed strings parsed out of journal HTML. Fixing that unlocks the Crier turn-card penalty report, exhaustion-aware treatment, countdown displays on Check-Up rows, and retires the last flavor-only status strings.

- **Tighten the injury definition schema and code against it.** An injury's mechanical fields (damage, duration, statuseffect, severity, odds) are loosely-typed strings with semantics we had to reverse-engineer (is damage one-time or ongoing? is duration seconds? which status ids are legal?). Define the schema explicitly — field names, types, units, allowed condition ids from `CONFIG.statusEffects`, what severity/odds mean — validate on read, and make the apply path consume only the validated shape. This is the contract half of the data-model rebuild (`plan-injuries-datamodel.md`): the typed JournalEntryPage model should implement this schema, not invent another one. Six injuries still carry flavor-only status text (confused ×3 minor, disoriented ×2, clumsy fingers) awaiting the `condition` id + `flavor` text split.
- **Extend the model to carry machine-readable mechanics.** Today an outcome is prose + at most one condition + one-time damage. Add round-based durations we can count down and display ("2 rounds remain"), roll penalties/bonuses as ActiveEffect changes ("-2 on next two attack rolls"), recurring damage ticks, and expiry behavior.
- **Review and update the injury import prompt** (used to author injury journals; Blacksmith is reviewing it too). Fold in the schema requirements: legal condition ids from `CONFIG.statusEffects` + the pseudo list, `damage` = one-time real HP integer, `duration` in seconds (0 = permanent), severity/odds semantics, the optional `treatmentdc` override (severity sets it otherwise: minor 10 / moderate 15 / major 20), single condition until the schema split, the canonical 14 damage categories.

Also pending:

- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- **Treatment phase 2** (phase 1 shipped and play-tested — see `documentation/plan-treatment-rolls.md`): attempt reset on a long rest (today a failed attempt is permanent until cleared via the test harness), a configurable kit item-name list, aggravation / DC-escalation options for failures, adjacency enforcement, GM hover-DC on Check-Up rows, and forced advantage/disadvantage once Blacksmith Request #5 lands.

## Send to Other Devs (drafted, awaiting send)

- **Blacksmith requests** — the six below, in order, using the `documentation/request-blacksmith-damage-api.md` format (it worked).
- **Squire dev** — `documentation/note-squire-status-effects.md`: correct apply/remove code, enumerating conditions from the system (incl. pseudo-conditions), the `@Embed` description workaround, categorizing our injuries/crits/fumbles via the `outcomeBurst` flag, the show/remove-anything filter + condition unwind, and assorted gotchas.
- **Crier dev** — `documentation/note-crier-turn-effects.md`: a display-only version of the Check-Up rows (icon tiles, two-line rows, "via" attribution, durations, enriched hover tooltips) as an optional turn-card block, with the filter/enrichment code to lift.

## Blacksmith Requests

1. **Cut a release (13.11.4+).** Everything this cycle — rolls API, `damageResolved`, toast `callToAction`, the request-roll API — exists only on master. Bibliosoph cannot ship to anyone on published 13.11.3 until Blacksmith tags a release; pin the version dependency when both ship.
2. **Public cross-client toast delivery** — e.g. `toast.publish(config, { recipients })`. Bibliosoph rolls its own socket relay (`coffee-pub-bibliosoph.rollToast`) for crit/fumble/injury/social toasts; every Coffee Pub module that toasts cross-client will rebuild the same plumbing. Receipt-side click-arming stays per-module (functions can't cross sockets) — only the delivery belongs in Blacksmith.
3. **Stats API surface for the phase 3 announcer** — a query API (`stats.getRecord('damage-dealt')`) or, better, events (`blacksmith.stats.recordBroken`) so "biggest hit / broken record" announcements are subscribers like everything else. Request BEFORE designing phase 3 so it lands event-shaped, same playbook as `damageResolved`.
4. **MIDI attacker/item attribution on `damageResolved`** — already on Blacksmith's own TODO; nudge it along (unlocks the `{attacker}`/`{weapon}` injury toast codes above).
5. **Request-side advantage/disadvantage for `openRequestRollDialog`.** The silent request API carries DC, `situationalBonus`, and `customModifier`, but advantage/disadvantage can only be chosen by the *roller's* buttons at roll time — a requesting module cannot force or default the mode. Ask for per-actor and global `advantage`/`disadvantage` options on the request (honored in the roll window and cinematic mode, ideally locking the buttons or at least pre-selecting), plus a **custom explainer/description field** rendered on the request card (`showRollExplanation` only toggles the standard skill description — a requester can't say "your Healer's Kit grants Advantage here"; today that guidance has to ride the title or module-side toasts/tooltips). Until then Bibliosoph's treatment rolls state the required mode in the request title and the GM resolver detects the actual mode from the roll formula (2d20kh/kl), logging mismatches.
6. **Two developer-experience footguns (flag, not formal requests):** `rollCoffeePubDice()` fabricates a decorative 2d20 when passed nothing (caused the fake-dice bug — warn-and-skip would be safer), and `objectToString`/`stringToObject` corrupt prose containing `=` or `|` (ate the Apply-button description — deprecate in favor of JSON helpers).

## Crits & Fumbles

- Phase 3: "announcer" moments (biggest hit, broken records) using the Blacksmith stats API — blocked on Blacksmith Request #3 above.

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
