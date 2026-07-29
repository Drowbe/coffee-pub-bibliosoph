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
