# Architecture: Outcomes (Criticals & Fumbles)

**Status:** describes the code as of 13.4.6. Written from source, not from plans.

"Outcomes" is the shared name for criticals and fumbles. They are one system with one schema, one validator, and one set of bands — two kinds, `crit` and `fumble`.

Content lives in journal pages of subtype `coffee-pub-bibliosoph.outcome`.

---

## Content organisation

Each kind ships its own compendium, named by a setting (`critCompendium`, `fumbleCompendium`) so a GM can point at their own.

Journals inside a compendium are **severity buckets, for browsing only**. The picker scans every journal and reads `severity` off the page itself. A journal name is never mechanical — a GM can rename a bucket, add a "Homebrew" journal, or drag pages between buckets without silently changing behaviour.

The data stays uniform (`minor` / `moderate` / `major`) so one validator covers both kinds, but nobody says "a moderate critical" at the table. The buckets carry real names:

| Severity | Critical | Fumble |
|---|---|---|
| minor | Butchery | Meek |
| moderate | Carnage | Nasty |
| major | Slaughter | Devastating |

`severityLabel(kind, severity)` resolves the pair. The moderate bucket is the deep one in both packs; minor and major are deliberately thin.

---

## Schema

`scripts/data/outcome-schema.js`.

**Required:** title, image, description, severity, `appliesto`, odds, and the mechanical fields.
**Optional:** `imagetitle`, `modifiers`, `gmnotes`, `dealscard`, `picks`.

### Targeting

Richer than target/self, because real crit and fumble tables scatter effects everywhere:

`target`, `self`, `ally`, `party`, `nearby`

`picks` (max 6) controls how many recipients an outcome lands on; `picksFor(rec)` and `targetHint(appliesto, picks, remaining)` drive the card's prompt text so the player is told who to select and how many remain.

### Mechanics

- `DAMAGE_BANDS`, `DURATION_BANDS`, `ODDS_BANDS` constrain authored values.
- `modifiers` become real ActiveEffect `changes` via `modifiersToChanges()` — a critical's "−2 to attacks for 2 rounds" becomes a number the system applies, not a note the table has to remember.
- Durations are authored in **rounds** and converted: `roundsToSeconds = rounds * 6`.
- Conditions use the same severity gating as injuries: `MAJOR_ONLY_CONDITIONS` (`paralyzed`, `incapacitated`, `unconscious`, `petrified`), `MODERATE_PLUS_CONDITIONS` (`stunned`).
- `dealscard` links an outcome to an Inspiration draw — see [architecture-inspiration](architecture-inspiration.md).

---

## Flow

1. **Trigger** — `triggerCriticalRoll()` / `triggerFumbleRoll()` from the toolbar, or a crit/fumble detected by the Rolls API (see [architecture-toasts](architecture-toasts.md)).
2. **Draw** — `createChatCardOutcome()` scans the configured compendium, reads records via `readOutcomeRecord()`, and picks by `odds`.
3. **Cast** — `resolveOutcomeCast()` works out who rolled and who was hit from `rollerActorId` / `rollerTokenId` / `hitActorId`.
4. **Card** — `buildOutcomeApplyButtons()` and `buildOutcomeMechanics()` render the card. Criticals and fumbles build their cards directly from the typed compendium and never route through `publishChatCard()`, which is why they have no `BIBLIOSOPH.CARDTYPE*` flag.
5. **Apply** — `handleApplyOutcomeClick()` → `applyOutcomeStatus()` → `applyStatusToTokens()` in `manager-status-effects.js`, the same single path injuries use.
6. **Stamp** — `stampOutcomeApplied()` and `markCardButtonApplied()` write the result back onto the chat message so a card cannot be applied twice, and so a reloading client sees the resolved state. `sweepStampsById()` reconciles on render.

Application is relayed GM-authoritatively over `bibliosoph.outcomeApply`. `pickedActorIds()` and `resolveOutcomePick()` track which recipients a multi-pick outcome has already consumed.

---

## Presentation

`playCritBurst()` and `playFumbleBurst()` in `manager-injury-effects.js` fire on every client via the `createActiveEffect` hook, driven by the `outcomeBurst` flag stamped at apply time.

GM notes render as tooltips for GMs only and are never written into the card DOM.

---

## Boundaries

Bibliosoph owns what a critical is and what it does. Blacksmith supplies roll classification (`api.rolls.attackResolved`), toast delivery, and the socket relay. The effect itself is a plain Foundry ActiveEffect; the condition is toggled through core `Actor#toggleStatusEffect`.
