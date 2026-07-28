# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [13.3.4]

### Added

- **Treatment Rolls — anyone can try to heal.** With the new **Player Treatment Rolls** setting (Injuries section, default on), any player can attempt to treat an **injury** on the Check-Up card with a **Medicine check** against the injury's DC — rolled through Blacksmith's Request a Roll system (their character gets the roll card; the DC stays hidden until the result). The rules matrix: a **Healer's Kit** in the roller's inventory grants Advantage and lowers the DC by 2; **self-treatment** imposes Disadvantage; both at once cancel to a normal roll at the reduced DC. Each character gets **one attempt per injury** (failed attempts are recorded on the effect and shown on the card as "tried: …"). With **Treatment Crits and Fumbles** on (default), a natural 20 heals the injury regardless of DC and restores 5 HP; a natural 1 fails and deals 5 HP. **Consume Kit Uses** (Every Attempt, default / On Success Only / Never) spends the kit's limited uses (dnd5e's spent/max model; kits without uses are presence-only). DCs come from the injury's severity — minor 10, moderate 15, major 20, fallback 15 — newly stamped into applied injuries. Resolution is **GM-authoritative end to end**: the player's click posts the roll request and relays the context to the active GM, who re-validates everything against live state (effect still present, attempt not already spent, success recomputed from the delivered roll) before removing the affliction, adjusting HP, consuming kit uses, and posting a table-visible outcome line. The **GM never rolls** — their click remains instant discretion-treat. Scope rulings baked in: only injuries are rollable; crit/fumble and loose-condition rows are GM-only, with a **dismiss eraser** icon replacing the bandaid and their buttons hidden entirely on player clients. One Blacksmith API gap found during verification (the request cannot force advantage/disadvantage — the required mode rides in the request title and the resolver detects what was actually rolled) is filed as Blacksmith Request #6. Design: `documentation/plan-treatment-rolls.md`.

- **Injuries are now a typed journal page you can actually edit.** Injury pages are a registered Foundry document subtype (`coffee-pub-bibliosoph.injury`) backed by a data model, so every mechanical field lives in validated `system` data instead of HTML — **Foundry itself now rejects an illegal category, severity, or condition at the moment of saving**, rather than the module discovering it mid-combat. With that comes a **proper editing sheet**: damage type and severity as dropdowns, an image picker, damage/duration/odds/condition/DC fields, and a live warning when a value fights its own severity, with the page's own rich-text area repurposed as free-form GM notes. This is what makes the library genuinely yours — writing a homebrew injury is now filling in a sheet, not hand-editing an HTML metadata block and hoping the parser agrees. The page title *is* the injury name, so it can never disagree with itself. The structure deliberately mirrors Squire's CODEX pages so the shared scaffolding can later be lifted into one Coffee Pub toolkit. Reading is backward-compatible (typed `system` → page flag → legacy HTML), so existing worlds keep working until they rebuild. **Requires a world relaunch** for Foundry to register the new page type.
- **Injury data model rebuilt — generated journals, a real schema, and rarity that finally works.** Injuries are now defined by a strict schema (`documentation/spec-injury-schema.md`) and their journal pages are **generated** from `resources/injuries.json` rather than hand-maintained, which structurally ends the drift that had pages advertising "Duration: 50" over metadata that said 300. Each page is laid out image → caption → description → treatment → metadata, and carries its whole record as a **page flag** that the module now reads in preference to parsing HTML (older pages still parse, so nothing breaks before the compendium is rebuilt). The schema drops three fields that were always parsed and thrown away (`journaltype` and `foldername` were constants; `action` is derived from the category), promotes `damage`, `duration`, and `odds` to real numbers, and requires lowercase dnd5e condition ids — the loose display-name strings ("Blind", "Prone") that caused the original condition bugs can no longer be authored. **`odds` now actually weights which injury you get**: it was authored across all 127 injuries with clear intent (minor injuries average 38, major 15) but the picker chose uniformly at random, so serious wounds landed far more often than intended. Weighted selection moves the mix from 46% minor / 33% moderate / 20% major to **64% / 26% / 10%**. The **General** category — the fallback for untyped or evenly-mixed damage, and likely the most-rolled of all — grew from 2 injuries to 12. Every injury now displays its **caption** beneath the card art (102 were written and never shown; the remaining 25 are newly authored), two injuries whose art fought their category were re-illustrated, and six flavor-only status strings with no dnd5e equivalent became `none` with their colour left to the prose. A **balance pass** followed, now that odds decide what you actually see: nine odds values, thirteen durations, and six conditions were corrected where an entry fought its own severity — a *major* that expired in thirty seconds, a *minor* that ran four hours, and five minor injuries that were applying `incapacitated`, `stunned`, or `paralyzed`, costing a player their entire turn over a light wound. The authored corpus was otherwise left alone; its medians already formed a clean 4:2:1 rarity ladder. **Force** and **Fire**, the two thinnest categories, gained 7 injuries between them. The library now holds **144 injuries across 14 categories**, every category's most likely result is a minor, and the severity mix settles at 67% minor / 25% moderate / 7% major. New tooling: `npm run injuries:validate` (schema gate — condition ids, severity/damage bands, duplicate titles, turn-denying conditions on light injuries, and whether every icon actually exists on disk), `injuries:generate` (validate → generate → verify every page reads back exactly as authored), and `injuries:build` (the above plus the pack build).
- **Per-injury treatment DCs.** An injury's **severity** now sets the DC its treatment roll must beat — minor **10**, moderate **15**, major **20** — carried on the applied effect so the difficulty travels with the wound (all 127 compendium injuries already carry a valid severity, so every one of them gets a real DC rather than a flat default). Individual injuries can override the ladder with an authored `treatmentdc:` line in their page metadata, for hand-tuned wounds that don't fit their severity band. The DC is never shown to players — it appears only in the roll result — while the GM can read any injury's resolved DC from the test harness's treatment report.
- **Injury automation — damage-threshold triggers:** Injuries now fire automatically when a single application of damage deals at least a configurable percentage of the target's **max HP** (slider, default 50% — the DMG "massive damage" convention). Detection rides Blacksmith's rolls API — the new `rolls.on('damageResolved')` event (implemented by Blacksmith same-day from Bibliosoph's request, `documentation/request-blacksmith-damage-api.md`), which centralizes the dnd5e damage-hook correlation and delivers the final post-resistance amount plus the typed damage breakdown on the GM client; healing arrives flagged and is filtered out. Requires a Blacksmith build with `damageResolved` (dormant otherwise), and works with chat damage buttons and MIDI's apply path alike since both funnel through dnd5e's `Actor#applyDamage`. The injury is rolled from the journal compendium by the hit's **dominant damage type** (largest typed component; untyped/mixed falls back to General). The Injuries section gains the full crit/fumble treatment: **Automation** (Off / Toast — manual / Toast — click to roll / Toast — automatic, default click; in click mode the **injured player's** toast persists with a "Roll for the Injury" pill and clicking posts their injury card), **Injury Threshold** slider, **Triggered By** (Everyone / Players / NPCs and Monsters — default Players, judged by the *injured* actor's type), a combined **Toolbar Button** dropdown, and a **Toast Design** subsection (title/message with `{name}`, `{type}`, `{damage}`, `{percent}` codes, button text, size, animation, sound, colors, background image; the injured token's portrait is the toast avatar). The manual toolbar flow (selector card → category click) is unchanged and now macro-free: the **Injuries Enabled** checkbox, both toolbar checkboxes, and the **Injury Macro** setting are retired along with all injury macro-binding code, and the injury card's fake "for show" d100 is gone. Healing never triggers; dropping to 0 HP is deliberately not a trigger (revisit later). Requires dnd5e (dormant on other systems). See `documentation/plan-injuries-automation.md`.
- **Injury burst — a procedural canvas effect when injuries land.** Applying an injury now detonates a visual on the token: a **shockwave ring** expanding outward, a **spray of shard fragments** flying through it, and the **injury name rising** over the token damage-number style — all drawn procedurally (PIXI + Foundry's scrolling-text engine, zero image assets) and **colored by damage type** (fire orange, cold ice-blue, necrotic olive, psychic magenta, slashing crimson, and so on across all fourteen categories). Every connected client sees it with no socket traffic: applied injuries carry a flag, and Foundry's `createActiveEffect` hook fires everywhere, so each client draws the burst locally. Works on every apply path — button clicks, bound-target cards, and auto-apply. **Crits and fumbles get their own bursts too, each with its own personality**: applying a critical detonates a triumphant gold starburst (rotating spikes through a gold-and-crimson double ring, the result name blazing upward), while applying a fumble plays the sad fizzle — the ring *implodes*, sputter particles drift *downward* with a sway, and the name *sinks* in deflated slate-grey. Following review the fumble burst was redesigned from a gentle fizzle into a proper mishap: a **jagged impact ring** cracks outward, **debris chunks are knocked skyward and tumble back down under gravity**, a low **dust cloud** spreads, and the name sinks with a defeated wobble. All three bursts are exposed as a **macro API** — `game.modules.get('coffee-pub-bibliosoph').api.playCritBurst()` / `.playFumbleBurst()` / `.playInjuryBurst(null, 'Fire', 'Roasted!')` — defaulting to the targeted (then selected) token when no token is passed. New `manager-injury-effects.js`; the test harness Tools tab has one preview button per burst type. The **General** injury category now displays as the *absence* of a type: `{type}` in toast templates renders as nothing with the sentence collapsing cleanly ("took a brutal hit" instead of "took a brutal General hit") — the category key is unchanged in data.
- **Check-Up & Treatment — the injury lifecycle completed.** New **Check-Up** toolbar button (stethoscope, GM-only, after Injuries, shown under the same Automation gate): target or select a character and click to post a **Check-Up card** — the patient's portrait and name with a procedural **diagnosis narrative** ("Skylar is badly wounded (9/32 HP) and suffering from 3 afflictions…"), then one row per affliction showing its icon, name, the **conditions it conveys**, the injury's **Treatment prose** where it exists (the field finally earns its keep as the GM's adjudication text), and its own **Treat** button. Scope is deliberately broad: rows cover Bibliosoph-applied outcomes (injuries, crits, fumbles) *and any active temporary effect or condition on the actor* — plain toggled conditions, other modules' spell effects, stray legacy afflictions — making the card a one-stop "what is going on with this token and how do I clear it" tool; passive item effects are excluded. A clean token gets a clean-bill-of-health card. Clicking Treat (ownership-gated; the GM always qualifies) removes the affliction, **unwinds its toggled condition** unless another untreated affliction still conveys the same one, stamps the row "✓ Treated", and deliberately does **not** restore lost hit points — treatment ends the ongoing affliction; healing is healing's job. Non-Bibliosoph effects get the burst flag stamped just before deletion, so the heal animation plays for them too. Pseudo-conditions (bleeding, burning, diseased) vanish automatically since they ride on the effect itself. And recovery is as visible as the wound: removing any flagged affliction — treatment click, manual deletion, expiry cleanup — plays a **treatment burst** on every client (a soft green ring contracting gently home, bright motes rising, the word lifting away in healing green), exposed as `api.playTreatmentBurst()` alongside the others. The harness gains a Treatment-card scenario and a heal-burst preview.

### Changed

- **Automation is now a true automation ladder** (crits, fumbles, and injuries alike): *Off — not using this feature* (no detection, and the toolbar button is hidden regardless of the Toolbar Button setting); *Manual — toolbar button only* (no detection, no toasts — the classic hand-rolled flow); *Automated — toast with a roll button* (detection on, the owner clicks their toast to roll the card); *Fully automated — toast and card* (card posts immediately; only Apply remains a human act). This replaces the earlier toast-centric framing where Manual still fired an announcement toast — announcement-only returns properly with the phase-3 announcer. Stored values are unchanged, so existing worlds keep their selections; a reload is needed for toolbar-button visibility to reflect an Automation change. The **Toolbar Button placement settings are gone entirely** — any Automation mode other than Off shows the feature's button in both the Coffee Pub and Foundry toolbars, no setting needed. Each of the three sections is now organized as **Configuration → Chat Card → Toast Design**, with the chat-card settings (style, roll table / compendium, injury images and sound) under their own subheading. A new **Automatically Apply Injury** checkbox (default off, right after Automation) makes automation-created injury cards apply to the damaged character *before* posting — the card arrives pre-stamped "✓ Applied to X" instead of carrying an Apply button; manual selector cards keep their button, and any auto-apply failure falls back to the normal button. Automation labels are per-feature and self-describing (e.g. "Automated Detection: Detect injuries, show a Toast Button to roll").
- **Check-Up card redesigned into four zones.** Afflictions are now grouped under ordered zone headers — **Injuries** (bundles of afflictions), **Criticals**, **Fumbles**, and **Effects & Conditions** (everything not stamped by Bibliosoph) — with empty zones omitted. Rows are single-line — `[icon] name — conditions [treat]` — with the Treat button reduced to an **icon-only bandaid** at the row's end (hover for the tooltip; the hover card on the icon still shows the full description). Real conditions conveyed by an injury (prone, blinded…) appear **both** in the injury row's conditions text *and* as their own independent rows in Effects & Conditions, because dnd5e toggles them as separate effects — so a patient knocked prone and set aflame by one injury can have just the prone treated (they stood up) while the injury and its burning remain; treating either side stays safe, since condition unwinding already checks whether another untreated affliction still conveys it. Pseudo-conditions (bleeding, burning, diseased) ride on the injury effect itself and so appear only within its row. With the bandaid claimed by healing, the **Injuries toolbar button** gets a new icon (injured figure, `fa-user-injured`).
- **Players can treat their own characters — with the card staying honest.** The Treat button was always ownership-gated (a player may treat their own character; the GM may treat anyone), but a player's successful treat couldn't flip the row to its Treated stamp — players cannot edit a GM-owned chat message, so the card kept showing an active button for a gone affliction. Now the click becomes an **intent relayed to the active GM** over the Blacksmith socket layer (the GM-authoritative pattern Blacksmith itself uses for skill-check cards): the player still performs the treatment locally — effect deleted, condition unwound, heal burst — and the GM performs the authoritative `message.update`, which Foundry syncs to every client. The GM-side sweep never trusts the request: it re-checks every row against the actor's live effects and stamps only rows whose affliction is verifiably gone, so a forged or stale relay can't mark anything that isn't actually cured. Treating a **bundled injury** also flips the rows of the conditions it took with it (treat Severed Strands and the "Prone — via Severed Strands" row stamps in the same pass), and rows that went stale any other way (sheet deletion, expiry) get swept up on the next treat. Second lines now append **remaining duration** ("Bleeding · 10 Minutes") and both row lines truncate with an ellipsis instead of wrapping — full text stays on the hover card.

### Fixed

- **Injury data scrubbed: invalid condition names fixed.** An audit of all 127 injuries against dnd5e's registered conditions (`CONFIG.statusEffects`) found 20 with names that could never apply. The unambiguous ones are fixed in both `resources/injuries.json` and `packs/_source/injuries/` (18 corrections): `blind` → `blinded` (5, including one `deafened, blind` combo collapsed to `blinded` — the schema is single-condition), `frozen in time` → `paralyzed`. Thirteen injuries carry flavor-only values with no dnd5e equivalent (confused ×6, disoriented ×2, clumsy fingers, chilled to the bone, sluggish, twitching, headache) — left as-is for now; they display on the card and are skipped gracefully with a log at apply time. Following review, 15 further mappings were applied (severity-scaled): major mental/spasm injuries → `stunned` (Cranial Cacophony, Cerebral Overload, Psionic Meltdown, Electric Shockwave); cold injuries → `exhaustion` (Frozen Heartbeat, Slippery Slope Syndrome), plus Wight's Weakness; thunder/tinnitus → `deafened` (Thunderous Migraine, Thunderous Tinnitus); the four moderate slashing wounds → `bleeding` (Bleeding Edge, Jagged Gash, Rending Rift, Sashimi Slice); Decaying Limb → `diseased`; Fiery Footsies → `burning` (ongoing fire damage — mind your feet). Six injuries intentionally keep flavor-only text with no condition (confused ×3 minor, disoriented ×2, clumsy fingers). The compendium has been rebuilt from the corrected source. Testing then exposed a deeper, pre-existing corruption in the compendium source: **48 injuries carried their journal-page sort value glued onto the status text** ("Exhaustion20144", "Bleeding6426" — an artifact of the original import), producing garbage condition names on cards and in toggles. All 96 occurrences (two HTML contexts per page) are stripped, bringing `packs/_source` into exact agreement with `resources/injuries.json` for the first time. Testing also showed the DFreds Convenient Effects integration failing ("Cannot find effect to toggle" — outdated API signature, and DFreds lacks dnd5e 5.x conditions like bleeding); **DFreds support is removed entirely** — conditions apply via core Foundry only, and still display in DFreds' panel when that module is present. The deprecated `renderChatMessage` hook is replaced with `renderChatMessageHTML`. Follow-up testing revealed dnd5e treats `bleeding`, `burning`, and `diseased` as **pseudo-conditions** — rules-reference hazards with official names and icons that are deliberately not toggleable statuses; the applier now handles them the way dnd5e intends: the injury effect itself carries the status (`statuses: [id]`), so `actor.statuses` reports it and the injury's icon marks the token, while real conditions (blinded, stunned, exhaustion, …) still toggle via core `Actor#toggleStatusEffect`.
- **Injury apply mechanics corrected: real damage, core-Foundry conditions.** An injury's HP damage is now dealt **once, for real, on apply** (direct HP deduction — deliberately outside the damage pipeline so an injury's own damage can never re-trigger the injury automation). Previously it was an Active Effect change suppressing `hp.value`, meaning the "damage" silently came back when the effect ended and was never real damage at all. And injury status effects no longer require DFreds Convenient Effects: conditions are validated against the system's `CONFIG.statusEffects` and applied via core Foundry's `Actor#toggleStatusEffect` — DFreds is still used when it's active, but is never a dependency.
- **Apply buttons: bound targets, "Apply to [name]", and applied stamps.** Injury cards created by the automation now **bind their Apply button to the actor who took the damage** — the button reads "Apply to Favia" and applies to that actor directly, no targeting needed (manual selector cards keep click-time targeting, and crit/fumble buttons deliberately stay generic since the right recipient there is a judgment call made at click time — closest enemy, chosen party member — not the attack's target). After a successful apply, every card's button is **replaced with a "✓ Applied to X" stamp** in the stored message, so it can't fire twice and the card records who carries the effect; the swap is skipped when the clicker can't modify the message (a non-GM clicking someone else's card), where the applier's duplicate guard still prevents double-application.
- **Status-effect application unified (crit/fumble/injury):** All card-apply buttons now flow through one shared applier (`manager-status-effects.js`) with a single behavior contract: targeted token(s) first with selected as fallback, permission-aware, duplicate-safe, and the effect always carries a **description**. This fixes several injury-path defects the crit/fumble path didn't have: injury effects never received a description (they now carry the injury text plus treatment), the effect image used the `icon` key deprecated since Foundry v12 (now `img`), applying with nothing selected was a silent no-op (now warns), the payload used the corruption-prone legacy encoding (now JSON, with a fallback decoder for cards already in chat history), and the DFreds condition check read `e.data.label` — broken since v10 — so conditions were never detected as present (now `e.name`, and the toggle is awaited). Behavior change: the injury Apply button now applies to the **targeted** token first, falling back to selected, matching Apply Critical/Fumble.
- **Performance cleanups:** The chat-card Handlebars template was fetched from disk and re-compiled on *every* card posted (five separate call sites — crit/fumble/inspiration, injury, injury selector, and both investigation paths); it is now fetched and compiled once per session and reused. The investigation narrative JSON is likewise cached after first load. The injury selector's category buttons no longer double-bind their click listeners on chat re-renders (previously a re-rendered selector could post duplicate injury cards from one click). The injury trigger's damage-type stash prunes stale entries so cancelled damage applications can't accumulate.

## [13.3.3]

### Added

- **Roll Toasts (crits & fumbles):** Phase 1 of the Blacksmith rolls-API integration. When an attack roll resolves as a critical or a fumble, an on-screen toast announces it to every player — no chat-card parsing, no manual button press. Detection rides Blacksmith's new `module.api.rolls` classification (`attackResolved`, fired on the GM client; requires a Blacksmith release newer than 13.11.3 — on older builds the feature stays dormant), delivery rides the Blacksmith socket API, and each client renders locally via the toast API. The toast settings live in the **Critical Hits** and **Fumbles** settings sections — both promoted to full banner sections (like Injuries) — each with enable toggle, title, message (`{name}` inserts the roller's token/actor name), FontAwesome icon, size, duration, animation, sound, and border/background colors, plus a shared "Whose Rolls Trigger Toasts" filter (everyone vs. players only). Hidden/blind/private rolls never broadcast: the GM still gets the toast, the table does not. Off by default.

### Changed

- **Crit/fumble sections simplified further.** The toast now shows the **roller's portrait** (actor image, falling back to token art) as its avatar instead of the configured icon — the icon setting remains only as a fallback when no portrait resolves. In settings, **Automation** now leads each section; the two toolbar checkboxes are merged into one **Toolbar Button** dropdown (None / Foundry Toolbar / Coffee Pub Toolbar / Both, kept for manual rolls); the **Enabled** checkbox is gone (Automation "Off" + Toolbar "None" cover it); the **Macro** setting and all macro-binding code are removed (toolbar buttons now roll the table directly via the same path as click-to-roll — no macro required, no startup validation nags); and the per-setting help text is cleared for a tighter sheet. The old "Whose Rolls Trigger Toasts" filter is now **Triggered By** (Everyone / Players / NPCs and Monsters) and filters on *what is rolling* — the actor type (character vs. everything else) — rather than which account made the roll, so a GM rolling for a PC still counts as a player roll and a player-controlled summon still counts as a monster. Both sections are organized under **Configuration** (Automation, Triggered By, Toolbar Button, Chat Card Style, Roll Table) and **Toast Design** (title, message, button text, size, animation, sound, colors, background image) subheadings. The Icon setting is gone — the toast always shows the roller's portrait, with a hardcoded fallback icon when no portrait resolves — and every "Card Style" label is now "Chat Card Style" to make clear it themes the chat card, not the toast. Toast title and message support substitution codes, documented in the Toast Design subheading: `{name}` (roller), `{target}` (first hit or targeted token), `{weapon}` (attack item), `{d20}` (die face), `{total}` (attack total).
- **Crit/fumble toasts: Automation modes, background image, color pickers.** One **Automation** dropdown per outcome type replaces the Enabled checkbox and Duration setting: *Off* (nothing happens), *Toast — manual rolls* (3-second announcement only), *Toast — click to roll* (**default**: the toast stays up for **the player who rolled the attack** until they click it — clicking rolls the crit/fumble table and posts the card from their client, making the moment theirs; hidden rolls hand the click to the GM instead; requires players to see the table), and *Toast — automatic rolls* (card posts immediately, 3-second toast). The clickable-roller mechanics ride the socket as plain data (roll action + roller user id) with each client arming the click handler locally, since functions cannot cross the relay; everyone else's toast self-dismisses after 3 seconds. The armed toast shows a call-to-action pill (Blacksmith's toast `callToAction`, rendered only where an onClick is live) so the roller can see their toast wants a click; the pill text is configurable per outcome type via the new **Button Text** setting in Toast Design (defaults "Roll for the Critical/Fumble Card"; blank hides the pill while the toast stays clickable). This supersedes the manual toolbar/macro click as the primary way cards get rolled. Each toast also gains a **Background Image** file picker (rendered behind the toast content with a dark scrim), and the border/background color settings now use Foundry's color picker instead of bare hex text fields.
- **Beverage Break, Bio Break, Insults, and Praise reimagined as Messages-window toasts:** The four social features no longer bind macros, sit in toolbars, or post chat cards. Instead, each enabled feature adds an image button to the Messages window header (beer stein, stomach, impact face, red heart); clicking one rolls that feature's table and announces the result to every connected client as an on-screen toast (small, 3 seconds, pop animation, shared fixed style, the button image as the toast avatar, each feature keeping its signature sound). Settings for all four live in a single **Random Toasts** subsection under Messaging — just four table dropdowns (Beverage, Bio, Insult, Praise), each defaulting to "None"; choosing a table shows that header button, None hides it (no enable toggles; the toolbar toggles, card style, and macro name settings are gone). With those moved, the now-empty Special Roll Tables section is removed. New `manager-social-toasts.js` carries the shared config and trigger; delivery rides the same Blacksmith socket relay as the crit/fumble roll toasts. Results are picked directly from the table (weighted random, no Roll evaluation), so no dice animate and dice-fulfillment prompts (e.g. Manual Rolls) never interrupt the button. This also retires the long-broken Insults chat-card path (a `CARDTYPEINSULTS`/`CARDTYPEINSULT` typo meant insult cards never posted from the toolbar or macro).
- **Inspiration promoted to its own section:** Moved out of Special Roll Tables into a top-level banner section above it, ahead of its planned evolution into a multi-card "deck" experience.
- **Settings reorganized:** The settings sheet now flows General → Messaging → Critical Hits → Fumbles → Injuries → Quick Encounters → Investigations → Special Roll Tables (Inspiration, Random Gifts, Shady Goods, Deck of Many Things, Beverage Break, Bio Break, Random Insults, Random Praise). Messaging is its own top-level section (was "Messages" under Communications, now removed as an empty shell), "Encounters" is retitled Quick Encounters, and "Beverage Messages"/"Bio Break Messages" are now Beverage Break/Bio Break. No setting keys changed — all stored values carry over.

### Added (later in cycle)

- **Apply Critical / Apply Fumble buttons on outcome cards:** Every critical and fumble chat card now carries an apply button. Clicking it applies the rolled result as a named status effect on the **targeted** token(s) (falling back to the selected token) — effect name "Critical: <result title>" or "Fumble: <result title>", with the card's text stored in the effect description, a per-type token icon (blood spray for crits, pained figure for fumbles), and no automatic mechanical changes. Duplicate-safe (skips tokens that already carry that effect) and permission-aware (you must own the target's actor, so in practice the GM applies to monsters and players to their own characters). Solves the "we forgot what the card said three rounds ago" problem — the result lives on the token until removed.

### Fixed

- **Table-card dice now show the real roll, before the card.** `getRollTable()` never returned the evaluated roll, so `createChatCardGeneral` passed `undefined` to Blacksmith's dice helper — which fabricates a decorative `2d20` when given nothing. The result: the card posted instantly (from a real but invisible, blind table roll) and then unrelated fake dice rolled afterward (and with manual dice fulfillment enabled, prompted for meaningless d20 entries). The real table roll now rides back in the result, is animated via Dice So Nice, and is **awaited** — so the sequence is dice first (showing the number that actually picked the result), then the card. The redundant blind roll-mode flag and the duplicate dice call inside `getRollTable` are gone. Applies to critical, fumble, and inspiration cards.

### Removed

- **Deck of Many Things:** Removed entirely — settings, macro binding, card branch, theme case, card-type flag, and language strings. The concept returns later as part of a planned "deck" experience built on Inspiration (see TODO.md).
- **Random Gifts and Shady Goods:** Both features are gone entirely — settings (including their Special Roll Tables subsections), toolbar buttons, macro bindings, the shared search-style chat card (`createChatCardSearch`) and its item-lookup helper, card-type flags, and language strings. Any macros users pointed at these features simply revert to their original behavior.
- **Dead roll-detection hooks:** The non-functional `createChatMessage` crit/fumble announcer (broken since Foundry v10 — it read `msg.rolls.total` on an array and compared against a hardcoded AC 15) and the empty `updateToken` HP-loss stub are gone, replaced by the rolls-API integration above.

## [13.3.2]

### Added

- **@Mentions in Messages:** Type `@` + a member's user name *or their assigned character's name* to mention them (`@Favia` notifies Favia's player). Partial names work — `@alicia` resolves to "Alicia Panicucci" (3+ characters, matched against the start of the name or any word in it, longest candidate wins) — and the message always displays the resolved full name as an accent-colored pill. Mentioned players get an upgraded alert: the menubar notification becomes "X mentioned you" with a pulsing `@` icon, and the on-screen splash always shows for mentions, even when group splashes are turned off. Mentions are limited to conversation members and are recomputed when a message is edited.
- **Clickable menubar notifications:** Built on Blacksmith's new actionable-notification API (Blacksmith 13.9.3+; older builds degrade to display-only). Clicking an incoming-message notification opens that conversation; clicking the unread-count notification opens the Messages window.
- **Persistent unread counter:** The "N Unread Messages" notification now appears on login *and* stays current as messages arrive; it persists until clicked or dismissed (pulsing for the first 10 seconds), clears whenever the Messages window opens, and reposts with a fresh count when the window closes with unread remaining. Notification hierarchy: when a message mentions you, only the mention notification shows — the ambient counter stands down until the next ordinary message or window close.
- **Collapsible conversation tray:** New chevron toggle in the Conversations header collapses the tray to a 48px icon rail — conversation icons and player avatars only, unread badges pinned to the icon corner, names available as tooltips. Per-client preference, remembered across sessions.

### Changed

- **Incoming-message notifications collapse per conversation:** A burst of messages updates one notification with a running count ("Alicia (3)") instead of stacking one per message, auto-closing 10 seconds (was 30) after the last message. The text is now just the sender's name — the envelope icon carries the rest. If any message in the burst mentioned you, the notification keeps the mention styling and count.
- **Messages init resilience:** The login unread notification is posted before any awaited setup (socket relay registration can stall on slow Blacksmith socket readiness and previously could silently swallow it), and socket-relay failures no longer abort the rest of Messages initialization.

## [13.3.1]

### Added

- **Pasted UUIDs become links:** Bare UUIDs pasted into a message (`Actor.xxxx`, `JournalEntry.x.JournalEntryPage.y`, `Compendium.scope.pack.Type.id`) are resolved on send (and on Save Edit) and converted to clickable `@UUID[...]{Name}` content links via `api.compendiums.formatLink`. Unresolvable UUIDs are left as plain text, UUIDs already inside an `@UUID[...]` enricher are skipped, and trailing punctuation is handled. The formatting help tooltip now mentions pasting UUIDs.

## [13.3.0]

### Added

- **Bundled Injuries compendium:** Bibliosoph now ships its own injuries. Blacksmith retired its content packs, which left the injuries feature with no out-of-the-box data source; the content now lives where it is used. The new `Injuries` journal compendium (`coffee-pub-bibliosoph.injuries`) contains **127 injuries across 14 damage categories** (Acid, Bludgeoning, Cold, Fire, Force, General, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant, Slashing, Thunder) — the full content rescued from Blacksmith's orphaned packs, including 25 injuries recovered from an older format that had not shipped in years, with legacy category typos fixed (Poision → Poison, Lightening → Lightning). Requires a full world relaunch after updating for the compendium to appear.
- **`resources/injuries.json`:** The canonical injuries dataset, formatted as a JSON array in the Blacksmith JSON Import / AI-prompt injury schema (`journaltype: "injury"`). Paste it into Blacksmith's Import tool to rebuild the injury journals in any world, or use it as the template for authoring new injuries with AI. Missing legacy values were derived from the data itself (severity from the prompt's damage ranges, odds from per-severity medians); recognized status effects re-cased to standard spellings.
- **Compendium pack tooling:** Pack content is version-controlled as per-document JSON under `packs/_source/` (LevelDB stays gitignored — no binary churn). `npm run packs:extract` pulls Foundry-edited pack content back to source JSON; `npm run packs:build` compiles source to LevelDB. The release workflow now builds the packs and ships `packs/` in the module zip.
- **Injuries rebuild plan:** `documentation/plan-injuries-datamodel.md` — the roadmap for moving injuries off HTML-metadata parsing onto a typed JournalEntryPage data model (Squire CODEX pattern) so users can create and edit their own injuries through a real form.

### Changed

- **Injury Compendium setting default:** `injuryCompendium` now defaults to the bundled `coffee-pub-bibliosoph.injuries` compendium, so injuries work out of the box on new installs. Existing worlds that previously saved this setting keep their choice — point it at "Coffee Pub Bibliosoph: Injuries" to use the bundled content. The setting hint (previously blank) now explains this.

## [13.2.1]

### Added

- **Paste and drop image uploads:** Paste a screenshot from the clipboard into the Messages compose box, or drop an image file from your desktop onto the window, and it uploads to `worlds/<world>/bibliosoph-messages/` (via Foundry's FilePicker) and inserts as a markdown image. Requires the core "Upload New Files" permission; users without it get a clear warning and can still link images by path or URL.
- **Day separators:** The message thread now shows "Today", "Yesterday", or the date between messages from different days.
- **Edit message:** Right-click your own message → Edit Message loads it into the compose box (banner + "Save Edit" button, ESC cancels); edited messages keep their timestamp and show an "(edited)" tag.
- **Typing indicators:** "X is typing…" appears above the compose box when another member types in the conversation you're viewing. Ephemeral socket pings only (throttled to one per 2s, targeted at active members, nothing stored).
- **Clean unused images (GM):** Broom button in the action bar scans the messages upload folder for images no longer referenced by any message and reclaims their space. Foundry provides no file-deletion API, so orphans are overwritten with a tiny blank PNG; the confirmation dialog names the folder for true on-disk removal.
- **Excluded Users setting:** `messagesExcludedUsers` (world) — comma-separated user names left out of Messages entirely: no 1:1 tray row, not selectable for groups, and removed from the party conversation on world load. Case-insensitive exact-or-prefix matching; replaces the hardcoded Cameraman/Developer/Author exclusion (which is now the default value).

### Changed

- **TODO.md:** Added planned work — crit/fumble table automation on natural 20/1 (replacing the placeholder `createChatMessage` hook), a keybinding to open Messages, and localization of hardcoded JS strings.

### Removed

- **Orphaned legacy CSS:** Deleted the dead `#bib-window-user-*` block in `styles/default.css` left over from the removed private chat window.

## [13.2.0]

### Added

- **Unified Messages window:** Party and private messaging completely redesigned as a single Regent-style conversation window (Application V2, built on Blacksmith's `BlacksmithWindowBaseV2` + zone template, opened via `api.openWindow('bibliosoph-messages')` from a single "Messages" toolbar button). Full back-and-forth conversations happen inside the window — the Foundry chat log is never touched, so conversations survive session chat wipes.
- **Journal-backed conversations:** Each conversation is a JournalEntry in a hidden "Bibliosoph Messages" folder with one JournalEntryPage per message. Members get OWNER permission; delivery/live sync ride on Foundry document hooks (no ChatMessages, no chat DB bloat). Sockets are used only to relay conversation create/edit requests to the GM (Blacksmith Sockets API with targeted `recipients`, requires Blacksmith >= 13.8.5).
- **Conversation tray (left panel):** Two zones separated by a dim rule — group chats on top (Party pinned first, then groups by activity), player chats below (one 1:1 row per user with their avatar, GMs first). 1:1 rows are virtual until first use; the journal document is created lazily on first message.
- **Party conversation:** Auto-created singleton that always includes every user; its name follows the Blacksmith Campaign API party name (fallback "Party Chat") and cannot be renamed in the editor.
- **Conversation management:** New Conversation picker with member selection, custom name, icon picker (16 icons), and tint color; right-click a conversation for Edit (name/icon/tint/members; GM or creator) and Delete (with gating; Party protected). Membership edits rewrite document ownership via the GM relay.
- **Messages:** Markdown support (with formatting help tooltip on a `?` icon), tone stamps (Message, Party Plan, Agree, Disagree, Praise, Insult), player-color accents on each message card, ENTER-sends toggle, drafts preserved across live updates.
- **Reactions:** Right-click a message → React (Like, Dislike, Love, Laugh, Huh?) via the Blacksmith context menu (`api.uiContextMenu`) with reaction chips (count, names on hover, click to toggle yours).
- **Reply:** Right-click a message → Reply quotes it into the compose box as a markdown blockquote.
- **Delete message (soft):** Right-click your own message (or any, as GM) → Delete wipes content/reactions from the document and leaves a dimmed "Message deleted" placeholder in the thread.
- **Send to Foundry Chat:** Per-message escalation (hover icon or context menu) posts that message to the Foundry chat as a Blacksmith-structured chat card (`.blacksmith-card` + theme from the Chat Cards API); group escalations whisper to members, party escalations post publicly.
- **Drag & drop:** Drop items, actors/tokens, journals, roll tables, etc. into the window to insert an `@UUID` content link (built with `api.compendiums.formatLink`); drop image paths/URLs to insert a markdown image.
- **Images in messages:** Markdown `![name](path or URL)` renders inline (sanitized; http(s)/relative paths only); click any image for a full-size popout.
- **Notifications:** Blacksmith menubar notification "Message from X" (30s) when a message arrives while away; "N Unread Messages" notification on login; unread badges per conversation from per-user read tracking.
- **On-screen splash:** Click-through splash (sender avatar + "Message from X", auto-dismiss, click to open the conversation) for direct messages and party/group messages, each behind its own user setting (`messageSplashEnabled`, `messageSplashGroupEnabled`, both default on). Group splashes name the conversation.
- **Auto Open:** Optional user setting (`messageAutoOpen`) that opens the Messages window on the incoming conversation when a message arrives while it is closed; also toggleable from the window's action bar.
- **Message sounds:** Five user-configurable local sounds — Alert (arrives while away), Received (posts in the open conversation), Sent, Switch Conversation, Close Window — with a mute toggle in the window's action bar (`messageSound*` settings).
- **Action bar tools:** Mute, Auto Open, Export Messages (standalone dark-themed HTML download of the conversation history), and Delete Messages (purge all messages with a confirmation dialog; GM anywhere, members on their 1:1s, creators on their groups).
- **Retention:** `retentionMaxMessages` world setting (default 200 per conversation, GM-adjustable); oldest messages trim automatically as new ones post.
- **GM visibility setting:** `gmSeesAllConversations` (world, default on) controls whether the GM's window lists conversations the GM is not a member of.
- **Hide journal folder:** `hideMessagesJournal` world setting (default on) hides the conversations folder and entries from the journal sidebar via injected CSS that survives sidebar re-renders.
- **Menubar button:** Messages also opens from the Blacksmith menubar (left zone, next to Squire's Quick Note icon) via `api.registerMenubarTool`.

### Changed

- **Blacksmith dependency:** `module.json` now requires `coffee-pub-blacksmith` >= 13.8.5 (targeted socket emit). New stylesheet loads via `@import` in `styles/default.css` per house convention.
- **Card theme settings:** `cardThemePartyMessage` / `cardThemePrivateMessage` kept but relabeled — they now style only the Send-to-Chat escalation cards and live under the Messages settings group.
- **Messages toolbar defaults:** The single Messages tool shows in both the Coffee Pub and Foundry toolbars by default.

### Removed

- **Legacy party/private messaging:** `BiblioWindowChat` (V1 FormApplication) and `dialogue-messages.hbs` deleted; both dialog openers, macro bindings and handlers, the chat-card Reply button, whisper send path, `buildPlayerList`/`buildPrivateList` and related helpers, `MESSAGES_*`/`CARDTYPEMESSAGE`/`CARDTYPEWHISPER` globals, and the two legacy toolbar buttons. Settings removed: `partyMessageEnabled`, `privateMessageEnabled`, both macro settings, both legacy toolbar setting pairs, `cardLayoutPrivateMessage`, `privateMessageCompressedWindow`. All roll-table features (criticals, fumbles, investigations, gifts, shady goods, inspiration, beverage/bio breaks, insults, praise, injuries, DOMT) are unaffected.

## [13.1.5]

### Fixed

- **Blacksmith registration race:** Module registration no longer calls `BlacksmithModuleManager.registerModule` before Blacksmith has finished consumer setup. When Coffee Pub Blacksmith is active, the `Hooks.once('ready')` handler awaits `BlacksmithAPI.waitForReady()`, then registers using `game.modules.get('coffee-pub-blacksmith').api` (`api.registerModule` or `api.ModuleManager.registerModule`) with a final fallback to `BlacksmithModuleManager`. Prevents `TypeError: Cannot read properties of null (reading 'registerModule')` when Bibliosoph’s `ready` ran before window globals or before older Blacksmith builds assigned `module.api`.

- **False “Blacksmith API not fully initialized” on startup:** The main `Hooks.on('ready')` handler now awaits `BlacksmithAPI.waitForReady()` when Blacksmith is active before checking `BlacksmithUtils`, so settings and notifications are not skipped just because `ready` fired early relative to `markReadyForConsumers()`.

## [13.1.4]

### Added

- **Quick Encounter Exclude section:** New "Exclude" section below Include with comma-separated monster names. Matching monsters are filtered out of Recommend and Roll results (e.g. "dragon, lich" excludes them from suggestions). Same substring matching and recent-chip quick-add as Include; registered setting `quickEncounterRecentExcludeNames` for recent exclude list.
- **Quick Encounter Remember checkboxes:** Right-aligned "Remember" checkbox for both Include and Exclude. When checked, the current value is saved and auto-fills when the window is opened again; values are also saved when running Recommend or Roll. Settings: `quickEncounterRememberInclude`, `quickEncounterRememberedIncludeText`, `quickEncounterRememberExclude`, `quickEncounterRememberedExcludeText`.
- **Quick Encounter open-sheet button:** Feather icon in the upper-left of each result card opens that creature's sheet when clicked (uses `fromUuid` + `sheet.render(true)`).

### Changed

- **Quick Encounter layout:** Main config panel (Habitat, Include, Exclude, etc.) is fixed width (550px) when the results tray is visible; the results/deploy tray flexes with the window. When the tray is hidden, main still fills the window.
- **Quick Encounter Include/Exclude row:** Clear (×) button is back inside the input; Remember checkbox remains to the right of the input. Input and clear are wrapped in `.window-encounter-section-input-inner` with the clear absolutely positioned over the input.
- **Quick Encounter window size:** Minimum width 900px and minimum height 575px for the Quick Encounter window.
- **Quick Encounter Roll for Detection:** The dice button now uses the Blacksmith Request a Roll API with `groupRoll: false` and `onRollComplete`. When all party Perception rolls are in, the average of roll totals is computed and the Detection slider is updated automatically: average 0–3 → Surprised, 4–8 → Outmatched Awareness, 9–12 → Mutual Awareness, 13–16 → Tactical Advantage, 17–20 → Undetected. Helper `getDetectionLevelFromAverageRoll()` added in `const.js`.
- **Settings group order:** Config groups now appear in this order: GENERAL, ENCOUNTERS, INJURIES, SPECIAL ROLL TABLES, COMMUNICATIONS.
- **Investigations section:** Investigations is its own top-level section (H2) below Encounters; removed from under Special Roll Tables. Redundant H3 "Investigations" heading removed. H3 "Currency" added above "Odds of finding coins"; H3 "Items" added above "Odds of finding items". New keys: `headingH2Investigations`, `headingH3Currency`, `headingH3Items`.
- **Encounters settings order:** "Card Style" and "Odds of encounter" moved below "Show in Foundry toolbar" in the Encounters section.

## [13.1.3] - Quick update

## [13.1.2]

### Added

- **Card theme settings for Gift and Shady Goods:** `cardThemeGift` and `cardThemeShadygoods` are now registered in settings and localization. These were previously referenced in `createChatCardSearch` but not registered, causing "not a registered game setting" errors when rolling Gift or Shady Goods cards.

### Changed

- **Toolbar zones:** Tools now use valid Blacksmith toolbar zones. Inspiration, Shady Goods, and Gifts moved to `rolls`; Praise, Insults, Bio Break, and Beverage Break moved to `communication`; Quick Encounter moved to `gmtools` (GM-only).
- **Toolbar order:** Sequential ordering (1–7 for rolls, 1–6 for communication, 1 for gmtools) so Bibliosoph tools stay grouped and other modules' tools do not appear between them.
- **Chat card action labels:** Removed all prepended labels ("Action", "Card") before UUID links on roll table cards. Critical, Fumble, Inspiration, Insults, Praise, DOMT, Beverage, Bio, and message variants now display only the UUID link (e.g. `@UUID[Item.xxx]{SNAKE OIL}`) with no word before it.

### Fixed

- **`strRollTableName` ReferenceError:** Declared `strRollTableName` at the top of `publishChatCard()` so it is defined before use. In strict mode (ES modules), assigning to an undeclared variable threw a ReferenceError when rolling Critical Hit and other roll table cards.
- **Invalid toolbar zone:** Replaced the invalid `roleplay` zone with `rolls` and `communication`. The Blacksmith Toolbar API only supports `general`, `rolls`, `communication`, `utilities`, `leadertools`, and `gmtools`; tools in `roleplay` did not appear in the toolbar.

## [13.1.1]

### Added

- **Wildcard token path resolution:** `resolveWildcardPath` resolves glob patterns (e.g. `arch-hag-*.webp`) to concrete files via `FilePicker.browse`. `getActorTokenImg` is async and resolves wildcards with random selection when multiple variants exist; resolved paths are cached at build time so encounter cards and recommendations use real file paths.

### Changed

- **Encounter card owner display:** Exclude GMs when resolving the character owner so the encounter card shows the actual player owner (e.g. Alicia Panicucci) instead of a GM (e.g. CursorAI).
- **Cache building spinner:** Replaced Font Awesome `fa-spin` with custom CSS animation (`window-encounter-spin`) for cache building and results loading spinners so they animate reliably in all contexts.
- **Encounter window header background:** Fixed variable name (`--notes-banner-image` → `--encounter-banner-image`) and applied background image to both `.window-header` and `.window-encounter-header` with proper `background-size`, `background-position`, `background-repeat`, and `background-blend-mode`.
- **line-clamp compatibility:** Added standard `line-clamp` property alongside `-webkit-line-clamp` for result card name truncation.
- **Quick Encounter cache gate:** Recommend, Roll, and Include now require a built monster cache; when absent, they show a "Cache required" notification instead of scanning compendiums implicitly.

### Fixed

- **Monster portrait fallback:** When a monster has no portrait, use `portrait-noimage.webp` in encounter cards and the encounter window.
- **Empty images on encounter cards:** `getActorTokenImg` returns `NO_IMAGE_PORTRAIT` when doc is null, when wildcard resolution fails, or when path is empty; encounter window recommendations use `noImagePortrait` fallback when `r.img` is empty.
- **Header background image not showing:** Wrong CSS variable reference caused background image to not display.
- **Quick Encounter slider churn:** Settings are no longer saved on every slider `input` event; values persist on change only, reducing settings DB spam during drags.
- **Combat assessment spam:** Encounter window fetches combat assessment once per session instead of on every render, avoiding repeated API calls and console noise.

## [13.1.0]

### Added

- **Quick Encounter Target Encounter CR label:** Visible label "Target Encounter CR" above the target CR slider.
- **Quick Encounter recent include list:** Names entered in Include and used (Recommend or Roll) are added to a "recent" list below the input. Clicking a recent item adds it to the Include field; clicking × removes it from the list. The recent list is persisted (client setting) until items are removed.
- **Quick Encounter include clear button:** A × button inside the Include input clears the field.
- **Quick Encounter Monster Gap overage:** When total monster CR exceeds the target, the MONSTER GAP box shows the overage (e.g. "+18") with flashing styling so the GM sees they are over budget.
- **Quick Encounter difficulty during drag:** The difficulty badge (Trivial, Easy, Moderate, etc.) updates live as the Target Encounter CR slider is dragged, without releasing the mouse.
- **Quick Encounter Detection levels:** Detection slider (1–5) maps to named levels: Surprised, Outmatched Awareness, Mutual Awareness, Tactical Advantage, Undetected. Each level has a tooltip and narrative text shown on the encounter chat card below Adversaries.
- **Quick Encounter Roll for Detection:** Clickable dice icon on the Detection header opens Blacksmith's Request a Roll dialog (Perception, DC 15, party filter) via the Request Roll API.

### Changed

- **Quick Encounter tray:** Results/deploy tray now shows by default so the two-column layout is visible from the start.
- **Quick Encounter results grid:** Cards stack from the top when there are few results (`align-content: start`).
- **Quick Encounter cache header:** Cache status and Refresh button are on one line (e.g. "Cache: 939 Monsters [Refresh]").
- **Quick Encounter Target CR slider:** Steps in whole numbers only (step 1); value is rounded and stored as an integer.
- **Quick Encounter deploy:** Clicking a deploy pattern button (Sequential, Circle, Line, Scatter, Grid) closes the Quick Encounter window so the canvas is visible for placing tokens.
- **Quick Encounter Detection display:** Slider shows the detection level label (never the number) and updates live as you drag. Detection section CSS classes renamed from odds-related to detection-related (`window-encounter-detection-*`).
- **Quick Encounter encounter card:** Detection narrative appears below Adversaries with the level label (no number) and paragraph text.
- **Notifications:** All notifications use Blacksmith's `postConsoleAndNotification` API directly; the former common.js wrapper was removed. Notifications are never permanent.

### Fixed

- **Quick Encounter result card selection:** Result cards and count buttons now have the correct `data-encounter-role` and `data-encounter-action` attributes so clicking cards toggles selection and ± adjusts count.
- **Quick Encounter include input:** Include field value is synced from the DOM when Recommend/Roll runs and via a document-level `input` listener so the value is read correctly (fixes cases where activateListeners may not run with Application V2/PARTS).
- **Quick Encounter habitat buttons:** Habitat buttons now have `data-encounter-role="habitat"` so clicking them selects the habitat.
- **Quick Encounter overage display:** Overage is shown only in the MONSTER GAP box as a single number (e.g. "+18") with flash; fixed missing `encounterCROver`/`encounterOverageDisplay` variable declarations in getData.
- **Manager encounters:** Removed stray `}` that caused "Illegal return statement" in `openEncounterWindow`.

## [13.0.10]

### Added

- **Quick Encounter deploy card with monster list:** When you deploy after a roll-for-encounter, a single chat card is posted that lists the selected monsters (name, count, CR, optional image) and states that they have been placed. No separate intro card is posted at roll time.

### Changed

- **Quick Encounter workflow:** Roll → encounter → select monsters → deploy. On deploy, one card is generated (narrative + monster list) and tokens are placed at the same time. The intro card that previously appeared when an encounter was rolled is no longer posted; the only encounter card is the deploy card with the monster list.
- **Encounter card template:** `buildEncounterCardData` accepts an optional `encounterMonsters` array; the encounter card template renders an "Encounter" section with monster rows (display name, CR) when present. Deploy card copy updated to "The following have been placed on the canvas."
- **Quick Encounter candidate filter:** When building the cache and when loading candidates, actors excluded from encounters: CR 0, vehicles, players (character type), and non-NPC types. Only NPC-type actors with CR &gt; 0 are used for Recommend and Roll.
- **Quick Encounter notifications:** Notifications from the encounter manager (e.g. no compendiums, narrative load failure) are now normal and no longer stay open (show briefly then dismiss).

## [13.0.9]

### Added

- **Quick Encounter cache:** Monster data can be built and stored in a world-level cache for fast Recommend and Roll. Use "Refresh cache" in the encounter window header to build or update; status line shows count (e.g. "Cache: 1073 monsters"). When the cache is valid, Recommend and Roll use it instead of loading compendiums on each action.
- **Quick Encounter deploy by pattern:** Clicking a deployment pattern (Sequential, Circle, Line, Scatter, Grid) now deploys directly with that pattern; the separate "Deploy selected" button was removed.
- **Quick Encounter selection indicator:** Selected result cards show a checkmark badge and stronger styling (orange-tinted border/background). Selection is seeded when results load (Roll or Recommend); you can toggle cards to include or exclude them from deploy.

### Changed

- **Quick Encounter header:** The duplicate "Close" button was removed (title bar close remains). "Refresh cache" was moved into the header where Close was.
- **Quick Encounter sliders:** CR slider track and thumb now match the Odds slider (purple/magenta track, white square thumb). Both sliders update the displayed value live during drag without full re-render for better responsiveness; full re-render and save happen on mouseup (change).
- **Quick Encounter odds display:** "Odds of encounter" value updates live while dragging. Fixed "0%" and "100%" endpoints sit at the slider ends and use the same visual style as the CR slider endpoints (matching icon row).
- **Quick Encounter selection and deploy:** Selection is driven by `_selectedForDeploy` for both built encounters and recommend lists; built encounters are seeded as all selected so you can deselect before deploy. Deploy uses only selected cards (and their counts for built encounters). Deploy pattern buttons are enabled whenever there are recommendations (Handlebars context fixed with `../hasDeploySelection`).
- **Quick Encounter Recommend:** CR band widened (target ±8) and a fallback added: if no monsters fall in band, the list shows the closest by CR so Recommend always returns results when the cache has habitat matches.
- **Quick Encounter event handling:** Delegation runs on document and only handles events inside the encounter window root; all handlers use a captured `self` reference so `_onRollForEncounter`, `_onRecommend`, `_onDeploy`, etc. are called correctly. Data attributes are read with `getAttribute` for reliability.

### Fixed

- **Quick Encounter class leak:** `DEFAULT_OPTIONS` for the encounter window was merged with `mergeObject(..., { inplace: true })`, which mutated the base Application defaults and applied `window-encounter` and `bibliosoph-window` to every Foundry dialog. Merges now use `{ inplace: false }` so only the Quick Encounter window gets those classes.

## [13.0.8]

### Changed

- **Release workflow:** The GitHub Actions release zip now includes the `resources/` folder so that `investigation-narrative.json` and other resources are bundled in the published module.

## [13.0.7]

### Added

- **Investigation narrative:** Titles and descriptions now come from `resources/investigation-narrative.json`. Entries in `foundNothing` and `foundSomething` are chosen at random; each entry supports `title`, `description`, `tags`, and optional `icon` (HTML, e.g. Font Awesome).
- **Investigation coins:** Optional coin finding with its own roll.
  - New setting: Odds of Finding Coins (0–100, default 20). Roll 1d100; on success, amounts are rolled from 0 up to each max and added to the character's purse (D&D 5e currency).
  - New settings: Max Platinum, Max Gold, Max Silver, Max Electrum, Max Copper (0–100 each, with defaults 0, 10, 45, 10, 100).
  - Card shows a Coins section and a summary line when coins are added.
- **Investigation rarity weightings:** Per-rarity roll tables (Common, Uncommon, Rare, Very Rare, Legendary) and weightings on a 0–1000 scale (step 1). Weightings are normalized to pick rarity for each slot; defaults 800, 200, 50, 20, 1 so Legendary is very rare.
- **Investigation card layout:** Items grouped by rarity with section headers and icons (Common: box, Uncommon: treasure-chest, Rare: axe-battle, Very Rare: trophy, Legendary: gem, Other: crate-apple). Long item names show an ellipsis when they overflow.
- **Investigation player skill bonus:** New setting "Use Player Skill Bonus" (default on). When enabled and the game system is dnd5e, the find-items roll becomes 1d100 + Intelligence modifier + Proficiency; items are found when that total is greater than (100 − Odds of Success). When disabled, behavior is unchanged (1d100, find when total ≤ Odds of Success).
- **Investigation notification:** A short notification ("Running investigation check...") is shown at the start of an investigation so users know the check is running.
- **Localization:** New keys for investigation coins (labels, hints, summary messages), investigation notification, and rarity weighting labels/hints.

### Changed

- **Investigation flow:** Replaced with narrative + slots + per-rarity tables. Find-items uses one 1d100 (or 1d100 + INT + PROF when player skill is on); then 1dN slots (N = Upper Limit of Items); for each slot, rarity is chosen by weighted bands and one item is rolled on that rarity's table and added to inventory.
- **Investigation narrative logic:** "Found something" narrative is used whenever the character finds coins or items (or both). "Found nothing" is used only when they find neither.
- **Rarity settings:** Renamed from "odds" to "weightings" in the UI; scale changed from 0–100 (step 0.5) to 0–1000 (step 1) for finer control. Defaults updated to 800, 200, 50, 20, 1.
- **createChatCardSearch:** Now used only for Gift and Shady Goods (single table roll, single item). All investigation-specific logic removed.
- **README:** Updated with current features, product screens (encounters, investigation, party message, private message), v13-only requirements, and no emoticons.

### Removed

- **Legacy investigation:** Use of the single `investigationTable` setting; dependency on "Search Descriptions: Nothing", "Before", "Reveal", and "After" roll tables. Narrative is only from `investigation-narrative.json`; item flow uses per-rarity tables and weightings.

## [13.0.6]

### Fixed
- **Macro Bindings:** All Bibliosoph macro bindings now work with Blacksmith safe settings and macro IDs/UUIDs.
  - Rebound every macro type (encounters, investigations, gifts, shady goods, crits, fumbles, inspiration, DOMT, beverage/bio/insult/praise, party/private messages, injuries) using a centralized binder with fresh `BlacksmithUtils.getSettingSafely` reads.
  - Macro resolution now accepts id/UUID/name and retries binding (immediate + delayed) to handle late-loaded settings.
  - Added `MACRO FIX` console traces for bind/execute to aid troubleshooting.

### Changed
- **Settings Access:** Standardized all runtime settings reads in macro binding to use Blacksmith’s `getSettingSafely` helper via the existing `getSetting` wrapper.

## [13.0.5]

### Changed
- **Chat Cards:** Migrated all cards to the unified Chat Cards system in Coffee Pub Blacksmith
  - All card types (general, injury, injury selector, encounter, investigation) now use the shared Blacksmith card structure, theme API, and styling
  - Card template uses `blacksmith-card` and theme from Blacksmith's `getCardThemeChoicesWithClassNames()`; settings provide theme choices from Blacksmith
- **Chat Card Section Content:** The actions/buttons section of the chat card now only renders when it has content
  - Wrapped the section-content block in `{{#if hasSectionContent}}` in the chat card template
  - Added `hasSectionContent` to card data in general cards (action text or private recipients), injury apply cards (effect data), and injury category selector cards (category buttons)
  - Cards without actions, injury buttons, or reply options no longer show an empty section-content area

## [13.0.4] 

### Changed
- **Markdown Conversion:** Switched to Blacksmith API markdown conversion for message content
  - Replaced local `markdownToHtml` with `BlacksmithUtils.markdownToHtml`
  - Removed the local markdown utility to keep behavior centralized

## [13.0.3] - GM-Only Encounters & User Scope Migration

### Changed
- **Encounter Buttons:** All encounter toolbar buttons are now GM-only
  - Added `gmOnly: true` to all 10 encounter button configurations (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)
  - Players can no longer see or access encounter buttons in the toolbar
  - Only Game Masters can trigger random encounters
- **Encounter Settings:** All encounter-related settings are now GM-only
  - Added `restricted: true` to all encounter settings in the module configuration
  - Players can no longer see encounter settings in the module settings UI
  - Includes: global encounter settings, all encounter type settings, toolbar preferences, tables, and macros
- **Settings Scope Migration:** Migrated user preference settings from `scope: 'client'` to `scope: 'user'` (Foundry v13)
  - All toolbar visibility preferences (`toolbarCoffeePub*Enabled` and `toolbarFoundry*Enabled`) now use `scope: 'user'`
  - UI layout preferences (`privateMessageCompressedWindow`, `showDiceRolls`) now use `scope: 'user'`
  - Settings now persist across devices for each user, following them when they log in from different machines
  - Total of 32 settings migrated to user scope

### Technical
- **Foundry v13 User Scope:** Leverages new `scope: 'user'` feature introduced in FoundryVTT v13
  - User scope settings are per-user, per-world, and persist across devices
  - Replaces client scope for personal preferences that should follow the user
  - Maintains client scope for visual separator headings (no meaningful data)

## [13.0.2] - Dice Roll Control

### Added
- **Dice Roll Toggle:** Added `showDiceRolls` setting to control whether virtual dice are rolled when cards are generated
  - Client-scoped setting (per-user preference)
  - Default: enabled (true)
  - Requires Dice So Nice module for visual dice effects
  - Applies to all card types: encounters, investigations, injuries, and general roll tables
- **Private Message Compressed Layout:** Added `privateMessageCompressedWindow` setting for compact recipient display
  - Client-scoped setting (per-user preference)
  - Default: disabled (false)
  - When enabled, shows only portrait images in horizontal row (similar to party message buttons)
  - When disabled, shows full recipient cards with names and character info (3 per row)

### Changed
- **Settings Organization:** Reorganized settings structure with new "General" section
  - Added `headingH2General` heading for better settings organization
  - Moved dice roll setting to General section
- **Party Message Dialog Layout:** Moved message type buttons to horizontal row at top of dialog
  - Changed from vertical column on left side to horizontal flexbox layout at top
  - Buttons (Party Message, Party Plan, Agree, Disagree, Praise, Insult) now display in a row
  - Improved visual organization and user experience
- **Private Message Dialog:** Improved layout and functionality
  - Window width set to 600px for better sizing
  - Non-compressed layout displays 3 recipients per row with full details
  - Compressed layout displays portrait images that wrap naturally
  - Reply button in chat cards now spans full width

### Fixed
- **Dice Roll Control:** All virtual dice rolls now respect the `showDiceRolls` setting
  - Updated 7 dice roll locations to check setting before rolling
  - Applies to: general cards, injury cards, encounter checks, encounter monster quantity, investigation checks, investigation item quantity, and roll table results
- **Private Message Recipients:** Fixed recipient list to only show party members
  - Now filters to only display users with assigned characters (party members)
  - Excludes observers and users without characters
  - Improves clarity of who can receive private messages
- **Private Message Reply Functionality:** Fixed reply button to properly pre-select recipients
  - Reply button now correctly opens dialog with recipients pre-selected
  - Fixed recipient array handling to ensure proper selection state
  - Fixed compressed mode portrait sizing when replying
  - Selection state now handled consistently in activateListeners

### Removed
- **Debug Logging:** Removed all debug logging statements from production code
  - Removed DEBUG statements from injury card creation function
  - Removed button HTML matching debug code
  - Removed metadata extraction debug logging
  - Cleaned up console spam for cleaner production experience

## [13.0.1] - Quick Fix
### Fixed
- **Logging:** Was passing the wrong parameter to the loggin tool.

## [13.0.0] - v13 Migration Complete

### Important Notice
- **v13 MIGRATION COMPLETE:** This version completes the migration to FoundryVTT v13
- **Breaking Changes:** This version requires FoundryVTT v13.0.0 or later
- **v12 Support Ended:** v12.1.3-FINAL was the last version supporting FoundryVTT v12

### Changed
- **Minimum Core Version:** Updated to require FoundryVTT v13.0.0
- **Module Version:** Bumped to 13.0.0 to align with FoundryVTT v13
- **Compatibility:** Module now exclusively supports FoundryVTT v13

### Fixed
- **jQuery Removal:** Migrated all jQuery code to native DOM APIs
  - Converted `html.find()` to `querySelector()` / `querySelectorAll()`
  - Replaced jQuery event handlers (`.on()`, `.click()`) with `addEventListener()`
  - Updated jQuery DOM manipulation (`.append()`, `.val()`, `.attr()`, etc.) to native methods
  - Added jQuery detection patterns for FormApplication compatibility during migration
- **Font Awesome Migration:** Updated all Font Awesome 5 references to Font Awesome 6
  - Changed all `fas` class prefixes to `fa-solid` in JavaScript and templates
  - Updated 20 toolbar icon definitions in `manager-toolbar.js`
  - Updated 11 icon references in Handlebars templates (`chat-card.hbs`, `dialogue-messages.hbs`)
- **Toolbar Registration:** Fixed toolbar tools not appearing in Coffee Pub and Foundry toolbars
  - Moved `registerToolbarTools` import to top of file for proper scope
  - Added retry logic with multiple attempts to ensure Blacksmith API is ready
  - Improved error handling and logging for toolbar registration
- **Encounter Type Bug:** Fixed all encounter buttons rolling General encounters
  - Updated all `trigger*EncounterMacro()` functions to set correct `BIBLIOSOPH.CARDTYPE` value
  - Changed from always setting "General" to setting specific types (Cave, Desert, Water, etc.)
- **TableResult UUID:** Fixed links pointing to TableResult instead of actual documents
  - Changed from using `rollResults.results[0].uuid` (TableResult UUID) to `rollResults.results[0].documentUuid` (document UUID)
  - Links now correctly point to the actual Actor/Item documents referenced by roll tables
- **Deprecated API Usage:** Fixed deprecation warnings for TableResult properties
  - Updated from deprecated `TableResult#text` to `TableResult#name` or `TableResult#description`
  - Updated from deprecated `TableResult#documentCollection` and `TableResult#documentId` to `TableResult#documentUuid`
  - Added fallback support for v12 compatibility during transition

### Technical
- **jQuery Detection:** Added transitional jQuery detection patterns in FormApplication classes
  - Created `_getNativeElement()` helper method for consistent jQuery handling
  - Added detection in `activateListeners()` and Dialog callbacks
  - Marked as technical debt to be removed after all call sites are confirmed native DOM
- **UUID Parsing:** Improved UUID parsing to handle pack names with dots
  - Added regex-based parsing for compendium UUIDs
  - Added fallback to Foundry's `foundry.utils.parseUuid()` utility
  - Enhanced error handling for invalid UUID formats
- **Logging:** Added comprehensive logging for UUID link creation
  - Logs document UUID, link string, and name for debugging
  - Separate logging for encounter and investigation card creation
  - Logs fallback paths when deprecated properties are used

## [12.1.3] - Final v12 Release

### Important Notice
- **FINAL v12 RELEASE:** This is the final build of Coffee Pub Bibliosoph compatible with FoundryVTT v12
- **v13 Migration:** All future builds will require FoundryVTT v13 or later
- **Breaking Changes:** Users must upgrade to FoundryVTT v13 to use future versions of this module

### Changed
- **Documentation Updates:** Updated README.md and module.json to reflect v12.1.3 as the final v12 release
- **Compatibility Notice:** Added clear notice that v12.1.3 is the last version supporting FoundryVTT v12
- **Migration Preparation:** Module is now locked for v12 compatibility; v13 migration work will begin in next version

### Technical
- **Version Lock:** Module version locked at 12.1.3-FINAL for v12 compatibility
- **Future Development:** All development moving forward will target FoundryVTT v13 exclusively

## [12.1.2] - Toolbar Integration

### Added
- Complete toolbar integration with Coffee Pub Blacksmith
- 23 toolbar tools across 3 zones (communication, rolls, roleplay)
- Toolbar visibility controls for Coffee Pub and Foundry toolbars
- Support for all existing Bibliosoph features in toolbar format

#### Communication Tools
- Party Message dialog
- Private Message dialog

#### Roll Tools
- Investigation rolls
- Critical Hit rolls
- Fumble rolls
- Injuries (GM only)
- All 10 encounter types (General, Cave, Desert, Dungeon, Forest, Mountain, Sky, Snow, Urban, Water)

#### Roleplay Tools
- Beverage Break messages
- Bio Break messages
- Random Insults
- Random Praise
- Random Gifts
- Shady Goods
- Inspiration

### Changed
- Moved toolbar settings to proper locations in module settings
- Toolbar checkboxes now appear directly below their respective "enable" checkboxes
- All encounter tools use "rolls" zone for proper toolbar organization
- Improved settings organization and user experience

### Fixed
- Toolbar buttons not showing due to incorrect API access pattern
- Timing issues with Blacksmith API initialization
- Missing toolbar visibility settings for encounters and injuries
- Duplicate settings entries in localization files

### Technical
- Created trigger functions for all encounter types and roleplay features
- Added proper window object exposure for all toolbar functions
- Implemented proper settings validation and error handling
- Added comprehensive localization strings for all toolbar settings
- Fixed zone assignment to use valid Blacksmith toolbar zones

## [12.1.1] - Bug Fixes

### Fixed
- Fixed playSound API calls to use direct Blacksmith API access instead of helper functions
- Updated all 5 playSound calls in chat card functions to use `getBlacksmith()?.utils?.playSound()` pattern
- Removed unnecessary playSound helper function wrapper

### Technical
- All playSound calls now follow the same direct API pattern as other Blacksmith utilities
- Maintains consistency with rollCoffeePubDice and other API integrations

## [12.1.0] - MAJOR UPDATE - Blacksmith API Migration

### Added
- Full integration with Coffee Pub Blacksmith API
- Safe settings access using `getSettingSafely()` and `setSettingSafely()`
- Dynamic access to shared choice arrays (themes, macros, tables, compendiums, sounds, etc.)
- Module registration system with Blacksmith
- Real-time updates via `blacksmithUpdated` hook
- Consolidated validation system for mandatory settings
- Enhanced error handling and fallback systems

### Changed
- Migrated from custom `global.js` utilities to Blacksmith API
- Updated all console logging to use Blacksmith's `postConsoleAndNotification`
- Replaced static choice arrays with dynamic Blacksmith data
- Improved module initialization timing using proper Foundry hooks
- Enhanced settings validation and user feedback

### Removed
- Dependency on `global.js` file
- Static choice arrays and hardcoded defaults
- Individual validation notifications (replaced with consolidated system)
- Old utility functions replaced by Blacksmith equivalents

### Fixed
- Module startup crashes due to timing issues
- Settings not populating with available choices
- Multiple notification spam for missing settings
- Hardcoded default values not respecting Blacksmith configuration

### Technical
- Uses `Hooks.once('ready')` for proper initialization timing
- Implements `Hooks.on('blacksmithUpdated')` for real-time data updates
- Provides graceful fallbacks when Blacksmith API is unavailable
- Maintains backward compatibility during transition

## [0.1.03] - 2024 Initial Release

### Added
- Initial release of Coffee Pub Bibliosoph
- Card formatting system for journal entries
- HTML Blockquote integration
- Custom styling for narrative cards
- Chat window integration
- Support for Foundry VTT v11 and v12

## [0.1.02] - Settings and Controls

### Added
- Settings for cards
- Margin controls for fine-tuning card alignment in chat
- Unified card themes

## [0.1.01] - Basic Styling

### Added
- Basic styling

## [0.1.00] - Initial Release

### Added
- Initial module foundation
