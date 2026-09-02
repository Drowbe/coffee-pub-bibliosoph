# Architecture: Injuries

**Audience:** someone changing Bibliosoph's injury system, or authoring injury content for it.

How an injury is defined, authored, applied, ticked, and cleared. The pasteable prompt for writing new injuries is in [userguide-authoring-injuries](../userguides/userguide-authoring-injuries.md); this document is the contract behind it.

Injuries are authored wounds that attach to an actor as a real ActiveEffect, optionally convey a core condition, optionally bleed each turn, and end either by healing themselves or by a player passing a Medicine check.

Content lives in journal pages of subtype `coffee-pub-bibliosoph.injury`. Users author their own -- Bibliosoph ships a starter pack, but the system is content-driven, not hardcoded.

---

## The record

`scripts/data/injury-schema.js` is the single machine-readable definition, deliberately dependency-free so both sides import it: the Foundry runtime (data model, sheet, card) and the Node build tools. `tools/injury-schema.mjs` re-exports it rather than keeping a second copy.

| Field | Required | Meaning |
|---|---|---|
| `category` | yes | Damage type, or `general`. Determines which journal the injury lands in |
| `title` | yes | Display name, under 25 characters. Becomes the effect name on the token |
| `image` | yes | Foundry icon path, chosen per injury. There is no category default or fallback |
| `imagetitle` | yes | Short caption, under five words, shown beneath the art on the card |
| `description` | yes | The narrative, three to five sentences, second person |
| `treatment` | yes | Prose on how it may be tended. GM adjudication text |
| `severity` | yes | `minor` / `moderate` / `major`. Drives the treatment DC and bounds damage |
| `damage` | yes | One-time damage as a **percentage of max HP** |
| `duration` | yes | Seconds. For a `heal` injury this is its lifetime; for a `linger` injury it is the bleed phase. `0` is permanent |
| `statuseffect` | yes | Exactly one condition id, or `none`. Lowercase ids, never display names |
| `odds` | yes | Relative likelihood within its category, 1-100 |
| `treatmentdc` | no | Overrides the severity-derived DC |
| `tick` | no | Recurring damage per turn, percentage of max HP |
| `expiry` | no | `heal` or `linger` |
| `modifiers` | no | Become real ActiveEffect `changes` |
| `flavor` | no | Status text that is not a real condition |
| `gmnotes` | no | Never copied into chat -- players can read the DOM |

### Damage is a percentage, not hit points

Flat hit points could not be correct at both ends of the level range. An average major injury was 10.5 HP: lethal to a level-1 wizard with 8 max HP, and 7 percent of a level-15 fighter. A percentage is the same wound at every level.

| Severity | Damage band | Tick band | L1 wizard (8) | L5 rogue (38) | L15 fighter (140) |
|---|---|---|---|---|---|
| minor | 0-5% | 0-2% | 0-1 | 0-2 | 0-7 |
| moderate | 6-10% | 0-3% | 1 | 2-4 | 8-14 |
| major | 11-18% | 0-5% | 1 | 4-7 | 15-25 |

`damageFor(percent, hp)` resolves it per creature. **`DAMAGE_LEAVES_AT_LEAST = 1`**: percent damage is floored so an injury never drops a character below 1 HP. Injuries wound; they do not kill, and dying is what death saves are for. The floor applies to ticks identically, through `tickDamageFor()`.

### Legal values

**Categories (14)** -- the 13 dnd5e damage types plus `general`, the fallback for untyped or evenly-mixed damage:

`acid`, `bludgeoning`, `cold`, `fire`, `force`, `general`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`

**Conditions.** Curated from dnd5e's registry to those that make sense as a wound; the system registers others (`flying`, `concentrating`, `dodging`) that never should be.

| Group | Ids |
|---|---|
| Sense loss | `blinded`, `deafened`, `silenced` |
| Ongoing | `poisoned`, `diseased`, `bleeding`, `burning` |
| Movement | `prone`, `grappled`, `restrained` |
| Mental | `frightened`, `charmed` |
| Turn-denying | `stunned`, `paralyzed`, `incapacitated`, `unconscious`, `petrified` |
| Other | `exhaustion` (applies level 1), `none` |

`bleeding`, `burning` and `diseased` are **pseudo-conditions**: they cannot be toggled in dnd5e, so they ride on the injury effect's own `statuses` array. The applier handles that difference; authors name them like any other.

**Condition gating by severity.** `MAJOR_ONLY_CONDITIONS` (`paralyzed`, `incapacitated`, `unconscious`, `petrified`) and `MODERATE_PLUS_CONDITIONS` (`stunned`) prevent a minor scrape from conveying a fight-ending condition.

**Guidance bands** produce validator warnings rather than errors, and are calibrated to the authored corpus so a warning means a genuine outlier: odds -- minor 5-75, moderate 5-40, major 1-20. Duration -- minor 60-1800s, moderate 60-7200s, major 1800-86400s, or 0.

The validator, not this list, is the authority on conditions: it checks every value against the live `CONFIG.statusEffects` plus `CONFIG.DND5E.conditionTypes` at build time, so a system update that renames an id surfaces as a failed build rather than a silent no-op at the table.

### Modifiers

`modifiers` is an array of `{ stat, value, rounds }` applied as real ActiveEffect changes. `MODIFIER_STATS` is defined once, in the outcome schema, and re-exported here -- a -2 to attack rolls is the same mechanic whether a fumble or a broken arm caused it. Five stats map to genuine dnd5e paths: `attack`, `damage`, `ac`, `checks`, `saves`.

`rounds: 0`, the norm, means the penalty lasts as long as the injury. `MODIFIER_LIMITS` caps size by severity (minor 1, moderate 2, major 5) and warns past three modifiers: a wound that stacks four penalties is a spreadsheet, not a story.

`flavor` holds status text that is not a real dnd5e condition ("Confused", "Clumsy Fingers"). It applies nothing and shows on the card only when `statuseffect` is `none`; a real condition always wins.

Treatment DC falls back through: authored `treatmentdc`, then `SEVERITY_DCS` (minor 10 / moderate 15 / major 20), then a flat 15.

---

## Typed pages

Injury pages are the registered subtype `coffee-pub-bibliosoph.injury`, not text pages.

- `module.json` declares `documentTypes.JournalEntryPage.injury`. A world relaunch is required for Foundry to see a new document subtype.
- `scripts/data/injury-page-model.js` defines `InjuryPageModel extends TypeDataModel`. Every mechanical field lives in `page.system` with Foundry validating each write, including closed choice lists for category, severity, and condition. Derived getters cover `treatmentDC`, `actionLabel`, `categoryLabel`, and `record`.
- `scripts/sheets/injury-page-sheet.js` gives GMs a real editing sheet -- fields in edit mode, a formatted block in view mode. That sheet is the reason for the move: it is what lets users author their own injuries.
- The page's `name` is the title, never stored twice, and `text.content` is free-form GM notes.

The structure deliberately mirrors Squire's CODEX (`data/codex-page-model.js`, `sheets/codex-page-sheet.js`) so the two can be diffed and their common scaffolding extracted later.

**Read order at runtime** (`readInjuryRecord` in `scripts/bibliosoph.js`): `system`, then the page flag, then HTML metadata. Older packs keep working through the fallbacks.

---

## Authoring pipeline

```
resources/injuries.json      hand-editable, git-diffable source of truth
  -> validator               injuries:validate
  -> generator               page HTML + the record stamped as a flag
  -> packs/_source/injuries  generated output, never hand-edited
  -> packs:build             Foundry must be closed
  -> compendium
```

| Script | Does |
|---|---|
| `npm run injuries:validate` | Checks `resources/injuries.json`. Exits non-zero on error |
| `npm run injuries:generate` | Validate, generate the pack source, verify every page round-trips |
| `npm run injuries:build` | The above, then `packs:build` |
| `npm run content:build` | Injuries and outcomes together |

Journal and page ids change on rebuild, which is safe: lookup is by journal name (the category) and picks a page by weighted draw, and applied effects are snapshots that never reference the journal.

The generated page is built entirely from the record, so display and data cannot disagree: image, title, description, treatment, then the metadata block the parser reads.

### Validation

The validator fails the build on: a missing required field or an unknown one; a `category` outside the canonical 14 or a `severity` outside the three; a non-integer `damage`, `duration` or `odds`; `damage` outside its severity band; `odds` outside 1-100; a `statuseffect` that is neither `none` nor resolvable against the live registries; an empty `image`, or one whose file is not on disk; an `imagetitle` that is empty or five words or longer; a `title` that is not unique within its category, or reaches 25 characters; and a `treatmentdc` that is present but not a positive integer.

Warnings cover the guidance bands, oversized or over-numerous modifiers, and durations outside a severity's range.

---

## Importing

A GM can import injuries as JSON through Blacksmith's **Import JSON -> Journal** tool. Bibliosoph ships no importer of its own: it registers a *declaration* describing an injury, and Blacksmith builds, validates and lands the pages. Foundry namespaces the declaration of a page subtype, not its creation, so the registered data model validates whoever calls create.

`scripts/data/injury-import-profile.js` registers on `ready` (`scripts/bibliosoph.js`), after `BlacksmithAPI.waitForReady()`. A registration failure is reported loudly rather than at debug level: with no legacy import path left, a silent skip presents to a GM as an import tool that simply does not offer injuries, which is indistinguishable from the feature not existing.

The declaration is derived, not written:

```
api.importer.declarationFromModel(InjuryPageModel.defineSchema(), { guidance, examples, extraFields })
```

The walk lifts `choices` to legal values, `integer` to the type, `min`/`max` to bounds, `nullable`, and `initial` to the default, recursing through nested fields. Because it runs against `defineSchema()` on every build, the machine shape of the declaration **cannot** drift from the model -- add a condition to `CONDITIONS` and the declaration has it. That is the whole reason not to transcribe a schema by hand.

### The model is the validator; the declaration only describes it

Foundry runs `InjuryPageModel` on create, so it is the senior schema. The declaration is a description of it, and a description that omits something does not fail loudly: the page lands and every undescribed field silently takes the model's `initial`. For injuries that would mean a page with no `system.severity`, which the picker skips -- the import reports success and the data is invisible.

What the derived walk leaves exposed is everything it cannot derive. `npm run injuries:profile` is what checks those, in three passes:

| Pass | Proves |
|---|---|
| `declarationFromModel` | it is built from the model rather than transcribed |
| `validateDeclaration` | Blacksmith's registry will accept it -- its own function, imported from `api/validate-declaration.mjs`, never a local copy of its rules |
| `checkDeclarationMirrorsModel` | the human layer is complete, the document block is right, and the container names match the shipped compendium |

The middle pass exists because the other two can both pass while registration throws in a live world: a declaration can mirror its model perfectly and still violate the declaration *format*. Two schemas, one senior, nothing comparing them -- the same shape as the invariant above, one level up.

### What the walk cannot derive

**The human layer is the one that matters most**, and it is the only one that fails by simple absence. Guidance is one sentence per field, keyed by dotted path (`modifiers.value` reaches a nested field), feeding the template comment, the authoring guide and the generation prompt alike. A field with none reaches an author as a bare name with nothing attached, and nothing is broken anywhere.

Because the machine shape is now free, this is the gate's main job: a field added to `InjuryPageModel` appears in the declaration automatically and fails the build for having no guidance. It went from silently absent to loudly undocumented.

Three envelope fields have no model counterpart and are supplied as `extraFields`. Each registers cleanly and then fails quietly:

- **`journaltype`** (`role: 'selector'`, value `injury`) -- how a payload reaches this profile at all. Without it the profile registers and is unreachable, and the author sees an error about a field they never heard of.
- **`foldername`** (`role: 'input'`) -- without it every import lands at the root of the journal directory. Defaulting it to the root is *correct*: the shipped compendium journals carry `folder: null`, so an `Injuries` folder in a world is the GM's own organisation. Defaulting it to `Injuries` instead would make an import append into the GM's real journals, because destination matching is on name and folder together.
- **`title`** -> the page's `name`. The injury's title is the page name and is never stored twice in `system`.

And the `document` block, which nothing derives either: `documentName: 'JournalEntryPage'` (declaring `JournalEntry` produces an entry named after the injury, carrying a stray `system` object and no pages at all, which imports "successfully"), `type`, `containerNameFrom: 'category'` and `containerNameTransform`.

### Destination

Blacksmith matches an existing journal on name **and** folder, updates a page of the same name in place, and appends a new one. Name alone collides across folders: two campaigns each with a `Fire` journal are one journal by that test.

Import creates in the **world**. The GM then exports to a compendium, because the picker reads the compendium named by the `injuryCompendium` setting rather than the world.

### The two vocabularies

`journaltype` is REQUIRED in an import payload -- it is how Blacksmith resolves the profile -- and FORBIDDEN in `resources/injuries.json`, where `tools/validate-injuries.mjs` rejects it by name as a dropped field. The authoring source and the import payload are different representations of the same record, and neither is precedent for the other.

---

## How an injury starts

### Manual

Toolbar, then **Injuries**, opens the picker (`window-injury-picker.js`), a Blacksmith Tool window. Four ways out of it:

| Control | Result |
|---|---|
| an injury row, or its droplet | deals that exact wound -- no roll |
| `d20` on a category | `weightedPickRolled()` draws by `odds`, showing real dice when `showDiceRolls` is on |
| hand icon on a category | asks the target's player to roll, via the same armed toast the damage threshold sends |
| feather on a row | opens the authored journal page; the picker stays open |

### Automatic

`manager-injury-triggers.js` subscribes to Blacksmith's `rolls.on('damageResolved')`. When a single application of damage meets or exceeds the configured percentage of the target's max HP, it rolls an injury whose category matches the hit's dominant damage type.

The Blacksmith payload delivers the final amount, a typed breakdown, and an `hp {before, after, max}` snapshot, already correlated across dnd5e's `calculateDamage` and `applyDamage` split, and already relayed to the GM client. Bibliosoph does none of that correlation itself. Without a Blacksmith build carrying `damageResolved` the automatic path is dormant; the manual flow is unaffected.

---

## Applying it

Everything routes through one function: `applyStatusToTokens()` in `scripts/manager-status-effects.js`. Criticals, fumbles, and injuries all use it, and the contract is identical for every caller:

- Targets the targeted token or tokens, falling back to selected; warns if neither.
- Permission-aware -- you must own the target's actor.
- Duplicate-safe -- a token never gets the same-named effect twice.
- Carries name, image, and a description, so the effect sheet and dnd5e tooltips retain what the card said.
- Optional mechanics: one-time damage, duration, real ActiveEffect `changes`, and a core condition toggled via `Actor#toggleStatusEffect` validated against `CONFIG.statusEffects`.

Conditions are toggled through core Foundry, not through a third-party dependency. DFreds is used when present but never required.

### The flag

The created effect carries `flags['coffee-pub-bibliosoph'].outcomeBurst`:

```
{ kind, category, name, condition, tick, expiry, bleedSeconds, bleedStart, severity, dc, sourceUuid }
```

This single flag is load-bearing for four systems: the canvas burst, the tick ticker, the condition unwind, and the treatment card. `condition` records which core condition this affliction toggled, which is what makes clean removal possible.

---

## What it does over time

`manager-injury-ticks.js`, active GM only:

- **TICK** -- recurring damage at the start of the victim's turn, as a percentage of max HP. Only 8 of 144 injuries carry one, and the rule is deliberately narrow: an ongoing physical process -- still bleeding, still burning, poison working through you -- never a lasting consequence. "It hurts" is a modifier, not a tick.
- **EXPIRY** -- a `heal` injury's duration is its lifetime, and Blacksmith owns removing it. `EffectsAPI.sweepExpired()` decides when the clock has run out and either deletes the effect or yields that to Times Up, so exactly one actor deletes in every configuration. Bibliosoph subscribes to `effects.onExpired` purely to announce it, and never deletes on expiry.

Ticks are tied to combat turns, not the world clock. A wound that bleeds every six seconds of wall time while the party shops is bookkeeping; a wound that bleeds on your turn is a thing you feel. Both `updateCombat` and `updateWorldTime` are watched, and the active-GM guard exists because those hooks fire on every client -- HP applied five times because five people are logged in is the classic version of this bug.

### Why a lingering wound has no Foundry duration

Foundry's `duration` means how long the effect exists. For a lingering wound the authored duration means how long it bleeds -- the wound itself stays until somebody treats it. Writing a phase timer into the lifetime field told every correct consumer the wrong thing: Times Up converted it and deleted it at combat end, and Blacksmith's expiry sweep deleted it the moment the clock ran out. Both were reading the field exactly as specified.

So a `linger` injury is applied as permanent, which is what it is, and the bleed phase rides `bleedSeconds` and `bleedStart` on our own flag, where nothing can mistake it for a lifetime. When the phase ends the ticker clears `changes`, zeroes `tick`, and sets `lingering: true` -- the penalties lift, the wound stays. Seven of the eight ticking injuries use it.

During the bleed phase such an effect has no `durationLabel`, so displays show `2 HP/turn` with no countdown.

---

## How it ends

### The unwind hook

`registerConditionUnwindHook()` at [bibliosoph.js:3089](../../scripts/bibliosoph.js#L3089) listens on `deleteActiveEffect`, GM-authoritative. When a flagged affliction is deleted by any route, it collects `flag.condition` plus anything in `effect.statuses` and unwinds each -- unless another untreated affliction still conveys it, so two injuries that both cause Prone do not fight over it.

This is deliberately a hook rather than a callback other modules must invoke. The condition is cleaned up whether the injury was removed from the Check-Up card, Squire's status window, the actor sheet, the token HUD, or by its duration expiring. **No other module has to know Bibliosoph exists.**

`removeAffliction()` is the shared removal core. For non-Bibliosoph effects it stamps a `kind: 'treated'` flag just before deletion so the heal burst still plays on every client, then deletes. The unwind itself is left entirely to the hook, so the path is identical however the effect leaves.

### Treatment rolls

Players heal via Medicine checks, driven from the Check-Up card:

| Situation | Effect |
|---|---|
| Healer's kit | Advantage, DC -2 |
| Self-treatment | Disadvantage |
| Both | Normal, DC -2 |
| Natural 20 | Critical heal, +5 HP |
| Natural 1 | Fumbled heal, -5 HP |

Delivered through Blacksmith's `openRequestRollDialog` in silent mode, resolved GM-side on `blacksmith.requestRollComplete` with the full roll JSON. The request API cannot force advantage or disadvantage, so the required mode rides in the request title, the player clicks the matching button, and the GM resolver reads what was actually rolled from the roll formula, logging mismatches.

Attempts are tracked in a `treatAttempts` flag. `registerTreatmentRestReset()` clears them on `dnd5e.restCompleted`.

---

## Presentation

`manager-injury-effects.js` provides canvas bursts and sounds, played on every client via the `createActiveEffect` and `deleteActiveEffect` hooks: `playInjuryBurst`, `playCritBurst`, `playFumbleBurst`, `playTreatmentBurst`. Those four are also the module's public macro surface -- see [api-bursts](../api/api-bursts.md).

GM notes are surfaced through `utility-gm-notes.js` as tooltips on the card, painted only for GMs. Note text is never written into the chat card DOM.

---

## Boundaries

Bibliosoph owns what an injury is. It does not own:

- the condition vocabulary (`CONFIG.statusEffects`, core and system)
- the status effects UI (currently Squire's; see [architecture-ownership](../../../coffee-pub-blacksmith/documentation/architecture/architecture-ownership.md))
- damage correlation (Blacksmith `api.rolls`)
- toast delivery (Blacksmith `api.toast`)

Bibliosoph does not register its own `effects.registerClassifier`. Blacksmith ships a low-priority compatibility classifier on its behalf (`coffee-pub-blacksmith.bibliosoph-outcome`, `api-effects.js`) which qualifies on the `outcomeBurst` flag and translates it into display metadata.
