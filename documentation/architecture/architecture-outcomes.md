# Architecture: Outcomes (Criticals and Fumbles)

**Audience:** someone changing Bibliosoph's critical and fumble system, or authoring outcome content for it.

The shared name for criticals and fumbles: one system, one schema, one validator, one set of bands, two kinds. The sibling systems are [architecture-injuries](architecture-injuries.md) and [architecture-inspiration](architecture-inspiration.md).

Crits and fumbles already had mechanical teeth -- "the target is blinded for a round", "you drop your weapon", "-2 to attacks" -- but the teeth lived in prose on a roll-table row, so every one of them was something the GM had to read, remember, and adjudicate by hand. Outcomes put the mechanics in validated fields and let the Apply button do what the text describes.

Content lives in journal pages of subtype `coffee-pub-bibliosoph.outcome`.

---

## Content organisation

Two compendiums, not one: `coffee-pub-bibliosoph.criticals` and `coffee-pub-bibliosoph.fumbles`. Each is browsable on its own, which is what a GM looking for "a fumble" actually wants. Each kind's compendium is named by a setting (`critCompendium`, `fumbleCompendium`) so a GM can point at their own.

Journals inside a compendium are severity buckets, for browsing only. The picker scans every journal and reads `severity` off the page itself, so a journal name is never mechanical -- a GM can rename a bucket, add a "Homebrew" journal, or drag pages between buckets without silently changing behaviour.

The data stays uniform (`minor` / `moderate` / `major`) so one validator covers both kinds, but nobody says "a moderate critical" at the table. The buckets carry real names:

| Severity | Critical | Fumble |
|---|---|---|
| minor | Butchery | Meek |
| moderate | Carnage | Nasty |
| major | Slaughter | Devastating |

`severityLabel(kind, severity)` resolves the pair. The moderate bucket is the deep one in both packs; minor and major are deliberately thin.

94 outcomes ship, 47 criticals and 47 fumbles, migrated verbatim from the world's own roll tables with the prose preserved. The deck is the only source: the roll-table fallback and its settings were removed, because a table row cannot carry the mechanics these cards are built around and produced a silent look-alike whenever a compendium was empty.

---

## The record

`scripts/data/outcome-schema.js`.

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | `crit` or `fumble`. Which compendium it lands in |
| `title` | yes | The page name |
| `image` | yes | Card art |
| `description` | yes | Two to four sentences, second person |
| `severity` | yes | `minor` / `moderate` / `major`. Total impact, not just damage |
| `appliesto` | yes | Who it lands on -- see below |
| `damage` | yes | One-time HP where it lands |
| `duration` | yes | Seconds. `0` is instant |
| `statuseffect` | yes | Condition id, or `none`. The same curated list injuries use |
| `odds` | yes | Relative likelihood within its kind, 1-100 |
| `imagetitle` | no | Short caption beneath the art |
| `modifiers` | no | `{ stat, value, rounds }`, applied as real ActiveEffect changes |
| `gmnotes` | no | Shipped guidance on how to run it |
| `dealscard` | no | Hands out an inspiration card instead of a status |
| `picks` | no | 1-6. How many party members to choose; `ally` only |

### What differs from injuries

| | Injury | Outcome |
|---|---|---|
| `treatment` / `treatmentdc` | Injuries linger and are treated | Absent. You do not treat a critical; it lands and it resolves |
| `duration: 0` | Permanent until treated | Instant -- nothing lingers |
| Grouping | One journal per damage type | One compendium per kind, three severity buckets each |
| `appliesto` | Always the damaged actor | Five targeting modes |
| Duration authoring | Seconds | Rounds on the sheet, stored as seconds at six seconds per round |

`damage` here is flat hit points, not the percentage of max HP that injuries use. A critical is a single moment resolved against whoever it lands on, rather than a wound carried across levels.

### Bands

`DAMAGE_BANDS` (minor 0-5, moderate 4-12, major 8-25), `DURATION_BANDS` and `ODDS_BANDS` constrain authored values. Severity means impact, not damage: the validator errors when damage exceeds a severity's ceiling but never when it falls below, because a major fumble that snaps your weapon for an hour is legitimately major at 2 damage. It warns only when a moderate-or-worse outcome has low damage *and* no condition *and* no modifier -- because then it really is just a minor.

Conditions use the same severity gating as injuries: `MAJOR_ONLY_CONDITIONS` (`paralyzed`, `incapacitated`, `unconscious`, `petrified`), `MODERATE_PLUS_CONDITIONS` (`stunned`).

### Modifiers

`{ stat: 'attack', value: -2, rounds: 2 }` renders as "-2 to attack rolls for 2 rounds" and becomes a real ActiveEffect change. Five stats are supported -- `attack`, `damage`, `ac`, `checks`, `saves` -- each mapping to a genuine dnd5e path so the number applies rather than being a note. The list is deliberately short: a modifier that cannot be applied is worse than no modifier, because it looks like it works.

`MODIFIER_STATS` is defined here and re-exported by the injury schema, so the two families cannot drift.

### Validation

`npm run outcomes:validate`. On top of the shape checks it enforces two rules the schema cannot express:

- A condition or modifier with `duration: 0` is an error -- it would either linger forever or never apply at all.
- Turn-denying conditions are major-only; `stunned` warns on a minor.

Pipeline: `resources/outcomes.json` -> `outcomes:validate` -> `build-outcome-journals.mjs`, which generates and round-trip verifies -> `packs/_source/outcomes` -> `packs:build`. `npm run content:build` does injuries and outcomes together.

---

## Targeting

`appliesto` is real targeting, not a label. Richer than target and self, because real crit and fumble tables scatter effects everywhere.

| Value | Apply control |
|---|---|
| `target` | One button, naming the creature hit when known |
| `self` | One button, naming the roller when known |
| `ally` | One button per party member, plus Random Party Member |
| `party` | A single button applying to everyone, with no selecting |
| `nearby` | One button; the GM selects who is in range |

Named buttons bind to that actor via `targetActorId`. A card records a specific moment, so it does not quietly re-aim at whatever happens to be selected when someone gets around to clicking it.

Who the card is about comes from the triggering roll -- `_outcomeCast()` relays roller and hit-target ids over the socket. With no roll behind it, as with the toolbar buttons or the test harness, it falls back to Foundry's own convention: a lone controlled token is the roller, a lone target is who they hit. Anything ambiguous stays unnamed rather than guessed at.

### `picks`

`picks` (optional, 1-6, default 1) is how many separate party members the card asks you to choose. It means something only with `appliesto: ally`, the one mode that draws a picker; the sheet and the validator both say so. `picksFor(rec)` and `targetHint(appliesto, picks, remaining)` drive the prompt text.

Before this existed, "two party members each lose 1 HP" lived in the prose and the card resolved on the first click, so the second choice was silently impossible. Now the picker stays open, the instruction counts down, a running line names who has been chosen, and the closing stamp lists everyone.

The count lives in the stored message HTML -- `data-picks-remaining`, `data-picks-applied` and `data-picks-actors` on the picker container -- not in any client's memory, so a refresh, a second client, and a relayed player click all read the same state.

Two things it deliberately handles:

- A chosen party member's button is retired, so nobody is picked twice. The applier counts a repeat as successfully applied rather than as a no-op, so an unguarded second pick on the same person would silently consume one.
- Random Party Member is resolved to a concrete actor before the effect is applied, excluding anyone already chosen -- otherwise the card could not know whose button to retire, and the dice could land twice on the same person.

---

## Flow

1. **Trigger** -- `triggerCriticalRoll()` or `triggerFumbleRoll()` from the toolbar, or a crit or fumble detected by the Rolls API (see [architecture-toasts](architecture-toasts.md)).
2. **Draw** -- `createChatCardOutcome()` scans the configured compendium, reads records via `readOutcomeRecord()`, and picks by `odds`.
3. **Cast** -- `resolveOutcomeCast()` works out who rolled and who was hit from `rollerActorId`, `rollerTokenId` and `hitActorId`.
4. **Card** -- `buildOutcomeApplyButtons()` and `buildOutcomeMechanics()` render it. The mechanics block reads as one line: "8 damage - Stunned for 1 round - -2 to attack rolls for 2 rounds". Criticals and fumbles build their cards directly from the typed compendium and never route through `publishChatCard()`, which is why they carry no `BIBLIOSOPH.CARDTYPE` flag.
5. **Apply** -- `handleApplyOutcomeClick()`, then `applyOutcomeStatus()`, then `applyStatusToTokens()` in `manager-status-effects.js`: the same single path injuries use.
6. **Stamp** -- `stampOutcomeApplied()` and `markCardButtonApplied()` write the result back onto the chat message, so a card cannot be applied twice and a reloading client sees the resolved state. `sweepStampsById()` reconciles on render.

Application is relayed GM-authoritatively over `bibliosoph.outcomeApply`. `pickedActorIds()` and `resolveOutcomePick()` track which recipients a multi-pick outcome has already consumed.

### Who may press Apply

Choosing who a crit lands on is a player decision, so the buttons are not GM-only:

- The GM always sees every apply control.
- A player sees them when they own the actor whose roll produced the card (`data-roller-actor`, baked in at render).
- Nobody else sees them.

Buttons marked `data-needs-selection` stay GM-only regardless. Those are the unbound ones -- "Select the creature that was hit" -- which resolve against whoever the clicker has selected on the canvas. Relayed, they would read the GM's selection rather than the player's and land on the wrong token.

A player's client cannot create effects on actors it does not own, nor edit the GM's chat message, so the click is relayed over Blacksmith's socket and the GM performs it -- the same shape as inspiration cards and treatment stamps. Client-side button pruning is presentation only. The GM side re-checks everything before acting: the button must still be live in the stored card, it must not be selection-bound, and the requesting user must genuinely own the roller. The relay is a request, not a fact. With no GM connected, the player is told so and nothing happens.

`appliesto: self` changes the Apply button's label but not its targeting -- the applier still uses targeted-then-selected tokens, so for a fumble the GM selects the fumbler.

---

## `dealscard`

An outcome with `dealscard: true` hands someone a card from the inspiration deck instead of applying a status. `appliesto` still decides who, so there is no second targeting concept: `self` deals to the roller, `ally` offers the party picker. It is the one place the three content families connect -- see [architecture-inspiration](architecture-inspiration.md).

---

## Presentation

`playCritBurst()` and `playFumbleBurst()` in `manager-injury-effects.js` fire on every client via the `createActiveEffect` hook, driven by the `outcomeBurst` flag stamped at apply time. GM notes render as tooltips for GMs only and are never written into the card DOM.

---

## Boundaries

Bibliosoph owns what a critical is and what it does. Blacksmith supplies roll classification (`api.rolls.attackResolved`), toast delivery, and the socket relay. The effect itself is a plain Foundry ActiveEffect, and the condition is toggled through core `Actor#toggleStatusEffect`.
