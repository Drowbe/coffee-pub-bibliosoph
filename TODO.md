# Coffee Pub Bibliosoph

## Injuries

**Data model rebuilt and rebalanced 2026-07-28 — see `documentation/spec-injury-schema.md`** (schema, legal values, page layout, rewritten authoring prompt, validation rules, pipeline). Shipped: a strict schema with a validator, generated journal pages (display and metadata can no longer drift), the record stamped as a flag on every page with the runtime reading flag-first, odds-weighted selection, `imagetitle` on the chat card, 17 new injuries (10 `general`, 4 `force`, 3 `fire`), a full balance pass, and the dead `journaltype` / `foldername` / `action` fields removed. 127 → 144 injuries, validator 868 errors → 0. Tooling: `npm run injuries:validate` / `injuries:generate` / `injuries:build`.

Compendium rebuilt and verified 2026-07-28: 14 journals / 144 pages, every page carrying its injury flag, checked back out of the compiled LevelDB against `resources/injuries.json`.

Remaining on the data model:

- **Extend the model to carry machine-readable mechanics.** Today an outcome is prose + at most one condition + one-time damage. Add round-based durations we can count down and display ("2 rounds remain"), roll penalties/bonuses as ActiveEffect changes ("-2 on next two attack rolls"), recurring damage ticks, and expiry behavior. This is what unlocks the Crier turn-card penalty report and exhaustion-aware treatment.
- ~~**Author `gmnotes` run guidance**~~ DONE — all 144 injuries ship "Running This Injury" guidance (`tools/add-injury-guidance*.mjs`, idempotent).
- ~~**Adopt the Blacksmith GM Notes API for injuries.**~~ DONE — their `createField()` controller mounts in our sheet, and our guidance is contributed live via `registerProvider()` rather than stored, so a pack rebuild can never clobber a GM's own note.
- **Remove the pre-release GM Notes fallback** in `scripts/utility-gm-notes.js` (the plain textarea + manual capability checks) once the shipped `createField()` path is confirmed against a locked pack. Blacksmith's `canSet()` is authoritative.
- **Use `gmNotes.PRESERVE_ON_REIMPORT`** in our importer profile when the Importer API lands.
- **Old note (superseded):** Notes move off the page body (which is authored *content*, not an annotation, and has no GM gating) onto `flags["coffee-pub-blacksmith"].gmNotes` via `gmNotes.set/getHtml`, hosted by a field in our own injury page sheet. Written when an injury is created and kept in sync on update; preserved across re-import. The page body reverts to being free-form authored notes (our own notes tool's territory) or is dropped. Workaround while their `get()` is synchronous: resolve the page Document ourselves and pass it instead of a uuid string, since compendium uuids will not resolve synchronously.
- **Document the "make it yours" workflow:** copy the shipped injury pack into a world compendium and repoint the `injuryCompendium` setting at it, so authored injuries and GM notes survive module updates. Uses Blacksmith's compendium API.
- **Retire the read fallbacks** once every world has rebuilt: `readInjuryRecord` prefers typed `system` data, so this is deleting the flag and HTML tiers plus `getHTMLMetadata`.
- **Extract the shared journal-content toolkit.** Injuries and Squire's CODEX are now two implementations of the same pattern (typed page subtype + data model + sheet + JSON import). Diff them and propose to Blacksmith what should be shared: base data-model/sheet helpers, validation utilities, and — the piece that needs no Foundry type machinery and is already designed — JSON import and prompt generation via their Importer API's kinds/profiles (`journal.injury`, `journal.codex`). Note the hard constraint: `documentTypes` lives in each module's own manifest and Foundry namespaces subtypes as `<moduleId>.<type>`, so Blacksmith can supply a **library**, never own another module's document type.
- **Split `statuseffect` into `condition` + `flavor`.** Six injuries lost flavor-only status text ("Confused", "Disoriented", "Clumsy Fingers") to `none` in the migration; their prose still carries the colour, but a flavor field would let the card show it again.
- **Damage scaling** (deferred by decision D2): flat 0–12 HP is brutal at level 1 and trivial at level 15. Revisit with the mechanics work.

Also pending:

- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- **Treatment phase 2** (phase 1 shipped and play-tested — see `documentation/plan-treatment-rolls.md`): attempt reset on a long rest (today a failed attempt is permanent until cleared via the test harness), a configurable kit item-name list, aggravation / DC-escalation options for failures, adjacency enforcement, GM hover-DC on Check-Up rows, and forced advantage/disadvantage once Blacksmith Request #5 lands.

## Send to Other Devs (drafted, awaiting send)

- **Blacksmith — GM Notes for journals** — `documentation/note-blacksmith-gmnotes-journals.md`: adopt-not-reinvent, plus the four journal-specific problems (sync `get()` cannot resolve compendium docs; `set()` silently fails on a locked pack; module-owned page sheets mean Blacksmith should offer a *component* rather than inject into sheets; re-import must preserve notes as user data).

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
