# Plan: Player Treatment via Medicine Rolls

**Status:** BUILT (2026-07-27) — phase 1 implemented. Step 0 verified: `openRequestRollDialog` silent mode covers actor/DC/hidden-DC/Medicine + `blacksmith.requestRollComplete` GM-side resolution with full roll JSON (d20 face extractable). Gap: request cannot force advantage/disadvantage → filed as Blacksmith Request #6; interim = required mode in the request title + GM-side formula detection with mismatch logging. Attempt tracking shipped in phase 1 (`treatAttempts` flag; no reset mechanism yet — reset-on-rest remains phase 2).
**Depends on:** Blacksmith rolls API request-side verification (Step 0 — do this first).

## The experience

Anyone at the table can try to treat an injury. The Check-Up card (and the injury card) carries a Treat button; a player clicking it triggers a **Medicine check** against the injury's DC through Blacksmith's roll tools. Success removes the injury (and unwinds its conveyed conditions) exactly like today's GM treat — heal burst and all. Failure spends that character's attempt. The GM never rolls: their click remains instant discretion-treat.

## The rules matrix (locked)

| Situation | Medicine Check |
|---|---|
| Standard treatment (no Healer's Kit) | Roll normally vs. Injury DC |
| Using a Healer's Kit | **Advantage**, Injury DC −2 |
| Self-treatment | **Disadvantage** |
| Self-treatment with a Healer's Kit | Roll normally (adv/dis cancel), Injury DC −2 |

- **Nat 20 — critical heal.** Succeeds regardless of DC AND restores **5 HP** to the patient.
- **Nat 1 — fumbled heal.** Fails and deals **5 HP damage** to the patient.
- Crit/fumble behavior is one shared toggle setting (both on or both off). Symmetric ±5 HP.
- The kit is always optional: anyone may roll bare-handed at the plain DC — the kit only buys the advantage and the DC reduction.

## Rulings (locked)

1. **Attempts:** each character gets **one attempt per injury** ("if I were bleeding out I'd want everyone to try"). Tracked as a flag on the injury effect: `flags.coffee-pub-bibliosoph.treatAttempts: [actorId, ...]`. Reset semantics (per long rest?) deferred. **Complexity valve:** if attempt-tracking complicates phase 1, it slips to phase 2 and phase 1 ships with unlimited attempts.
2. **Scope:** **only injuries are rollable.** Crits and fumbles are a different kind of thing — GM-only removal with a **different icon** (not the bandaid; suggest `fa-eraser` for "dismiss"). Loose conditions: no player buttons either; they're removed when their bundle is treated (existing unwind) or by the GM directly.
3. **Per-viewer buttons:** the card HTML is the same for everyone; the existing `renderChatMessageHTML` hook prunes buttons client-side by `data-kind` + `game.user.isGM`. Players see crit/fumble/condition rows informational-only. No "you can't do that" messaging needed.
4. **GM always succeeds, no roll.** Current instant-treat path unchanged.
5. **Adjacency:** GM discretion in phase 1. No range enforcement.
6. **DC is hidden from players.** Not rendered on the Check-Up or injury card; players see it only in the roll result card. (GM hover could show it — nice-to-have.)
7. **Kit:** Healer's Kit only for now (configurable item-name list is future). Detection by item name on the **roller's** actor.

## DC source (severity ladder)

1. Explicit `treatmentDC` on the injury (schema-tightening TODO adds the field).
2. Severity-derived default: minor **10**, moderate **15**, major **20**.
3. Neither known → flat **15**.

## Architecture — GM-authoritative intents (the Blacksmith pattern)

A non-owner roller can neither delete the patient's effects nor edit the GM's chat message, so everything flows as intents (same pattern as the shipped `treatStamp` relay, extended):

1. Player clicks Treat on an injury row → client computes the roll context (kit present? self-treatment? DC after kit reduction) and requests the Medicine check via the Blacksmith rolls API.
2. Roll resolves → result relayed to the **active GM** with context `{messageId, actorUuid/tokenId, effectId, rollerActorId, total, d20, dc}`.
3. GM handler **independently validates** (payloads are user-controlled): message is one of our Check-Up/injury cards; effect still exists on that actor; roller hasn't already attempted (flag check); recompute success from the roll data.
4. On success → GM runs the existing treat path (delete effect, unwind conditions, heal burst), sweeps stamps, and — per the "Consume Kit Uses" mode — decrements one use on the roller's kit (Every Attempt mode decrements on failures too, in the failure branch below) (GM-side, keeping ALL mutations on the GM; the dnd5e 4.x+ uses model is spent-based: available = `system.uses.max - system.uses.spent`, and "Destroy on Empty" handles quantity itself). Nat 20 additionally restores 5 HP. On failure → GM records the attempt flag (kit use spent only in Every Attempt mode); nat 1 → applies 5 HP damage (direct `actor.update`, same injury-recursion-safe path as injury damage).
5. `message.update` by the GM; Foundry syncs to all clients.

## Step 0 — verify the Blacksmith rolls API request side (BEFORE building)

We consume `skillCheckResolved` today; this feature needs the other direction. Verify against the wiki (github.com/Drowbe/coffee-pub-blacksmith/wiki/api-rolls) and the skill-check window code:

- Can we **programmatically request** a skill check (Medicine) for a specific actor?
- Can the request carry a **DC**, an **advantage/disadvantage** state, and an opaque **context tag** returned in the resolution event?
- Does the resolution event expose **d20 face** (for nat 1/20) and success-vs-DC?

If any piece is missing → **Blacksmith Request #6**, filed early so it lands event-shaped (the damageResolved playbook). Do not build a parallel roll system.

## UI changes

- **Injury rows (players + GM):** bandaid button. Player click → roll flow; GM click → instant treat. Second line unchanged (no DC shown).
- **Crit/fumble rows:** GM-only button, `fa-eraser` (or similar — pick at build time), instant dismiss. Hidden for players by the render hook.
- **Loose condition rows:** GM-only button, same dismiss icon. Hidden for players.
- **Attempted-and-failed state:** row shows who has tried (e.g. dimmed "attempted: Skylar, Bram" on the second line or tooltip) — design at build time.

## Settings (Injuries section, existing conventions)

- **Treatment Rolls** (Automation-style dropdown or checkbox): off = GM-only treat (today's behavior) / on = players roll Medicine.
- **Treatment Crits & Fumbles** (checkbox, default on): nat 20 crit heal (+5 HP) / nat 1 fumbled heal (−5 HP).
- **Consume Kit Uses** (dropdown, default **Every Attempt**): *Every Attempt* — a use is spent whenever the kit's benefit was applied, success or failure (bandages get unwrapped either way; makes "should we use the kit?" a real decision, and with one-try-per-character the choice of WHO rolls with the kit becomes the tactical moment) / *On Success Only* — failure costs only the attempt / *Never* — presence-only, the kit is never consumed. Kits without a uses pool are presence-only in every mode.
- (Deferred: DC defaults override, kit item-name list, attempt reset timing.)

## Resolved decisions (2026-07-27)

1. **Kit uses — honor them, "Consume Kit Uses" dropdown, default Every Attempt** (revised 2026-07-27 after economy discussion: consume-on-success made kit use a no-brainer checkbox; per-attempt consumption is the mode where using the kit is an actual decision). Modes: Every Attempt / On Success Only / Never. Homebrew kits with no uses pool are presence-only in every mode. Phase 1 simplification permitted: if uses handling adds real complexity, ship presence-only first — merely owning the kit "marks them as the healer."
2. **Crit heal — flat +5 HP restored** on the nat 20, mirroring the nat 1's 5 HP damage.

## Phases

- **Phase 1:** Step 0 verification → roll flow for injuries, matrix + crit/fumble toggle, GM instant path, per-viewer button pruning, DC ladder, kit detection (per decision), attempt tracking (if simple).
- **Phase 2:** attempt-gate hardening + reset-on-rest, kit item-name list setting, aggravation/DC-escalation options, adjacency options, GM hover-DC.
