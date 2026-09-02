# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- **Injuries can be imported through Blacksmith's JSON importer, and the profile is ours.** Blacksmith's importer can now build a `JournalEntryPage` subtype it does not own -- Foundry namespaces the *declaration* of a subtype, not its creation, so the registered data model validates whoever calls `create`. Bibliosoph registers a journal profile via `api.importer.registerDeclaration` declaring `pageType: 'coffee-pub-bibliosoph.injury'`; Blacksmith builds and lands the document, we own the schema. New file `scripts/data/injury-import-profile.js`. It writes no machine shape at all: field names, types, bounds, enums, defaults and nullability are derived from `InjuryPageModel` by Blacksmith's `declarationFromModel`, which walks `defineSchema()`. The profile supplies only what a schema cannot express -- one sentence of guidance per dotted path, template examples, the `title` -> page-name mapping, and the document block. The argument for the walk is the field *set* rather than the enums: the enums were already imported from `injury-schema.js` and would have flowed through, but a seventeenth model field that never appears in a hand-written declaration is a field nobody knows is missing. Blacksmith's walk is injected rather than imported, because this module is loaded both by Foundry at runtime and by the build gate in Node, and an import would have to be one or the other. Blacksmith's own `buildInjuryJournalEntry` and `templates/journal-injury.hbs` are deleted as part of the same handover. The profile builds a `JournalEntryPage` directly, because the declared fields *are* the page: declaring `JournalEntry` instead produced an entry named after the injury, carrying a stray `system` object, and no pages at all -- an import that reports success and yields nothing the picker can see. Field paths are written verbatim, so they carry their own `system.` prefix. The containing journal is named from the page's `category` with `containerNameTransform: 'sentenceCase'`, a named transform from Blacksmith's vocabulary that we select rather than supply: the page's `system.category` stays lowercase `fire` because that is the enum, while the journal name is a display string, matching both the shipped compendium and what the picker looks for -- one vocabulary in two representations. `sentenceCase` uppercases the first character and leaves the rest untouched, which is `displayCategory` exactly; `titleCase` would have agreed on all fourteen current categories and diverged on the first value carrying an interior capital (`coldIron` becomes `Coldiron`), so the agreement is by construction rather than by every category happening to be one word. Untransformed, an import would create `fire` beside the shipped `Fire`, giving a world two journals per category and the picker two entries, one of them appended as an unrecognised extra. Registered on `ready` from `scripts/bibliosoph.js`, guarded so an older Blacksmith simply does not offer injuries in its import tool. It gets its OWN `ready` hook rather than sharing the module-registration one: sitting inside that handler after `registerFn` meant any earlier exception -- `waitForReady`, `registerModule` -- was swallowed by its outer `catch` and the profile silently never registered. Blacksmith has since deleted its legacy injury path, so this declaration is the only way an injury imports at all, and it should not depend on unrelated steps succeeding first. Its failure is also raised rather than logged at debug, because the GM's symptom would otherwise be an import tool that simply does not list injuries. Not yet run in a world: the check is to import an injury JSON, confirm the page lands in the title-cased journal with `system.severity` set, export to the compendium, and confirm the picker lists it.

- **A build gate that the import declaration mirrors the data model.** `tools/verify-injury-profile.mjs`, run by `npm run injuries:generate` and available as `npm run injuries:profile`. The checks themselves are module-agnostic and are now hosted by Blacksmith, imported through its contract path `api/check-declaration-mirrors-model.mjs`; the verifier is the injury-specific half, stubbing the Foundry globals and supplying the five things only this module knows -- title field, page type, routing selector, container transform, and the expected container names. The generic half was written here, moved there once it proved generic, and briefly existed in both trees while no import path existed -- where it forked inside an hour, `isEnvelope` here against `isRoled` there, the same rule reached twice under two names. A tool whose whole argument is that two descriptions of one thing drift apart should not be two descriptions of one thing, so there is one copy and it lives behind `api/`, which is sibling-facing and stable in a way `tools/` is not. That last one is the parameter that earns the file: without it a mirror check reads only the two things the importer already controls and proves the declaration agrees with itself. Foundry runs `InjuryPageModel.defineSchema()` against whatever the importer creates, so a declaration describing a subset of the model does not fail loudly -- it lands pages with the undescribed fields silently defaulted, and a page missing `system.severity` is invisible to the injury picker. The checker pairs every model field against a declared one in both directions, rejects any declared bound or enum *stricter* than the model's, and holds guidance to the one sentence Blacksmith's contract requires. It also closes the container loop: it applies the declared `containerNameTransform` to all fourteen categories and checks the resulting journal names against the names the compendium actually ships, so a mismatch is caught here rather than discovered as a duplicate category in the picker. An unrecognised transform name is an error rather than a shrug, because the typo `titlecase` for `titleCase` is precisely the failure being avoided, and a build going red over a transform Blacksmith has since added is loud and one line to fix where a false green is neither. It also holds the path rule in both directions: a nested field carrying a document path is a registration failure, and a top-level field *without* one is a field the importer has nowhere to write and drops from every imported document without complaint. Verified in both directions: it passes on the real profile, and injecting a stricter `max`, a dropped enum value, a two-sentence guidance line, the superseded `containerNameFormat` spelling, the `titlecase` typo, a `slug` transform, `JournalEntry` in place of `JournalEntryPage`, and a dropped model field each produced the errors they should. Re-run against the derived declaration after adopting the walk: a field with no guidance, a two-sentence guidance line, `JournalEntry`, a transform typo, a missing `title` mapping, and an absent Blacksmith checkout each failed correctly, the last exiting 1 with the expected sibling path named rather than skipping the gate.

  **The Foundry stubs carry class defaults, not just the options the model passes.** Registration threw in a live world -- `journal.injury.modifiers: min requires a number or integer field, not array` -- while this gate passed, and the reason was not that the gate checks the wrong rules. It was checking a different declaration. Foundry merges `static _defaults` into every field instance, so a real field carries properties the model never mentions: `ArrayField._defaults` is `{min: 0, max: Infinity}` (`common/data/fields.mjs:1802`), a bound on element COUNT. The walk lifted it onto an `array` descriptor and the registry refused it, but the thin stub produced no `min` at all, so the gate verified a declaration the runtime could never build. Fixed in Blacksmith by lifting bounds only from numeric fields; fixed here by giving every stubbed field type its class defaults. Worth stating why this ordering mattered: exporting the registry's real format validator -- which is the obvious fix and has been asked for -- would have proved nothing while the declaration under test was unfaithful. The registry's format rules are deliberately NOT reimplemented here, even though a local copy would have caught this, because a second description of another module's rules drifts from the day it is written. Blacksmith instead split validation out of registration and exposed it at `api/validate-declaration.mjs` -- the same function `registerDeclaration` calls, not a copy -- and `injuries:profile` now runs three checks that prove different things: `declarationFromModel` builds it from the model, `validateDeclaration` confirms the registry will accept it, and the mirror check confirms it still describes the model. Verified by re-injecting `min` on the array descriptor, which reproduces the live-console failure in the gate: `journal.injury.modifiers: min requires a number or integer field, not array`. Note that the stub fix currently changes nothing in the built declaration -- with the walk fixed, faithful and thin stubs produce byte-identical output across all sixteen descriptors, checked rather than assumed -- so its value is regression protection: without it, a reintroduction of the bug would pass the gate again.

  The guidance check is now the load-bearing one. With the machine shape derived, a field added to `InjuryPageModel` appears in the declaration automatically and carries no guidance -- so it goes from silently absent, which nothing could catch, to loudly undocumented, which fails the build. The gate stopped being a drift detector and became an authoring prompt.

- **The profile declares the selector the journal kind routes on.** Blacksmith picks a profile by lowercasing a payload's `journaltype` and looking up the registered declaration by it (`declaredProfileFor`), so a profile without a `role: 'selector'` field is unreachable: it registers cleanly, appears complete, and every import fails with the key reported as unknown. Registration cannot catch the absence -- it rejects *two* selectors and rejects a `values` list omitting the profile's own id, but zero selectors passes -- so `journaltype` is declared in `extraFields` beside the `title` mapping, and `tools/verify-injury-profile.mjs` now asserts exactly one selector, under the kind's routing name, whose values include our id. `declarationFromModel` cannot derive it: `journaltype` is an import-payload discriminator, deliberately absent from `InjuryPageModel` and from `resources/injuries.json`, where `validate-injuries.mjs` rejects it as an unknown field. Required at the import boundary and forbidden at the authoring boundary, for the same data. `testing/injury-import-sample.json` carries the payload half. Six selector faults verified to fail: no selector, two selectors, wrong name, values omitting the id, a roled field carrying a path, and the role stripped so the field reads as document data.

- **The profile declares `foldername`, so an import can say which folder it means.** Without it every injury landed at root: `upsertJournalEntry` matches on name AND folder (`registry-json-import-journals.js:1412`), so a payload with no way to name a folder can only ever match a root journal. Found in the first live run -- the import itself worked, but a GM whose world already holds an `Injuries` folder got a *second* `Fire` at root competing with the one they had, and the mismatch made the first console check read as a failure when the import had actually succeeded. Declared as `role: 'input'` with a root default, matching the three journal profiles Blacksmith ships. Not derivable and not document data: the folder is where the containing entry goes, not a value on the page. The test fixtures now target a dedicated `Injury Import Test` folder rather than `Injuries`, so a verification run cannot append test pages into a GM's real injury journals -- our shipped compendium journals carry `folder: null`, so any `Injuries` folder in a world is the GM's own organisation.

- **The nested modifier descriptors no longer carry their own paths.** `stat`, `value` and `rounds` each declared `path`, which Blacksmith's registration rejects: a nested field's parent owns the document path, and the nesting only describes the shape of the value. The profile would have failed to register. Found by diffing the hand-written descriptors against `declarationFromModel`'s output for the same model, which is the check that also found the reverse defect in Blacksmith's walk -- one bug in each direction from a single comparison.
- **The injury importer is documented, for GMs and for whoever maintains the profile.** Neither the user guide nor the architecture document mentioned it at all, so a feature that works was reachable only by having been in the conversation that built it. `documentation/userguides/userguide-authoring-injuries.md` gains "Importing several at once": the three tabs, the two payload fields that are not on the sheet (`journaltype` and `foldername`), a minimal example, and how injuries are filed into one journal per damage type with same-named pages updated rather than duplicated. It leads with the trap rather than footnoting it -- import creates journals in the WORLD and the picker reads the compendium, so an injury that imported perfectly and was not moved across is invisible in a way that looks identical to a failed import. It also names the one inconsistency a GM will otherwise trip over: `journaltype` is required in an import payload and rejected by the build in `resources/injuries.json`, because the authoring source and the import payload are two shapes of one record. `documentation/architecture/architecture-injuries.md` gains "Importing": the registration and its own `ready` hook, the derived declaration, and the invariant every failure this feature had came back to -- Foundry runs `InjuryPageModel` on create, so the model is the senior schema and the declaration only describes it. The section is explicit that the machine shape can no longer drift, since `declarationFromModel` runs against `defineSchema()` on every build, and that what the gate now protects is the human layer, the document block and the envelope fields. Those are listed because each registers cleanly and then fails quietly: a missing selector makes the profile unreachable, a missing `foldername` writes to the root of the journal directory, a missing `title` mapping imports untitled, and `documentName: 'JournalEntry'` in place of `JournalEntryPage` yields an entry with a stray `system` object and no pages. Guidance is called out as the one that fails by simple absence rather than by breaking anything. `foldername` defaulting to the root is recorded as correct rather than as a gap, with the reason: the shipped journals carry `folder: null`, so an `Injuries` folder is the GM's own, and defaulting to it would make an import append into their real journals through name-and-folder matching. `node tools/check-docs-structure.mjs` passes.

### Fixed

- **Injury import has never produced a page the picker could see.** Blacksmith's injury builder hardcoded `type: 'text'` on the pages it created, while `scripts/window-injury-picker.js` skips any page without `system.severity` -- so every page that import path created was invisible, and there was never a working path to produce injury data with. Fixed by the handover above. Checked read-only against all four worlds in `F:\Data\worlds` before deleting the old builder: no typed injury pages, no journals named for a damage-type category, and no injury-template markup in any of them, so there is no orphaned production data and no GM has to re-import anything. Note that the two-step is unchanged and still required -- import creates in the world, the GM exports to a compendium, and the picker reads the compendium named by the `injuryCompendium` setting.

## [13.6.3]

### Fixed

- **The wiki sidebar rendered six entries as raw filenames.** `userguide-injuries` and `architecture-injuries` both reduce to the label "Injuries", and the publisher deduplicated labels across the whole publish set rather than within a sidebar group, so both fell back to the page name -- and the same for encounters, inspiration, investigation, messages and outcomes. Every one of those pairs is a feature documented once for the reader and once for whoever changes it, so the fallback fired hardest where the standard had been followed most closely. Fixed in Blacksmith and picked up by re-copying `tools/wiki-sync.mjs`; labels now dedupe within a group, and the user guides take their order from the links in `home.md`. Re-copied `tools/check-docs-structure.mjs` and `.github/workflows/sync-wiki.yml` at the same time -- the workflow's header comment had been describing the retired publish-list rule. All five publisher files verified byte-identical to the hub by staged blob. Verified by rebuilding and reading `tools/.wiki-build/_Sidebar.md`. The refreshed checker then flagged the heading `## Open the window` as work-shaped, because its pattern looked for the adjective in "Open work" and also matched the imperative verb a task heading starts with -- the construction the user-guide rules require. That was reported rather than worked around, since renaming the heading would have let a tool bug reword conforming documentation; Blacksmith narrowed the pattern to require its noun, and the checker now passes with the heading unchanged.

- **The injury picker was unusable once a category was expanded.** The window sized itself with `height: 'auto'` and could not be resized, while the category list carried its own `max-height: 52vh` scroller. Collapsed, that looked right. Expanded, it produced two independent scrollbars and clipped the open category mid-row, with the rest of its injuries reachable only through the inner bar. The list no longer scrolls itself at all -- the Tool shell's body zone already does that (`.blacksmith-window-tool-body` is `flex: 1 1 auto` with `overflow: auto`), so a second scroll container nested inside it was the whole defect. The window now opens at a real height of 640, is resizable, and has minimum bounds so it cannot be dragged smaller than it can render. Files: `scripts/window-injury-picker.js`, `styles/window-injury-picker.css`. Not yet run in a world: the check is to open the picker, expand a long category such as Bludgeoning, confirm one scrollbar and every row reachable, then resize the window and confirm the list grows with it.

### Changed

- **The injury picker names its target with a portrait.** The header was a line of prose; it now carries the actor's portrait, "Dealing an injury to", and the name, and it sticks to the top of the list so the answer to "who is this landing on" stays on screen while a long category is scrolled. It takes the actor's portrait rather than the token image, since a token is often a top-down marker and the header is asking who this is happening to. With nothing targeted it shows a crosshairs icon and the same instruction as before. The sticky surface uses `surface-raised` plus a blur, with `scrim` substituted under Glass, per Blacksmith's guidance for sticky elements. Files: `scripts/window-injury-picker.js`, `templates/window-injury-picker.hbs`, `styles/window-injury-picker.css`.

- **Documentation adopted the suite-wide standard.** The tree is now `documentation/` with `home.md`, `known-issues.md` and `TODO.md` at its root and one folder per kind (`api/`, `architecture/`, `userguides/`, `assets/`), and the five publisher files are copied from Blacksmith unchanged, so every document under a published folder goes live on the module's wiki by existing rather than by being named in a list. `ROADMAP.md` is gone -- its items were duplicates of the journal entries already in `TODO.md`, and its header claimed a GitHub Issues automation this repository has never had. `TODO.md` moved to `documentation/` and was cut back to work that is actually outstanding; the shipped-work narrative it carried is in this file and the design in it is now in the architecture documents. Verified by `node tools/check-docs-structure.mjs` (clean) and `node tools/wiki-sync.mjs build` (12 pages plus Home and the sidebar), and by comparing all five copied files against Blacksmith's staged blobs, which match byte for byte.
- **Twelve product screenshots, and the guides corrected against them.** The captures were read before being referenced, which caught three places where the guides described the module from its source rather than from its interface: the injury picker's damage-type rows carry a count and two controls and expand to list their injuries, rather than the flat list of controls the guide described; the four buttons in the Messages header are the break-and-gag buttons rather than a tone bar; and the Quick Encounter window has a challenge-rating readout, a party-average marker on the CR slider, include and exclude fields, and five placement patterns, none of which the guide mentioned because it had been written from the architecture document. `userguide-encounters.md` was rewritten from the capture. The README and `home.md` take the product shot as their hero image. Reading the captures also caught real players' full names in two of them -- in a conversation tray row and a quoted reply block, which is interface chrome rather than anything that reads as content -- and both were recaptured before anything was published.
- **Seven more user guides, one per feature a user would name.** The standard's bar for user guides changed from a single required getting-started file to coverage: together, the guides must let a person understand what the module does, set it up, and use every part of it. Bibliosoph had two guides against eight architecture documents. Added: messages, injuries as experienced rather than authored, criticals and fumbles, inspiration, investigation, quick encounters, and settings. `userguide-getting-started.md` was cut back to the first five minutes and a routing table, which is all it should ever have been -- the per-feature detail it carried moved into the guide that owns it. Every setting in `userguide-settings.md` is named as it appears on screen, taken from `lang/en.json` rather than from a settings key.
- **The three schema documents were merged into their architecture documents, and each pair disagreed.** `spec-injury-schema.md`, `spec-outcome-schema.md` and `spec-inspiration-schema.md` each duplicated an architecture document, and each pair had drifted in a different direction, so both halves were reconciled against the code before folding. `investigation-spec.md` became `architecture-investigation.md`, rewritten to describe what the code does rather than what an implementation should do. `documentation/architecture/README.md` was deleted: it was an index the wiki sidebar now generates, and two of its three outbound links pointed at Blacksmith paths that no longer exist.
- **Eight cross-module items were handed off to Blacksmith** and deleted from `TODO.md`. Cross-module work belongs in the hub's `TODO-GLOBAL.md`, which a satellite cannot write, so the move is a handoff rather than a deletion: the entries were sent, confirmed landed, and only then removed here. They were the toast-delivery, stats-API, MIDI-attribution, roll-mode, duration-formatter and two API-document requests, plus two developer-experience footguns. What stays in `TODO.md` is Bibliosoph's own work that waits on them.
- **README rewritten as a product page** -- what the module is, what it needs, how to install it, and where to read more -- and it now carries the suite's AI-assistance disclosure verbatim from the hub. The toast-channel reference it carried moved to the architecture document that already covered channels.

### Fixed

- **The injury authoring prompt told authors to write flat hit points.** `damage` has been a percentage of maximum HP since 2026-07-30, but the prompt, the field table and decision D2 in the old schema document all still specified flat HP with bands of 0-4, 5-8 and 9-12, contradicted only by an addendum further down the same file. A GM pasting that prompt into an AI got records whose damage was wrong by an order of magnitude at high level and harmless at low. The corrected prompt is in the new `userguide-authoring-injuries.md`, with the real bands (0-5, 6-10, 11-18 percent) and the real duration and odds guidance, which also differed. Verified against `DAMAGE_BANDS` and `damageFor()` in `scripts/data/injury-schema.js` and against the injury sheet's own on-screen label, "Damage (% of max HP, one time)".
- **The inspiration architecture document described a design that was abandoned before it shipped.** Under the heading "The design decision that shapes everything", it said drawing a card grants a dnd5e inspiration point and playing it spends the point. Bibliosoph deliberately never touches `system.attributes.inspiration` in that lifecycle, because the field is a boolean and could not represent a hand of several cards; the only write is the `grantInspiration` card action. It also listed four actions where seven exist. Verified by tracing every use of `INSPIRATION_PATH` in `scripts/`.
- **The toasts architecture document undercounted the declared channels.** It listed four; `TOAST_CHANNELS` declares five, the fifth being `messages-group`. Verified in `scripts/manager-roll-toasts.js`.
- **Four product screenshots showed user interface that no longer exists** and have been deleted rather than republished: the pre-13.6.0 Party and Private Message dialogs that the unified Messages window replaced, plus settings captures showing `Sky Encounters`, `Macro Name` selectors and the separate Coffee Pub and Foundry toolbar checkboxes, none of which are registered any more. Three also showed real players' names. They lived in a root-level `product/` folder, which does not ship and which the wiki publisher cannot see, so they rendered nowhere but the GitHub landing page. Recapturing them is a TODO entry.
- **Code comments pointed at documents that had been deleted.** Six comments in `scripts/` and `tools/` referenced the merged schema documents, and `manager-injury-triggers.js` cited two files removed back in August. All now point at the architecture documents that carry the content.
- **Five check-mark glyphs removed from the CHANGELOG.** The no-emoji rule covers the whole repository including released sections; the words are unchanged.

## [13.6.2]

### NOTE: Needs a Blacksmith newer than 13.19.0.

- The window base classes are imported from Blacksmith's public bridge, and that export is not in a released Blacksmith yet. Until it is, these changes must not ship — a missing named export is a link-time failure, so the Messages window and the injury picker would fail to load rather than degrade.

### Changed

- **Window base classes come from Blacksmith's bridge instead of `game.modules`.** Three of our windows read the base class off `module.api` at module top level and each guarded it differently — `window-messages.js` with a `resolveBase()` factory that threw, `window-messages-lite.js` and `window-injury-picker.js` with `extends (Base ?? Object)` plus a startup log and an unreachable runtime guard. That pattern cannot work in general: `extends` is evaluated when the module is evaluated, `game` does not exist then, and ES modules cache a failed evaluation, so the throw disables the module for the session rather than being retried. It never bit us only because all three modules are exclusively dynamic-imported, always after `ready` — the deferred import *was* the workaround, and it held by luck of call-site rather than by design. A single future static import would have reproduced the failure. They now `import { BlacksmithWindowBaseV2 } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js'`, which is a real ES module and resolves at evaluation time. The three guards, two `?? Object` fallbacks and one now-unused helper went with it.
- **Found items and coins go through Blacksmith's inventory API.** Investigation added each found item with its own `createEmbeddedDocuments` call and wrote `system.currency.*` by hand. Both are now `grantItems({ stack: 'merge' })` and `grantCurrency`, in `scripts/manager-loot.js`. This fixes a disagreement the card itself exposed: the summary line counted duplicates and said "3 Arrows" while the sheet received three separate rows of one, because a hand-built payload can never match the row it becomes — creation fills schema defaults, writes `system.identifier` from the name, and normalises properties. The coin write was also unlocked, so two finds resolving together would each read the same balance and one would be lost; `grantCurrency` takes the per-actor lock and applies a delta.
- **The round length comes from the system rather than from a `6`.** `secondsToRounds` and `roundsToSeconds` read `CONFIG.time.roundTime`, matching how Blacksmith labels a duration. Hardcoding our own let a system with a different round make our card text and Blacksmith's effect label disagree — a card saying "2 rounds" beside a tooltip saying three.

### Fixed

- **The investigation summary claimed items that never arrived.** Each failed add toasted on its own, but the "added to your inventory" line was built from everything *found*. It now counts only what actually landed; the card still lists the whole find, because the search turned it up either way.


## [13.6.1]

### NOTE: Card themes must be re-picked once.

- The eight card-theme settings stored Blacksmith CSS class names (`theme-red`); they store theme **ids** now (`red`), because that is what `chatCards.post()` takes. Existing worlds hold a value that is no longer a valid choice, so those cards fall back to the world default until the GM picks again. One pass through the settings and it is done.

### Changed

- **Bibliosoph no longer writes chat card HTML.** Every card is now described as data — a composition of Blacksmith-owned parts — and Blacksmith renders it. `templates/chat-card.hbs` (413 lines), `templates/chat-card-message.hbs` and every line of card CSS in `default.css` are gone; that stylesheet is now nothing but `@import`s for the window and page sheets. The point is not the deletion: it is that improving a part improves every card in the suite at once, that Foundry's chat markup churn is now one module's problem instead of nine, and that Bibliosoph stops maintaining a drifted fork of someone else's card. All nine cards moved — investigation, encounter, treatment outcome, send-to-chat, injury, critical, fumble, Check-Up and inspiration.
- **Parts were chosen for their shape, not for their contents.** Coins became `tiles`, a grid of caption-over-value boxes. Item and monster lists became `rows`, which take a `uuid` directly — so the card no longer hand-writes `@UUID[...]{...}` and a renamed item still resolves. The injury card's treatment block became a `panel`; roll penalties and inventory summaries became `notes`; severity and outcome verdicts became `band`s. The Check-Up's health bar is a `meter`, which cost it its custom colour ramp: a meter's tint is emphasis rather than data, so the theme derives it from the proportion and the module does not pass a colour.
- **Buttons are registered, not bound.** A chat message is data on every client, so a handler cannot travel with the card. Four actions — apply-injury, apply-outcome, use-inspiration, treat-affliction — are registered on every client at startup and resolved from that client's own registry at render time, which is also why they keep working after a browser reload. The document-level click listener that dispatched on CSS classes is gone.
- **Card state moved off the markup and onto the message.** The crit/fumble pick counter, the applied stamps and the Check-Up's treated rows were all held in the stored HTML and edited by re-parsing it with `DOMParser`. They live in the module's own message flags now, and a card is amended through `chatCards.getCard()` → splice → `chatCards.update()`, which rewrites the rendered snapshot and the stored composition together. The two could previously disagree; they no longer can.
- **Who-sees-what is declared rather than pruned.** The old card was identical for every viewer and a `renderChatMessageHTML` hook deleted the parts a given reader should not have. Applying a critical is now `readableBy: 'owner'` against the roller's actor — which reads as "the player whose character rolled, and the GM" — and the encounter card's adversary lists are a `'gm'` / `'player'` pair, so the GM gets linked names with CR and players get the plain list, or "Unknown Adversaries" at detection 1–2. The hook is gone entirely. Note that this decides what RENDERS, not what travels: as before, both halves are in the message on every client. Anything that must not reach a client is whispered instead.
- **The one thing that cannot be composed is a render pass.** Which Check-Up rows a reader may treat is a per-row, per-reader decision, and so is the tooltip that previews how *that* user's Medicine roll would go. Both run in the reader's own browser through `registerRenderPass` rather than a hook, because a parts card re-renders from its stored composition a tick after Foundry paints it and that swap discards anything a hook decorated.
- **The investigation card names the character, not the player.** It showed the Foundry username over the character name; it shows the character alone. The encounter card had the inverse oddity — the token's name over the *owning player's* name — and now says the same thing the same way.

### Fixed

- **The injury selector card's leftovers.** The selector card was removed several versions ago, but its `.category-button` click handler and the `{{#if injurybutton}}` block it drove were still shipping. Nothing had set `injurybutton` since, so the handler could never fire.
- **Dead banner artwork.** `createChatCardInjury` picked one of thirteen damage-type banner images in a switch and then passed `banner: ""` to the template. Sixteen lines of assignment feeding a field that had been hardcoded empty.


## [13.6.0]

### NOTE: Requires Blacksmith 13.17.0 or newer.
- The popout needs `BlacksmithToolWindowBaseV2` (13.12.0) and the per-instance `ACTION_HANDLERS` argument (13.12.3), toast channels need `registerChannel` (13.15.1), and the favorites menu needs right-click `contextMenuItems` on a menubar tool (13.17.0). The declared floor was 13.12.3, under which favorites would have silently done nothing on right-click; it is now 13.17.0.

### Added

- **A conversation can be popped out into a lightweight window.** The Messages window is a workspace — a tray of every conversation, a member picker, tone stamps, reactions, export, purge. That is the right shape when you are *managing* conversations and the wrong shape when you are simply *in* one, mid-session, with a map to run. Hovering a conversation in the tray now reveals a popout icon on its right edge; clicking it opens that single thread in a Tool window (`BlacksmithToolWindowBaseV2`) that floats over the canvas and follows the user's Light / Dark / Glass choice. Popouts **stack** — one per conversation, so you can watch the party channel and a 1:1 side by side — and they coexist with the full window rather than replacing it. Each remembers its own position and theme. Closing one closes only that one; nothing is ever summoned back at you.
- **The popout is the same thread, not a copy of it.** Markdown, day separators, avatars, speaker colours, `@mentions`, `@UUID` links and inline images all render exactly as they do in the full window. Right-click still opens reply, edit, delete and send-to-Foundry-chat. Documents still drop in as links, screenshots still paste in as uploads. ENTER sends and SHIFT+ENTER makes a newline. What it deliberately drops is the chrome: no tray, no tone bar, no reaction chips, no picker, and no send button — ENTER is the whole interface, which is why the popout always sends on ENTER rather than honouring the full window's ENTER-sends toggle. Obeying a disabled toggle here would leave a window you can type into but never send from.

- **Conversations can be favorited, and favorites live on the menubar.** Right-click a conversation in the Messages tray — or click the star in a popout's title bar — and it joins a shortlist. Right-clicking the **Messages** menubar tool then lists that shortlist, and picking one opens it straight as a popout without going through the full window first. Favorited rows carry a star in the tray. Unread counts ride along in the menu (`Alicia (3)`), and the list is rebuilt on every right-click, so it is never stale.
- **Several conversations can be open at once.** The messages layer no longer assumes a single window. `ConversationManager` keeps a registry of every live surface — the full window plus any number of popouts — and incoming messages, typing indicators, renames and deletions reach all of them. Unread only returns to the menubar once the last one closes, so shutting one popout does not badge you about a conversation still visible in another.
- **Favorites follow the player, not the browser.** They are held in a `scope: 'user'` setting rather than `localStorage`, so a player who plays from a second machine keeps their list. Anything already saved locally is migrated once at startup and the old key cleared. The other personal Messages preferences (mute, ENTER-sends, tray collapsed) stay client-scoped, because those describe a screen rather than a person.
- **A favorite survives the conversation being created.** You can favorite a player you have never messaged — the tray shows a row for them before any conversation exists — and the favorite follows that row when it becomes a real conversation on first send. Favorites that stop resolving (deleted, or a conversation you were removed from) are dropped from the list as it is built. Favorites are stored per browser, alongside the other personal Messages preferences (mute, ENTER-sends, tray collapsed).

### Changed

- **The incoming-message splash is a real toast now.** It had been 46 lines of hand-built DOM plus 60 lines of CSS — an avatar, a title, a subtitle, a fade class and a manual eight-second timer — reimplementing what Blacksmith's toast already does. It rides `toast.show` instead, which brings stacking, the excluded-user rules, and a look that follows the user's theme, which a hardcoded overlay never could. Bursts are handled by `stackKey`: a second message from the same conversation replaces its alert in place rather than piling a second one underneath.
- **Message alerts open the popout, and that is a setting.** Clicking an alert — or the per-conversation menubar notification, which now routes the same way — opens the lightweight popout for that conversation rather than the full workspace. **Alerts Open the Popout** turns that off in favor of the full window. An alert is an invitation to glance at one conversation, so the popout is the default.
- **Group message alerts are channelled; direct messages deliberately are not.** A toast channel's only effect is that a user listed in Blacksmith's `toastExcludedUsers` — a camera account, a shared table display — sees the toast anyway unless the GM unticks that channel. That is a reasonable offer for the party channel and an unreasonable one for a private message, so `messages-group` exists and direct-message alerts carry no channel at all and can never reach a shared screen.
- **Thread behaviour is written once and worn by two windows.** The full window is built on `BlacksmithWindowBaseV2` and the popout on `BlacksmithToolWindowBaseV2` — siblings, not ancestors, so shared behaviour could not live in a common parent. It lives in `mixin-messages-thread.js` instead, as `ThreadBehavior(Base)`, which returns a subclass of whichever base it is handed. Sending, dropping, pasting, uploading, editing, replying, the context menu, the typing indicator and the message half of the render context moved there intact — 535 lines out of `window-messages.js`, which is now the tray, the picker and the action bar and little else. A fix to how a message behaves lands in both windows by construction.
- **Message actions resolve the window from the click, not from a static.** Every `ACTION_HANDLERS` entry read `MessagesWindow.current` — a class-level singleton — to find its instance, and the context menu ran off one document-level listener dispatched through that same pointer. Neither can serve two window classes. Handlers now take the instance the Blacksmith base already passes them, and the context menu binds per instance on the window's own element, the way the base binds click delegation.
- **Notices from the thread ride the Blacksmith toast.** The five `ui.notifications` calls carried along in the moved code — upload permission, upload unavailable, upload failed, nothing-selected, sent-to-chat — now go through `toast.show` like every other user-facing notice in the module.

### Fixed

- **Popping out no longer announces itself as a departure.** Closing the full Messages window plays a close sound and pushes any unread count back onto the menubar. Doing that while handing the conversation to the popout would sound and badge every popout, so a hand-off is now distinguished from a real close and stays silent.

## [13.5.0]

### NOTE: Coordinated with Blacksmith, Crier on API changes.
- Any wound authored expiry: linger has been getting deleted rather than lingering — at combat end with Times Up installed, or the instant its clock ran out otherwise. Seven of the shipped injuries were affected, and they'll now behave as written for the first time.

### Added

- **Injuries are chosen from a window now, not a card in the chat log.** The old flow posted a selector card listing damage types, you clicked one, and a random injury from that type was rolled. It put a permanent message in the log for what is really a GM control, and it could only ever roll — there was no way to say "the villain takes the eye", which is the moment a GM most wants to choose. The **Injuries** toolbar button now opens a Tool window (`BlacksmithToolWindowBaseV2`) listing every category and, expanded, every injury in it with its severity, conveyed condition, whether it bleeds, and its odds as a percentage. A row deals that exact wound. Only the resulting injury card reaches chat; the selection leaves nothing behind.
- **Three ways to land a wound, and the picker says which is which.** A droplet on each row deals it. A `d20` on a category rolls one at random, weighted by odds, as before. A hand icon asks the **target's own player** to roll it — the same armed toast the damage threshold sends, styled identically, so from the player's side a GM-initiated injury is indistinguishable from one they earned. Where nobody owns the actor, or the owner is offline, the prompt comes back to the GM rather than hanging unanswered. A feather opens the injury's authored journal page without closing the picker, because reading what a wound does is how you decide whether to deal it.
- **Random draws roll real dice.** Injuries, criticals, fumbles and inspiration honour the existing `showDiceRolls` setting and hand a genuine `Roll` to Dice So Nice. Deliberately not decorative: the die is `1d{total weight}` and its result walks the same weights the silent version used, so the dice on screen are the dice that chose. Verified across 200,000 draws to reproduce the authored odds exactly — a rare injury does not become likelier because somebody turned dice on. Naming a specific injury does not roll, because choosing is not drawing.
- **Bibliosoph tells Blacksmith what its effects are.** An authoritative `effects.registerClassifier` replaces the low-priority compatibility classifier Blacksmith had been carrying on our behalf. Any surface that lists an actor's effects — Blacksmith's combat bar, a status window, a future turn card — now reads `Injury · Moderate · Blinded · 2 HP/turn` or `Critical · Carnage · Charmed` instead of a bare row, with a live bleed stated in real hit points rather than the authored percent. No consumer imports anything from us to get it.

### Changed

- **A lingering wound no longer has a Foundry duration, because it never should have.** `duration` means how long an effect *exists*; for a lingering injury the authored duration means how long it *bleeds* — the wound itself stays until treated. Writing a phase timer into the lifetime field told every correct consumer the wrong thing: Times Up converted it and deleted it at combat end, and Blacksmith's new expiry sweep deleted it the moment the clock ran out. Both were reading the field exactly as specified. Lingering injuries are now applied **permanent**, with the bleed phase on `bleedSeconds` / `bleedStart` in our own flag where nothing can mistake it for a lifetime. The seven affected injuries behave as authored again: bleed, stop, stay until somebody treats them.
- **Blacksmith owns effect expiry; Bibliosoph only announces it.** Their sweep decides when a lifetime has run out and either deletes the effect or yields that to Times Up, so exactly one actor deletes in every configuration. We subscribe to `effects.onExpired` to say a wound healed, and delete nothing on expiry ourselves. This settles a real problem rather than a tidy one: with two modules independently expiring the same document, the loser of the race cannot even fail quietly — Foundry raises its error banner from inside the socket response handler, *before* the promise rejects, so a `catch` is strictly too late.
- **Applying an effect says what actually happened.** The toast fired before any of the mechanics ran, so it could only ever say "X now afflicts Y" while the HP came off silently and the condition arrived unannounced. It now fires once per recipient after the fact — `"Gnash Wound" afflicts Cyrus — −5 HP · Bleeding` — and names pseudo-conditions, which are conveyed by the effect rather than toggled and so were invisible in the summary.
- **Remaining time is Blacksmith's to phrase.** The Check-Up card built its own duration wording, which was right when Foundry rendered a half-hour wound as `1710 Seconds` and stopped being right the moment Blacksmith fixed that. It now reads `durationLabel` from `getDisplayEffects`, so rows say `29 minutes` out of combat and `3 Rounds` in it, consistently with every other surface in the suite.
- **The GM no longer mirrors every player's crit toast.** The GM was armed for *every* critical as a backup in case the roller walked away, which meant two live toasts for one event and a whole stand-down protocol to reconcile them — a second socket event, a generated roll id, and a per-client map of armed toasts, all to undo a duplicate the code chose to create. Exactly one client arms now: the designated roller. NPC crits, unowned actors and hidden rolls still resolve to the GM, because that is who the roller *is* in those cases.
- **The last four Foundry notifications became toasts.** Quick Encounter's "no monsters matched", "roll unavailable", "deploy unavailable" and "deploy failed" were the only `notify: true` calls left in the module, against the convention that every user-facing notice rides the Blacksmith toast.

### Fixed

- **Treating a wound left its condition behind.** `unwindConveyedCondition` asked "does anything still convey Prone?" without excluding the effect that was being deleted — so a wound blocked the unwind of its own condition, and Prone stranded on the sheet. It looked intermittent because it depended on who deleted the effect and whether the document had left the collection by the time the hook ran: conditions unwound correctly when *another* module did the deleting, and failed on our own Check-Up treat. The hook now names the departing effect, and the unwind logs which of its two reasons it declined for.
- **Two duration-unit bugs, one root cause.** Foundry reports `duration.remaining` in the unit the document carries — seconds for a seconds duration, a decimal count of rounds for a turns duration — and announces that nowhere. `roundsRemaining()` divided both by six, understating every rounds-based wound sixfold. Worse, `hasExpired()` checked `duration.seconds` was positive *before* reading `remaining` and returned "permanent" when it was not — and a Times Up conversion nulls exactly that field, so **every converted affliction looked permanent to us and our expiry silently opted out**. That is why an expiring critical produced a recovery burst but no announcement: something else expired it because we had stopped claiming it.
- **Auto-applied injuries were missing most of their mechanics.** The `injuryAutoApply` path had drifted from the manual one: it passed the authored percentage as *flat* damage — bypassing the floor that stops an injury killing anyone, so a 6% wound took half a level-1 character's hit points and could drop them to zero — and dropped roll modifiers, tick and expiry entirely. Automated wounds did the wrong damage, cost no penalties, never bled and never lingered. Both paths now build their config from one function.
- **An unguarded delete on the Check-Up treat button.** `removeAffliction` called `effect.delete()` with no guard, so a GM removing the same effect by hand mid-click produced an unhandled rejection. All three removal sites now share one guarded helper that reports whether *it* did the deleting, which is what decides who announces the result.

### Removed

- **The injury selector card and everything under it.** `createChatCardInjurySelector`, `getCategoryButtons`, `getCompendiumJournalList`, the unreachable branch in `publishChatCard`, and the `CARDTYPEINJURY` flag that became write-only once the branch went — 190 lines. `publishChatCard` is now the investigation path only; criticals, fumbles, inspiration and injuries each build their card straight from their typed compendium.
- **The roll-claim protocol.** `bibliosoph.rollClaimed`, `_claimRoll`, `_onRollClaimed`, the `_armedToasts` map and the generated roll id existed solely to reconcile the GM's mirrored toast with the player's. With one armed client there is nothing to reconcile.
- **The silent `weightedPick`.** Superseded by the rolled version at all three call sites.
- **Cross-module notes as files.** The three `note-*.md` documents were retired under a suite rule agreed with Blacksmith: decisions and rules live in the doc that owns them, and anything needing a reply is sent as a message. File-notes went stale and got missed — one of them was still telling Crier to copy filtering code that `api.effects` had long since replaced.


## [13.4.6]

### Added

- **The camera account needs no setup to see the crit.** 13.4.5 shipped the channel labels and a README table telling the GM to type them into Blacksmith — and then a real session went by with a camera account recording no criticals, fumbles or injuries at all. Nothing was broken: an empty allow-list allowed nothing, and no part of any interface admitted the words `crit` or `fumble` existed. Bibliosoph now declares its four channels to Blacksmith at startup via `api.toast.registerChannel`, so they appear as labelled, tickable rows — Critical Hits, Fumbles, Injuries, Table Breaks — with the module that sent them named alongside. Blacksmith flipped the default to match: an empty list now permits every *declared* channel, on the reasoning that declaring one is already the sender saying "this is not routine chatter". The practical result is that the feature works untouched, and the setting became how a GM narrows it rather than how they switch it on. Guarded with `typeof registerChannel === 'function'`, so older Blacksmith builds skip declaration and behave exactly as before.

### Changed

- **The docs stopped teaching magic words.** The README's Toast Channels section led with a table of strings to type and a warning that a mismatch fails silently; that framing is obsolete now the names are a checklist, so it opens with "this needs no setup" and the table became a reference for which row is which. The test harness audit was reporting the opposite of the truth under the new default — it read "nothing reaches them, check your spelling" for the case where everything reaches them — so it now names what was declared, and explains an empty result as a GM narrowing the list rather than as a typo. Blacksmith's first-sighting debug log is kept as the pointer for confirming a *cross-module* name collision, which is the case a checklist genuinely cannot resolve.
- **`getChannels()` is read-only here, by rule.** The harness uses it to report what we declared and to flag a channel missing from the registry as "registration did not run". It never prunes or validates anything stored, because that list reports what is loaded right now and not what is valid — a GM's saved allow-list naming our channels has to survive Blacksmith running without us.


## [13.4.5]

### Removed

- **Macros are gone; the buttons were always the real interface.** Investigation and Inspiration each asked the GM to pick a macro, then overwrote that macro's `execute()` so pressing it ran Bibliosoph's code instead of whatever the macro said. It was a hotbar shim from before the toolbar existed, and it had a failure mode nothing else in the module has: the feature could be fully enabled and still do nothing, because the name in settings matched no macro. The toolbar button already ran the identical path. Removed the two settings, both binding paths (including the delayed 500 ms/2000 ms rebinds and the `updateSetting` rebind hooks that existed to catch macros loading late), the macro resolver, the `MACRO FIX` console tracer, and `validateMandatorySettings()` — whose entire job was checking those two names, which is why startup could report "setup is not complete" at a GM who had configured everything that mattered. `testing/test-api-light.js` tested only that validator and went with it.

### Changed

- **One toolbar choice instead of two checkboxes.** Messages, Quick Encounter, Investigation and Inspiration each had a *Show in the Coffee Pub toolbar* and a *Show in the Foundry toolbar* checkbox — two booleans with four states, one of which (both off) hides the button of a feature the GM has explicitly enabled and reads as a bug rather than a decision. Each is now a single choice: **Show In Coffee Pub Toolbar**, **Show In Foundry Toolbar**, or **Show In Both Toolbars**, defaulting to both. Turning a button off is what the feature's own enable setting is for, and the hints now say so. The crit, fumble, injuries and Check-Up buttons are unchanged — they never had these checkboxes, and their Automation mode already decides whether they appear at all.
- **Toolbar placement is not migrated.** The old boolean pairs are no longer registered, so the four new settings start at *both* regardless of what was set before. A GM who had deliberately hidden one of these from a toolbar will see it return once and can set it again. The alternative was reading unregistered world data to guess an intent, which is worse than a one-time reset a GM can see and correct.

### Added

- **A camera account can see the crit without seeing everything.** Blacksmith's Toast Excluded Users setting is all-or-nothing: a stream or camera account listed there renders no toast at all, which is right for party chatter and exactly backwards for "CRITICAL!" — those are the moments a broadcast exists to capture. Bibliosoph now labels each broadcast toast with a channel (`crit`, `fumble`, `injury`, `social`), and Blacksmith's new Channels Excluded Users Still See setting lets the GM allow any subset through. The names are per-outcome rather than one blanket `announcements`, so the allowance can be partial — dice moments on camera, injuries and table gags off it. Blacksmith only compares two strings, so what counts as a critical stays entirely in Bibliosoph. Requires a Blacksmith newer than 13.15.0; on older builds the field is ignored and behaviour is unchanged. Channel names are documented in the README and in the Toast Design hints, because a mismatch is silent and Blacksmith deliberately has no list of valid names to offer.
- **The test harness can answer "will the camera see this?".** Two scenarios under Tools: an audit reporting who is toast-excluded and which of the four channels still reach them, and a fire-one-toast-per-channel button that bypasses automation, thresholds and source filters so the channel field itself can be verified against a real excluded client. Both read Blacksmith's `api.toast.isExcludedUser()` and `isBypassChannel()` rather than its world settings — the first draft parsed `toastExcludedUsers` and `toastBypassChannels` by hand, which coupled the harness to two setting ids and to a comma/trim/case convention that is Blacksmith's to change; the introspection was made public on request. Asking by user object rather than by name is also simply more correct: the answer covers the users that exist, so a listed name matching nobody can't read as an exclusion that isn't happening.


## [13.4.4]

### Added

- **The settings screen says what the module is.** Getting Started explains the shape of the thing — every feature switches off independently, and players see only the handful of settings that are genuinely theirs — and the Introduction below it covers what Bibliosoph actually does: injuries that linger and have to be treated, criticals and fumbles with real mechanics rather than a line of prose, inspiration cards a player holds and spends, encounters weighed against the party, investigation, and private messages that stay out of the chat log. The old copy described sending messages, rolling special tables and generating encounters — it predated the injury system, the outcome compendiums and the card deck, and named roll tables, which 13.4.3 removed.

### Fixed

- **The one place that says what the module is was invisible to players.** `registerHeader()` hardcoded `scope: "world"`, so every heading registered through it was GM-only regardless of what sat under it — including the Introduction, which is nothing *but* the description. It sat inside the player-visible Getting Started section, so a player opening the settings found the section title and no explanation under it. The helper now takes a scope argument; it still defaults to `world`, so no other heading moved.

### Changed

- **`tools/validate-settings.mjs` sees headings registered through the wrapper.** It matched only direct `game.settings.register(MODULE.ID, 'literal', …)` calls, which is precisely why the hardcoded scope above survived the 13.4.3 audit — a heading created by a helper was invisible to the checker that exists to catch this. Wrapper calls are now parsed and merged back into source order, since the heading tree is built by reading the file top to bottom and a heading appended at the end would adopt the wrong children.
- **An informational heading no longer has to justify itself with children.** The rule was "a heading is player-visible exactly when a player-visible setting sits under it", which the Introduction correctly failed the moment the checker could see it — it has no settings under it and never will, because the prose *is* the content. Headings carrying hint text are now exempt from the empty-section half of the rule. The other half still applies without exception: hiding prose from players is a choice, but hiding the context above their own settings is a bug.


## [13.4.3]

### Added

- **Outcomes can ask for more than one party member.** A new optional `picks` field (1–6, `ally` only) keeps the picker open until that many choices have been made: the instruction counts down, a running `So far:` line names who has been chosen, and the closing stamp lists everyone. "Two party members each lose 1 HP" used to live in the prose and resolve on the first click, so the second choice was silently impossible. The count lives in the stored message HTML rather than in any one client's memory, so a refresh, a second client and a relayed player click all read the same state. Two traps handled: a chosen member's button is retired, because the applier counts a repeat as *successfully applied* rather than as a no-op and would otherwise let a pick be burned on the same person twice; and *Random Party Member* resolves to a concrete actor **before** the effect is applied, excluding anyone already picked, since otherwise the card cannot know whose button to retire.
- **The player who rolled can apply their own crit or fumble.** Who a critical lands on is a table decision, so the apply controls are no longer GM-only: a player sees them when they own the actor whose roll produced the card, and the GM always sees everything. Their client cannot create effects on actors it does not own nor edit the GM's chat message, so the click is relayed over Blacksmith's socket and the GM performs it — the same shape as inspiration cards and treat stamps. The client-side pruning is presentation; the GM re-checks everything that matters before acting: the button must still be live in the stored card, it must not resolve against canvas selection, and the requester must genuinely own the roller. Buttons whose hint reads "Select the creature that was hit" stay GM-only, because relayed they would read the *GM's* selection and land on the wrong token.
- **Drag a monster from Quick Encounter straight onto the canvas.** The result cards already carried the actor UUID, so they now emit the same `{type:'Actor', uuid}` payload the Actors sidebar does and let Foundry's own drop handler do the permission check, compendium import, prototype-token build and grid snapping. Deploy remains the bulk tool — pattern, counts, the whole selected group; a drag is one monster placed exactly where you point, and deliberately ignores the count badge.
- **`tools/validate-settings.mjs`.** Checks a rule that is invisible until a player complains: a heading must be visible to exactly the people who can see something under it. It fails in both directions — a hidden heading above player-visible settings, and a visible heading with nothing under it — and reports registrations it *cannot* analyse (the message sounds register in a loop) rather than passing over them, because a green check that quietly skips things is worse than a known gap.

### Changed

- **The decks are the only source for criticals, fumbles and inspiration.** The roll-table fallback is gone. A table row cannot carry what these cards are now built around — conditions, durations, roll modifiers, targeting, a card's action and odds — so what it produced was a look-alike with none of the mechanics behind it, posted silently whenever a compendium was empty or misconfigured. That silence was the real problem: an empty deck fell through to a table and looked like it worked. Both failure cases now say so out loud, and are distinguished from each other — "no deck configured" reads differently from "deck configured but empty". Injuries were already compendium-only and are unchanged. **This removes the bring-your-own-table escape hatch**: anyone pointing these at a custom table now gets a "No Criticals Deck" toast until they author a compendium.
- **Compendium dropdowns list every installed journal compendium.** These four settings are the module nominating a compendium for its own purpose, not following the GM's search configuration, so they now use Blacksmith's `api.compendiums.getAllChoices('JournalEntry')`. The search mapping filters twice — by enabled-source checkboxes and by content heuristics deciding whether a pack looks "primary" — and GMs frequently keep an injuries or quotations pack *out* of that mapping precisely so `@UUID` lookups don't resolve against it, which made exactly the pack they wanted the one they could not choose. Asking for `JournalEntry` also drops the Actor and Item packs the old list offered, which could never have worked here.
- **"The party" no longer includes Foundry's Party actor, and prefers who is actually on the scene.** Only real `character` actors count — the Party actor is a container with no hit points to lose, and putting it in a picker offers a choice that cannot be applied. Presence is a *preference*, not a rule: if nobody is placed (a GM on a prep scene, theatre-of-mind, the test harness) the whole party comes back rather than an empty picker, which would silently downgrade the card to its select-a-token fallback and read as a missing feature. Card-dealing paths opt out of the canvas filter entirely — an inspiration card goes to a sheet, not to a square.
- **Settings are filed where they belong, and players get their context.** All three compendium selectors had been registered in a row inside the Fumbles section, so Critical showed a roll table with no deck, and Inspiration showed a roll table whose deck lived three sections away. Each now sits directly above the table it falls back to — which also makes each `None` option's "use the roll table below" true, where before it pointed at *fumbles*' table. Separately, 18 headings were rescoped: five that sit above player-visible settings were hidden from players entirely (a bare list of switches with no section titles), while thirteen that players *could* see had nothing under them (empty section titles introducing nothing).
- **Sound settings are the GM's, and `client` scope is down to one setting.** The five Messages-window sounds were per-user and are now world like every other sound in the module — one person picks the table's soundscape. Players still hear everything: a world setting is readable by every client, it is only hidden from their settings UI, and the Messages mute toggle stays per-user for anyone who wants silence. Thirteen Quick Encounter state settings moved from `client` to `user` so they follow you between machines instead of living in one browser's localStorage; window geometry is the sole remaining `client` setting, and deliberately so, since it is about the screen you are sitting at rather than about you.
- **Investigation reports through the toast system.** The "Running investigation check…" notice was a Foundry notification and three failure paths were bare `console.warn`. Two of those failures were genuinely invisible: a narrative-file error aborts the card entirely, so the GM clicked Investigate and nothing happened at all; and an item that fails to reach the sheet still appears in the card's loot list, leaving card and inventory disagreeing with nobody the wiser.
- **Card instructions read as instructions.** The apply hints and the "Applied to …" stamp were faded italics, which is easy to miss when it is the line telling you what to select. Both are now upright and bold at full opacity, and hints sit **above** their button rather than below it.

### Fixed

- **An empty mechanics callout on outcomes with no mechanics.** A card with no damage, condition or modifier fell back to a placeholder line — "No lasting effect — the damage is the story" — which filled a box designed to hold a stacked list and read as a heading with its body missing. The strip is now omitted entirely and the description carries the card.
- **A phantom blank line under a single mechanic.** Our `p { margin }` rule was specificity 0-1-1 and lost to the system's `.chat-message .message-content p`, so the last line kept a bottom margin inside the box's padding. Margin now lives only *between* lines, with the edges pinned by rules that out-specify the system's.
- **Instructions left behind after the button they described.** "Select everyone in range." survived on clients where the button had been pruned, and after a card was applied — a direction to someone with no way to follow it. The hint and its control are now one unit, with a sweep for cards already sitting in the chat log from before the change.
- **A crash when applying an outcome.** `decodeEffectPayload` was scoped inside the click-listener setup, so moving the apply logic into its own function put it out of reach: `ReferenceError: decodeEffectPayload is not defined` on every apply-outcome click. It is now module-scoped, and the same class of mistake was checked for across the rest of the new code rather than only patched where it threw.

### Removed

- **`criticalTable`, `fumbleTable` and `inspirationTable` settings**, and 225 lines of the legacy table-driven card builder behind them. Those three branches were the only callers of `createChatCardGeneral`, which was in turn the only caller of `getRollTable`; the `CARDTYPECRIT` / `CARDTYPEFUMBLE` / `CARDTYPEINSPIRATION` flags existed only to choose between them. Investigation's per-rarity tables and the four social-toast tables are untouched — they roll through `game.tables` directly and neither feature has moved to journals. Inspiration's three entry points (toolbar, macro binding, and an older direct `Macro.execute` override) were also unified, since two of them published table cards independently and would have called into the deleted branch.

### Testing

- Harness scenarios for the new mechanics: a **two-pick ally card** and a **three-pick driven entirely by Random** (which exercises the exclude-already-chosen path), a **roller-owner gate** scenario that names which players should see the buttons based on real actor ownership, and a **party resolution** report showing what was excluded by type, who is on and off the scene, and what the pickers will actually offer. The outcome pool audit now flags multi-pick entries, including the broken combination of `picks > 1` without the `ally` picker.
- `rollOutcomeCard` gained an `overrides` seam — the same pattern as the existing `title` parameter — so the harness can demo a field combination no shipped outcome carries yet without editing the compendium.

### Requires

- The unfiltered compendium list needs a Blacksmith build carrying `api.compendiums.getAllChoices()` (their master at time of writing). Older builds fall back to the previous filtered array, so this does not hard-block on their release.


## [13.4.2]

### Changed

- **The treatment advantage matrix is derived in one place.** `treatmentRollPlan()` now owns which situation maps to which roll mode, what the DC becomes, and the sentence explaining it; the roll request and the pre-click tooltip both consume it. They had each been deriving kit/self/mode independently, which is how a tooltip ends up promising Advantage on a roll that requests normal — and now that the requested mode is *locked*, that drift would have shown a player a button the tooltip said should not be there.

### Testing

- Three harness scenarios for the requested-advantage integration, each aimed at a different layer: **report the matrix** (our derivation, no rolling), **fire a locked request per mode** (Blacksmith's rendering — each should show only its own button), and **inspect the last request's flags** (what actually travelled). The last one distinguishes "we never sent it" from "this build dropped it", instead of leaving both looking identical.


## [13.4.1]

### Changed

- **Treatment rolls now request their own advantage mode** instead of naming it in the title and hoping the player clicks the matching button. The kit/self matrix is sent as `rollAdvantage` and **locked**, so only the correct button renders — that matrix is a rule, not a suggestion, since whether you hold a kit and whether the patient is you are both facts with no judgement in them. `'normal'` is a real requestable value, which is what the "kit and self cancel out" case needed. The rules explanation rides the request card itself rather than a three-second toast.
- **The requested roll mode is read from the request flags** (`flags['coffee-pub-blacksmith'].rollAdvantage`, per-actor winning over request-level) instead of being reverse-engineered from the dice formula. The formula check survives as a cheap assertion that logs a mismatch without acting on one: enforcement lives at the buttons rather than in the roll path, so a mismatch on a *locked* request would be a bug worth reporting, and this is the only place that would notice it.
- **Blacksmith dependency minimum raised from 13.8.5 to 13.12.3.** 13.8.5 could not run this module: the rolls API needs > 13.11.3, so injury detection and crit/fumble toasts silently did nothing on any build below it. The floor now matches what Bibliosoph is actually developed and tested against.

### Requires

- The advantage-mode fields need a Blacksmith build carrying Request #5 (their master, `## [Unreleased]` at time of writing). Older builds ignore the unknown options and fall back to the previous behaviour — the mode in the request title with a GM-side audit — so this does not hard-block on their release.


## [13.4.0]

### Added

- **Inspiration cards.** A 10-card deck as typed journal pages with their own data model and sheet, five of them automated (heal to full, set hit points, long rest, percentage damage, hit-point swap). Drawing a card puts it in the character's **inventory as a real one-use consumable**; using that item raises the play card, whose buttons pick who it lands on, run the action, and discard the card. The card is the currency — no inspiration points are tracked. GMs deal from a picker showing every card with its art, kind and draw odds; players draw at random from the same toolbar button. See `documentation/spec-inspiration-schema.md`.
- **Injury roll modifiers.** Injuries now carry real bonuses and penalties, applied as ActiveEffect changes, so a mangled hand costs the attack roll instead of only saying so in prose. 135 of 144 injuries were authored with the penalty their prose implies; the remaining 9 are genuinely cosmetic. Shares one definition with crit/fumble modifiers rather than duplicating it.
- **Injury flavour statuses.** A `flavor` field for injuries whose "condition" was never a real dnd5e one. The six flattened to `none` by the 2026-07-28 migration — "Confused", "Disoriented", "Clumsy Fingers" — were recovered verbatim from history and restored. A real condition always wins on the card.
- **Crits that deal inspiration cards.** `Inspired` and `Inspirational` hand a card from the deck to whoever their `appliesto` names, reusing the existing party picker.
- **Treatment phase 2.** Failed attempts reset on a rest (configurable: long rest, any rest, or never) — previously a failed attempt was permanent until cleared through the test harness. Accepted healer's-kit item names are now a setting, so homebrew and localised kits count. Optional DC escalation per failed attempt, with a fumble counting double. The GM's treat tooltip shows the live DC and who has already tried.

- **Recurring damage and expiry.** Injuries can bleed: `tick` costs a percentage of maximum hit points at the start of the victim's turn, for as long as the wound lasts. `expiry` decides what happens when the clock runs out — `heal` removes the injury and unwinds its condition, `linger` stops the bleeding and the roll penalties but leaves the wound for somebody to treat. Eight injuries carry a tick, and seven of those linger. Ticks land on combat turns rather than the game clock, so the damage arrives where the table is already looking.
- **"2 rounds remain" on Check-Up rows**, alongside the bleed rate in real hit points for the character being looked at.

### Changed

- **Removing an injury, critical or fumble now takes its condition with it however it was removed** — the Check-Up button, the actor sheet, the token HUD, or a duration running out. Previously the unwind lived only in the card's button, so a critical deleted from the sheet left its Prone or Blinded stuck on the character with nothing left pointing at it. A condition still survives while another affliction conveys it.
- **Injury damage is now a percentage of maximum hit points**, not a flat number, floored so an injury can never drop a character below 1 HP. Flat damage could not be right at both ends of the level range: an average major injury was 10.5 HP, which killed a level-1 wizard outright and was 7% of a level-15 fighter. All 144 injuries were converted, preserving each one's relative position inside its severity band.
- **Crit and fumble Apply buttons name the person.** "Apply to Roller" became "Apply to Aneda", resolved from the triggering roll and bound to that actor, so a card recorded at one moment cannot quietly re-aim at whatever is selected later.

### Fixed

- **Dead macro links in two critical hits.** `Inspired` and `Inspirational` pointed at `Macro.N60EOG6dQaf4rbHo`, which exists only in the author's world and was a broken link for everyone else.
- **Cat Nap's long rest was only a partial rest.** It passed `newDay: false`, silently skipping daily-recharge items, suppressed dnd5e's summary card so there was no way to tell, and reported success even when the rest had been refused outright. It is now a genuine long rest that cannot be blocked by the "Allow Rests" player setting, leaves a receipt, and fails honestly.
- **The inspiration draw card said nothing about where the card went.** The note was nested inside the button block, so removing the button removed the one line telling the player the card was on their sheet.

### Removed

- The pre-release GM Notes textarea fallback. A Blacksmith build without `createField()` now says so plainly rather than shipping a second, worse notes editor that would silently diverge from the real one.


## [13.3.4]

### Added

- **Treatment Rolls — anyone can try to heal.** With the new **Player Treatment Rolls** setting (Injuries section, default on), any player can attempt to treat an **injury** on the Check-Up card with a **Medicine check** against the injury's DC — rolled through Blacksmith's Request a Roll system (their character gets the roll card; the DC stays hidden until the result). The rules matrix: a **Healer's Kit** in the roller's inventory grants Advantage and lowers the DC by 2; **self-treatment** imposes Disadvantage; both at once cancel to a normal roll at the reduced DC. Each character gets **one attempt per injury** (failed attempts are recorded on the effect and shown on the card as "tried: …"). With **Treatment Crits and Fumbles** on (default), a natural 20 heals the injury regardless of DC and restores 5 HP; a natural 1 fails and deals 5 HP. **Consume Kit Uses** (Every Attempt, default / On Success Only / Never) spends the kit's limited uses (dnd5e's spent/max model; kits without uses are presence-only). DCs come from the injury's severity — minor 10, moderate 15, major 20, fallback 15 — newly stamped into applied injuries. Resolution is **GM-authoritative end to end**: the player's click posts the roll request and relays the context to the active GM, who re-validates everything against live state (effect still present, attempt not already spent, success recomputed from the delivered roll) before removing the affliction, adjusting HP, consuming kit uses, and posting a table-visible outcome line. The **GM never rolls** — their click remains instant discretion-treat. Scope rulings baked in: only injuries are rollable; crit/fumble and loose-condition rows are GM-only, with a **dismiss eraser** icon replacing the bandaid and their buttons hidden entirely on player clients. One Blacksmith API gap found during verification (the request cannot force advantage/disadvantage — the required mode rides in the request title and the resolver detects what was actually rolled) is filed as Blacksmith Request #6. Design: `documentation/plan-treatment-rolls.md`.

- **Criticals and fumbles get the injury treatment — and finally have real teeth.** They were roll-table rows: a title, some prose, and mechanics ("target is blinded for a round", "you drop your weapon", "-2 to attacks") that lived only in the text, so every one was something the GM had to read, remember, and adjudicate by hand. They are now **typed journal pages** (`coffee-pub-bibliosoph.outcome`) with validated fields — severity, damage, duration in rounds, condition, odds, who it lands on — and a proper editing sheet, exactly like injuries. The headline addition is **modifiers**: `-2 to attack rolls for 2 rounds` is now a structured field that becomes a real ActiveEffect change, so the penalty applies itself instead of being a note somebody has to hold in their head. Five stats are supported (attack, damage, AC, checks, saves), each mapped to a genuine dnd5e path — a deliberately short list, because a modifier that silently fails is worse than none. The chat card now spells out what actually happens ("8 damage · Stunned for 1 round · -2 to attack rolls for 2 rounds") and the **Apply button carries the whole record**, so applying reproduces the mechanics rather than stamping a name on the token. **46 outcomes ship** — 24 criticals and 22 fumbles across three severity tiers, each with art, a caption, and "how to run it" guidance — from `Clean Through` (a plain extra bite, no bookkeeping) to `Weapon Broken`, `Catastrophic Misfire`, and `The Perfect Moment`. Selection is **odds-weighted** like injuries, so the marquee disasters stay rare. **Roll tables still work**: the new "Criticals and Fumbles Source" setting defaults to our compendium but can be set to None, which restores the classic table path untouched — nobody loses their own crit tables. Unlike injuries there is no treatment and no DC (you do not treat a critical), and `duration: 0` means *instant* rather than permanent, since most outcomes are a single moment. New tooling: `npm run outcomes:validate` / `outcomes:generate`, and `content:build` to do injuries and outcomes together. Design: `documentation/spec-outcome-schema.md`. **Requires a world relaunch** for the new page type.
- **Injuries are now a typed journal page you can actually edit.** Injury pages are a registered Foundry document subtype (`coffee-pub-bibliosoph.injury`) backed by a data model, so every mechanical field lives in validated `system` data instead of HTML — **Foundry itself now rejects an illegal category, severity, or condition at the moment of saving**, rather than the module discovering it mid-combat. With that comes a **proper editing sheet**: damage type and severity as dropdowns, an image picker, damage/duration/odds/condition/DC fields, and a live warning when a value fights its own severity, with the page's own rich-text area repurposed as free-form GM notes. This is what makes the library genuinely yours — writing a homebrew injury is now filling in a sheet, not hand-editing an HTML metadata block and hoping the parser agrees. The page title *is* the injury name, so it can never disagree with itself. The structure deliberately mirrors Squire's CODEX pages so the shared scaffolding can later be lifted into one Coffee Pub toolkit. Reading is backward-compatible (typed `system` → page flag → legacy HTML), so existing worlds keep working until they rebuild. **Requires a world relaunch** for Foundry to register the new page type.
- **Injury data model rebuilt — generated journals, a real schema, and rarity that finally works.** Injuries are now defined by a strict schema (`documentation/spec-injury-schema.md`) and their journal pages are **generated** from `resources/injuries.json` rather than hand-maintained, which structurally ends the drift that had pages advertising "Duration: 50" over metadata that said 300. Each page is laid out image → caption → description → treatment → metadata, and carries its whole record as a **page flag** that the module now reads in preference to parsing HTML (older pages still parse, so nothing breaks before the compendium is rebuilt). The schema drops three fields that were always parsed and thrown away (`journaltype` and `foldername` were constants; `action` is derived from the category), promotes `damage`, `duration`, and `odds` to real numbers, and requires lowercase dnd5e condition ids — the loose display-name strings ("Blind", "Prone") that caused the original condition bugs can no longer be authored. **`odds` now actually weights which injury you get**: it was authored across all 127 injuries with clear intent (minor injuries average 38, major 15) but the picker chose uniformly at random, so serious wounds landed far more often than intended. Weighted selection moves the mix from 46% minor / 33% moderate / 20% major to **64% / 26% / 10%**. The **General** category — the fallback for untyped or evenly-mixed damage, and likely the most-rolled of all — grew from 2 injuries to 12. Every injury now displays its **caption** beneath the card art (102 were written and never shown; the remaining 25 are newly authored), two injuries whose art fought their category were re-illustrated, and six flavor-only status strings with no dnd5e equivalent became `none` with their colour left to the prose. A **balance pass** followed, now that odds decide what you actually see: nine odds values, thirteen durations, and six conditions were corrected where an entry fought its own severity — a *major* that expired in thirty seconds, a *minor* that ran four hours, and five minor injuries that were applying `incapacitated`, `stunned`, or `paralyzed`, costing a player their entire turn over a light wound. The authored corpus was otherwise left alone; its medians already formed a clean 4:2:1 rarity ladder. **Force** and **Fire**, the two thinnest categories, gained 7 injuries between them. The library now holds **144 injuries across 14 categories**, every category's most likely result is a minor, and the severity mix settles at 67% minor / 25% moderate / 7% major. New tooling: `npm run injuries:validate` (schema gate — condition ids, severity/damage bands, duplicate titles, turn-denying conditions on light injuries, and whether every icon actually exists on disk), `injuries:generate` (validate → generate → verify every page reads back exactly as authored), and `injuries:build` (the above plus the pack build).
- **Per-injury treatment DCs.** An injury's **severity** now sets the DC its treatment roll must beat — minor **10**, moderate **15**, major **20** — carried on the applied effect so the difficulty travels with the wound (all 127 compendium injuries already carry a valid severity, so every one of them gets a real DC rather than a flat default). Individual injuries can override the ladder with an authored `treatmentdc:` line in their page metadata, for hand-tuned wounds that don't fit their severity band. The DC is never shown to players — it appears only in the roll result — while the GM can read any injury's resolved DC from the test harness's treatment report.
- **Injury automation — damage-threshold triggers:** Injuries now fire automatically when a single application of damage deals at least a configurable percentage of the target's **max HP** (slider, default 50% — the DMG "massive damage" convention). Detection rides Blacksmith's rolls API — the new `rolls.on('damageResolved')` event (implemented by Blacksmith same-day from Bibliosoph's request, `documentation/request-blacksmith-damage-api.md`), which centralizes the dnd5e damage-hook correlation and delivers the final post-resistance amount plus the typed damage breakdown on the GM client; healing arrives flagged and is filtered out. Requires a Blacksmith build with `damageResolved` (dormant otherwise), and works with chat damage buttons and MIDI's apply path alike since both funnel through dnd5e's `Actor#applyDamage`. The injury is rolled from the journal compendium by the hit's **dominant damage type** (largest typed component; untyped/mixed falls back to General). The Injuries section gains the full crit/fumble treatment: **Automation** (Off / Toast — manual / Toast — click to roll / Toast — automatic, default click; in click mode the **injured player's** toast persists with a "Roll for the Injury" pill and clicking posts their injury card), **Injury Threshold** slider, **Triggered By** (Everyone / Players / NPCs and Monsters — default Players, judged by the *injured* actor's type), a combined **Toolbar Button** dropdown, and a **Toast Design** subsection (title/message with `{name}`, `{type}`, `{damage}`, `{percent}` codes, button text, size, animation, sound, colors, background image; the injured token's portrait is the toast avatar). The manual toolbar flow (selector card → category click) is unchanged and now macro-free: the **Injuries Enabled** checkbox, both toolbar checkboxes, and the **Injury Macro** setting are retired along with all injury macro-binding code, and the injury card's fake "for show" d100 is gone. Healing never triggers; dropping to 0 HP is deliberately not a trigger (revisit later). Requires dnd5e (dormant on other systems). See `documentation/plan-injuries-automation.md`.
- **Injury burst — a procedural canvas effect when injuries land.** Applying an injury now detonates a visual on the token: a **shockwave ring** expanding outward, a **spray of shard fragments** flying through it, and the **injury name rising** over the token damage-number style — all drawn procedurally (PIXI + Foundry's scrolling-text engine, zero image assets) and **colored by damage type** (fire orange, cold ice-blue, necrotic olive, psychic magenta, slashing crimson, and so on across all fourteen categories). Every connected client sees it with no socket traffic: applied injuries carry a flag, and Foundry's `createActiveEffect` hook fires everywhere, so each client draws the burst locally. Works on every apply path — button clicks, bound-target cards, and auto-apply. **Crits and fumbles get their own bursts too, each with its own personality**: applying a critical detonates a triumphant gold starburst (rotating spikes through a gold-and-crimson double ring, the result name blazing upward), while applying a fumble plays the sad fizzle — the ring *implodes*, sputter particles drift *downward* with a sway, and the name *sinks* in deflated slate-grey. Following review the fumble burst was redesigned from a gentle fizzle into a proper mishap: a **jagged impact ring** cracks outward, **debris chunks are knocked skyward and tumble back down under gravity**, a low **dust cloud** spreads, and the name sinks with a defeated wobble. All three bursts are exposed as a **macro API** — `game.modules.get('coffee-pub-bibliosoph').api.playCritBurst()` / `.playFumbleBurst()` / `.playInjuryBurst(null, 'Fire', 'Roasted!')` — defaulting to the targeted (then selected) token when no token is passed. New `manager-injury-effects.js`; the test harness Tools tab has one preview button per burst type. The **General** injury category now displays as the *absence* of a type: `{type}` in toast templates renders as nothing with the sentence collapsing cleanly ("took a brutal hit" instead of "took a brutal General hit") — the category key is unchanged in data.
- **Check-Up & Treatment — the injury lifecycle completed.** New **Check-Up** toolbar button (stethoscope, GM-only, after Injuries, shown under the same Automation gate): target or select a character and click to post a **Check-Up card** — the patient's portrait and name with a procedural **diagnosis narrative** ("Skylar is badly wounded (9/32 HP) and suffering from 3 afflictions…"), then one row per affliction showing its icon, name, the **conditions it conveys**, the injury's **Treatment prose** where it exists (the field finally earns its keep as the GM's adjudication text), and its own **Treat** button. Scope is deliberately broad: rows cover Bibliosoph-applied outcomes (injuries, crits, fumbles) *and any active temporary effect or condition on the actor* — plain toggled conditions, other modules' spell effects, stray legacy afflictions — making the card a one-stop "what is going on with this token and how do I clear it" tool; passive item effects are excluded. A clean token gets a clean-bill-of-health card. Clicking Treat (ownership-gated; the GM always qualifies) removes the affliction, **unwinds its toggled condition** unless another untreated affliction still conveys the same one, stamps the row "Treated", and deliberately does **not** restore lost hit points — treatment ends the ongoing affliction; healing is healing's job. Non-Bibliosoph effects get the burst flag stamped just before deletion, so the heal animation plays for them too. Pseudo-conditions (bleeding, burning, diseased) vanish automatically since they ride on the effect itself. And recovery is as visible as the wound: removing any flagged affliction — treatment click, manual deletion, expiry cleanup — plays a **treatment burst** on every client (a soft green ring contracting gently home, bright motes rising, the word lifting away in healing green), exposed as `api.playTreatmentBurst()` alongside the others. The harness gains a Treatment-card scenario and a heal-burst preview.

### Changed

- **Automation is now a true automation ladder** (crits, fumbles, and injuries alike): *Off — not using this feature* (no detection, and the toolbar button is hidden regardless of the Toolbar Button setting); *Manual — toolbar button only* (no detection, no toasts — the classic hand-rolled flow); *Automated — toast with a roll button* (detection on, the owner clicks their toast to roll the card); *Fully automated — toast and card* (card posts immediately; only Apply remains a human act). This replaces the earlier toast-centric framing where Manual still fired an announcement toast — announcement-only returns properly with the phase-3 announcer. Stored values are unchanged, so existing worlds keep their selections; a reload is needed for toolbar-button visibility to reflect an Automation change. The **Toolbar Button placement settings are gone entirely** — any Automation mode other than Off shows the feature's button in both the Coffee Pub and Foundry toolbars, no setting needed. Each of the three sections is now organized as **Configuration → Chat Card → Toast Design**, with the chat-card settings (style, roll table / compendium, injury images and sound) under their own subheading. A new **Automatically Apply Injury** checkbox (default off, right after Automation) makes automation-created injury cards apply to the damaged character *before* posting — the card arrives pre-stamped "Applied to X" instead of carrying an Apply button; manual selector cards keep their button, and any auto-apply failure falls back to the normal button. Automation labels are per-feature and self-describing (e.g. "Automated Detection: Detect injuries, show a Toast Button to roll").
- **Check-Up card redesigned into four zones.** Afflictions are now grouped under ordered zone headers — **Injuries** (bundles of afflictions), **Criticals**, **Fumbles**, and **Effects & Conditions** (everything not stamped by Bibliosoph) — with empty zones omitted. Rows are single-line — `[icon] name — conditions [treat]` — with the Treat button reduced to an **icon-only bandaid** at the row's end (hover for the tooltip; the hover card on the icon still shows the full description). Real conditions conveyed by an injury (prone, blinded…) appear **both** in the injury row's conditions text *and* as their own independent rows in Effects & Conditions, because dnd5e toggles them as separate effects — so a patient knocked prone and set aflame by one injury can have just the prone treated (they stood up) while the injury and its burning remain; treating either side stays safe, since condition unwinding already checks whether another untreated affliction still conveys it. Pseudo-conditions (bleeding, burning, diseased) ride on the injury effect itself and so appear only within its row. With the bandaid claimed by healing, the **Injuries toolbar button** gets a new icon (injured figure, `fa-user-injured`).
- **Players can treat their own characters — with the card staying honest.** The Treat button was always ownership-gated (a player may treat their own character; the GM may treat anyone), but a player's successful treat couldn't flip the row to its Treated stamp — players cannot edit a GM-owned chat message, so the card kept showing an active button for a gone affliction. Now the click becomes an **intent relayed to the active GM** over the Blacksmith socket layer (the GM-authoritative pattern Blacksmith itself uses for skill-check cards): the player still performs the treatment locally — effect deleted, condition unwound, heal burst — and the GM performs the authoritative `message.update`, which Foundry syncs to every client. The GM-side sweep never trusts the request: it re-checks every row against the actor's live effects and stamps only rows whose affliction is verifiably gone, so a forged or stale relay can't mark anything that isn't actually cured. Treating a **bundled injury** also flips the rows of the conditions it took with it (treat Severed Strands and the "Prone — via Severed Strands" row stamps in the same pass), and rows that went stale any other way (sheet deletion, expiry) get swept up on the next treat. Second lines now append **remaining duration** ("Bleeding · 10 Minutes") and both row lines truncate with an ellipsis instead of wrapping — full text stays on the hover card.

### Fixed

- **Injury data scrubbed: invalid condition names fixed.** An audit of all 127 injuries against dnd5e's registered conditions (`CONFIG.statusEffects`) found 20 with names that could never apply. The unambiguous ones are fixed in both `resources/injuries.json` and `packs/_source/injuries/` (18 corrections): `blind` → `blinded` (5, including one `deafened, blind` combo collapsed to `blinded` — the schema is single-condition), `frozen in time` → `paralyzed`. Thirteen injuries carry flavor-only values with no dnd5e equivalent (confused ×6, disoriented ×2, clumsy fingers, chilled to the bone, sluggish, twitching, headache) — left as-is for now; they display on the card and are skipped gracefully with a log at apply time. Following review, 15 further mappings were applied (severity-scaled): major mental/spasm injuries → `stunned` (Cranial Cacophony, Cerebral Overload, Psionic Meltdown, Electric Shockwave); cold injuries → `exhaustion` (Frozen Heartbeat, Slippery Slope Syndrome), plus Wight's Weakness; thunder/tinnitus → `deafened` (Thunderous Migraine, Thunderous Tinnitus); the four moderate slashing wounds → `bleeding` (Bleeding Edge, Jagged Gash, Rending Rift, Sashimi Slice); Decaying Limb → `diseased`; Fiery Footsies → `burning` (ongoing fire damage — mind your feet). Six injuries intentionally keep flavor-only text with no condition (confused ×3 minor, disoriented ×2, clumsy fingers). The compendium has been rebuilt from the corrected source. Testing then exposed a deeper, pre-existing corruption in the compendium source: **48 injuries carried their journal-page sort value glued onto the status text** ("Exhaustion20144", "Bleeding6426" — an artifact of the original import), producing garbage condition names on cards and in toggles. All 96 occurrences (two HTML contexts per page) are stripped, bringing `packs/_source` into exact agreement with `resources/injuries.json` for the first time. Testing also showed the DFreds Convenient Effects integration failing ("Cannot find effect to toggle" — outdated API signature, and DFreds lacks dnd5e 5.x conditions like bleeding); **DFreds support is removed entirely** — conditions apply via core Foundry only, and still display in DFreds' panel when that module is present. The deprecated `renderChatMessage` hook is replaced with `renderChatMessageHTML`. Follow-up testing revealed dnd5e treats `bleeding`, `burning`, and `diseased` as **pseudo-conditions** — rules-reference hazards with official names and icons that are deliberately not toggleable statuses; the applier now handles them the way dnd5e intends: the injury effect itself carries the status (`statuses: [id]`), so `actor.statuses` reports it and the injury's icon marks the token, while real conditions (blinded, stunned, exhaustion, …) still toggle via core `Actor#toggleStatusEffect`.
- **Injury apply mechanics corrected: real damage, core-Foundry conditions.** An injury's HP damage is now dealt **once, for real, on apply** (direct HP deduction — deliberately outside the damage pipeline so an injury's own damage can never re-trigger the injury automation). Previously it was an Active Effect change suppressing `hp.value`, meaning the "damage" silently came back when the effect ended and was never real damage at all. And injury status effects no longer require DFreds Convenient Effects: conditions are validated against the system's `CONFIG.statusEffects` and applied via core Foundry's `Actor#toggleStatusEffect` — DFreds is still used when it's active, but is never a dependency.
- **Apply buttons: bound targets, "Apply to [name]", and applied stamps.** Injury cards created by the automation now **bind their Apply button to the actor who took the damage** — the button reads "Apply to Favia" and applies to that actor directly, no targeting needed (manual selector cards keep click-time targeting, and crit/fumble buttons deliberately stay generic since the right recipient there is a judgment call made at click time — closest enemy, chosen party member — not the attack's target). After a successful apply, every card's button is **replaced with a "Applied to X" stamp** in the stored message, so it can't fire twice and the card records who carries the effect; the swap is skipped when the clicker can't modify the message (a non-GM clicking someone else's card), where the applier's duplicate guard still prevents double-application.
- **Status-effect application unified (crit/fumble/injury):** All card-apply buttons now flow through one shared applier (`manager-status-effects.js`) with a single behavior contract: targeted token(s) first with selected as fallback, permission-aware, duplicate-safe, and the effect always carries a **description**. This fixes several injury-path defects the crit/fumble path didn't have: injury effects never received a description (they now carry the injury text plus treatment), the effect image used the `icon` key deprecated since Foundry v12 (now `img`), applying with nothing selected was a silent no-op (now warns), the payload used the corruption-prone legacy encoding (now JSON, with a fallback decoder for cards already in chat history), and the DFreds condition check read `e.data.label` — broken since v10 — so conditions were never detected as present (now `e.name`, and the toggle is awaited). Behavior change: the injury Apply button now applies to the **targeted** token first, falling back to selected, matching Apply Critical/Fumble.
- **Performance cleanups:** The chat-card Handlebars template was fetched from disk and re-compiled on *every* card posted (five separate call sites — crit/fumble/inspiration, injury, injury selector, and both investigation paths); it is now fetched and compiled once per session and reused. The investigation narrative JSON is likewise cached after first load. The injury selector's category buttons no longer double-bind their click listeners on chat re-renders (previously a re-rendered selector could post duplicate injury cards from one click). The injury trigger's damage-type stash prunes stale entries so cancelled damage applications can't accumulate.

## [13.3.3]

### Added

- **Roll Toasts (crits & fumbles):** Phase 1 of the Blacksmith rolls-API integration. When an attack roll resolves as a critical or a fumble, an on-screen toast announces it to every player — no chat-card parsing, no manual button press. Detection rides Blacksmith's new `module.api.rolls` classification (`attackResolved`, fired on the GM client; requires a Blacksmith release newer than 13.11.3 — on older builds the feature stays dormant), delivery rides the Blacksmith socket API, and each client renders locally via the toast API. The toast settings live in the **Critical Hits** and **Fumbles** settings sections — both promoted to full banner sections (like Injuries) — each with enable toggle, title, message (`{name}` inserts the roller's token/actor name), FontAwesome icon, size, duration, animation, sound, and border/background colors, plus a shared "Whose Rolls Trigger Toasts" filter (everyone vs. players only). Hidden/blind/private rolls never broadcast: the GM still gets the toast, the table does not. Off by default.

### Changed

- **Crit/fumble sections simplified further.** The toast now shows the **roller's portrait** (actor image, falling back to token art) as its avatar instead of the configured icon — the icon setting remains only as a fallback when no portrait resolves. In settings, **Automation** now leads each section; the two toolbar checkboxes are merged into one **Toolbar Button** dropdown (None / Foundry Toolbar / Coffee Pub Toolbar / Both, kept for manual rolls); the **Enabled** checkbox is gone (Automation "Off" + Toolbar "None" cover it); the **Macro** setting and all macro-binding code are removed (toolbar buttons now roll the table directly via the same path as click-to-roll — no macro required, no startup validation nags); and the per-setting help text is cleared for a tighter sheet. The old "Whose Rolls Trigger Toasts" filter is now **Triggered By** (Everyone / Players / NPCs and Monsters) and filters on *what is rolling* — the actor type (character vs. everything else) — rather than which account made the roll, so a GM rolling for a PC still counts as a player roll and a player-controlled summon still counts as a monster. Both sections are organized under **Configuration** (Automation, Triggered By, Toolbar Button, Chat Card Style, Roll Table) and **Toast Design** (title, message, button text, size, animation, sound, colors, background image) subheadings. The Icon setting is gone — the toast always shows the roller's portrait, with a hardcoded fallback icon when no portrait resolves — and every "Card Style" label is now "Chat Card Style" to make clear it themes the chat card, not the toast. Toast title and message support substitution codes, documented in the Toast Design subheading: `{name}` (roller), `{target}` (first hit or targeted token), `{weapon}` (attack item), `{d20}` (die face), `{total}` (attack total).
- **Crit/fumble toasts: Automation modes, background image, color pickers.** One **Automation** dropdown per outcome type replaces the Enabled checkbox and Duration setting: *Off* (nothing happens), *Toast — manual rolls* (3-second announcement only), *Toast — click to roll* (**default**: the toast stays up for **the player who rolled the attack** until they click it — clicking rolls the crit/fumble table and posts the card from their client, making the moment theirs; hidden rolls hand the click to the GM instead; requires players to see the table), and *Toast — automatic rolls* (card posts immediately, 3-second toast). The clickable-roller mechanics ride the socket as plain data (roll action + roller user id) with each client arming the click handler locally, since functions cannot cross the relay; everyone else's toast self-dismisses after 3 seconds. The armed toast shows a call-to-action pill (Blacksmith's toast `callToAction`, rendered only where an onClick is live) so the roller can see their toast wants a click; the pill text is configurable per outcome type via the new **Button Text** setting in Toast Design (defaults "Roll for the Critical/Fumble Card"; blank hides the pill while the toast stays clickable). This supersedes the manual toolbar/macro click as the primary way cards get rolled. Each toast also gains a **Background Image** file picker (rendered behind the toast content with a dark scrim), and the border/background color settings now use Foundry's color picker instead of bare hex text fields.
- **Beverage Break, Bio Break, Insults, and Praise reimagined as Messages-window toasts:** The four social features no longer bind macros, sit in toolbars, or post chat cards. Instead, each enabled feature adds an image button to the Messages window header (beer stein, stomach, impact face, red heart); clicking one rolls that feature's table and announces the result to every connected client as an on-screen toast (small, 3 seconds, pop animation, shared fixed style, the button image as the toast avatar, each feature keeping its signature sound). Settings for all four live in a single **Random Toasts** subsection under Messaging — just four table dropdowns (Beverage, Bio, Insult, Praise), each defaulting to "None"; choosing a table shows that header button, None hides it (no enable toggles; the toolbar toggles, card style, and macro name settings are gone). With those moved, the now-empty Special Roll Tables section is removed. New `manager-social-toasts.js` carries the shared config and trigger; delivery rides the same Blacksmith socket relay as the crit/fumble roll toasts. Results are picked directly from the table (weighted random, no Roll evaluation), so no dice animate and dice-fulfillment prompts (e.g. Manual Rolls) never interrupt the button. This also retires the long-broken Insults chat-card path (a `CARDTYPEINSULTS`/`CARDTYPEINSULT` typo meant insult cards never posted from the toolbar or macro).
- **Inspiration promoted to its own section:** Moved out of Special Roll Tables into a top-level banner section above it, ahead of its planned evolution into a multi-card "deck" experience.
- **Settings reorganized:** The settings sheet now flows General → Messaging → Critical Hits → Fumbles → Injuries → Quick Encounters → Investigations → Special Roll Tables (Inspiration, Random Gifts, Shady Goods, Deck of Many Things, Beverage Break, Bio Break, Random Insults, Random Praise). Messaging is its own top-level section (was "Messages" under Communications, now removed as an empty shell), "Encounters" is retitled Quick Encounters, and "Beverage Messages"/"Bio Break Messages" are now Beverage Break/Bio Break. No setting keys changed — all stored values carry over.

### Added (later in cycle)

- **Apply Critical / Apply Fumble buttons on outcome cards:** Every critical and fumble chat card now carries an apply button. Clicking it applies the rolled result as a named status effect on the **targeted** token(s) (falling back to the selected token) — effect name "Critical: <result title>" or "Fumble: <result title>", with the card's text stored in the effect description, a per-type token icon (blood spray for crits, pained figure for fumbles), and no automatic mechanical changes. Duplicate-safe (skips tokens that already carry that effect) and permission-aware (you must own the target's actor, so in practice the GM applies to monsters and players to their own characters). Solves the "we forgot what the card said three rounds ago" problem — the result lives on the token until removed.

### Fixed

- **Table-card dice now show the real roll, before the card.** `getRollTable()` never returned the evaluated roll, so `createChatCardGeneral` passed `undefined` to Blacksmith's dice helper — which fabricates a decorative `2d20` when given nothing. The result: the card posted instantly (from a real but invisible, blind table roll) and then unrelated fake dice rolled afterward (and with manual dice fulfillment enabled, prompted for meaningless d20 entries). The real table roll now rides back in the result, is animated via Dice So Nice, and is **awaited** — so the sequence is dice first (showing the number that actually picked the result), then the card. The redundant blind roll-mode flag and the duplicate dice call inside `getRollTable` are gone. Applies to critical, fumble, and inspiration cards.

### Removed

- **Deck of Many Things:** Removed entirely — settings, macro binding, card branch, theme case, card-type flag, and language strings. The concept returns later as part of a planned "deck" experience built on Inspiration (see TODO.md).
- **Random Gifts and Shady Goods:** Both features are gone entirely — settings (including their Special Roll Tables subsections), toolbar buttons, macro bindings, the shared search-style chat card (`createChatCardSearch`) and its item-lookup helper, card-type flags, and language strings. Any macros users pointed at these features simply revert to their original behavior.
- **Dead roll-detection hooks:** The non-functional `createChatMessage` crit/fumble announcer (broken since Foundry v10 — it read `msg.rolls.total` on an array and compared against a hardcoded AC 15) and the empty `updateToken` HP-loss stub are gone, replaced by the rolls-API integration above.

## [13.3.2]

### Added

- **@Mentions in Messages:** Type `@` + a member's user name *or their assigned character's name* to mention them (`@Favia` notifies Favia's player). Partial names work — `@alicia` resolves to "Alicia Panicucci" (3+ characters, matched against the start of the name or any word in it, longest candidate wins) — and the message always displays the resolved full name as an accent-colored pill. Mentioned players get an upgraded alert: the menubar notification becomes "X mentioned you" with a pulsing `@` icon, and the on-screen splash always shows for mentions, even when group splashes are turned off. Mentions are limited to conversation members and are recomputed when a message is edited.
- **Clickable menubar notifications:** Built on Blacksmith's new actionable-notification API (Blacksmith 13.9.3+; older builds degrade to display-only). Clicking an incoming-message notification opens that conversation; clicking the unread-count notification opens the Messages window.
- **Persistent unread counter:** The "N Unread Messages" notification now appears on login *and* stays current as messages arrive; it persists until clicked or dismissed (pulsing for the first 10 seconds), clears whenever the Messages window opens, and reposts with a fresh count when the window closes with unread remaining. Notification hierarchy: when a message mentions you, only the mention notification shows — the ambient counter stands down until the next ordinary message or window close.
- **Collapsible conversation tray:** New chevron toggle in the Conversations header collapses the tray to a 48px icon rail — conversation icons and player avatars only, unread badges pinned to the icon corner, names available as tooltips. Per-client preference, remembered across sessions.

### Changed

- **Incoming-message notifications collapse per conversation:** A burst of messages updates one notification with a running count ("Alicia (3)") instead of stacking one per message, auto-closing 10 seconds (was 30) after the last message. The text is now just the sender's name — the envelope icon carries the rest. If any message in the burst mentioned you, the notification keeps the mention styling and count.
- **Messages init resilience:** The login unread notification is posted before any awaited setup (socket relay registration can stall on slow Blacksmith socket readiness and previously could silently swallow it), and socket-relay failures no longer abort the rest of Messages initialization.

## [13.3.1]

### Added

- **Pasted UUIDs become links:** Bare UUIDs pasted into a message (`Actor.xxxx`, `JournalEntry.x.JournalEntryPage.y`, `Compendium.scope.pack.Type.id`) are resolved on send (and on Save Edit) and converted to clickable `@UUID[...]{Name}` content links via `api.compendiums.formatLink`. Unresolvable UUIDs are left as plain text, UUIDs already inside an `@UUID[...]` enricher are skipped, and trailing punctuation is handled. The formatting help tooltip now mentions pasting UUIDs.

## [13.3.0]

### Added

- **Bundled Injuries compendium:** Bibliosoph now ships its own injuries. Blacksmith retired its content packs, which left the injuries feature with no out-of-the-box data source; the content now lives where it is used. The new `Injuries` journal compendium (`coffee-pub-bibliosoph.injuries`) contains **127 injuries across 14 damage categories** (Acid, Bludgeoning, Cold, Fire, Force, General, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant, Slashing, Thunder) — the full content rescued from Blacksmith's orphaned packs, including 25 injuries recovered from an older format that had not shipped in years, with legacy category typos fixed (Poision → Poison, Lightening → Lightning). Requires a full world relaunch after updating for the compendium to appear.
- **`resources/injuries.json`:** The canonical injuries dataset, formatted as a JSON array in the Blacksmith JSON Import / AI-prompt injury schema (`journaltype: "injury"`). Paste it into Blacksmith's Import tool to rebuild the injury journals in any world, or use it as the template for authoring new injuries with AI. Missing legacy values were derived from the data itself (severity from the prompt's damage ranges, odds from per-severity medians); recognized status effects re-cased to standard spellings.
- **Compendium pack tooling:** Pack content is version-controlled as per-document JSON under `packs/_source/` (LevelDB stays gitignored — no binary churn). `npm run packs:extract` pulls Foundry-edited pack content back to source JSON; `npm run packs:build` compiles source to LevelDB. The release workflow now builds the packs and ships `packs/` in the module zip.
- **Injuries rebuild plan:** `documentation/plan-injuries-datamodel.md` — the roadmap for moving injuries off HTML-metadata parsing onto a typed JournalEntryPage data model (Squire CODEX pattern) so users can create and edit their own injuries through a real form.

### Changed

- **Injury Compendium setting default:** `injuryCompendium` now defaults to the bundled `coffee-pub-bibliosoph.injuries` compendium, so injuries work out of the box on new installs. Existing worlds that previously saved this setting keep their choice — point it at "Coffee Pub Bibliosoph: Injuries" to use the bundled content. The setting hint (previously blank) now explains this.

## [13.2.1]

### Added

- **Paste and drop image uploads:** Paste a screenshot from the clipboard into the Messages compose box, or drop an image file from your desktop onto the window, and it uploads to `worlds/<world>/bibliosoph-messages/` (via Foundry's FilePicker) and inserts as a markdown image. Requires the core "Upload New Files" permission; users without it get a clear warning and can still link images by path or URL.
- **Day separators:** The message thread now shows "Today", "Yesterday", or the date between messages from different days.
- **Edit message:** Right-click your own message → Edit Message loads it into the compose box (banner + "Save Edit" button, ESC cancels); edited messages keep their timestamp and show an "(edited)" tag.
- **Typing indicators:** "X is typing…" appears above the compose box when another member types in the conversation you're viewing. Ephemeral socket pings only (throttled to one per 2s, targeted at active members, nothing stored).
- **Clean unused images (GM):** Broom button in the action bar scans the messages upload folder for images no longer referenced by any message and reclaims their space. Foundry provides no file-deletion API, so orphans are overwritten with a tiny blank PNG; the confirmation dialog names the folder for true on-disk removal.
- **Excluded Users setting:** `messagesExcludedUsers` (world) — comma-separated user names left out of Messages entirely: no 1:1 tray row, not selectable for groups, and removed from the party conversation on world load. Case-insensitive exact-or-prefix matching; replaces the hardcoded Cameraman/Developer/Author exclusion (which is now the default value).

### Changed

- **TODO.md:** Added planned work — crit/fumble table automation on natural 20/1 (replacing the placeholder `createChatMessage` hook), a keybinding to open Messages, and localization of hardcoded JS strings.

### Removed

- **Orphaned legacy CSS:** Deleted the dead `#bib-window-user-*` block in `styles/default.css` left over from the removed private chat window.

## [13.2.0]

### Added

- **Unified Messages window:** Party and private messaging completely redesigned as a single Regent-style conversation window (Application V2, built on Blacksmith's `BlacksmithWindowBaseV2` + zone template, opened via `api.openWindow('bibliosoph-messages')` from a single "Messages" toolbar button). Full back-and-forth conversations happen inside the window — the Foundry chat log is never touched, so conversations survive session chat wipes.
- **Journal-backed conversations:** Each conversation is a JournalEntry in a hidden "Bibliosoph Messages" folder with one JournalEntryPage per message. Members get OWNER permission; delivery/live sync ride on Foundry document hooks (no ChatMessages, no chat DB bloat). Sockets are used only to relay conversation create/edit requests to the GM (Blacksmith Sockets API with targeted `recipients`, requires Blacksmith >= 13.8.5).
- **Conversation tray (left panel):** Two zones separated by a dim rule — group chats on top (Party pinned first, then groups by activity), player chats below (one 1:1 row per user with their avatar, GMs first). 1:1 rows are virtual until first use; the journal document is created lazily on first message.
- **Party conversation:** Auto-created singleton that always includes every user; its name follows the Blacksmith Campaign API party name (fallback "Party Chat") and cannot be renamed in the editor.
- **Conversation management:** New Conversation picker with member selection, custom name, icon picker (16 icons), and tint color; right-click a conversation for Edit (name/icon/tint/members; GM or creator) and Delete (with gating; Party protected). Membership edits rewrite document ownership via the GM relay.
- **Messages:** Markdown support (with formatting help tooltip on a `?` icon), tone stamps (Message, Party Plan, Agree, Disagree, Praise, Insult), player-color accents on each message card, ENTER-sends toggle, drafts preserved across live updates.
- **Reactions:** Right-click a message → React (Like, Dislike, Love, Laugh, Huh?) via the Blacksmith context menu (`api.uiContextMenu`) with reaction chips (count, names on hover, click to toggle yours).
- **Reply:** Right-click a message → Reply quotes it into the compose box as a markdown blockquote.
- **Delete message (soft):** Right-click your own message (or any, as GM) → Delete wipes content/reactions from the document and leaves a dimmed "Message deleted" placeholder in the thread.
- **Send to Foundry Chat:** Per-message escalation (hover icon or context menu) posts that message to the Foundry chat as a Blacksmith-structured chat card (`.blacksmith-card` + theme from the Chat Cards API); group escalations whisper to members, party escalations post publicly.
- **Drag & drop:** Drop items, actors/tokens, journals, roll tables, etc. into the window to insert an `@UUID` content link (built with `api.compendiums.formatLink`); drop image paths/URLs to insert a markdown image.
- **Images in messages:** Markdown `![name](path or URL)` renders inline (sanitized; http(s)/relative paths only); click any image for a full-size popout.
- **Notifications:** Blacksmith menubar notification "Message from X" (30s) when a message arrives while away; "N Unread Messages" notification on login; unread badges per conversation from per-user read tracking.
- **On-screen splash:** Click-through splash (sender avatar + "Message from X", auto-dismiss, click to open the conversation) for direct messages and party/group messages, each behind its own user setting (`messageSplashEnabled`, `messageSplashGroupEnabled`, both default on). Group splashes name the conversation.
- **Auto Open:** Optional user setting (`messageAutoOpen`) that opens the Messages window on the incoming conversation when a message arrives while it is closed; also toggleable from the window's action bar.
- **Message sounds:** Five user-configurable local sounds — Alert (arrives while away), Received (posts in the open conversation), Sent, Switch Conversation, Close Window — with a mute toggle in the window's action bar (`messageSound*` settings).
- **Action bar tools:** Mute, Auto Open, Export Messages (standalone dark-themed HTML download of the conversation history), and Delete Messages (purge all messages with a confirmation dialog; GM anywhere, members on their 1:1s, creators on their groups).
- **Retention:** `retentionMaxMessages` world setting (default 200 per conversation, GM-adjustable); oldest messages trim automatically as new ones post.
- **GM visibility setting:** `gmSeesAllConversations` (world, default on) controls whether the GM's window lists conversations the GM is not a member of.
- **Hide journal folder:** `hideMessagesJournal` world setting (default on) hides the conversations folder and entries from the journal sidebar via injected CSS that survives sidebar re-renders.
- **Menubar button:** Messages also opens from the Blacksmith menubar (left zone, next to Squire's Quick Note icon) via `api.registerMenubarTool`.

### Changed

- **Blacksmith dependency:** `module.json` now requires `coffee-pub-blacksmith` >= 13.8.5 (targeted socket emit). New stylesheet loads via `@import` in `styles/default.css` per house convention.
- **Card theme settings:** `cardThemePartyMessage` / `cardThemePrivateMessage` kept but relabeled — they now style only the Send-to-Chat escalation cards and live under the Messages settings group.
- **Messages toolbar defaults:** The single Messages tool shows in both the Coffee Pub and Foundry toolbars by default.

### Removed

- **Legacy party/private messaging:** `BiblioWindowChat` (V1 FormApplication) and `dialogue-messages.hbs` deleted; both dialog openers, macro bindings and handlers, the chat-card Reply button, whisper send path, `buildPlayerList`/`buildPrivateList` and related helpers, `MESSAGES_*`/`CARDTYPEMESSAGE`/`CARDTYPEWHISPER` globals, and the two legacy toolbar buttons. Settings removed: `partyMessageEnabled`, `privateMessageEnabled`, both macro settings, both legacy toolbar setting pairs, `cardLayoutPrivateMessage`, `privateMessageCompressedWindow`. All roll-table features (criticals, fumbles, investigations, gifts, shady goods, inspiration, beverage/bio breaks, insults, praise, injuries, DOMT) are unaffected.

## [13.1.5]

### Fixed

- **Blacksmith registration race:** Module registration no longer calls `BlacksmithModuleManager.registerModule` before Blacksmith has finished consumer setup. When Coffee Pub Blacksmith is active, the `Hooks.once('ready')` handler awaits `BlacksmithAPI.waitForReady()`, then registers using `game.modules.get('coffee-pub-blacksmith').api` (`api.registerModule` or `api.ModuleManager.registerModule`) with a final fallback to `BlacksmithModuleManager`. Prevents `TypeError: Cannot read properties of null (reading 'registerModule')` when Bibliosoph’s `ready` ran before window globals or before older Blacksmith builds assigned `module.api`.

- **False “Blacksmith API not fully initialized” on startup:** The main `Hooks.on('ready')` handler now awaits `BlacksmithAPI.waitForReady()` when Blacksmith is active before checking `BlacksmithUtils`, so settings and notifications are not skipped just because `ready` fired early relative to `markReadyForConsumers()`.

## [13.1.4]

### Added

- **Quick Encounter Exclude section:** New "Exclude" section below Include with comma-separated monster names. Matching monsters are filtered out of Recommend and Roll results (e.g. "dragon, lich" excludes them from suggestions). Same substring matching and recent-chip quick-add as Include; registered setting `quickEncounterRecentExcludeNames` for recent exclude list.
- **Quick Encounter Remember checkboxes:** Right-aligned "Remember" checkbox for both Include and Exclude. When checked, the current value is saved and auto-fills when the window is opened again; values are also saved when running Recommend or Roll. Settings: `quickEncounterRememberInclude`, `quickEncounterRememberedIncludeText`, `quickEncounterRememberExclude`, `quickEncounterRememberedExcludeText`.
- **Quick Encounter open-sheet button:** Feather icon in the upper-left of each result card opens that creature's sheet when clicked (uses `fromUuid` + `sheet.render(true)`).

### Changed

- **Quick Encounter layout:** Main config panel (Habitat, Include, Exclude, etc.) is fixed width (550px) when the results tray is visible; the results/deploy tray flexes with the window. When the tray is hidden, main still fills the window.
- **Quick Encounter Include/Exclude row:** Clear (×) button is back inside the input; Remember checkbox remains to the right of the input. Input and clear are wrapped in `.window-encounter-section-input-inner` with the clear absolutely positioned over the input.
- **Quick Encounter window size:** Minimum width 900px and minimum height 575px for the Quick Encounter window.
- **Quick Encounter Roll for Detection:** The dice button now uses the Blacksmith Request a Roll API with `groupRoll: false` and `onRollComplete`. When all party Perception rolls are in, the average of roll totals is computed and the Detection slider is updated automatically: average 0–3 → Surprised, 4–8 → Outmatched Awareness, 9–12 → Mutual Awareness, 13–16 → Tactical Advantage, 17–20 → Undetected. Helper `getDetectionLevelFromAverageRoll()` added in `const.js`.
- **Settings group order:** Config groups now appear in this order: GENERAL, ENCOUNTERS, INJURIES, SPECIAL ROLL TABLES, COMMUNICATIONS.
- **Investigations section:** Investigations is its own top-level section (H2) below Encounters; removed from under Special Roll Tables. Redundant H3 "Investigations" heading removed. H3 "Currency" added above "Odds of finding coins"; H3 "Items" added above "Odds of finding items". New keys: `headingH2Investigations`, `headingH3Currency`, `headingH3Items`.
- **Encounters settings order:** "Card Style" and "Odds of encounter" moved below "Show in Foundry toolbar" in the Encounters section.

## [13.1.3] - Quick update

## [13.1.2]

### Added

- **Card theme settings for Gift and Shady Goods:** `cardThemeGift` and `cardThemeShadygoods` are now registered in settings and localization. These were previously referenced in `createChatCardSearch` but not registered, causing "not a registered game setting" errors when rolling Gift or Shady Goods cards.

### Changed

- **Toolbar zones:** Tools now use valid Blacksmith toolbar zones. Inspiration, Shady Goods, and Gifts moved to `rolls`; Praise, Insults, Bio Break, and Beverage Break moved to `communication`; Quick Encounter moved to `gmtools` (GM-only).
- **Toolbar order:** Sequential ordering (1–7 for rolls, 1–6 for communication, 1 for gmtools) so Bibliosoph tools stay grouped and other modules' tools do not appear between them.
- **Chat card action labels:** Removed all prepended labels ("Action", "Card") before UUID links on roll table cards. Critical, Fumble, Inspiration, Insults, Praise, DOMT, Beverage, Bio, and message variants now display only the UUID link (e.g. `@UUID[Item.xxx]{SNAKE OIL}`) with no word before it.

### Fixed

- **`strRollTableName` ReferenceError:** Declared `strRollTableName` at the top of `publishChatCard()` so it is defined before use. In strict mode (ES modules), assigning to an undeclared variable threw a ReferenceError when rolling Critical Hit and other roll table cards.
- **Invalid toolbar zone:** Replaced the invalid `roleplay` zone with `rolls` and `communication`. The Blacksmith Toolbar API only supports `general`, `rolls`, `communication`, `utilities`, `leadertools`, and `gmtools`; tools in `roleplay` did not appear in the toolbar.

## [13.1.1]

### Added

- **Wildcard token path resolution:** `resolveWildcardPath` resolves glob patterns (e.g. `arch-hag-*.webp`) to concrete files via `FilePicker.browse`. `getActorTokenImg` is async and resolves wildcards with random selection when multiple variants exist; resolved paths are cached at build time so encounter cards and recommendations use real file paths.

### Changed

- **Encounter card owner display:** Exclude GMs when resolving the character owner so the encounter card shows the actual player owner (e.g. Alicia Panicucci) instead of a GM (e.g. CursorAI).
- **Cache building spinner:** Replaced Font Awesome `fa-spin` with custom CSS animation (`window-encounter-spin`) for cache building and results loading spinners so they animate reliably in all contexts.
- **Encounter window header background:** Fixed variable name (`--notes-banner-image` → `--encounter-banner-image`) and applied background image to both `.window-header` and `.window-encounter-header` with proper `background-size`, `background-position`, `background-repeat`, and `background-blend-mode`.
- **line-clamp compatibility:** Added standard `line-clamp` property alongside `-webkit-line-clamp` for result card name truncation.
- **Quick Encounter cache gate:** Recommend, Roll, and Include now require a built monster cache; when absent, they show a "Cache required" notification instead of scanning compendiums implicitly.

### Fixed

- **Monster portrait fallback:** When a monster has no portrait, use `portrait-noimage.webp` in encounter cards and the encounter window.
- **Empty images on encounter cards:** `getActorTokenImg` returns `NO_IMAGE_PORTRAIT` when doc is null, when wildcard resolution fails, or when path is empty; encounter window recommendations use `noImagePortrait` fallback when `r.img` is empty.
- **Header background image not showing:** Wrong CSS variable reference caused background image to not display.
- **Quick Encounter slider churn:** Settings are no longer saved on every slider `input` event; values persist on change only, reducing settings DB spam during drags.
- **Combat assessment spam:** Encounter window fetches combat assessment once per session instead of on every render, avoiding repeated API calls and console noise.

## [13.1.0]

### Added

- **Quick Encounter Target Encounter CR label:** Visible label "Target Encounter CR" above the target CR slider.
- **Quick Encounter recent include list:** Names entered in Include and used (Recommend or Roll) are added to a "recent" list below the input. Clicking a recent item adds it to the Include field; clicking × removes it from the list. The recent list is persisted (client setting) until items are removed.
- **Quick Encounter include clear button:** A × button inside the Include input clears the field.
- **Quick Encounter Monster Gap overage:** When total monster CR exceeds the target, the MONSTER GAP box shows the overage (e.g. "+18") with flashing styling so the GM sees they are over budget.
- **Quick Encounter difficulty during drag:** The difficulty badge (Trivial, Easy, Moderate, etc.) updates live as the Target Encounter CR slider is dragged, without releasing the mouse.
- **Quick Encounter Detection levels:** Detection slider (1–5) maps to named levels: Surprised, Outmatched Awareness, Mutual Awareness, Tactical Advantage, Undetected. Each level has a tooltip and narrative text shown on the encounter chat card below Adversaries.
- **Quick Encounter Roll for Detection:** Clickable dice icon on the Detection header opens Blacksmith's Request a Roll dialog (Perception, DC 15, party filter) via the Request Roll API.

### Changed

- **Quick Encounter tray:** Results/deploy tray now shows by default so the two-column layout is visible from the start.
- **Quick Encounter results grid:** Cards stack from the top when there are few results (`align-content: start`).
- **Quick Encounter cache header:** Cache status and Refresh button are on one line (e.g. "Cache: 939 Monsters [Refresh]").
- **Quick Encounter Target CR slider:** Steps in whole numbers only (step 1); value is rounded and stored as an integer.
- **Quick Encounter deploy:** Clicking a deploy pattern button (Sequential, Circle, Line, Scatter, Grid) closes the Quick Encounter window so the canvas is visible for placing tokens.
- **Quick Encounter Detection display:** Slider shows the detection level label (never the number) and updates live as you drag. Detection section CSS classes renamed from odds-related to detection-related (`window-encounter-detection-*`).
- **Quick Encounter encounter card:** Detection narrative appears below Adversaries with the level label (no number) and paragraph text.
- **Notifications:** All notifications use Blacksmith's `postConsoleAndNotification` API directly; the former common.js wrapper was removed. Notifications are never permanent.

### Fixed

- **Quick Encounter result card selection:** Result cards and count buttons now have the correct `data-encounter-role` and `data-encounter-action` attributes so clicking cards toggles selection and ± adjusts count.
- **Quick Encounter include input:** Include field value is synced from the DOM when Recommend/Roll runs and via a document-level `input` listener so the value is read correctly (fixes cases where activateListeners may not run with Application V2/PARTS).
- **Quick Encounter habitat buttons:** Habitat buttons now have `data-encounter-role="habitat"` so clicking them selects the habitat.
- **Quick Encounter overage display:** Overage is shown only in the MONSTER GAP box as a single number (e.g. "+18") with flash; fixed missing `encounterCROver`/`encounterOverageDisplay` variable declarations in getData.
- **Manager encounters:** Removed stray `}` that caused "Illegal return statement" in `openEncounterWindow`.

## [13.0.10]

### Added

- **Quick Encounter deploy card with monster list:** When you deploy after a roll-for-encounter, a single chat card is posted that lists the selected monsters (name, count, CR, optional image) and states that they have been placed. No separate intro card is posted at roll time.

### Changed

- **Quick Encounter workflow:** Roll → encounter → select monsters → deploy. On deploy, one card is generated (narrative + monster list) and tokens are placed at the same time. The intro card that previously appeared when an encounter was rolled is no longer posted; the only encounter card is the deploy card with the monster list.
- **Encounter card template:** `buildEncounterCardData` accepts an optional `encounterMonsters` array; the encounter card template renders an "Encounter" section with monster rows (display name, CR) when present. Deploy card copy updated to "The following have been placed on the canvas."
- **Quick Encounter candidate filter:** When building the cache and when loading candidates, actors excluded from encounters: CR 0, vehicles, players (character type), and non-NPC types. Only NPC-type actors with CR &gt; 0 are used for Recommend and Roll.
- **Quick Encounter notifications:** Notifications from the encounter manager (e.g. no compendiums, narrative load failure) are now normal and no longer stay open (show briefly then dismiss).

## [13.0.9]

### Added

- **Quick Encounter cache:** Monster data can be built and stored in a world-level cache for fast Recommend and Roll. Use "Refresh cache" in the encounter window header to build or update; status line shows count (e.g. "Cache: 1073 monsters"). When the cache is valid, Recommend and Roll use it instead of loading compendiums on each action.
- **Quick Encounter deploy by pattern:** Clicking a deployment pattern (Sequential, Circle, Line, Scatter, Grid) now deploys directly with that pattern; the separate "Deploy selected" button was removed.
- **Quick Encounter selection indicator:** Selected result cards show a checkmark badge and stronger styling (orange-tinted border/background). Selection is seeded when results load (Roll or Recommend); you can toggle cards to include or exclude them from deploy.

### Changed

- **Quick Encounter header:** The duplicate "Close" button was removed (title bar close remains). "Refresh cache" was moved into the header where Close was.
- **Quick Encounter sliders:** CR slider track and thumb now match the Odds slider (purple/magenta track, white square thumb). Both sliders update the displayed value live during drag without full re-render for better responsiveness; full re-render and save happen on mouseup (change).
- **Quick Encounter odds display:** "Odds of encounter" value updates live while dragging. Fixed "0%" and "100%" endpoints sit at the slider ends and use the same visual style as the CR slider endpoints (matching icon row).
- **Quick Encounter selection and deploy:** Selection is driven by `_selectedForDeploy` for both built encounters and recommend lists; built encounters are seeded as all selected so you can deselect before deploy. Deploy uses only selected cards (and their counts for built encounters). Deploy pattern buttons are enabled whenever there are recommendations (Handlebars context fixed with `../hasDeploySelection`).
- **Quick Encounter Recommend:** CR band widened (target ±8) and a fallback added: if no monsters fall in band, the list shows the closest by CR so Recommend always returns results when the cache has habitat matches.
- **Quick Encounter event handling:** Delegation runs on document and only handles events inside the encounter window root; all handlers use a captured `self` reference so `_onRollForEncounter`, `_onRecommend`, `_onDeploy`, etc. are called correctly. Data attributes are read with `getAttribute` for reliability.

### Fixed

- **Quick Encounter class leak:** `DEFAULT_OPTIONS` for the encounter window was merged with `mergeObject(..., { inplace: true })`, which mutated the base Application defaults and applied `window-encounter` and `bibliosoph-window` to every Foundry dialog. Merges now use `{ inplace: false }` so only the Quick Encounter window gets those classes.

## [13.0.8]

### Changed

- **Release workflow:** The GitHub Actions release zip now includes the `resources/` folder so that `investigation-narrative.json` and other resources are bundled in the published module.

## [13.0.7]

### Added

- **Investigation narrative:** Titles and descriptions now come from `resources/investigation-narrative.json`. Entries in `foundNothing` and `foundSomething` are chosen at random; each entry supports `title`, `description`, `tags`, and optional `icon` (HTML, e.g. Font Awesome).
- **Investigation coins:** Optional coin finding with its own roll.
  - New setting: Odds of Finding Coins (0–100, default 20). Roll 1d100; on success, amounts are rolled from 0 up to each max and added to the character's purse (D&D 5e currency).
  - New settings: Max Platinum, Max Gold, Max Silver, Max Electrum, Max Copper (0–100 each, with defaults 0, 10, 45, 10, 100).
  - Card shows a Coins section and a summary line when coins are added.
- **Investigation rarity weightings:** Per-rarity roll tables (Common, Uncommon, Rare, Very Rare, Legendary) and weightings on a 0–1000 scale (step 1). Weightings are normalized to pick rarity for each slot; defaults 800, 200, 50, 20, 1 so Legendary is very rare.
- **Investigation card layout:** Items grouped by rarity with section headers and icons (Common: box, Uncommon: treasure-chest, Rare: axe-battle, Very Rare: trophy, Legendary: gem, Other: crate-apple). Long item names show an ellipsis when they overflow.
- **Investigation player skill bonus:** New setting "Use Player Skill Bonus" (default on). When enabled and the game system is dnd5e, the find-items roll becomes 1d100 + Intelligence modifier + Proficiency; items are found when that total is greater than (100 − Odds of Success). When disabled, behavior is unchanged (1d100, find when total ≤ Odds of Success).
- **Investigation notification:** A short notification ("Running investigation check...") is shown at the start of an investigation so users know the check is running.
- **Localization:** New keys for investigation coins (labels, hints, summary messages), investigation notification, and rarity weighting labels/hints.

### Changed

- **Investigation flow:** Replaced with narrative + slots + per-rarity tables. Find-items uses one 1d100 (or 1d100 + INT + PROF when player skill is on); then 1dN slots (N = Upper Limit of Items); for each slot, rarity is chosen by weighted bands and one item is rolled on that rarity's table and added to inventory.
- **Investigation narrative logic:** "Found something" narrative is used whenever the character finds coins or items (or both). "Found nothing" is used only when they find neither.
- **Rarity settings:** Renamed from "odds" to "weightings" in the UI; scale changed from 0–100 (step 0.5) to 0–1000 (step 1) for finer control. Defaults updated to 800, 200, 50, 20, 1.
- **createChatCardSearch:** Now used only for Gift and Shady Goods (single table roll, single item). All investigation-specific logic removed.
- **README:** Updated with current features, product screens (encounters, investigation, party message, private message), v13-only requirements, and no emoticons.

### Removed

- **Legacy investigation:** Use of the single `investigationTable` setting; dependency on "Search Descriptions: Nothing", "Before", "Reveal", and "After" roll tables. Narrative is only from `investigation-narrative.json`; item flow uses per-rarity tables and weightings.

## [13.0.6]

### Fixed
- **Macro Bindings:** All Bibliosoph macro bindings now work with Blacksmith safe settings and macro IDs/UUIDs.
  - Rebound every macro type (encounters, investigations, gifts, shady goods, crits, fumbles, inspiration, DOMT, beverage/bio/insult/praise, party/private messages, injuries) using a centralized binder with fresh `BlacksmithUtils.getSettingSafely` reads.
  - Macro resolution now accepts id/UUID/name and retries binding (immediate + delayed) to handle late-loaded settings.
  - Added `MACRO FIX` console traces for bind/execute to aid troubleshooting.

### Changed
- **Settings Access:** Standardized all runtime settings reads in macro binding to use Blacksmith’s `getSettingSafely` helper via the existing `getSetting` wrapper.

## [13.0.5]

### Changed
- **Chat Cards:** Migrated all cards to the unified Chat Cards system in Coffee Pub Blacksmith
  - All card types (general, injury, injury selector, encounter, investigation) now use the shared Blacksmith card structure, theme API, and styling
  - Card template uses `blacksmith-card` and theme from Blacksmith's `getCardThemeChoicesWithClassNames()`; settings provide theme choices from Blacksmith
- **Chat Card Section Content:** The actions/buttons section of the chat card now only renders when it has content
  - Wrapped the section-content block in `{{#if hasSectionContent}}` in the chat card template
  - Added `hasSectionContent` to card data in general cards (action text or private recipients), injury apply cards (effect data), and injury category selector cards (category buttons)
  - Cards without actions, injury buttons, or reply options no longer show an empty section-content area

## [13.0.4] 

### Changed
- **Markdown Conversion:** Switched to Blacksmith API markdown conversion for message content
  - Replaced local `markdownToHtml` with `BlacksmithUtils.markdownToHtml`
  - Removed the local markdown utility to keep behavior centralized

## [13.0.3] - GM-Only Encounters & User Scope Migration

### Changed
- **Encounter Buttons:** All encounter toolbar buttons are now GM-only
  - Added `gmOnly: true` to all 10 encounter button configurations (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)
  - Players can no longer see or access encounter buttons in the toolbar
  - Only Game Masters can trigger random encounters
- **Encounter Settings:** All encounter-related settings are now GM-only
  - Added `restricted: true` to all encounter settings in the module configuration
  - Players can no longer see encounter settings in the module settings UI
  - Includes: global encounter settings, all encounter type settings, toolbar preferences, tables, and macros
- **Settings Scope Migration:** Migrated user preference settings from `scope: 'client'` to `scope: 'user'` (Foundry v13)
  - All toolbar visibility preferences (`toolbarCoffeePub*Enabled` and `toolbarFoundry*Enabled`) now use `scope: 'user'`
  - UI layout preferences (`privateMessageCompressedWindow`, `showDiceRolls`) now use `scope: 'user'`
  - Settings now persist across devices for each user, following them when they log in from different machines
  - Total of 32 settings migrated to user scope

### Technical
- **Foundry v13 User Scope:** Leverages new `scope: 'user'` feature introduced in FoundryVTT v13
  - User scope settings are per-user, per-world, and persist across devices
  - Replaces client scope for personal preferences that should follow the user
  - Maintains client scope for visual separator headings (no meaningful data)

## [13.0.2] - Dice Roll Control

### Added
- **Dice Roll Toggle:** Added `showDiceRolls` setting to control whether virtual dice are rolled when cards are generated
  - Client-scoped setting (per-user preference)
  - Default: enabled (true)
  - Requires Dice So Nice module for visual dice effects
  - Applies to all card types: encounters, investigations, injuries, and general roll tables
- **Private Message Compressed Layout:** Added `privateMessageCompressedWindow` setting for compact recipient display
  - Client-scoped setting (per-user preference)
  - Default: disabled (false)
  - When enabled, shows only portrait images in horizontal row (similar to party message buttons)
  - When disabled, shows full recipient cards with names and character info (3 per row)

### Changed
- **Settings Organization:** Reorganized settings structure with new "General" section
  - Added `headingH2General` heading for better settings organization
  - Moved dice roll setting to General section
- **Party Message Dialog Layout:** Moved message type buttons to horizontal row at top of dialog
  - Changed from vertical column on left side to horizontal flexbox layout at top
  - Buttons (Party Message, Party Plan, Agree, Disagree, Praise, Insult) now display in a row
  - Improved visual organization and user experience
- **Private Message Dialog:** Improved layout and functionality
  - Window width set to 600px for better sizing
  - Non-compressed layout displays 3 recipients per row with full details
  - Compressed layout displays portrait images that wrap naturally
  - Reply button in chat cards now spans full width

### Fixed
- **Dice Roll Control:** All virtual dice rolls now respect the `showDiceRolls` setting
  - Updated 7 dice roll locations to check setting before rolling
  - Applies to: general cards, injury cards, encounter checks, encounter monster quantity, investigation checks, investigation item quantity, and roll table results
- **Private Message Recipients:** Fixed recipient list to only show party members
  - Now filters to only display users with assigned characters (party members)
  - Excludes observers and users without characters
  - Improves clarity of who can receive private messages
- **Private Message Reply Functionality:** Fixed reply button to properly pre-select recipients
  - Reply button now correctly opens dialog with recipients pre-selected
  - Fixed recipient array handling to ensure proper selection state
  - Fixed compressed mode portrait sizing when replying
  - Selection state now handled consistently in activateListeners

### Removed
- **Debug Logging:** Removed all debug logging statements from production code
  - Removed DEBUG statements from injury card creation function
  - Removed button HTML matching debug code
  - Removed metadata extraction debug logging
  - Cleaned up console spam for cleaner production experience

## [13.0.1] - Quick Fix
### Fixed
- **Logging:** Was passing the wrong parameter to the loggin tool.

## [13.0.0] - v13 Migration Complete

### Important Notice
- **v13 MIGRATION COMPLETE:** This version completes the migration to FoundryVTT v13
- **Breaking Changes:** This version requires FoundryVTT v13.0.0 or later
- **v12 Support Ended:** v12.1.3-FINAL was the last version supporting FoundryVTT v12

### Changed
- **Minimum Core Version:** Updated to require FoundryVTT v13.0.0
- **Module Version:** Bumped to 13.0.0 to align with FoundryVTT v13
- **Compatibility:** Module now exclusively supports FoundryVTT v13

### Fixed
- **jQuery Removal:** Migrated all jQuery code to native DOM APIs
  - Converted `html.find()` to `querySelector()` / `querySelectorAll()`
  - Replaced jQuery event handlers (`.on()`, `.click()`) with `addEventListener()`
  - Updated jQuery DOM manipulation (`.append()`, `.val()`, `.attr()`, etc.) to native methods
  - Added jQuery detection patterns for FormApplication compatibility during migration
- **Font Awesome Migration:** Updated all Font Awesome 5 references to Font Awesome 6
  - Changed all `fas` class prefixes to `fa-solid` in JavaScript and templates
  - Updated 20 toolbar icon definitions in `manager-toolbar.js`
  - Updated 11 icon references in Handlebars templates (`chat-card.hbs`, `dialogue-messages.hbs`)
- **Toolbar Registration:** Fixed toolbar tools not appearing in Coffee Pub and Foundry toolbars
  - Moved `registerToolbarTools` import to top of file for proper scope
  - Added retry logic with multiple attempts to ensure Blacksmith API is ready
  - Improved error handling and logging for toolbar registration
- **Encounter Type Bug:** Fixed all encounter buttons rolling General encounters
  - Updated all `trigger*EncounterMacro()` functions to set correct `BIBLIOSOPH.CARDTYPE` value
  - Changed from always setting "General" to setting specific types (Cave, Desert, Water, etc.)
- **TableResult UUID:** Fixed links pointing to TableResult instead of actual documents
  - Changed from using `rollResults.results[0].uuid` (TableResult UUID) to `rollResults.results[0].documentUuid` (document UUID)
  - Links now correctly point to the actual Actor/Item documents referenced by roll tables
- **Deprecated API Usage:** Fixed deprecation warnings for TableResult properties
  - Updated from deprecated `TableResult#text` to `TableResult#name` or `TableResult#description`
  - Updated from deprecated `TableResult#documentCollection` and `TableResult#documentId` to `TableResult#documentUuid`
  - Added fallback support for v12 compatibility during transition

### Technical
- **jQuery Detection:** Added transitional jQuery detection patterns in FormApplication classes
  - Created `_getNativeElement()` helper method for consistent jQuery handling
  - Added detection in `activateListeners()` and Dialog callbacks
  - Marked as technical debt to be removed after all call sites are confirmed native DOM
- **UUID Parsing:** Improved UUID parsing to handle pack names with dots
  - Added regex-based parsing for compendium UUIDs
  - Added fallback to Foundry's `foundry.utils.parseUuid()` utility
  - Enhanced error handling for invalid UUID formats
- **Logging:** Added comprehensive logging for UUID link creation
  - Logs document UUID, link string, and name for debugging
  - Separate logging for encounter and investigation card creation
  - Logs fallback paths when deprecated properties are used

## [12.1.3] - Final v12 Release

### Important Notice
- **FINAL v12 RELEASE:** This is the final build of Coffee Pub Bibliosoph compatible with FoundryVTT v12
- **v13 Migration:** All future builds will require FoundryVTT v13 or later
- **Breaking Changes:** Users must upgrade to FoundryVTT v13 to use future versions of this module

### Changed
- **Documentation Updates:** Updated README.md and module.json to reflect v12.1.3 as the final v12 release
- **Compatibility Notice:** Added clear notice that v12.1.3 is the last version supporting FoundryVTT v12
- **Migration Preparation:** Module is now locked for v12 compatibility; v13 migration work will begin in next version

### Technical
- **Version Lock:** Module version locked at 12.1.3-FINAL for v12 compatibility
- **Future Development:** All development moving forward will target FoundryVTT v13 exclusively

## [12.1.2] - Toolbar Integration

### Added
- Complete toolbar integration with Coffee Pub Blacksmith
- 23 toolbar tools across 3 zones (communication, rolls, roleplay)
- Toolbar visibility controls for Coffee Pub and Foundry toolbars
- Support for all existing Bibliosoph features in toolbar format

#### Communication Tools
- Party Message dialog
- Private Message dialog

#### Roll Tools
- Investigation rolls
- Critical Hit rolls
- Fumble rolls
- Injuries (GM only)
- All 10 encounter types (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)

#### Roleplay Tools
- Beverage Break messages
- Bio Break messages
- Random Insults
- Random Praise
- Random Gifts
- Shady Goods
- Inspiration

### Changed
- Moved toolbar settings to proper locations in module settings
- Toolbar checkboxes now appear directly below their respective "enable" checkboxes
- All encounter tools use "rolls" zone for proper toolbar organization
- Improved settings organization and user experience

### Fixed
- Toolbar buttons not showing due to incorrect API access pattern
- Timing issues with Blacksmith API initialization
- Missing toolbar visibility settings for encounters and injuries
- Duplicate settings entries in localization files

### Technical
- Created trigger functions for all encounter types and roleplay features
- Added proper window object exposure for all toolbar functions
- Implemented proper settings validation and error handling
- Added comprehensive localization strings for all toolbar settings
- Fixed zone assignment to use valid Blacksmith toolbar zones

## [12.1.1] - Bug Fixes

### Fixed
- Fixed playSound API calls to use direct Blacksmith API access instead of helper functions
- Updated all 5 playSound calls in chat card functions to use `getBlacksmith()?.utils?.playSound()` pattern
- Removed unnecessary playSound helper function wrapper

### Technical
- All playSound calls now follow the same direct API pattern as other Blacksmith utilities
- Maintains consistency with rollCoffeePubDice and other API integrations

## [12.1.0] - MAJOR UPDATE - Blacksmith API Migration

### Added
- Full integration with Coffee Pub Blacksmith API
- Safe settings access using `getSettingSafely()` and `setSettingSafely()`
- Dynamic access to shared choice arrays (themes, macros, tables, compendiums, sounds, etc.)
- Module registration system with Blacksmith
- Real-time updates via `blacksmithUpdated` hook
- Consolidated validation system for mandatory settings
- Enhanced error handling and fallback systems

### Changed
- Migrated from custom `global.js` utilities to Blacksmith API
- Updated all console logging to use Blacksmith's `postConsoleAndNotification`
- Replaced static choice arrays with dynamic Blacksmith data
- Improved module initialization timing using proper Foundry hooks
- Enhanced settings validation and user feedback

### Removed
- Dependency on `global.js` file
- Static choice arrays and hardcoded defaults
- Individual validation notifications (replaced with consolidated system)
- Old utility functions replaced by Blacksmith equivalents

### Fixed
- Module startup crashes due to timing issues
- Settings not populating with available choices
- Multiple notification spam for missing settings
- Hardcoded default values not respecting Blacksmith configuration

### Technical
- Uses `Hooks.once('ready')` for proper initialization timing
- Implements `Hooks.on('blacksmithUpdated')` for real-time data updates
- Provides graceful fallbacks when Blacksmith API is unavailable
- Maintains backward compatibility during transition

## [0.1.03] - 2024 Initial Release

### Added
- Initial release of Coffee Pub Bibliosoph
- Card formatting system for journal entries
- HTML Blockquote integration
- Custom styling for narrative cards
- Chat window integration
- Support for Foundry VTT v11 and v12

## [0.1.02] - Settings and Controls

### Added
- Settings for cards
- Margin controls for fine-tuning card alignment in chat
- Unified card themes

## [0.1.01] - Basic Styling

### Added
- Basic styling

## [0.1.00] - Initial Release

### Added
- Initial module foundation
