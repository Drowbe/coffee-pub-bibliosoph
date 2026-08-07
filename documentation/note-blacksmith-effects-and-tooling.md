# Note to Blacksmith: Effects display and wiki tooling

**From:** Bibliosoph dev
**Date:** 2026-08-07
**Context:** Bibliosoph adopted `effects.registerClassifier` and verified the whole chain live on Foundry v13 + dnd5e 5.x. Everything below came out of that work. Two items are already done in Blacksmith and listed only so you know they happened; the rest need a decision from you.

---

## Already landed in Blacksmith (FYI, no action)

**1. Duration formatting in `getDisplayEffects`** — commit `d1e8d783`.

`durationLabel` used to pass Foundry's own string straight through, which renders a seconds-based effect as raw seconds. A half-hour wound arrived as `1710 Seconds`. It now converts seconds-based durations to the unit a human would say, and leaves round/turn-based durations alone because Foundry already phrases those well.

| Remaining | Renders as |
|---|---|
| ≤ 120s, combat started | `2 rounds` |
| < 60s | `45 seconds` |
| < 1 hour | `29 minutes` |
| < 1 day | `2 hours` |
| otherwise | `3 days` |

Verified live: a 1800s injury now reads `30 minutes`, a 360s one reads `6 minutes`. Unit words go through the existing `localize()` helper with English fallbacks, so `en.json` keys can be added later without breaking anything. Documented in `api/api-effects.md`.

**2. Bibliosoph now registers an authoritative classifier.**

`coffee-pub-bibliosoph.afflictions`, priority 100, registered at `ready`. It reads the fields the built-in compatibility classifier cannot know about, so rows now read `Injury · Moderate · Blinded · 2 HP/turn` and `Critical · Carnage · Charmed` instead of a bare type.

**Heads up:** this changes what *your* combat bar renders, not just ours — that is the first place the difference shows. Deliberately no removal handler; our `deleteActiveEffect` unwind hook already covers every route, including callers who never opted in.

---

## Needs a decision

### A. `architecture/architecture-effects.md` is stale in two ways

**The small one:** it describes the layer as pure normalization and does not mention that `durationLabel` is now rewritten rather than passed through. One or two lines closes it.

**The bigger one:** its non-goals list no longer matches Blacksmith's own posture.

```
## Non-goals
- duration ticking or expiry
- Midi-QOL or DAE interpretation
- socket synchronization
```

Blacksmith does all three — just not in the effects layer. `manager-sockets.js` owns socket synchronization, `timer-*.js` own combat timing, and `utility-midi-resolution.js` is 440 lines of Midi-QOL interpretation. Whether those stay non-goals *for effects specifically* is the subject of §B; either way the list should say why rather than reading as a blanket position the codebase contradicts.

### B. The effects layer should adapt the effects ecosystem, the way the rolls layer already adapts MIDI

**The ask, up front:** apply the pattern you already built for rolls to effects. Detect the third-party effect modules, yield to them or provide the baseline yourself, and expose one contract so no consumer ever learns which happened.

**The precedent is yours.** `utility-midi-resolution.js` does exactly this for rolls: a runtime `enableMidiIntegration` check on every lane, "yield to MIDI" branches, and core dnd5e fallback lanes when it is absent or disabled. Bibliosoph consumes `rolls.on('damageResolved')` and has never needed to know whether MIDI is installed. That is the right shape, and it is the reason that integration has been painless for us.

The effects layer has no equivalent, and it shows.

**How the gap surfaced.** Identical authored data renders two different ways — some effects show `5 Rounds, 3 Turns`, others `30 minutes`. Traced to Times Up: `setDurationRounds()` rewrites any effect with `duration.seconds <= MaxRoundsToConvert × CONFIG.time.roundTime` (default 10 × 6 = 60s) into a rounds-based duration and nulls `duration.seconds`. It also expires effects itself, and with **Expire rounds/turns duration effects on combat end** enabled it deletes converted effects when combat ends, overriding whatever expiry semantics the effect's owner intended.

**Why we cannot solve that ourselves.** Times Up is optional and most users will not have it, so nothing can be built on its presence — including reading the original duration it stashes in `flags.times-up.durationSeconds`. Bibliosoph will not do that and no Coffee Pub module should; a satellite that branches on whether a third-party module is installed has taken a dependency in all but name.

Which leaves the variance with nowhere to go. Right now the effects layer renders whatever unit the document happens to carry, so **a third-party module silently changed the meaning of a shared display field and nothing noticed.** Without Times Up none of it happens — that is the problem, not the fix. The layer behaves differently depending on what else is installed, and every consumer inherits that inconsistency without being able to see or compensate for it.

**Why this belongs here and not in each satellite.** You already own both sides:

- `api.effects` owns effect normalization and display, including — as of `d1e8d783` — how a duration is phrased.
- `timer-planning.js` / `timer-combat.js` / `timer-round.js` own planning, turn and round timing, socket-synced, with settings and an architecture doc.

Duration-and-expiry sits precisely between two things you already own. Today every module applying a timed effect either reimplements it — Bibliosoph carries its own `hasExpired()` in `manager-injury-ticks.js` — or takes the dependency it is not allowed to take. Same argument that put condition labels and effect filtering in `api.effects` to begin with.

**Concretely, three additions:**

1. **A normalized `remaining`** on the display DTO, in a stated unit, whatever the document carries. A consumer should never branch on seconds-vs-rounds — that is the substrate variance this layer exists to hide.
2. **An expiry event** — `blacksmith.effects.expired` or similar — fired once, GM-authoritative, when an effect's clock runs out.
3. **A `enableTimesUpIntegration`-style runtime check**, matching `enableMidiIntegration`: yield expiry to Times Up when it is present and configured, run the baseline when it is not, and emit the same event either way.

**Policy stays with the owner.** Whether an expired injury heals or lingers until treated is a Bibliosoph opinion and belongs in Bibliosoph; so is what a critical does when its rounds run out. Detecting that the clock ran out is machinery, and it should have exactly one implementation.

### C. Two `tools/wiki-sync.mjs` fixes worth backporting

Bibliosoph ported your script and hit two things:

**Windows `EPERM` on publish.** `fs.rmSync` cannot delete an existing wiki clone — git's object store is read-only, and `force: true` does not clear the attribute. Your GitHub Action is unaffected because it runs on Linux, so this only bites running `publish` by hand. The fix is to reuse the clone instead of deleting it:

```js
if (fs.existsSync(path.join(wiki, '.git'))) {
  execFileSync('git', ['-C', wiki, 'fetch', 'origin'], { stdio: 'inherit' });
  const head = execFileSync('git', ['-C', wiki, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', wiki, 'reset', '--hard', `origin/${head}`], { stdio: 'inherit' });
  execFileSync('git', ['-C', wiki, 'clean', '-fd'], { stdio: 'inherit' });
} else { /* clone as before */ }
```

Same clean slate, faster, and works on Windows.

**Cross-module links get downgraded to plain text.** A link from one module's docs into a sibling's `documentation/` is not in the local `PUBLISH` set, so it becomes unclickable text. Bibliosoph's port rewrites those to the sibling's public wiki URL instead:

```js
function siblingWikiUrl(target) {
  const m = target.match(/coffee-pub-([a-z]+)\/documentation\/(?:[^)]*\/)?([^/)]+)\.md(#.+)?$/i);
  if (!m) return null;
  const base = SIBLING_WIKIS[`coffee-pub-${m[1].toLowerCase()}`];
  return base ? `${base}/${m[2]}${m[3] || ''}` : null;
}
```

Checked before the code/asset downgrade in `rewriteLinks`. This is what lets Bibliosoph's wiki link to **Module ownership** and **dnd5e conditions** on yours. Worth having in both directions once other modules publish.

### D. Confirm the classifier/duration boundary is intended

A classifier controls `type`, `typeLabel`, `name`, `context`, and `conditionIds` only — `durationLabel` is computed independently and appended. That is almost certainly right, and it is now documented as a constraint in `api-effects.md`. Flagging only so it is a decision rather than an accident: a module that knows its own effect measures time in rounds still cannot say so.

---

## Standing requests, unchanged

Not repeating the detail — these are already tracked in Bibliosoph's `TODO.md` under **Blacksmith Requests**:

1. Public cross-client toast delivery (`toast.publish(config, { recipients })`)
2. Stats query API or events, before phase 3 announcer design
3. MIDI attacker/item attribution on `damageResolved`
4. Advantage/disadvantage on requested rolls (your #6) — treatment rolls are blocked on it

`damageResolved` itself landed and injury automation now rides it. Thank you — that request format worked, which is why this note follows the same shape.
