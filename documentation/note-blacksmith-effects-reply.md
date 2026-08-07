# Reply to Blacksmith: duration units, and one rule to argue

**From:** Bibliosoph dev
**Date:** 2026-08-07
**Re:** your reply of 2026-08-07 (A shipped, B staged, C split, D answered)

Your two questions answered first, then one concession, two bugs your reply flushed out on our side, and
the single item we want to argue rather than accept.

---

## Your questions

### 1. What do we need from `remaining` — a number to compare, or a string to display?

**A number to compare, with its unit. We render our own strings.**

Bibliosoph does not consume `getDisplayEffects` at all today. The Check-Up card builds its own rows
because "2 rounds remain" reads better at the table than Foundry's label, and that judgement is ours to
make. What we cannot make on our own is a correct comparison, which is the part we keep getting wrong.

So your correction to ask 1 is the right one and better than what we asked for. `{value, unit}` is exactly
the shape we need. A seconds-normalized number would have been actively harmful here: it would have let us
carry on believing a single unit exists, which is the belief that produced both bugs below.

If a display string is cheap to expose alongside it, we would use it for anything new. But it is not what
we are blocked on.

### 2. Times Up settings on the world we verified against

| Setting | Value |
|---|---|
| Max rounds to convert | **10** — so a 60s threshold at `roundTime` 6 |
| Expire rounds/turns duration effects on combat end | **enabled** |
| Enable Times Up | enabled |
| Set start for transfer effects | enabled |
| Update passive effects | enabled |

The second one is the one that changes semantics: converted effects are deleted when combat ends, so for
any Bibliosoph affliction under 60s, `expiry: linger` never happens — the wound is binned instead of
surviving to be treated. That is observed behaviour, not inference.

---

## Conceded

> no Coffee Pub module should

You are right and we were wrong by exactly the one step you identified. A satellite must not; the hub must.
Reading a third-party module's flags is what an adapter is for, and we cited `utility-midi-resolution.js`
as the precedent in the same breath as forbidding the technique it uses. The rule as you have written it —
**Blacksmith absorbs third-party variance; satellites never branch on it** — is the correct form, and we
have no exception to ask for.

---

## Two bugs your reply flushed out, both ours

Your note that a second source of rounds exists — dnd5e's `DurationData.getEffectDuration()` mapping item
units, plus the sheet's Temporary section defaulting `duration.rounds` to 1 — is what made us re-check our
own unit assumptions rather than treating this as one module's doing. Both were wrong.

Foundry reports `duration.remaining` **in the unit the document carries**: seconds for a seconds-based
duration, rounds as a decimal for a turns-based one. We assumed seconds everywhere.

**`roundsRemaining()`** divided `remaining` by six unconditionally, so a five-round effect reported
"1 round remains" — understated by a factor of six for every rounds-based duration.

**`hasExpired()`** gated on `duration.seconds` being positive *before* reading `remaining`, and returned
`false` — permanent — when it was not. Times Up nulls `duration.seconds` on conversion, so **every
converted affliction looked permanent to us and our expiry silently opted out.**

That second one is the actual explanation for the symptom in our original note: an expiring critical that
produced a recovery burst but no Bibliosoph announcement. Times Up expired it because we had stopped
claiming it. Both are fixed in `manager-injury-ticks.js` and verified against both unit types.

Worth stating plainly because it changes what §B is for: **we are not blocked on you.** With the unit
handling corrected our expiry works standalone. The case for the adapter is that every consumer will
independently get this wrong in the same way — we did, in code that had been reviewed and shipped — not
that we cannot proceed. Take asks 1 and 3 at whatever pace suits; ask 2 can wait for its own decision, and
your reasoning for separating it is better than our reasoning for bundling it.

Your §A trap does not reach us, incidentally: we never read your `durationLabel`, and our own fallback uses
core's `duration.label` directly. Flagging so you can discount one consumer when weighing it.

---

## The one we want to argue: cross-module links

You declined the sibling-wiki link rewriting on a suite rule — cross-module references get deleted, not
relinked, because a corrected cross-module link is still coupling. You invited the argument to be made
against the rule, so here it is.

**The rule is right for the direction it was written for, and over-broad in the other.**

Every satellite has Blacksmith as a *required* dependency. A link from Bibliosoph's docs to
`Module ownership` on the Blacksmith wiki does not create coupling — the coupling already exists, is
mandatory, and is the entire architecture. The link only makes an existing dependency legible.

The reverse is a different thing entirely. Blacksmith pointing into Squire's documentation would couple a
hub to an optional consumer, and would break the moment that consumer is not installed. Same for one
satellite pointing at a sibling.

So we would propose the rule become **directional**:

- **Satellite → Blacksmith: allowed.** Documents a dependency that is already required.
- **Blacksmith → satellite: not allowed.** Couples a hub to something optional.
- **Satellite → sibling satellite: not allowed.** Two optional things, neither guaranteed present.

Your stated reasoning — "Blacksmith's docs describe Blacksmith" — is fully preserved by this, because the
prohibition on outbound links from Blacksmith is exactly the case it was defending. What it does not cover
is a satellite pointing up its own dependency chain.

If the rule stands as written we will comply and strip the links; the `siblingWikiUrl` rewriting in our
`wiki-sync.mjs` is two dozen lines and easily removed. But it currently means our architecture docs cannot
tell a reader where the ownership rules they are being judged against actually live, and that seems a real
cost for a coupling that is not real.

---

## Addendum — the two things your settlement asked of us

**1. Your predicate is ported.** `siblingWikiUrl` in our `tools/wiki-sync.mjs` is now yours verbatim with
`THIS_MODULE = 'coffee-pub-bibliosoph'`, comment block included so the rule reads the same wherever
somebody finds it.

Worth flagging why that mattered: our version carried a **map** of sibling wikis, and Squire was already in
it. Under the rule as settled that is satellite → satellite and refused — so our implementation would have
permitted exactly the direction we had just argued should not be allowed, in the same file where we argued
it. Testing the target against `HUB` rather than against a list refuses it structurally. Verified: hub
links still rewrite, no sibling URLs are emitted.

**2. Pages we link to — the contract you asked for.**

| Page | Inbound links | From |
|---|---|---|
| `architecture-ownership` | 3 | `architecture/README.md` (Home), `architecture-bibliosoph.md`, `architecture-injuries.md` |
| `guide-dnd5e-conditions` | 1 | `architecture/README.md` (Home) |

That is the whole set. Both are pages we asked you to create, so neither should be a surprise, but the
count is what matters if either gets renamed. It is also recorded in a comment at the predicate in our
`wiki-sync.mjs`, so whoever changes our docs sees it at the point the dependency is created rather than
having to remember this note. We will tell you if the set changes.

---

## Received, no action

A shipped, D answered, the `EPERM` fix taken as portability, and the stale colon warning noted — thank you
for chasing that down rather than leaving it to trip the next port.

Your point in D that authoring `{rounds: N}` gets us round labels but that Times Up can undo it in either
direction is well taken. We are not going to build on that.
