# Note to Squire: Status Effects Done Right (field notes from Bibliosoph's Check-Up build)

**From:** Bibliosoph dev
**Context:** Bibliosoph just shipped its injury/treatment lifecycle (apply injuries, crits, and fumbles as effects; a Check-Up card that lists and removes *anything* on an actor). We hit every pothole on this road so you don't have to. Verified on Foundry v13 + dnd5e 5.2.5, core only — no DFreds, no third-party condition modules.

---

## 1. Applying and removing conditions — use the core toggle, nothing else

For any official condition, the only correct call is:

```js
await actor.toggleStatusEffect('blinded', { active: true });   // apply
await actor.toggleStatusEffect('blinded', { active: false });  // remove
```

- This creates/deletes the system's own condition ActiveEffect with the right icon, name, and rules wiring. Do **not** hand-build an ActiveEffect for an official condition — you get a lookalike that other code (including dnd5e itself) doesn't recognize as the condition.
- Guard before toggling on: `actor.statuses.has('blinded')` — toggling an already-active condition off when you meant on is a classic.
- We tried routing through DFreds Convenient Effects first. Its API signatures didn't match its docs and it was missing dnd5e 5.x conditions entirely. We ripped it out; core-only has been flawless. Recommend you never take the dependency.
- **Exhaustion is special**: it's leveled. `toggleStatusEffect('exhaustion')` gives you level 1; the actual level lives at `actor.system.attributes.exhaustion`. If you surface exhaustion, surface the level.
- Removing an arbitrary effect (yours, ours, another module's) is just `await effect.delete()` — see §5.
- All of this requires ownership of the actor. Gate your UI on `actor.isOwner`.

## 2. Pull the condition list from the system — never a fixed set

The set of legal conditions changed in dnd5e 5.x and will change again. Enumerate at runtime from two sources:

```js
// Toggleable conditions (what the token HUD shows)
CONFIG.statusEffects            // [{ id, name, img, ... }] — name is a LOCALIZATION KEY
game.i18n.localize(se.name)     // always localize before display

// The system's full condition registry, including pseudo-conditions
CONFIG.DND5E.conditionTypes     // { blinded: {...}, bleeding: { pseudo: true, ... }, ... }
```

The **pseudo-conditions** (`bleeding`, `burning`, `diseased` — flagged `pseudo: true`) are the trap: they can NOT be toggled and never get their own effect. A pseudo-condition exists only by riding on some other effect's `statuses` array:

```js
// Correct way to convey "bleeding" — put it on YOUR effect:
await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: 'Gnash Wound', img: '...', statuses: ['bleeding'], ...
}]);
```

It lives and dies with the carrying effect. If your add-a-condition picker offers bleeding/burning/diseased as toggleables, it will silently fail — either exclude `pseudo` entries from "add", or create a carrier effect like the above.

## 3. Descriptions — the `@Embed` workaround

dnd5e condition effects don't store description text. They store **enricher syntax** pointing at the rules journal:

```
@Embed[Compendium.dnd5e.content24.JournalEntry.phbAppendixCRule.JournalEntryPage.QxCrRcgMdUd3gfzz inline]
```

If you render `effect.description` raw, your users see exactly that string (we shipped that bug for about an hour). Run every description through the enricher:

```js
const TextEditorImpl = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
const html = await TextEditorImpl.enrichHTML(effect.description ?? '', {
    relativeTo: effect,
    rollData: actor.getRollData?.() ?? {}
});
```

- It's async — build your row data with `Promise.all`, don't try to enrich in a synchronous render path.
- Wrap in try/catch and fall back to the raw text; a broken embed shouldn't kill the whole list.
- Related: `CONFIG.DND5E.conditionTypes[id].reference` is a UUID straight to the rules page if you'd rather link than inline.
- Watch heights: the Exhaustion page embeds a full table. Cap/scroll your container.

## 4. Categorizing effects — injuries, crits, fumbles, and everyone else

Every effect Bibliosoph applies is stamped with a module flag you can read:

```js
const flag = effect.getFlag('coffee-pub-bibliosoph', 'outcomeBurst');
// => { kind: 'injury' | 'crit' | 'fumble', category: 'Fire'|..., name: 'Roasted Rump', condition: 'prone'|null }
```

Bucket by `flag.kind`; anything unflagged (system conditions, spells, other modules, hand-authored) is your "Effects & Conditions" bucket. Our Check-Up card renders exactly these four groups in this order: **Injuries → Criticals → Fumbles → Effects & Conditions**, and it reads well at the table.

One subtlety worth copying: a real condition conveyed by an injury (injury toggles Prone) exists as **its own effect too**, so it legitimately appears both inside the injury's row and as an independent row — that's correct, not a dedup bug (the patient can stand up while the injury persists). To label such rows, match the loose condition's `statuses` against the flagged effects' conveyed conditions and render "via <injury name>".

## 5. "Add only official, but show and remove ANYTHING" — the filter and the unwind

**Detection** — what counts as an active affliction is messier than `actor.statuses`. Our battle-tested filter, in order:

```js
const isAffliction = (e) =>
    !e.disabled && !e.isSuppressed && (
        !!e.getFlag('coffee-pub-bibliosoph', 'outcomeBurst') // module-stamped
        || e.isTemporary                                      // has a duration
        || e.statuses?.size > 0                               // carries condition ids
        || conditionNames.has(e.name.toLowerCase())           // NAME matches a localized condition
    );
```

That last clause matters: GMs hand-author effects named "Frightened" with no duration and no statuses — they land under "Passive Effects" and every other test misses them. Build `conditionNames` from both registries in §2 (localized, lowercased). The `disabled`/`isSuppressed` exclusions keep toggled-off and unequipped-item effects out.

**Removal** — `await effect.delete()` removes any effect regardless of who created it (ownership permitting). Two gotchas:

1. If the effect *conveyed* a toggled condition (our `flag.condition`, or the effect's `statuses`), deleting the effect may leave the condition behind. After deleting, check whether any **remaining** effect still conveys that condition; only if none does, `toggleStatusEffect(id, { active: false })`. Skipping the still-conveyed check makes removing one of two bleed-inducing wounds cure the bleeding.
2. Deleting dnd5e's own condition effect (the one `toggleStatusEffect` created) is fine — it untoggles cleanly.

**Duration display**: `effect.duration.label` gives you a localized remaining-time string ("10 Rounds", "1 Minute"); `duration.type === 'none'` means no duration — show nothing.

## 6. Everything else we learned the hard way

- **Deleting Bibliosoph effects is safe and pretty.** Our `deleteActiveEffect` hook plays a green treatment burst on every client whenever a flagged affliction is removed — by our Treat button, your UI, or manual deletion. No coordination needed; just delete.
- **Hooks fire everywhere — exploit it.** `createActiveEffect`/`deleteActiveEffect` fire on *all* clients. We drive every canvas animation off applied-effect flags with zero socket traffic. If Squire wants visual feedback on apply/remove, this is the pattern.
- **`effect.statuses` is a Set, `actor.statuses` is the aggregate Set** of every condition id currently conveyed by anything. Great for duplicate guards, useless for "which effect conveys it."
- **Names are localization keys almost everywhere** (`CONFIG.statusEffects[n].name`, `conditionTypes[id].name`). Localize before comparing or displaying, and compare lowercased.
- **Duplicate applies:** treat "already has it" as success with a notification, not an error — GMs double-click.
- If you ever need to distinguish our effects' damage behavior: injury HP damage is applied **once, immediately, via `actor.update`** at apply time — deliberately not an ActiveEffect HP change (those suppress instead of damage, and un-suppress on removal) and deliberately not through the damage pipeline (a big injury's damage re-triggering injury detection is a fun infinite loop we declined to ship).

Happy to walk through any of it — the implementation lives in `coffee-pub-bibliosoph/scripts/bibliosoph.js` (`createChatCardTreatment`, `treatAffliction`) and `scripts/manager-status-effects.js`.
