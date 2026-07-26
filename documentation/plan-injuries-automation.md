# Plan: Injuries Automation (damage-threshold triggers)

**Status:** IMPLEMENTED (phase 1, 2026-07-26) — decisions from §5: % of max HP;
Triggered By is a setting (default Players); injured player's owner clicks;
`injuriesMacroGlobal` retired; largest typed component picks category; no
zero-HP auto-trigger (revisit later). Implementation:
`scripts/manager-injury-triggers.js` (detection + toast),
`manager-roll-toasts.js` `deliver()`/injury arming, `rollInjuryCard()` export
in bibliosoph.js, Injuries settings rebuilt (Configuration + Toast Design).
**Depends on:** nothing new (dnd5e system hooks + existing Blacksmith socket/toast plumbing)
**Related:** `plan-injuries-datamodel.md` (the typed-page rebuild — separate track, see §7)

## 1. Concept

Injuries are what happens when you get hit so hard you may have permanent damage.
Today they are 100% manual: the GM decides, opens the selector card, picks the damage
category, and applies the rolled injury. This plan adds the automation layer on the
same pattern as Critical Hits / Fumbles — detect → toast → click-to-roll → card →
apply — while keeping the manual toolbar flow untouched.

**Phase 1 trigger: percent damage.** A single application of damage that deals at
least N% of the target's max HP triggers an injury, N set by a slider. When the
trigger fires, the injury is rolled from the injury journal compendium **by the
damage type of the hit**.

## 2. Research: detection (how we know damage landed, and its type)

dnd5e 5.2.5 (installed) fires these hooks on the client that applies the damage
(chat card damage buttons, token HUD, sheet, and MIDI's applyDamage path):

| Hook | Signature | Gives us |
|---|---|---|
| `dnd5e.calculateDamage` | `(actor, damages, options)` | **The typed breakdown**: `damages = [{ value, type, properties }]` per damage part, before resistances collapse it |
| `dnd5e.preApplyDamage` | `(actor, amount, updates, options)` | Cancellable pre-hook (not needed) |
| `dnd5e.applyDamage` | `(actor, amount, options)` | **The final applied amount** after resistances/temp HP |

**Strategy:** listen to both. `calculateDamage` stashes the typed parts keyed by
actor (same-tick), `applyDamage` supplies the authoritative final amount and fires
the trigger check. The applying client is the single authority — one application,
one event, no GM-client gating and no dedupe problem. Delivery to other clients
rides the existing `coffee-pub-bibliosoph.rollToast` socket relay.

- **Damage type** = the largest typed component of the hit (a 2d6 slashing + 1d6
  fire hit is a Slashing injury). Untyped/mixed-unknown → **General**.
- Category names in the injury compendium map 1:1 onto dnd5e damage types
  (acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison,
  psychic, radiant, slashing, thunder) + General — no mapping table needed beyond
  capitalization.
- **Out of scope (phase 1):** damage typed directly into the HP field on a sheet
  bypasses these hooks (and carries no type anyway). Fallback idea for later: an
  `updateActor` HP-delta watcher that triggers a **General** injury.
- **Healing** arrives through the same path with negative/healing types — filtered out.

## 3. Research: thresholds (what makes a hit "injury-worthy")

Prior art for when lingering injuries happen:

- **DMG (Lingering Injuries / Massive Damage variants):** a single hit ≥ half max
  HP; dropping to 0 HP; taking a critical hit; failing a death save by 5+.
- **Common injury modules** use the same set: crit-triggered, zero-HP-triggered,
  massive-damage %-based, death-save-fail.

**Phase 1 ships the % slider** (default **50%**, matching the DMG massive-damage
convention). The other triggers are natural phase-2 checkboxes — crit-triggered
injuries can piggyback on the crit detection we already have.

**Threshold basis decision:** % of **max HP** (recommended — stable, DMG-aligned,
predictable for players) vs % of *current* HP (death-spirally, punishes the
wounded). Plan assumes max HP.

## 4. Phase 1 build

Mirrors the crit/fumble architecture. New `scripts/manager-injury-triggers.js`:

1. **Detect** (applying client): `calculateDamage` + `applyDamage` → compute
   `pct = amount / actor.system.attributes.hp.max` → gate on threshold slider,
   automation mode, and Triggered By (the **injured** actor's type: character vs
   everything else).
2. **Toast** (existing relay + toast API): portrait of the injured token, fixed
   fallback icon, Toast Design settings like crit/fumble. Substitution codes:
   `{name}` (injured), `{type}` (damage type), `{damage}` (amount), `{percent}`
   (of max HP), `{attacker}` if resolvable from context.
3. **Click-to-roll** goes to the **injured actor's owner** (the player whose
   character got maimed rolls their own injury; GM for NPCs; GM fallback when no
   owner is connected) — same receipt-side arming + `callToAction` pill.
4. **Roll the injury**: clicking calls the existing path —
   `createChatCardInjury(category)` with the damage type as category, which
   already picks a random injury from the journal compendium and posts the card
   with its **Apply Injury** button (active effect with damage/duration/status).
   Auto mode posts the card immediately; Manual mode is toast-only.
5. **Manual flow unchanged**: toolbar button → selector card → category click →
   same card. The GM can always trigger an injury by hand.

**Settings** (Injuries section, reorganized like crit/fumble):
- *Configuration*: **Automation** (Off / Toast — manual / Toast — click to roll /
  Toast — automatic, default click), **Injury Threshold** (slider 5–100%, default
  50, "a single hit dealing at least this % of max HP triggers an injury"),
  **Triggered By** (Everyone / Players / NPCs and Monsters — default **Players**;
  injuries are interesting on PCs, monsters usually just die), **Toolbar Button**
  (None / Foundry / Coffee Pub / Both — replaces the two checkboxes), plus the
  existing Compendium, Chat Card Style, Injury Image, Sound + Volume.
- *Toast Design*: title, message, button text, size, animation, colors,
  background image — same fields as crit/fumble.
- **Removed** (pending approval): `injuriesMacroGlobal` + its binding code and the
  mandatory-macro validation — same treatment the crit/fumble macros got; the
  toolbar button calls the selector directly.

**Cleanup along the way:** the confessed fake `1d100` "for show" in
`createChatCardInjury` gets removed (injury picking is journal-random, not
dice-driven — no more lying dice).

## 5. Decisions to confirm

1. **Threshold basis**: % of max HP (recommended) or % of current HP?
2. **Triggered By default**: Players only (recommended) or Everyone?
3. **Who clicks**: injured player's owner (recommended, mirrors crit) or GM only?
4. **Macro removal**: retire `injuriesMacroGlobal` like the crit/fumble macros?
5. **Mixed damage**: largest typed component picks the category (recommended)?
6. **Zero HP**: should dropping to 0 always trigger regardless of % (cheap to add
   in phase 1 as part of the same check)?

## 6. Phase 2+ (later)

- Additional triggers: on-crit (wire to existing crit detection), zero-HP, death
  save failure.
- **Severity scaling**: injuries.json carries per-injury `severity` and `odds`
  fields that are currently unused — overkill % could select the severity band
  (50% hit → minor, 80% → severe, 100%+ → grievous).
- Multiple simultaneous triggers (crit + threshold) → one injury, worst severity.

## 7. Relationship to the data-model rebuild

`plan-injuries-datamodel.md` (typed JournalEntryPage data model, user-authorable
injuries, Squire CODEX pattern) is a separate track. This automation deliberately
touches injury *selection* through one seam — `getJournalCategoryPageData(compendium,
category)` — so when the rebuild replaces HTML parsing with typed pages, the
automation keeps working by swapping that one function's internals.
