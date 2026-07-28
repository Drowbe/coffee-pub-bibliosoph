# Coffee Pub Bibliosoph

## Injuries (CURRENT FOCUS — fix and test)

- ~~ON DECK: "Automatically Apply Injury" checkbox~~ — DONE (2026-07-26): `injuryAutoApply` (default off) sits right after Automation. Automation-created cards (click or fully automated) apply to the damaged actor before posting and arrive pre-stamped "✓ Applied to X"; manual selector cards keep the button (no known target). Falls back to the normal button on any failure.

- Play-test the automation end to end: threshold trigger on damage application, toast to all clients, click-to-roll arming on the injured player, injury card by damage type, Apply Injury. Fix what testing surfaces.
- ~~Migrate injury detection to Blacksmith's `damageResolved` event~~ — DONE (Blacksmith shipped it same-day; manager-injury-triggers.js subscribes via `rolls.on('damageResolved')`).
- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- ~~Decide the 13 flavor-only status effects~~ — **DONE (2026-07-26): all recommendations below applied (including burning) and the compendium rebuilt.** Six injuries intentionally keep flavor-only text (confused ×3 minors, disoriented ×2, clumsy fingers) — they display on cards and skip gracefully; the schema split (`condition` id + `flavor` text) remains the long-term answer for those. Table kept for the record:

  | Category | Injury | Current | Recommendation | Why |
  |---|---|---|---|---|
  | bludgeoning | Cranial Cacophony (major) | confused | `stunned` | Major head trauma deserves teeth; closest 5e analog |
  | psychic | Cerebral Overload (major) | confused | `stunned` | Same — major mental disruption |
  | psychic | Psionic Meltdown (major) | confused | `stunned` | Same |
  | psychic | Brain Fizzle (minor) | confused | none (flavor) | Stunned is too brutal for a minor; no light 5e analog |
  | psychic | Mindbender's Migraine (minor) | confused | none (flavor) | Same |
  | psychic | Mindquake Madness (minor) | confused | none (flavor) | Same |
  | psychic | Cerebral Backfire (moderate) | disoriented | none (flavor) | Memory lapses have no 5e condition |
  | psychic | Psionic Feedback (moderate) | disoriented | none (flavor) | Same |
  | cold | Frostbitten Fingertips (minor) | clumsy fingers | none (flavor) | Numb fingers have no 5e condition; great card text |
  | cold | Frozen Heartbeat (moderate) | chilled to the bone | `exhaustion` | DMG extreme-cold rules deal exhaustion — perfect fit |
  | cold | Slippery Slope Syndrome (minor) | sluggish | `exhaustion` | Same logic; drop to none if too harsh for a minor |
  | thunder | Electric Shockwave (major) | twitching | `stunned` | Uncontrollable muscle spasms, major severity |
  | thunder | Thunderous Migraine (moderate) | headache | `deafened` | Booming thunder → deafened is the thematic condition |

  **Upgrade candidates** — currently `none`, but a dnd5e 5.x condition fits well:

  | Category | Injury | Recommendation | Why |
  |---|---|---|---|
  | lightning | Thunderous Tinnitus (minor) | `deafened` | It is literally tinnitus |
  | slashing | Bleeding Edge (moderate) | `bleeding` | The name says it; 5.x has the condition |
  | slashing | Jagged Gash (moderate) | `bleeding` | Open wound |
  | slashing | Rending Rift (moderate) | `bleeding` | "Gaping chasm of agony" — it bleeds |
  | slashing | Sashimi Slice (moderate) | `bleeding` | Same |
  | necrotic | Decaying Limb (moderate) | `diseased` | Rotting flesh → diseased |
  | necrotic | Wight's Weakness (minor) | `exhaustion` | Life-drain weakness is exhaustion's whole thing |
  | fire | Fiery Footsies (minor) | `burning` (maybe) | 5.x burning deals ongoing fire damage — fun but real teeth for a minor; GM's call |
- **Player treatment via Medicine checks — PLANNED, ready to build after Step 0.** Full design agreed and captured in `documentation/plan-treatment-rolls.md`: anyone can attempt (one try per character per injury), rules matrix (kit = advantage + DC−2, self = disadvantage, both = normal + DC−2), nat 20 crit heal / nat 1 fumbled heal (5 HP) as a shared toggle, injuries-only rollable (crits/fumbles/conditions GM-only with per-viewer button pruning), GM always succeeds without rolling, DC hidden from players, severity-derived DC ladder (10/15/20, fallback 15). **Step 0 first: verify the Blacksmith rolls API supports request-side skill checks with DC/adv-dis/context — file Blacksmith Request #6 if not.** All decisions made: kit uses honored via "Consume Kit Uses" dropdown (Every Attempt **default** / On Success Only / Never; presence-only fallback allowed for phase 1), nat 20 crit heal restores +5 HP.
- **Review and update the injury import prompt** (the one used to author injury journals — user is having Blacksmith review it too). Fold in the schema requirements already drafted: legal condition ids from `CONFIG.statusEffects`/pseudo list, `damage` = one-time real HP integer, `duration` in seconds (0 = permanent), severity/odds semantics, single condition until the schema split, the canonical 14 damage categories.
- **Review the injury and crit/fumble card data model for mechanical richness.** Today an outcome is prose + at most one condition + one-time damage. Extend the schema so cards/effects can carry machine-readable mechanics: round-based durations we can count down and display ("2 rounds remain" — on the Check-Up row and Crier's turn card), roll penalties/bonuses as ActiveEffect changes ("-2 on next two attack rolls"), recurring damage ticks, and expiry behavior. This is what makes the Crier turn-card report and exhaustion-aware treatment possible.
- **Tighten the injury definition schema and code against it.** Today an injury's mechanical fields (damage, duration, statuseffect, severity, odds) are loosely-typed strings parsed out of journal HTML, with unclear semantics we've had to reverse-engineer (is damage one-time or ongoing? is duration seconds? which status ids are legal?). Define the schema explicitly — field names, types, units, allowed condition ids from CONFIG.statusEffects, what severity/odds mean — validate on read, and make the apply path consume only the validated shape. This is the contract half of the data-model rebuild (`plan-injuries-datamodel.md`): the typed JournalEntryPage model should implement this schema, not invent another one.

## Blacksmith Requests (NEXT PRIORITY once injuries are good to go)

Send these to the Blacksmith dev, in this order — use the `documentation/request-blacksmith-damage-api.md` format (it worked):

1. **Cut a release (13.11.4+).** Everything this cycle — rolls API, `damageResolved`, toast `callToAction` — exists only on master. Bibliosoph cannot ship to anyone on published 13.11.3 until Blacksmith tags a release; pin the version dependency when both ship.
2. **Public cross-client toast delivery** — e.g. `toast.publish(config, { recipients })`. Bibliosoph rolls its own socket relay (`coffee-pub-bibliosoph.rollToast`) for crit/fumble/injury/social toasts; every Coffee Pub module that toasts cross-client will rebuild the same plumbing. Receipt-side click-arming stays per-module (functions can't cross sockets) — only the delivery belongs in Blacksmith.
3. **Stats API surface for the phase 3 announcer** — a query API (`stats.getRecord('damage-dealt')`) or, better, events (`blacksmith.stats.recordBroken`) so "biggest hit / broken record" announcements are subscribers like everything else. Request BEFORE designing phase 3 so it lands event-shaped, same playbook as `damageResolved`.
4. **MIDI attacker/item attribution on `damageResolved`** — already on Blacksmith's own TODO; nudge it along (unlocks the `{attacker}`/`{weapon}` injury toast codes above).
5. **Two developer-experience footguns (flag, not formal requests):** `rollCoffeePubDice()` fabricates a decorative 2d20 when passed nothing (caused the fake-dice bug — warn-and-skip would be safer), and `objectToString`/`stringToObject` corrupt prose containing `=` or `|` (ate the Apply-button description — deprecate in favor of JSON helpers).

## Notes to Other Coffee Pub Devs

- **Squire dev — status effects & descriptions know-how (from the Check-Up build).** ✅ Note drafted and ready to send: `documentation/note-squire-status-effects.md` — covers correct apply/remove code, enumerating conditions from the system (incl. pseudo-conditions), the `@Embed` description workaround, categorizing Bibliosoph injuries/crits/fumbles via the `outcomeBurst` flag, the show/remove-anything filter + condition unwind, and assorted hard-won gotchas.
- **Crier dev — active effects & conditions on the turn card.** ✅ Note drafted and ready to send: `documentation/note-crier-turn-effects.md` — display-only version of the Check-Up rows (icon tiles, two-line rows, "via" attribution, durations, enriched hover tooltips) as an optional turn-card block, with the filter/enrichment code to lift and a pointer to the future machine-readable-penalties upgrade ("-2 on attacks, 2 rounds left") once our card data model carries them.

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

