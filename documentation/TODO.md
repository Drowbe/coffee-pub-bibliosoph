# TODO

Work we intend to do. An entry says what, why, which files it touches, and how it will be verified. When it is done it is deleted and lives in the CHANGELOG.

## Documentation

- **Re-copy the five publisher files once Blacksmith commits its current changes.** `tools/check-docs-structure.mjs` and `tools/wiki-sync.mjs` both moved after our copies were taken -- the checker now also reports the ratio of user guides to architecture documents. The copies here are correct against Blacksmith's last commit and stale against its working tree, so this waits until the hub's changes land rather than copying an uncommitted file. Nothing here is edited per module: copy `.gitattributes` first, then the two tools, `tools/.gitignore` and `.github/workflows/sync-wiki.yml`. Verify by staged blob, never a working-tree diff: `git show ":tools/wiki-sync.mjs" | md5sum` against `git -C ../coffee-pub-blacksmith show "HEAD:tools/wiki-sync.mjs" | md5sum`. If a copied file appears to need a local edit, that is a bug in the hub's copy -- report it rather than patching here.
- **Capture the three features that still have no screenshot:** inspiration (the deal dialog and a play card), the injury authoring sheet in edit mode, and the settings window. Verify: each image renders in the repository, on the landing page and on the wiki, and every label in it matches `lang/en.json`.
- **Walk the nine user guides in a running world.** The screenshots settled a great deal -- the injury picker, the injury and Check-Up cards, the critical and fumble cards, the investigation card, and the whole Quick Encounter window are now described from the product rather than from source. What is still unwalked:
  - `userguide-getting-started.md` -- the toolbar button order and the button labels, which come from code rather than `lang/en.json`.
  - `userguide-messages.md` -- what the row of icons above the message box actually does, and whether a tone is picked there.
  - `userguide-injuries.md` -- what an expanded damage type offers on each injury row.
  - `userguide-authoring-injuries.md` -- the injury sheet's field order, and how the page type is chosen.
  - `userguide-outcomes.md` -- the apply controls for the party, nearby and self targeting modes; only the hit-creature and ally modes have been seen.
  - `userguide-inspiration.md` -- all of it. No capture, and nothing in it has been walked.
  - `userguide-investigation.md` -- what a search that finds nothing shows.
  - `userguide-encounters.md` -- the wording of the difficulty badge across its range.
  - `userguide-settings.md` -- the section order and headings, and any setting whose hint is empty in `lang/en.json` and whose behaviour was inferred.
  Verify: perform every task as both GM and player, and correct any label that differs.
- **The Inspiration Cards Source hint describes a design that was abandoned.** It reads "Drawing a card grants the character an inspiration point; using the card spends it." Bibliosoph deliberately never touches `system.attributes.inspiration` in that lifecycle -- the card itself is the currency, and the only write is the `grantInspiration` card action. This is product copy in `lang/en.json`, visible to every GM in the settings window, so it is the author's to reword rather than a documentation fix. The same wrong claim was in the inspiration architecture document and has been corrected there. Verify: open the settings window and read the hint under Inspiration Cards Source.

## Injuries

- **Escalating ticks.** A tick is a flat percentage for the whole duration. A wound that gets worse the longer it goes untreated is the natural extension: the bleed grows each turn, or each round past a grace period, so ignoring it costs more than treating it. Needs a growth field (flat step or multiplier), a ceiling so it stays survivable against the 1 HP floor, and a decision on whether a failed treatment attempt accelerates it -- which would pair with `injuryTreatmentDcEscalation`. Touches `scripts/data/injury-schema.js`, `scripts/manager-injury-ticks.js`. Verify: apply an escalating injury and watch damage rise turn by turn without dropping the character below 1 HP.
- **Retire the read fallbacks** once every world has rebuilt. `readInjuryRecord` prefers typed `system` data, so this is deleting the flag and HTML tiers plus `getHTMLMetadata` from `scripts/bibliosoph.js`. Verify: injuries still apply from a freshly built pack.
- **Treatment adjacency enforcement** -- the last piece of treatment phase 2. Ours, no API needed. Verify: a character out of reach cannot treat another.
- **Use `gmNotes.PRESERVE_ON_REIMPORT`** in our importer profile when Blacksmith's Importer API lands.
- **Add `{attacker}` and `{weapon}` codes to the injury toast** once Blacksmith wires MIDI attacker and item attribution into `damageResolved`.
- **Extract the shared journal-content toolkit.** Injuries and Squire's CODEX are two implementations of the same pattern: typed page subtype, data model, sheet, JSON import. Diff them and propose to Blacksmith what should be shared -- base data-model and sheet helpers, validation utilities, and JSON import and prompt generation via their Importer API's kinds and profiles. Hard constraint: `documentTypes` lives in each module's own manifest and Foundry namespaces subtypes as `<moduleId>.<type>`, so Blacksmith can supply a library, never own another module's document type.

## Criticals and fumbles

- **Play-test the outcome flow.** Roll a crit and a fumble, check the mechanics block on the card, apply one, and confirm the condition, duration, damage and modifier all land on the token.
- **Author more outcomes.** 47 and 47 is a solid corpus, but repeats will still show at a busy table.
- **Phase 3 announcer** -- biggest hit, broken records -- using the Blacksmith stats API. Blocked on a query or event surface existing there.

## Inspiration

- **Play-test end to end.** In progress. Cat Nap's long rest was verified as a genuine dnd5e rest.
- **Author more cards.** Ten is thin for a deck.
- **Multi-deck support.** Decks as a concept -- inspiration boons, a Deck of Many Things, whatever a table invents -- drawn from a configurable deck rather than one hard-wired compendium. The schema does not yet carry a deck identity.
- **Discard piles and shuffling.** Draws are independent weighted picks, so a card can come up twice and nothing tracks what has been seen.

## Messages

- **Keybinding to open the Messages window**, via the Foundry keybindings API, default `M`.
- **Localisation.** Move hardcoded JS strings -- menubar notifications, context menu labels, tooltips, alert titles and subtitles, dialog copy -- into `lang/en.json`. Settings strings are already localised.

## Windows and styling

- **Consolidate `window-encounter.css`'s colour literals** ahead of any Tool-shell move. 150 colour literals against 40 `var()` uses, most of them bare `rgba()` inline in rules. Quick Encounter is still a plain ApplicationV2 and does not theme, so this is not a bug today, but it is the only window left in that position -- the injury picker and the Messages popout both run on the Tool shell. The prep is consolidating the literals into a local variable block the way `window-messages-lite.css` does, so a migration swaps one block instead of touching 150 sites.

## Chat cards

- **Migrate Investigation and Quick Encounter off the legacy `chat-card.hbs` path.** Everything else builds from its typed compendium. Touches `scripts/bibliosoph.js`, `scripts/manager-encounters.js`. Verify: both cards render with the shared structure and no visual regression.
- **Deferred polish:** the full `.section-table` conversion for label and value pairs -- injury duration, damage, statuseffect; rarity kind, value, details. Cosmetic, not blocking.

## Journals

- Allow icon configuration.
- Introduce journal styles, and tweak the look and feel inside journals.
- Allow sub-element style formatting, for example conversations.
- Nail down theme names.
- Tools for inserting a narrative template into a journal.
