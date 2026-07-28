# Note to Crier: Show Active Effects & Conditions on the Turn Card

**From:** Bibliosoph dev
**Context:** Bibliosoph just shipped a "Check-Up" chat card that lists everything afflicting a token — injuries, crits, fumbles, conditions, other modules' effects — with icons, plain-language detail lines, and rules text on hover. The ask for Crier: when a combatant's turn card posts, **optionally include that same list, display-only** — no buttons, no actions, just "here is what's on you right now." The table constantly forgets they're prone, frightened, blessed, or bleeding until two rounds too late; the turn card is exactly the moment to remind them. Everything below is verified working code from the Check-Up build (Foundry v13 + dnd5e 5.2.5, core only) — lift it wholesale from `coffee-pub-bibliosoph/scripts/bibliosoph.js` (`createChatCardTreatment`) and `templates/chat-card.hbs` (the `treatmentgroups` block).

---

## 1. What to render

One compact row per active effect, grouped under small-caps zone headers in this order (empty zones omitted):

```
INJURIES                 ← bundles applied by Bibliosoph
EFFECTS & CONDITIONS     ← everything else: conditions, spells, other modules
```

(We also render CRITICALS and FUMBLES zones from our flag — include them if you want full parity, or fold flagged crits/fumbles into the general bucket; for a reminder card the two-zone split may be plenty.)

Each row: `[40px icon tile] [two lines of text]` — that's it. No buttons for Crier's version; ours has a Treat button in the third slot and everything else is identical.

- **Line 1:** the effect name, bold, single line, `text-overflow: ellipsis`.
- **Line 2** (smaller, ~0.85em, dimmed): context —
  - a flagged injury lists the conditions it conveys ("Bleeding");
  - a loose condition conveyed by an injury credits its source ("via Crimson Gash of Carnage");
  - append remaining duration when there is one, dot-separated ("Bleeding · 10 Minutes"). Get it free from `effect.duration.label` ("10 Rounds", "1 Minute"); skip when `duration.type === 'none'`.
- **Icon tile:** condition SVGs are white-on-transparent and look broken on a light card. Tile them: 40×40, `background: rgba(0,0,0,0.5)`, 4px radius, 1px `rgba(0,0,0,0.1)` border, 4px padding, `object-fit: contain`. (This matches Squire's tray tiles — Coffee Pub house style at this point.)

## 2. Which effects to include — the filter

`actor.statuses` alone misses half of what matters. Our battle-tested filter:

```js
const conditionNames = new Set([
    ...(CONFIG.statusEffects ?? []).map((s) => game.i18n.localize(s.name ?? '').toLowerCase()),
    ...Object.values(CONFIG.DND5E?.conditionTypes ?? {}).map((c) => game.i18n.localize(c.name ?? '').toLowerCase())
].filter(Boolean));

const include = (e) =>
    !e.disabled && !e.isSuppressed && (
        !!e.getFlag('coffee-pub-bibliosoph', 'outcomeBurst')   // Bibliosoph injury/crit/fumble
        || e.isTemporary                                        // has a duration (Bless, Rage…)
        || e.statuses?.size > 0                                 // carries condition ids
        || conditionNames.has(String(e.name ?? '').toLowerCase()) // hand-authored "Frightened" w/ no duration or status
    );
```

- `isTemporary` is what catches the "we forgot they had advantage" cases — Bless, Guidance, Rage, and friends are temporary effects even though they're not conditions.
- The name-match clause catches GM-hand-authored conditions with no duration and no statuses — they land under "Passive Effects" and every other test misses them.
- `disabled`/`isSuppressed` keeps toggled-off and unequipped-item effects out.

Categorize with our flag: `effect.getFlag('coffee-pub-bibliosoph', 'outcomeBurst')` → `{ kind: 'injury'|'crit'|'fumble', category, name, condition }`. Flagged → its zone; unflagged → Effects & Conditions.

**Expect legitimate double-listing:** an injury that knocked someone prone shows Prone in its own line-2 *and* Prone appears as an independent row (dnd5e creates a separate effect for toggled conditions). That's correct — the patient can stand up while the wound persists. Label the loose row "via <injury>" by matching its `statuses` ids against the flagged effects' conveyed conditions (`flag.condition` + their `statuses`).

## 3. The mouseover — rules text on hover, with the `@Embed` workaround

This is the part that makes the reminder useful: hovering the icon tile shows what the effect *does*. Foundry's TooltipManager renders `data-tooltip` content as HTML, and it works fine inside chat messages:

```html
<img src="..." data-tooltip="{{tooltipHtml}}" data-tooltip-direction="LEFT" style="cursor: help; ..." />
```

Our tooltip: name, the line-2 detail in italics, `<hr>`, then the effect's full description. **The trap:** dnd5e condition effects don't store description text — they store enricher syntax (`@Embed[Compendium.dnd5e.content24.JournalEntry...  inline]`). Render it raw and users see exactly that gibberish. Enrich first:

```js
const TextEditorImpl = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
let description = String(effect.description ?? '').trim();
if (description) {
    try {
        description = String(await TextEditorImpl.enrichHTML(description, {
            relativeTo: effect,
            rollData: actor.getRollData?.() ?? {}
        })).trim();
    } catch (_) { /* fall back to raw text — never kill the card over one bad embed */ }
}
```

- It's async — build rows with `Promise.all`, and note this runs at card-build time, so build the tooltip HTML into the posted message rather than enriching on hover.
- HTML-attribute-encode the tooltip when templating (Handlebars `{{ }}` does this for you).
- Cap the width (~320px). The Exhaustion rules page embeds a full table — consider a max-height too.
- Content links inside an enriched tooltip are display-only (you can't mouse into a tooltip to click) — fine for this purpose.

## 4. Suggested setting

One optional toggle in Crier's turn-card section, off or on per your conventions — e.g. **"Show Active Effects & Conditions"** with a line of flavor ("Remind the table what's riding on this combatant — conditions, injuries, buffs — with rules on hover."). Everything renders from the combatant's actor at post time; no sockets, no per-player anything — the card content is the same for everyone, and tooltips work for whoever hovers.

## 5. Where this is heading (no action needed now)

Bibliosoph's TODO includes extending our injury/crit/fumble data model to carry **machine-readable mechanics** — roll penalties as ActiveEffect changes ("-2 on attack rolls, 2 rounds left"), recurring damage ticks, countdown durations. Once that lands, the turn-card block can graduate from "here's what's on you" to "here's what it does to you *this turn*" by reading `effect.changes` + remaining duration. Building the display block now means that upgrade is just a richer line 2 later.

Questions welcome — the working implementation is in `coffee-pub-bibliosoph`: `createChatCardTreatment` in `scripts/bibliosoph.js` builds the rows (filter, grouping, "via" attribution, duration, enriched tooltips), and the `treatmentgroups` block in `templates/chat-card.hbs` is the exact markup — delete the `<button>` and it's your display-only version.
