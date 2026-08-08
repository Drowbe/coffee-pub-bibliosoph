# Coffee Pub Bibliosoph

> Architecture reference for this module now lives in `documentation/architecture/` and publishes to the wiki. Historical plan documents were removed 2026-08-06 — what shipped is described in the architecture docs, not in the plans that produced it.

## Documentation

**Notes are no longer files.** Suite rule, agreed with Blacksmith 2026-08-07: decisions, rules and asks live in the doc that owns them — plan, architecture, API — and anything needing a reply is sent as a message. File-notes went stale and got missed. The three `note-*.md` files were retired on that basis; what was still live in them is below.

- **Crier turn-card effects — send as a message.** Still open: Crier does not consume `effects.getDisplayEffects`, so turn cards say nothing about what is afflicting the combatant, and the table forgets they are prone or bleeding until two rounds too late. The retired note told Crier to lift our filtering and enrichment code wholesale, which is now exactly the duplication `api.effects` exists to prevent — send the ask, not the code: *call `getDisplayEffects(actor)` and render the rows display-only, no buttons.* Our data is ready (rounds remaining, modifiers, ticks) and our classifier already types the rows.
- **Resolve `documentation/plan-chatcard-migration.md`.** Partially adopted: Bibliosoph consumes `blacksmith.chatCards` for card theme choices in settings, but §7 "Migration Status" implies more of the plan remains outstanding. Audit what is actually done against the two remaining legacy `chat-card.hbs` paths (see **Chat Cards** below), then either finish it or fold the residue into that section and delete the plan.
- **If Blacksmith takes ask 2, we stop deleting on expiry.** Their stated contract: the effects layer either yields deletion to Times Up or performs it, firing one expiry event either way, so exactly one actor deletes in every configuration. That would remove the delete from `resolveTurnFor` and the world-time sweep entirely, leaving us to decide only what an expiry *means* (heal vs linger). Do not build toward it until they decide — but do not add anything that would make it harder to adopt.

## Injuries

**Data model rebuilt and rebalanced 2026-07-28 — see `documentation/spec-injury-schema.md`** (schema, legal values, page layout, rewritten authoring prompt, validation rules, pipeline). Shipped: a strict schema with a validator, generated journal pages (display and metadata can no longer drift), the record stamped as a flag on every page with the runtime reading flag-first, odds-weighted selection, `imagetitle` on the chat card, 17 new injuries (10 `general`, 4 `force`, 3 `fire`), a full balance pass, and the dead `journaltype` / `foldername` / `action` fields removed. 127 → 144 injuries, validator 868 errors → 0. Tooling: `npm run injuries:validate` / `injuries:generate` / `injuries:build`.

Compendium rebuilt and verified 2026-07-28: 14 journals / 144 pages, every page carrying its injury flag, checked back out of the compiled LevelDB against `resources/injuries.json`.

**Mechanics and damage scaling landed 2026-07-30.** Injuries now carry `modifiers` — real roll penalties applied as ActiveEffect changes, sharing one definition with crits/fumbles (`MODIFIER_STATS` lives in the outcome schema and the injury schema re-exports it). 135 of 144 injuries were authored with the penalty their prose implies (`tools/add-injury-modifiers.mjs`, idempotent); the 9 without are genuinely cosmetic. Damage moved from flat HP to a **percentage of max HP** with a floor that means an injury can never drop a character below 1 HP — flat damage was lethal to a level-1 wizard and a rounding error to a level-15 fighter. The 6 flavour-only statuses flattened by the 2026-07-28 migration were recovered verbatim from git and restored into a new `flavor` field.

**Ticks, expiry and universal condition unwind landed 2026-07-30.** `tick` bleeds a percentage of max HP at the start of the victim's turn (8 of 144 injuries, deliberately narrow — an ongoing physical process, never a lasting consequence). `expiry` decides what happens when the clock runs out: `heal` removes it, `linger` stops the bleeding and the penalties but leaves the wound to be treated. Check-Up rows now read "2 rounds remain" and name the bleed in real hit points. Conditions unwind on **any** removal path — the card button, the actor sheet, the token HUD, or expiry — where previously that only happened via the button, so a critical deleted from the sheet left its Prone stranded.

Remaining on the data model:

- **Crier turn-card penalty report.** The data is all there now (rounds remaining, modifiers, ticks); nothing publishes it to Crier yet. See the ask under **Documentation** above.
- **Escalating ticks.** A tick is a flat percentage for the whole duration. A wound that gets *worse* the longer it goes untreated is the natural extension: the bleed grows each turn (or each round past some grace period), so ignoring it costs more than treating it. Needs a growth field (flat step vs multiplier), a ceiling so it stays survivable against the 1 HP floor, and a decision on whether a failed treatment attempt accelerates it — which would pair with the existing `injuryTreatmentDcEscalation`.
- ~~Register an authoritative effects classifier.~~ **Done 2026-08-07** — `registerAfflictionClassifier()` in `manager-status-effects.js`, priority 100, beating Blacksmith's `-100` compatibility classifier. Rows now read `Injury · Moderate · Deafened` and name a live bleed in real hit points. Removal is deliberately *not* routed through the registry; the `deleteActiveEffect` unwind hook already covers every route.
- **Use `gmNotes.PRESERVE_ON_REIMPORT`** in our importer profile when the Importer API lands.
- **Document the "make it yours" workflow:** copy the shipped injury pack into a world compendium and repoint the `injuryCompendium` setting at it, so authored injuries and GM notes survive module updates. Uses Blacksmith's compendium API.
- **Retire the read fallbacks** once every world has rebuilt: `readInjuryRecord` prefers typed `system` data, so this is deleting the flag and HTML tiers plus `getHTMLMetadata`.
- **Extract the shared journal-content toolkit.** Injuries and Squire's CODEX are now two implementations of the same pattern (typed page subtype + data model + sheet + JSON import). Diff them and propose to Blacksmith what should be shared: base data-model/sheet helpers, validation utilities, and — the piece that needs no Foundry type machinery and is already designed — JSON import and prompt generation via their Importer API's kinds/profiles (`journal.injury`, `journal.codex`). Note the hard constraint: `documentTypes` lives in each module's own manifest and Foundry namespaces subtypes as `<moduleId>.<type>`, so Blacksmith can supply a **library**, never own another module's document type.

Also pending:

- Once Blacksmith wires MIDI attacker/item attribution into `damageResolved`, add `{attacker}`/`{weapon}` codes to the injury toast.
- **Treatment adjacency enforcement** — the last piece of treatment phase 2. Ours, no API needed.
- ~~Our expiry must hold without Times Up.~~ **Resolved 2026-08-07 by re-modelling, not by asking.** Blacksmith shipped the adapter (`getRemaining`/`hasExpired`/`onExpired`/`sweepExpired`, `enableTimesUpIntegration`), and their sweep deletes any expired effect. That broke `expiry: linger` — but the fault was ours: we had written a *phase* timer into Foundry's `duration`, which means *lifetime*. Times Up and Blacksmith were both reading the field as specified. Lingering wounds are now applied **permanent** with the bleed phase on `bleedSeconds`/`bleedStart` in our own flag; heal injuries keep their duration and Blacksmith owns removing them. Bibliosoph no longer deletes on expiry anywhere — `onExpired` is subscribed purely to announce it. No `retainOnExpiry` ask was needed.
- **Tell Blacksmith `api-window.md` omits the consumer hook.** The doc covers `ACTION_HANDLERS`, the zone contract and the tool-theme properties, but does not state that **`getData()` is the consumer hook and `_prepareContext` belongs to the base**. Overriding `_prepareContext` — the obvious Application V2 instinct — intercepts the chain, and the base's own call then fails with `this.getData is not a function` at `window-base.js:44`, which points at Blacksmith rather than at the consumer's class. Cost us a render cycle on the injury picker. One line in Getting Started would close it.
- **Ask Blacksmith for a public duration formatter.** The one thing the re-model does cost: a lingering wound has no `durationLabel` during its bleed phase, so rows show `2 HP/turn` with no countdown. Rendering it means re-deriving their rounds/minutes/hours wording locally — the duplication that has now produced two shipped bugs (`roundsRemaining()` dividing by `roundTime` unconditionally, and before that assuming `remaining` is always seconds). `formatDuration` already exists inside `api-effects.js` but is not exposed; something like `effects.formatRemaining({ value, unit })` would let any consumer render its own time values in the suite's wording.

## Blacksmith Requests

The `damageResolved` request was **delivered** — injury automation now rides `rolls.on('damageResolved')`. The request document has been retired; use its format (it worked) for the rest.

1. **Public cross-client toast delivery** — e.g. `toast.publish(config, { recipients })`. Bibliosoph rolls its own socket relay (`coffee-pub-bibliosoph.rollToast`) for crit/fumble/injury/social toasts; every Coffee Pub module that toasts cross-client will rebuild the same plumbing. Receipt-side click-arming stays per-module (functions can't cross sockets) — only the delivery belongs in Blacksmith. Still absent as of 13.15.1: `ToastAPI` exposes `show`/`remove`/`clearByModule`/`getActive`/`isExcludedUser`/`isBypassChannel`/`registerChannel`/`getChannels`, and `broadcastToast`/`sendToastToUsers` remain module-internal.
2. **Stats API surface for the phase 3 announcer** — a query API (`stats.getRecord('damage-dealt')`) or, better, events (`blacksmith.stats.recordBroken`) so "biggest hit / broken record" announcements are subscribers like everything else. Request BEFORE designing phase 3 so it lands event-shaped, same playbook as `damageResolved`. (`api.stats` exists; the query/event surface we need does not.)
3. **MIDI attacker/item attribution on `damageResolved`** — already on Blacksmith's own TODO; nudge it along (unlocks the `{attacker}`/`{weapon}` injury toast codes above). Confirmed still open: `manager-roll-outcomes.js` emits `attackerTokenId: null, itemUuid: null` with "MIDI enrichment is future work".
4. **Advantage/disadvantage on requested rolls** (Blacksmith Request #6, still open). Treatment needs it; the interim is the required mode in the request title plus GM-side formula detection with mismatch logging.
5. **Two developer-experience footguns (flag, not formal requests):** `rollCoffeePubDice()` fabricates a decorative 2d20 when passed nothing (caused the fake-dice bug — warn-and-skip would be safer), and `objectToString`/`stringToObject` corrupt prose containing `=` or `|` (ate the Apply-button description — deprecate in favor of JSON helpers).

## Crits & Fumbles

**Migrated to typed journal pages 2026-07-29 — see `documentation/spec-outcome-schema.md`.** The world's own crit/fumble tables were migrated verbatim: **94 outcomes (47 crits, 47 fumbles)** across **two compendiums**, three severity-bucket journals each (crits: Butchery / Carnage / Slaughter; fumbles: Meek / Nasty / Devastating). Severity, damage, round-based durations, conditions, odds weighting, target metadata, and **modifiers** that apply as real ActiveEffect changes. **The deck is the only source as of 13.4.3** — the roll-table fallback and its three settings were removed, because a table row cannot carry the mechanics these cards are built around and produced a silent look-alike whenever a compendium was empty.

- Play-test the outcome flow: roll a crit and a fumble, check the mechanics block on the card, apply one and confirm the condition, duration, damage, and modifier all land on the token.
- Author more outcomes: 47/47 is a solid corpus but repeats will still show at a busy table.
- Phase 3: "announcer" moments (biggest hit, broken records) using the Blacksmith stats API — blocked on Blacksmith Request #2 above.

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

- **Consolidate `window-encounter.css`'s colour literals ahead of any Tool-shell move.** 149 colour literals against 40 `var()` uses, most of them bare `rgba()` inline in rules. Not a bug today — Quick Encounter is a plain ApplicationV2 and Messages uses Blacksmith's *Template* shell, and neither themes, so we are unaffected by their Tool window changes (verified: zero `blacksmith-window-tool` and zero `--blacksmith-tool-*` references in this module). It becomes a rewrite the moment either window moves to the **Tool** shell, which is the one that themes Light/Dark/Glass. The shell-agnostic prep is consolidating the literals into a local variable block the way `window-messages.css` already does (45 literals / 94 `var()`, routed through `--bibliosoph-msg-*`), so a future migration swaps one block instead of touching 149 sites. Their bar: `styles/window-compendium-search.css` has no colour literals at all. Three traps documented in Blacksmith's `api-window` doc if we ever do migrate — `surface-raised` is decorative and may be translucent while `scrim` guarantees legibility (anything sticky wants scrim, and the two only diverge under Glass); use `text-muted` rather than `opacity`, which fades borders and backgrounds too and compounds when nested; and an open `<select>` is an OS popup that inherits nothing, so it needs the explicit opaque option pair and has to be tested with the dropdown actually open.

## Chat Cards

- Clean up how chat cards look when sent to the Foundry chat — they are pretty rough. Two features still render through the legacy `chat-card.hbs`/CARDDATA path: **Investigation** (`bibliosoph.js`) and **Quick Encounter** (`manager-encounters.js`). Consider migrating them to the Blacksmith chat card structure (`.blacksmith-card` + `card-header`/`section-content` + Chat Cards API themes), like the Messages send-to-chat escalation card already uses. When Blacksmith ships its full chat-card creation API, both paths could move onto it together. *(Insults and Praise are no longer part of this — they became toasts and post no chat card at all.)*

# Coffee Pub Journals

- Allow icon configuration?
- Allow sub-element style formatting (e.g. conversations)
- introduce JOURNAL styles
- nail down theme names.
- tweak journal look and feel for inside journals
- tools for inserting a narrative template into a journal?
