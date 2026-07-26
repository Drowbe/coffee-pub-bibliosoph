# API Request: `damageResolved` event for Blacksmith `module.api.rolls`

**From:** Bibliosoph
**To:** Blacksmith
**Date:** 2026-07-26
**Status:** IMPLEMENTED by Blacksmith (same day) and Bibliosoph MIGRATED —
`manager-injury-triggers.js` now subscribes to `rolls.on('damageResolved')`;
the direct dnd5e two-hook stopgap described below is deleted. Blacksmith's
judgment calls: healing delivered flagged (`isHealing`), damage does NOT fire
the generic `resolved` hook (kept d20-shaped), attacker/item attribution ships
null pending MIDI testing. Event delivers on the GM client (attack-lane
semantics); Bibliosoph guards on activeGM accordingly.

## The ask

Extend the rolls outcome API with a **damage application** event, mirroring the
`attackResolved` pattern:

```javascript
rolls.on('damageResolved', (outcome) => {
    // outcome.actorId took outcome.amount damage, typed breakdown included
});
```

## Why Blacksmith and not per-module

Bibliosoph now triggers injuries off damage thresholds and had to hook the
dnd5e system directly (`dnd5e.calculateDamage` for the typed breakdown +
`dnd5e.applyDamage` for the final amount, correlated by actor uuid within a
tick). That correlation-and-normalization work is exactly what the rolls API
already does for d20 outcomes, and it is not Bibliosoph-specific — any module
reacting to "someone got hurt" needs the same payload:

- Bibliosoph: injury automation (% max HP threshold, injury by damage type)
- Squire: party health / HP tracking views
- Crier: death/bloodied announcements
- Blacksmith stats: damage-dealt / damage-taken leaderboards, "biggest hit"

One normalized event beats four modules each re-implementing the same
two-hook dance (and each rediscovering the same edge cases: MIDI vs core,
temp HP absorption, healing filtering, synthetic token actors).

## Proposed outcome shape

```javascript
{
    kind: 'damage',
    source: 'dnd5e.applyDamage' | 'midi.damageApplied',
    amount: 23,                 // final applied (post-resistance, post-temp)
    tempAbsorbed: 5,            // portion soaked by temp HP, if knowable
    damages: [                  // typed breakdown from calculateDamage
        { value: 18, type: 'slashing' },
        { value: 5,  type: 'fire' }
    ],
    isHealing: false,           // deliver healing too, flagged, or filter — dealer's choice
    actorId, tokenId, sceneId,
    hp: { before, after, max, temp },   // lets consumers do thresholds/bloodied/zero
    attackerTokenId: null,      // if resolvable from the workflow (MIDI knows; core often doesn't)
    itemUuid: null,             // damaging item if resolvable
    meta: { ts, trigger }
}
```

Notes:
- `hp.before/after/max` makes threshold logic ("≥50% of max in one hit",
  "dropped below half", "hit 0") one-liners for every consumer.
- Fires wherever damage is applied (the hooks fire on the applying client) —
  the payload should say so, and cross-client delivery semantics should match
  whatever `attackResolved` promises.
- Attacker/item attribution is best-effort: MIDI workflows know it, core chat
  damage buttons usually don't. Null is fine; carrying it when known is the
  value-add.

## What Bibliosoph does today (the stopgap to be replaced)

`scripts/manager-injury-triggers.js` — `_stashDamageTypes()` (calculateDamage)
+ `_onDamageApplied()` (applyDamage). Detection is deliberately isolated in
those two methods, so migrating to `rolls.on('damageResolved', ...)` is a
small, contained swap.
