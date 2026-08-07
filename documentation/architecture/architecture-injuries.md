# Architecture: Injuries

**Status:** describes the code as of 13.4.6. Written from source, not from plans.

Injuries are authored wounds that attach to an actor as a real ActiveEffect, optionally convey a core condition, optionally bleed each turn, and end either by healing themselves or by a player passing a Medicine check.

Content lives in journal pages of subtype `coffee-pub-bibliosoph.injury`. Users author their own — Bibliosoph ships a starter pack but the system is content-driven, not hardcoded.

---

## Data model

`scripts/data/injury-schema.js` is the single contract shared by four consumers: the authoring prompt, the page generator, the validator, and the page sheet.

| Field | Meaning |
|---|---|
| `category` | damage type (`acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`) or `general` |
| `severity` | `minor` / `moderate` / `major` |
| `damage` | one-time damage as a **percent of max HP** |
| `duration` | seconds; `0`/absent means until removed |
| `statuseffect` | core condition id to convey, or `none` |
| `tick` | recurring damage per turn, percent of max HP |
| `expiry` | `heal` or `linger` |
| `odds` | weight for the random draw |
| `treatmentdc` | overrides the severity ladder |
| `modifiers` | become real ActiveEffect `changes` |
| `gmnotes` | never copied into chat — players can read the DOM |

Two invariants worth knowing:

- **`DAMAGE_LEAVES_AT_LEAST = 1`.** Percent damage is floored so an injury never drops a character below 1 HP. Injuries wound; they do not kill.
- **Condition gating by severity.** `MAJOR_ONLY_CONDITIONS` (`paralyzed`, `incapacitated`, `unconscious`, `petrified`) and `MODERATE_PLUS_CONDITIONS` (`stunned`) prevent a minor scrape from conveying a fight-ending condition.

Treatment DC falls back through: authored `treatmentdc` → `SEVERITY_DCS` (minor 10 / moderate 15 / major 20) → flat 15.

---

## How an injury starts

### Manual

Toolbar → **Injuries** → a selector card of categories → click a category → `weightedPick()` draws from that category's pages by `odds`. Built in `createChatCardInjury()`.

### Automatic

`manager-injury-triggers.js` subscribes to Blacksmith's `rolls.on('damageResolved')`. When a **single application** of damage meets or exceeds the configured percent of the target's max HP, it rolls an injury whose category matches the hit's dominant damage type.

The Blacksmith payload delivers the final amount, a typed breakdown, and an `hp {before, after, max}` snapshot, already correlated across dnd5e's `calculateDamage`/`applyDamage` split and already relayed to the GM client. Bibliosoph does none of that correlation itself.

Requires a Blacksmith build with `damageResolved`. Dormant otherwise; the manual flow is unaffected.

---

## Applying it

Everything routes through **one function**: `applyStatusToTokens()` in `scripts/manager-status-effects.js`. Criticals, fumbles, and injuries all use it, and the contract is identical for every caller:

- Targets the **targeted** token(s), falling back to selected; warns if neither.
- Permission-aware — you must own the target's actor.
- Duplicate-safe — a token never gets the same-named effect twice.
- Carries name, image, and a description so the effect sheet and dnd5e tooltips retain what the card said.
- Optional mechanics: one-time damage (flat or percent of max HP), duration, real ActiveEffect `changes`, and a core condition toggled via `Actor#toggleStatusEffect` validated against `CONFIG.statusEffects`.

Conditions are toggled through **core Foundry**, not through a third-party dependency. DFreds is used when present but never required.

### The flag

The created effect carries `flags['coffee-pub-bibliosoph'].outcomeBurst`:

```
{ kind, category, name, condition, tick, expiry, severity, dc, sourceUuid }
```

This single flag is load-bearing for four different systems: the canvas burst, the tick ticker, the condition unwind, and the treatment card. `condition` records **which core condition this affliction toggled**, which is what makes clean removal possible.

---

## What it does over time

`manager-injury-ticks.js`, **active GM only**:

- **TICK** — recurring damage at the start of the victim's turn, as a percent of max HP.
- **EXPIRY** — when the duration runs out, `heal` deletes the injury (and the unwind hook clears its condition); `linger` stops the ticking and the penalties but leaves the injury on the sheet for someone to treat.

Ticks are tied to **combat turns**, not the world clock. A wound that bleeds every six seconds of wall time while the party shops is bookkeeping; a wound that bleeds on your turn is a thing you feel. Both `updateCombat` and `updateWorldTime` are watched, and the active-GM guard exists because those hooks fire on every client — HP applied five times because five people are logged in is the classic version of this bug.

---

## How it ends

### The unwind hook

`registerConditionUnwindHook()` at [bibliosoph.js:3089](../../scripts/bibliosoph.js#L3089) listens on `deleteActiveEffect`, GM-authoritative. When a flagged affliction is deleted **by any route**, it collects `flag.condition` plus anything in `effect.statuses` and unwinds each — unless another untreated affliction still conveys it.

This is deliberately a hook rather than a callback other modules must invoke. It means the condition is cleaned up whether the injury was removed from the Check-Up card, Squire's status window, the actor sheet, the token HUD, or by its duration expiring. **No other module has to know Bibliosoph exists.**

`removeAffliction()` is the shared removal core. For non-Bibliosoph effects it stamps a `kind: 'treated'` flag just before deletion so the heal burst still plays on every client, then deletes. The unwind itself is left entirely to the hook so the path is identical however the effect leaves.

### Treatment rolls

Players heal via Medicine checks, driven from the Check-Up card. The rules matrix:

| Situation | Effect |
|---|---|
| Healer's kit | Advantage, DC −2 |
| Self-treatment | Disadvantage |
| Both | Normal, DC −2 |
| Natural 20 | Critical heal, +5 HP |
| Natural 1 | Fumbled heal, −5 HP |

Delivered through Blacksmith's `openRequestRollDialog` in silent mode, resolved GM-side on `blacksmith.requestRollComplete` with the full roll JSON.

**Known gap:** the Blacksmith request API cannot force advantage/disadvantage (filed as Blacksmith Request #6). The interim is that the required mode rides in the request title, the player clicks the matching button, and the GM resolver reads what was actually rolled from the roll formula, logging mismatches.

Attempts are tracked in a `treatAttempts` flag. `registerTreatmentRestReset()` clears them on `dnd5e.restCompleted`.

---

## Presentation

`manager-injury-effects.js` provides canvas bursts and sounds, played on every client via `createActiveEffect` / `deleteActiveEffect` hooks: `playInjuryBurst`, `playCritBurst`, `playFumbleBurst`, `playTreatmentBurst`.

GM notes are surfaced through `utility-gm-notes.js` as tooltips on the card, painted only for GMs. Note text is never written into the chat card DOM.

---

## Boundaries

Bibliosoph owns **what an injury is**. It does not own:

- the condition vocabulary (`CONFIG.statusEffects`, core/system)
- the status effects UI (currently Squire's; see [architecture-ownership](../../../coffee-pub-blacksmith/documentation/architecture/architecture-ownership.md))
- damage correlation (Blacksmith `api.rolls`)
- toast delivery (Blacksmith `api.toast`)

**Classifier status:** Bibliosoph does not register its own `effects.registerClassifier`. Blacksmith ships a **low-priority compatibility classifier** on its behalf (`coffee-pub-blacksmith.bibliosoph-outcome`, `api-effects.js`) which qualifies on the `outcomeBurst` flag and translates it into display metadata. That exists to prevent regressions while Bibliosoph adopts the registry properly. An authoritative Bibliosoph classifier should register at a higher priority, or explicitly replace the compatibility one.
