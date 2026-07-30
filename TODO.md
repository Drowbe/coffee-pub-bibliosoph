# Coffee Pub Bibliosoph

## Injuries

**Data model rebuilt and rebalanced 2026-07-28 — see `documentation/spec-injury-schema.md`** (schema, legal values, page layout, rewritten authoring prompt, validation rules, pipeline). Shipped: a strict schema with a validator, generated journal pages (display and metadata can no longer drift), the record stamped as a flag on every page with the runtime reading flag-first, odds-weighted selection, `imagetitle` on the chat card, 17 new injuries (10 `general`, 4 `force`, 3 `fire`), a full balance pass, and the dead `journaltype` / `foldername` / `action` fields removed. 127 → 144 injuries, validator 868 errors → 0. Tooling: `npm run injuries:validate` / `injuries:generate` / `injuries:build`.

Compendium rebuilt and verified 2026-07-28: 14 journals / 144 pages, every page carrying its injury flag, checked back out of the compiled LevelDB against `resources/injuries.json`.

**Mechanics and damage scaling landed 2026-07-30.** Injuries now carry `modifiers` — real roll penalties applied as ActiveEffect changes, sharing one definition with crits/fumbles (`MODIFIER_STATS` lives in the outcome schema and the injury schema re-exports it). 135 of 144 injuries were authored with the penalty their prose implies (`tools/add-injury-modifiers.mjs`, idempotent); the 9 without are genuinely cosmetic. Damage moved from flat HP to a **percentage of max HP** with a floor that means an injury can never drop a character below 1 HP — flat damage was lethal to a level-1 wizard and a rounding error to a level-15 fighter. The 6 flavour-only statuses flattened by the 2026-07-28 migration were recovered verbatim from git and restored into a new `flavor` field.

Remaining on the data model:

- **Recurring damage ticks and expiry behaviour.** `modifiers` and round durations exist; damage-over-time and "what happens when it runs out" do not.
- **Count down and display remaining rounds.** The data supports it; nothing renders "2 rounds remain" yet. This is what unlocks the Crier turn-card penalty report.
- ~~**Author `gmnotes` run guidance**~~ DONE — all 144 injuries ship "Running This Injury" guidance (`tools/add-injury-guidance*.mjs`, idempotent).
- ~~**Adopt the Blacksmith GM Notes API for injuries.**~~ DONE — their `createField()` controller mounts in our sheet, and our guidance is contributed live via `registerProvider()` rather than stored, so a pack rebuild can never clobber a GM's own note.
- ~~**Remove the pre-release GM Notes fallback**~~ DONE 2026-07-30 — the textarea path is gone. A Blacksmith without `createField()` now says so plainly instead of shipping a second, worse notes editor that would silently diverge from the real one.
- **Use `gmNotes.PRESERVE_ON_REIMPORT`** in our importer profile when the Importer API lands.
- **Old note (superseded):** Notes move off the page body (which is authored *content*, not an annotation, and has no GM gating) onto `flags["coffee-pub-blacksmith"].gmNotes` via `gmNotes.set/getHtml`, hosted by a field in our own injury page sheet. Written when an injury is created and kept in sync on update; preserved across re-import. The page body reverts to being free-form authored notes (our own notes tool's territory) or is dropped. Workaround while their `get()` is synchronous: resolve the page Document ourselves and pass it instead of a uuid string, since compendium uuids will not resolve synchronously.
- **Document the "make it yours" workflow:** copy the shipped injury pack into a world compendium and repoint the `injuryCompendium` setting at it, so authored injuries and GM notes survive module updates. Uses Blacksmith's compendium API.
- **Retire the read fallbacks** once every world has rebuilt: `readInjuryRecord` prefers typed `system` data, so this is deleting the flag and HTML tiers plus `getHTMLMetadata`.
- **Extract the shared journal-content toolkit.** Injuries and Squire's CODEX are now two implementations of the same pattern (typed page subtype + data model + sheet + JSON import). Diff them and propose to Blacksmith what should be shared: base data-model/sheet helpers, validation utilities, and — the piece that needs no Foundry type machinery and is already designed — JSON import and prompt generation via their Importer API's kinds/profiles (`journal.injury`, `journal.codex`). Note the hard constraint: `documentTypes` lives in each module's own manifest and Foundry namespaces subtypes as `<moduleId>.<type>`, so Blacksmith can supply a **library**, never own another module's document type.
- ~~**Split `statuseffect` into `condition` + `flavor`**~~ DONE 2026-07-30 — all six recovered from `d712175^` and restored (`tools/restore-injury-flavor.mjs`). A real condition always wins on the card; flavour fills the slot otherwise.
- ~~**Damage scaling** (deferred decision D2)~~ DONE 2026-07-30 — percent of max HP, floored so an injury maims and never kills (`tools/convert-injury-damage.mjs`, a deliberately one-shot migration).

Also pending:

- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- **Treatment phase 2** — mostly shipped 2026-07-30. DONE: attempt reset on a rest (`injuryTreatmentAttemptReset`, defaults to long rest), a configurable kit item-name list (`injuryTreatmentKitNames`), DC escalation per failed attempt with a fumble counting double (`injuryTreatmentDcEscalation`, defaults to 0 = off), and the GM hover-DC on Check-Up rows showing the live escalated DC plus who has already tried. STILL OPEN: adjacency enforcement, and forced advantage/disadvantage once Blacksmith Request #5 lands.

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

**Migrated to typed journal pages 2026-07-29 — see `documentation/spec-outcome-schema.md`.** The world's own crit/fumble tables were migrated verbatim: **94 outcomes (47 crits, 47 fumbles)** across **two compendiums**, three severity-bucket journals each (crits: Butchery / Carnage / Slaughter; fumbles: Meek / Nasty / Devastating). Severity, damage, round-based durations, conditions, odds weighting, target metadata, and **modifiers** that apply as real ActiveEffect changes. Roll tables still supported via the "Criticals and Fumbles Source" setting (set to None).

- Play-test the outcome flow: roll a crit and a fumble, check the mechanics block on the card, apply one and confirm the condition, duration, damage, and modifier all land on the token.
- ~~**`appliesto: self` only changes the Apply label, not the targeting**~~ FIXED 2026-07-30 — the card now names the roller ("Apply to Aneda") and binds the button to that actor, resolved from the triggering roll, falling back to Foundry's own convention (a lone controlled token is the roller, a lone target is who they hit). Ambiguous selection stays unnamed rather than guessed at.
- ~~Dead macro links in `Inspired` / `Inspirational`~~ FIXED 2026-07-30 — both pointed at `Macro.N60EOG6dQaf4rbHo`, which only exists in the author's world. They now carry `dealscard: true` and hand out a real card from the inspiration deck, targeted by their own `appliesto`. This is the one place the three content families connect.
- Author more outcomes: 47/47 is a solid corpus but repeats will still show at a busy table.
- Phase 3: "announcer" moments (biggest hit, broken records) using the Blacksmith stats API — blocked on Blacksmith Request #3 above.

## Inspiration

**Built 2026-07-29/30 — see `documentation/spec-inspiration-schema.md`.** 10 cards as typed journal pages with their own model and sheet, 5 of them automated (heal to full, set HP, long rest, percent damage, HP swap). Drawing puts the card in the character's inventory as a real one-use dnd5e consumable; using that item raises the play card, whose buttons pick the target, run the action, and discard the card. **The card is the currency** — no inspiration points are tracked, because dnd5e's flag is a boolean and could never represent a hand of several cards. GMs deal from a picker showing every card; players draw at random from the same button.

- **Play-test end to end** — in progress. Cat Nap's long rest was verified as a genuine dnd5e rest (`newDay: true`, `request: true`, `advanceTime: false`, with the summary card as the receipt).
- Author more cards: 10 is thin for a deck.
- **Multi-deck support.** The original goal stands: decks as a concept — inspiration boons, a Deck of Many Things, whatever a table invents — drawn from a configurable deck rather than one hard-wired compendium. The schema does not yet carry a deck identity.
- Discard piles and shuffling: draws are independent weighted picks, so a card can come up twice and nothing tracks what has been seen.

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
