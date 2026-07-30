# Critical & Fumble Schema ("Outcomes")

**Status:** BUILT 2026-07-29. 46 outcomes shipped (24 criticals, 22 fumbles). Pack build pending — Foundry was open.

Criticals and fumbles as typed journal content — the lite sibling of `spec-injury-schema.md`. Same machinery (typed page subtype, data model, sheet, validator, generator, odds-weighted picking), different schema.

## Why this exists

Crits and fumbles already had mechanical teeth — "target is blinded for a round", "you drop your weapon", "-2 to attacks" — but the teeth lived in prose on a roll-table row, so every one of them was a thing the GM had to read, remember, and adjudicate by hand. That is exactly the position injuries were in before their rebuild. The cure is the same: put the mechanics in validated fields, and let the Apply button do what the text describes.

## What differs from injuries

| | Injury | Outcome |
|---|---|---|
| `treatment` / `treatmentdc` | Yes — injuries linger and are treated | **No.** You do not treat a critical. It lands and it resolves. |
| `duration: 0` | Permanent until treated | **Instant** — nothing lingers. Most outcomes are a single moment. |
| Grouping | One journal per damage type (14) | One journal per kind: **Criticals**, **Fumbles** |
| `appliesto` | Always the damaged actor | **New.** `target` (the creature hit) or `self` (the roller) |
| `modifiers` | — | **New.** Real roll bonuses/penalties, applied as ActiveEffect changes |
| Duration authoring | Seconds | **Rounds** on the sheet, stored as seconds (6s per round) |

## The record

| Field | Type | Semantics |
|---|---|---|
| `kind` | `crit` \| `fumble` | Which journal it lands in |
| `title` | string | The page name |
| `image`, `imagetitle` | string | Art and its caption |
| `description` | string | Two to four sentences, second person |
| `severity` | `minor` \| `moderate` \| `major` | Total impact, not just damage |
| `appliesto` | `target` \| `self` | Who it lands on |
| `damage` | integer | One-time HP where it lands |
| `duration` | integer | Seconds; **0 = instant** |
| `statuseffect` | condition id \| `none` | Same curated list as injuries |
| `odds` | 1–100 | Relative likelihood within its kind |
| `modifiers` | array | `{ stat, value, rounds }` — see below |
| `gmnotes` | string | Shipped "how to run it" guidance |

### Modifiers — the teeth

`{ stat: 'attack', value: -2, rounds: 2 }` renders as "-2 to attack rolls for 2 rounds" and becomes a real ActiveEffect change. Five stats are supported, each mapping to a genuine dnd5e path so the number actually applies rather than being a note:

`attack` · `damage` · `ac` · `checks` · `saves`

The list is deliberately short. A modifier that cannot be applied is worse than no modifier, because it looks like it works.

## Severity means impact, not damage

The validator errors when damage **exceeds** a severity's ceiling, but not when it falls below. A major fumble that snaps your weapon for an hour is legitimately major at 2 damage. It only warns if a moderate-or-worse outcome has low damage *and* no condition *and* no modifier — because then it really is just a minor.

Bands: minor 0–5, moderate 4–12, major 8–25.

## Validation

`npm run outcomes:validate`. On top of the shape checks it enforces two rules the schema cannot express:

- A condition or modifier with `duration: 0` is an **error** — it would linger forever or never apply at all.
- Turn-denying conditions (`paralyzed`, `incapacitated`, `unconscious`, `petrified`) are major-only; `stunned` warns on a minor.

## Pipeline

`resources/outcomes.json` → `outcomes:validate` → `build-outcome-journals.mjs` (generates + round-trip verifies) → `packs/_source/outcomes` → `packs:build`.

`npm run content:build` does injuries and outcomes together.

## Runtime

`rollOutcomeCard(type)` prefers the **typed compendium** (`outcomeCompendium` setting, defaults to ours) and falls back to the classic **roll table** when set to None — so existing user tables keep working untouched. The compendium path picks weighted by `odds`, renders a mechanics block on the card ("8 damage · Stunned for 1 round · -2 to attack rolls for 2 rounds"), and hands the Apply button the whole record so applying reproduces the mechanics rather than stamping a name on the token.

## Known nuance

`appliesto: self` changes the Apply button's label but not its targeting — the applier still uses targeted-then-selected tokens. For a fumble the GM selects the fumbler. Auto-targeting the roller is a possible refinement once the rolls API reports the actor reliably for every path.

---

# Addendum — 2026-07-30

## Structure as shipped

The spec above predates the migration of the world's own tables. What
actually ships:

- **Two compendiums**, not one: `coffee-pub-bibliosoph.criticals` and
  `coffee-pub-bibliosoph.fumbles`. Each is browsable on its own, which is
  what a GM looking for "a fumble" actually wants.
- **Three journals per compendium**, named for the severity buckets the
  original tables used — crits: Butchery / Carnage / Slaughter; fumbles:
  Meek / Nasty / Devastating. The journals are organisational only: each
  page states its own `severity` and `odds`, so renaming or adding a
  journal changes nothing about selection.
- **94 outcomes** (47 crits, 47 fumbles), migrated verbatim from the
  world's roll tables with the prose preserved.

## `appliesto` and the pickers

`appliesto` is real targeting, not just a label:

| Value | Apply control |
|---|---|
| `target` | One button, naming the creature hit when known |
| `self` | One button, naming the roller when known |
| `ally` | One button **per party member**, plus *Random Party Member* |
| `party` | A single button that applies to everyone, no selecting |
| `nearby` | One button; the GM selects who is in range |

Named buttons **bind** to that actor via `targetActorId`. A card records a
specific moment, so it should not quietly re-aim at whatever happens to be
selected when someone gets around to clicking it.

Who the card is about comes from the triggering roll (`_outcomeCast()`
relays roller and hit-target ids over the socket). With no roll behind it —
the toolbar buttons, the test harness — it falls back to Foundry's own
convention: a lone **controlled** token is the roller, a lone **target**
is who they hit. Anything ambiguous stays unnamed rather than guessed at.

## `dealscard`

An outcome with `dealscard: true` hands someone a card from the
inspiration deck instead of applying a status. `appliesto` still decides
who, so there is no second targeting concept — `self` deals to the roller,
`ally` offers the party picker.

This exists because `Inspired` and `Inspirational` previously carried
`@UUID[Macro.…]` links to a macro that only existed in the author's world.
It is the one place the three content families connect.
