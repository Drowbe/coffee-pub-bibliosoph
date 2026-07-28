# Note to Blacksmith: GM Notes for Journals

**From:** Bibliosoph dev
**Re:** `documentation/api/api-gmnotes.md` — extending GM Notes beyond Items

**Short version:** Bibliosoph is adopting the GM Notes API for injuries rather than inventing its own notes convention. The headless API already works on any document, so we are not blocked. What we would like is for the *journal* case to be a first-class citizen — and journals raise four problems Items never did. Points 1 and 2 will bite every consumer, not just us.

---

## Why we're adopting it

Injuries are journal pages. We briefly used the page's own `text.content` as a "GM notes" area and it was the wrong instinct: that is page *content*, not an *annotation*, and it has no GM gating whatsoever — it was private only because players happened not to have compendium access. GM Notes is the correct home precisely because it is a separate, GM-scoped layer keyed by UUID, and because one shared store means a future notes panel or `gm:` search finds *everyone's* notes instead of each module hiding them in a private convention.

---

## 1. `get()` is synchronous, but compendium documents are not

This is the one that stops us cold. The API table gives:

```
get(uuid) -> object | null
```

Synchronous resolution works for world documents. **It cannot work for a document living in a compendium** — `fromUuidSync` returns null (or an unusable stub) for a pack that has not been loaded. Bibliosoph's injuries ship *in a module compendium*, which is the normal case for any module distributing content, so the common path for us is exactly the one that fails.

**Suggestion:** add an async sibling and keep the sync one for world documents:

```js
await gmNotes.getAsync(uuid)      // resolves compendium docs; falls through to get() when already loaded
await gmNotes.getHtmlAsync(uuid)
```

Or make `get()` accept an already-resolved Document (the docs say it does) and clearly document that a *string* uuid must resolve synchronously. Either is fine — the important part is that consumers can tell which case they are in instead of silently getting `null` and concluding "no notes."

## 2. Writing to a locked compendium fails — say so out loud

`set()` on a document inside a locked pack cannot succeed. Module-shipped packs are locked by default, so a GM opening our injury sheet and typing a note would hit this constantly.

**Suggestion:** `canSet(uuid)` returning something actionable (`true`, or a reason like `'locked-pack'` / `'no-permission'`), so a sheet can disable the field with an explanatory tooltip rather than accepting typing that evaporates. Failing that, have `set()` reject with a typed error instead of resolving `null` — right now `null` covers both "failed" and "nothing to do," and a consumer cannot tell a locked pack from a bad uuid.

## 3. For journals, offer a component — do not hunt for sheets

The v1 approach (inject a panel into `ItemSheet5e` / `ContainerSheet`) does not generalize to journals, because **module-owned page subtypes bring their own sheets**. Bibliosoph's injury pages use `InjuryPageSheet`; Squire's codex pages use `CodexPageSheet`. Blacksmith cannot know about either, and chasing every core page sheet type (text, image, pdf, video) still misses both of us.

**Suggestion: invert the integration.** Rather than Blacksmith finding sheets, let sheet owners opt in:

```js
// returns { html, bind(rootElement) } or an ApplicationV2 part
const field = await gmNotes.renderField(uuid, { label: 'GM Notes', collapsed: true });
```

A module drops that into its own template and calls `bind()` on render. One component, consistent look, correct storage, and it works in *anyone's* bespoke sheet — including the two that exist today. Keep the auto-injected panel for stock sheets where it does work; make the component the supported path everywhere else.

## 4. Re-import must never clobber notes

Modules that ship content overwrite it on update — we rebuild `packs/injuries` from source on every release. Anything a GM authored *on* those documents is user data and must survive.

Squire's CODEX already handles this shape of problem by preserving specific fields across import (has the party discovered this, quest progress). GM notes are the same category, and arguably the clearest case: they are *never* module-authored.

**Suggestion:** when the Importer API lands, let a profile declare what survives an update-in-place, with GM notes preserved by default:

```js
preserveOnReimport: ['flags.coffee-pub-blacksmith.gmNotes']
```

The related workflow worth documenting alongside it: a GM who wants to *own* shipped content should copy the pack into a world compendium and repoint the consuming module at it (Bibliosoph already exposes an `injuryCompendium` setting for exactly this). Flags travel with the copy, so notes come along and a module update can never reach them. That is the honest answer to "I edited your compendium and lost it," and it is the same for every module.

## 5. Smaller things

- **Journal context in the change hook and any search index.** A note on a page is not navigable from the page name alone — carrying the parent `JournalEntry` name/uuid in the hook payload would let a search result say "Injuries ▸ Slashing ▸ Gnash Wound" rather than just "Gnash Wound."
- **Bulk read.** Our Check-Up card can list a dozen afflictions at once. A `getMany(uuids)` (or making the async variant cheap to call in a loop) avoids N sequential resolutions.
- **The privacy caveat deserves to be louder for journals.** Your docs already say notes are UI-gated rather than secret. With Items that is mostly theoretical; with journals, players routinely have observer access to entries, so the flag genuinely travels. Worth repeating the warning in whatever journal-facing docs you write, because the failure mode is a GM assuming a *journal* note is as private as a GM-only journal.

---

## What we're doing meanwhile

Bibliosoph will host the notes field in its own injury page sheet and read/write through `gmNotes` — no private convention, no notes in page content. Where the API is synchronous we will resolve the page document ourselves first and pass the Document rather than a uuid string, which sidesteps issue 1 today.

One thing we already solved that may be worth stealing: our Check-Up chat card never embeds note text in the message. The card carries only the page uuid, and each **GM's own client** fetches the note and rewrites its local tooltip. Players never receive the bytes, and the note stays live — editing the journal updates the hover with no need to repost. Any Blacksmith surface that renders notes into shared HTML (chat cards, shared journals) should use the same shape.
