# Application V2 Implementation Guidance

This document captures how we implement Foundry V13 **Application V2** windows in Coffee Pub modules: patterns that work, requirements, and lessons learned. Use it when adding new V2 apps or migrating existing FormApplication/Application (V1) dialogs to V2.

**Reference implementation in this repo:** Quick Encounter window — `scripts/window-encounter.js`, `templates/window-encounter.hbs`, `styles/window-encounter.css`.

---

## 1. Scope and Policy

- **Target:** Foundry V13+ only. No fallbacks to V1 `Application` or `FormApplication`.
- **New windows/dialogs** in Coffee Pub modules should use Application V2 where possible so we stay on the supported path and avoid deprecated patterns.

---

## 2. Critical Requirement: You Must Be “Renderable”

Application V2 does **not** implement `_renderHTML` and `_replaceHTML` by default. If you extend `ApplicationV2` directly and call `render()`, you get:

```text
Uncaught (in promise) Error: The YourApp Application class is not renderable because it does not implement the abstract methods _renderHTML and _replaceHTML. Consider using a mixin such as foundry.applications.api.HandlebarsApplicationMixin for this purpose.
```

**Fix:** Use **HandlebarsApplicationMixin** so the mixin provides those methods. Your app then uses Handlebars for HTML and fits the V2 lifecycle.

---

## 3. Base Class Pattern

Use the mixin **with** Application V2; do not extend `ApplicationV2` alone for Handlebars-based UIs.

```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

export class YourWindow extends Base {
    // ...
}
```

- **ApplicationV2** — V2 lifecycle and behavior.
- **HandlebarsApplicationMixin(ApplicationV2)** — Adds Handlebars-based `_renderHTML` / `_replaceHTML` so the app is renderable and works with `getData()` and `activateListeners(html)`.

---

## 4. Required and Common Options

For **ApplicationV2**, use **`static DEFAULT_OPTIONS`** (not `static get defaultOptions()`). At minimum:

- **id** — Unique string (e.g. `'your-module-your-window'`).
- **classes** — Array of CSS classes for the app shell.
- **position** — `{ width, height }` (not top-level).
- **window** — `{ title, resizable, minimizable }` (not top-level).
- **PARTS** — Define **`static PARTS = { content: { template: '...' } }`** on the class (not inside DEFAULT_OPTIONS). This is what injects your template into `.window-content`.

Merge with `super.DEFAULT_OPTIONS` to preserve the mixin’s defaults.

```javascript
static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
    id: `${MODULE.ID}-your-window`,
    classes: ['window-yourname', 'yourmodule-window'],
    position: { width: 720, height: 560 },
    window: { title: 'Your Window Title', resizable: true, minimizable: true },
});
```

Define parts separately so AppV2 injects into `.window-content`:

```javascript
static PARTS = {
    content: { template: `modules/${MODULE.ID}/templates/your-window.hbs` }
};
```

---

## 5. Template Data: getData(options)

The HandlebarsApplicationMixin uses **getData** to build the context for the Handlebars template. Implement it as **async** and return a plain object.

- **Name:** `getData(options = {})`.
- **Return:** Object passed to the template (e.g. `title`, lists, flags, current selections).
- **Usage in template:** `{{title}}`, `{{#each items}}`, `{{#if selected}}`, etc.

Avoid relying on V1-only or undocumented names (e.g. `_prepareContext`) unless the mixin explicitly documents them. Stick to `getData` for Handlebars apps.

```javascript
async getData(options = {}) {
    await this._loadSomeData(); // optional async prep
    return {
        appId: this.id,
        title: this.options.window?.title ?? 'Default Title',
        items: this._items.map(i => ({ name: i.name, selected: i.id === this._selectedId })),
        hasResults: this._results.length > 0
    };
}
```

---

## 6. Event Binding: activateListeners(html)

After the mixin renders HTML, it calls **activateListeners(html)** so you can attach events. Use **native DOM** (no jQuery).

- **Signature:** `activateListeners(html)` — `html` is the rendered root (or fragment) for your app’s content.
- **Resolve root:** If your template is wrapped in a single root (e.g. `<div class="window-yourname">`), get it with `html?.querySelector?.('.window-yourname') ?? html?.[0] ?? html`.
- **Use:** `root.querySelector`, `root.querySelectorAll`, `element.addEventListener('click', ...)`, etc.

```javascript
activateListeners(html) {
    const root = html?.matches?.('.window-yourname') ? html : html?.querySelector?.('.window-yourname') ?? html;
    if (!root) return;

    const closeBtn = root.querySelector('.window-yourname-close');
    closeBtn?.addEventListener('click', () => this.close());

    root.querySelectorAll('.window-yourname-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            this._selected = e.currentTarget?.dataset?.value;
            this.render(); // re-render to refresh UI
        });
    });
}
```

---

## 7. File and Naming Conventions

Align with existing patterns so other modules can copy and adapt:

| Kind            | Pattern           | Example                    |
|-----------------|-------------------|----------------------------|
| Application JS  | `window-*.js`     | `window-encounter.js`      |
| Handlebars      | `window-*.hbs`    | `window-encounter.hbs`     |
| Styles          | `window-*.css`    | `window-encounter.css`     |
| Orchestration   | `manager-*.js`    | `manager-encounters.js`    |

- **Template path:** `` `modules/${MODULE.ID}/templates/window-encounter.hbs` `` (or your module’s ID and filename).
- **CSS:** Load `styles/window-encounter.css` from `module.json` so the window is scoped and doesn’t clash with other apps.

---

## 8. Template Structure (Handlebars)

- One logical root (e.g. `<div class="window-yourname">`) so `activateListeners` can target it reliably.
- Use the same class prefix in the template as in `defaultOptions.classes` and in CSS (e.g. `window-yourname-header`, `window-yourname-body`) for clarity and to avoid clashes.
- Prefer passing **precomputed** data from `getData` (e.g. `selected: true/false`) instead of relying on Handlebars helpers that might not be registered (e.g. `eq`).

Example shape:

```handlebars
<div class="window-yourname">
    <header class="window-yourname-header">...</header>
    <section class="window-yourname-body">...</section>
</div>
```

---

## 9. Opening the Window from the Toolbar (or Elsewhere)

- **Manager/orchestrator** (e.g. `manager-encounters.js`) exports a function that creates and renders the app:
  - Reuse existing window if it’s already rendered; otherwise `new YourWindow().render(true)`.
- **Toolbar** (e.g. in `manager-toolbar.js`): register a tool whose `onClick` calls that function. No need to tie the app to V1 or global `window` beyond what you need for wiring (e.g. a recommend callback).

```javascript
// In manager-encounters.js (or similar)
let _window = null;
export function openEncounterWindow() {
    if (_window?.rendered) {
        _window.bringToFront();
        return _window;
    }
    _window = new WindowEncounter();
    _window.render(true);
    return _window;
}
```

---

## 10. Lessons Learned

| Lesson | Detail |
|--------|--------|
| **Don’t extend ApplicationV2 alone for Handlebars UIs** | You must implement `_renderHTML` and `_replaceHTML` or use `HandlebarsApplicationMixin(ApplicationV2)` so the app is renderable. |
| **Use the mixin explicitly** | `const Base = HandlebarsApplicationMixin(ApplicationV2); export class YourWindow extends Base { ... }` is the pattern that works. |
| **getData, not _prepareContext, for the mixin** | The Handlebars mixin expects template context from `getData(options)`. Use async `getData` and return a plain object. |
| **Use DEFAULT_OPTIONS, not defaultOptions** | ApplicationV2 (v13) expects `static DEFAULT_OPTIONS` and v13 option shape: `position`, `window` (no top-level `template`/`title`/`width`/`height`). |
| **Define parts in static PARTS, not in DEFAULT_OPTIONS** | Put `static PARTS = { content: { template: '...' } }` on the class. If parts are only in DEFAULT_OPTIONS, the shell renders but `.window-content` stays empty. |
| **activateListeners(html): handle "I am already the root"** | In AppV2, `html` may be the part root (e.g. your `.window-yourname` div). Use `html?.matches?.('.window-yourname') ? html : html?.querySelector?.('.window-yourname') ?? html` so listeners attach. |
| **No jQuery dependency** | Application V2 / mixin flow is native DOM; keep window code jQuery-free. |
| **V13 only** | We do not support fallbacks to V1 Application or FormApplication; document and implement for V13+ only. |
| **Scoped CSS** | Use a unique app id and class prefix (e.g. `#bibliosoph-quick-encounter`, `.window-encounter-*`) so styles don’t leak. |
| **Precompute “selected” in getData** | Avoid depending on Handlebars helpers like `eq`; pass `selected: true/false` (or similar) from `getData` so templates stay simple and portable. |
| **Use bringToFront, not bringToTop** | In Application V2, `bringToTop` is deprecated (v12) and redirects to `bringToFront`; the shim is removed in v14. Always use `bringToFront()` when focusing an already-rendered window. |

---

## 11. Checklist for New V2 Windows

- [ ] Base class is `HandlebarsApplicationMixin(ApplicationV2)`, not raw `ApplicationV2`.
- [ ] `static PARTS = { content: { template: '...' } }` is defined on the class (not inside DEFAULT_OPTIONS).
- [ ] `DEFAULT_OPTIONS` uses v13 shape: `id`, `classes`, `position`, `window` (no top-level `template`/`title`/`width`/`height`).
- [ ] `async getData(options)` returns the full template context.
- [ ] `activateListeners(html)` resolves root with "I am already the root" logic (`html?.matches?.('.your-root') ? html : ...`), then attaches listeners with native DOM.
- [ ] Template has a single logical root and uses a consistent class prefix.
- [ ] CSS is in `styles/window-*.css` and loaded via `module.json`; selectors are scoped (id/class).
- [ ] Opening the window is done via a manager (e.g. `openEncounterWindow()`) and, if needed, wired from the toolbar or another entry point.

---

## 12. References

- **This repo:** `scripts/window-encounter.js`, `templates/window-encounter.hbs`, `styles/window-encounter.css`, `scripts/manager-encounters.js`.
- **Squire (V1) reference:** `documentation/squire/window-note.js` — structure and styling only; that app is FormApplication (V1), not V2.
- **Foundry:** Application V2 API and HandlebarsApplicationMixin (Foundry V13 docs / wiki). Policy: V13+ only, no V1 fallbacks.
