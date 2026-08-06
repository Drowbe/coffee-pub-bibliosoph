# Coffee Pub Bibliosoph

## Injuries

**Data model rebuilt and rebalanced 2026-07-28 — see `documentation/spec-injury-schema.md`** (schema, legal values, page layout, rewritten authoring prompt, validation rules, pipeline). Shipped: a strict schema with a validator, generated journal pages (display and metadata can no longer drift), the record stamped as a flag on every page with the runtime reading flag-first, odds-weighted selection, `imagetitle` on the chat card, 17 new injuries (10 `general`, 4 `force`, 3 `fire`), a full balance pass, and the dead `journaltype` / `foldername` / `action` fields removed. 127 → 144 injuries, validator 868 errors → 0. Tooling: `npm run injuries:validate` / `injuries:generate` / `injuries:build`.

Compendium rebuilt and verified 2026-07-28: 14 journals / 144 pages, every page carrying its injury flag, checked back out of the compiled LevelDB against `resources/injuries.json`.

**Mechanics and damage scaling landed 2026-07-30.** Injuries now carry `modifiers` — real roll penalties applied as ActiveEffect changes, sharing one definition with crits/fumbles (`MODIFIER_STATS` lives in the outcome schema and the injury schema re-exports it). 135 of 144 injuries were authored with the penalty their prose implies (`tools/add-injury-modifiers.mjs`, idempotent); the 9 without are genuinely cosmetic. Damage moved from flat HP to a **percentage of max HP** with a floor that means an injury can never drop a character below 1 HP — flat damage was lethal to a level-1 wizard and a rounding error to a level-15 fighter. The 6 flavour-only statuses flattened by the 2026-07-28 migration were recovered verbatim from git and restored into a new `flavor` field.

**Ticks, expiry and universal condition unwind landed 2026-07-30.** `tick` bleeds a percentage of max HP at the start of the victim's turn (8 of 144 injuries, deliberately narrow — an ongoing physical process, never a lasting consequence). `expiry` decides what happens when the clock runs out: `heal` removes it, `linger` stops the bleeding and the penalties but leaves the wound to be treated. Check-Up rows now read "2 rounds remain" and name the bleed in real hit points. Conditions unwind on **any** removal path — the card button, the actor sheet, the token HUD, or expiry — where previously that only happened via the button, so a critical deleted from the sheet left its Prone stranded.

Remaining on the data model:

- **Crier turn-card penalty report.** The data is all there now (rounds remaining, modifiers, ticks); nothing publishes it to Crier yet. See `documentation/note-crier-turn-effects.md`.
- **Escalating ticks.** A tick is a flat percentage for the whole duration. A wound that gets *worse* the longer it goes untreated is the natural extension: the bleed grows each turn (or each round past some grace period), so ignoring it costs more than treating it. Needs a growth field (flat step vs multiplier), a ceiling so it stays survivable against the 1 HP floor, and a decision on whether a failed treatment attempt accelerates it — which would pair with the existing `injuryTreatmentDcEscalation`.
- **Use `gmNotes.PRESERVE_ON_REIMPORT`** in our importer profile when the Importer API lands.
- **Old note (superseded):** Notes move off the page body (which is authored *content*, not an annotation, and has no GM gating) onto `flags["coffee-pub-blacksmith"].gmNotes` via `gmNotes.set/getHtml`, hosted by a field in our own injury page sheet. Written when an injury is created and kept in sync on update; preserved across re-import. The page body reverts to being free-form authored notes (our own notes tool's territory) or is dropped. Workaround while their `get()` is synchronous: resolve the page Document ourselves and pass it instead of a uuid string, since compendium uuids will not resolve synchronously.
- **Document the "make it yours" workflow:** copy the shipped injury pack into a world compendium and repoint the `injuryCompendium` setting at it, so authored injuries and GM notes survive module updates. Uses Blacksmith's compendium API.
- **Retire the read fallbacks** once every world has rebuilt: `readInjuryRecord` prefers typed `system` data, so this is deleting the flag and HTML tiers plus `getHTMLMetadata`.
- **Extract the shared journal-content toolkit.** Injuries and Squire's CODEX are now two implementations of the same pattern (typed page subtype + data model + sheet + JSON import). Diff them and propose to Blacksmith what should be shared: base data-model/sheet helpers, validation utilities, and — the piece that needs no Foundry type machinery and is already designed — JSON import and prompt generation via their Importer API's kinds/profiles (`journal.injury`, `journal.codex`). Note the hard constraint: `documentTypes` lives in each module's own manifest and Foundry namespaces subtypes as `<moduleId>.<type>`, so Blacksmith can supply a **library**, never own another module's document type.

Also pending:

- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- **Treatment adjacency enforcement** — the last piece of treatment phase 2. Ours, no API needed.

## Send to Other Devs (drafted, awaiting send)

- **Blacksmith — GM Notes for journals** — `documentation/note-blacksmith-gmnotes-journals.md`: adopt-not-reinvent, plus the four journal-specific problems (sync `get()` cannot resolve compendium docs; `set()` silently fails on a locked pack; module-owned page sheets mean Blacksmith should offer a *component* rather than inject into sheets; re-import must preserve notes as user data).

- **Blacksmith requests** — the four below, in order, using the `documentation/request-blacksmith-damage-api.md` format (it worked).
- **Squire dev** — `documentation/note-squire-status-effects.md`: correct apply/remove code, enumerating conditions from the system (incl. pseudo-conditions), the `@Embed` description workaround, categorizing our injuries/crits/fumbles via the `outcomeBurst` flag, the show/remove-anything filter + condition unwind, and assorted gotchas.
- **Crier dev** — `documentation/note-crier-turn-effects.md`: a display-only version of the Check-Up rows (icon tiles, two-line rows, "via" attribution, durations, enriched hover tooltips) as an optional turn-card block, with the filter/enrichment code to lift.

## Blacksmith Requests

1. **Public cross-client toast delivery** — e.g. `toast.publish(config, { recipients })`. Bibliosoph rolls its own socket relay (`coffee-pub-bibliosoph.rollToast`) for crit/fumble/injury/social toasts; every Coffee Pub module that toasts cross-client will rebuild the same plumbing. Receipt-side click-arming stays per-module (functions can't cross sockets) — only the delivery belongs in Blacksmith. Still absent as of 13.15.1: `ToastAPI` exposes `show`/`remove`/`clearByModule`/`getActive`/`isExcludedUser`/`isBypassChannel`/`registerChannel`/`getChannels`, and `broadcastToast`/`sendToastToUsers` remain module-internal.
2. **Stats API surface for the phase 3 announcer** — a query API (`stats.getRecord('damage-dealt')`) or, better, events (`blacksmith.stats.recordBroken`) so "biggest hit / broken record" announcements are subscribers like everything else. Request BEFORE designing phase 3 so it lands event-shaped, same playbook as `damageResolved`. (`api.stats` exists; the query/event surface we need does not.)
3. **MIDI attacker/item attribution on `damageResolved`** — already on Blacksmith's own TODO; nudge it along (unlocks the `{attacker}`/`{weapon}` injury toast codes above). Confirmed still open: `manager-roll-outcomes.js` emits `attackerTokenId: null, itemUuid: null` with "MIDI enrichment is future work".
4. **Two developer-experience footguns (flag, not formal requests):** `rollCoffeePubDice()` fabricates a decorative 2d20 when passed nothing (caused the fake-dice bug — warn-and-skip would be safer), and `objectToString`/`stringToObject` corrupt prose containing `=` or `|` (ate the Apply-button description — deprecate in favor of JSON helpers).

## Crits & Fumbles

**Migrated to typed journal pages 2026-07-29 — see `documentation/spec-outcome-schema.md`.** The world's own crit/fumble tables were migrated verbatim: **94 outcomes (47 crits, 47 fumbles)** across **two compendiums**, three severity-bucket journals each (crits: Butchery / Carnage / Slaughter; fumbles: Meek / Nasty / Devastating). Severity, damage, round-based durations, conditions, odds weighting, target metadata, and **modifiers** that apply as real ActiveEffect changes. **The deck is the only source as of 13.4.3** — the roll-table fallback and its three settings were removed, because a table row cannot carry the mechanics these cards are built around and produced a silent look-alike whenever a compendium was empty.

- Play-test the outcome flow: roll a crit and a fumble, check the mechanics block on the card, apply one and confirm the condition, duration, damage, and modifier all land on the token.
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

## Windows & Styling

- **Consolidate `window-encounter.css`'s colour literals ahead of any Tool-shell move.** 149 colour literals against 40 `var()` uses, most of them bare `rgba()` inline in rules. Not a bug today — Quick Encounter is a plain ApplicationV2 and Messages uses Blacksmith's *Template* shell, and neither themes, so we are unaffected by their Tool window changes (verified: zero `blacksmith-window-tool` and zero `--blacksmith-tool-*` references in this module). It becomes a rewrite the moment either window moves to the **Tool** shell, which is the one that themes Light/Dark/Glass. The shell-agnostic prep is consolidating the literals into a local variable block the way `window-messages.css` already does (45 literals / 94 `var()`, routed through `--bibliosoph-msg-*`), so a future migration swaps one block instead of touching 149 sites. Their bar: `styles/window-compendium-search.css` has no colour literals at all. Three traps documented in `api/api-window.md` if we ever do migrate — `surface-raised` is decorative and may be translucent while `scrim` guarantees legibility (anything sticky wants scrim, and the two only diverge under Glass); use `text-muted` rather than `opacity`, which fades borders and backgrounds too and compounds when nested; and an open `<select>` is an OS popup that inherits nothing, so it needs the explicit opaque option pair and has to be tested with the dropdown actually open.
- **Four Quick Encounter notices still use Foundry notifications.** `postConsoleAndNotification(..., notify: true)` at `manager-encounters.js:411` and `window-encounter.js:1185, 1467, 1476` (no monsters matched, roll unavailable, deploy unavailable, deploy failed). Against the module convention that every user-facing notice goes through the Blacksmith toast; investigation's were converted in 13.4.3 and these are what is left.

## Chat Cards

- Clean up how chat cards look when sent to the Foundry chat — they are pretty rough. Two features still render through the legacy `chat-card.hbs`/CARDDATA path: **Investigation** (`bibliosoph.js`) and **Quick Encounter** (`manager-encounters.js`). Consider migrating them to the Blacksmith chat card structure (`.blacksmith-card` + `card-header`/`section-content` + Chat Cards API themes), like the Messages send-to-chat escalation card already uses. When Blacksmith ships its full chat-card creation API, both paths could move onto it together. *(Insults and Praise are no longer part of this — they became toasts and post no chat card at all.)*

# Coffee Pub Journals

- Allow icon cinfiguration?
- Allow sub-element style formatting (e.g. conversations)
- introduce JOURNAL styles
- nail down theme names.
- tweak journal look and feel for inside journals
- tools for insertign a narrative template into a journal?
