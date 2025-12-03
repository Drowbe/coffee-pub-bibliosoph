# Coffee Pub Bibliosoph - v12 to v13 Migration Plan

> **Module:** coffee-pub-bibliosoph  
> **Current Version:** 12.1.3  
> **Target Version:** 13.0.0  
> **Migration Date:** TBD

---

## Executive Summary

This migration plan outlines the steps required to upgrade Coffee Pub Bibliosoph from FoundryVTT v12 to v13. The module requires updates for jQuery removal and Font Awesome 5 to 6 migration. No `getSceneControlButtons` hooks or deprecated APIs were found.

**Estimated Complexity:** Medium  
**Estimated Time:** 4-6 hours  
**Breaking Changes:** 3 major areas identified

---

## Pre-Migration Checklist

### 1. Lock Down v12 Release
- [ ] Finalize and test current v12 version (12.1.3)
- [ ] Create git tag: `v12.1.3-FINAL`
- [ ] Create GitHub release marking as final v12 version
- [ ] Update README with v12 support end notice
- [ ] Update CHANGELOG with final v12 release entry

### 2. Update Module Configuration
- [ ] Update `module.json` minimum Core Version to `"13.0.0"`
- [ ] Update module version to `"13.0.0"` (or appropriate v13 starting version)
- [ ] Update compatibility section:
  ```json
  "compatibility": {
    "minimum": "13",
    "verified": "13",
    "maximum": "13"
  }
  ```

### 3. Prepare Development Environment
- [ ] Set up FoundryVTT v13 testing environment
- [ ] Create feature branch: `v13-migration`
- [ ] Document current functionality baseline

### 4. Audit Results Summary
- [x] **jQuery Usage:** Found in 2 files (`bibliosoph.js`, `window.js`)
- [x] **Font Awesome 5:** Found in 2 files (`manager-toolbar.js`, templates)
- [x] **getSceneControlButtons:** None found ✓
- [x] **Deprecated APIs:** None found ✓
- [x] **FormApplication Classes:** 1 class (`BiblioWindowChat`)

---

## Migration Tasks

### Task 1: jQuery Removal - `scripts/window.js`

**File:** `scripts/window.js`  
**Lines Affected:** 55-86, 118, 122  
**Complexity:** Medium

#### Issues Found:
1. Line 60: `html.find('#optionChatType > img').on('click', ...)`
2. Line 64: `html.find('#optionChatType > img').removeClass(...)`
3. Line 68: `html.find('#hiddenOptionChatType').val(...)`
4. Line 73: `html.find('div[name="selectable-div"]').on('click', ...)`
5. Line 75: `$(event.currentTarget).attr('value')`
6. Line 77: `$(event.currentTarget).toggleClass(...)`
7. Line 118: `$(event.currentTarget).find('textarea#inputMessage').val('')`
8. Line 122: `$(event.currentTarget).find('textarea#inputMessage').val('')`

#### Migration Steps:
1. Add jQuery detection helper method to `BiblioWindowChat` class (Pattern 10)
2. Convert `html.find()` to `querySelector()` / `querySelectorAll()`
3. Convert `.on('click', ...)` to `addEventListener('click', ...)`
4. Convert `.removeClass()` to `classList.remove()`
5. Convert `.val()` to `.value`
6. Convert `$(event.currentTarget)` to `event.currentTarget`
7. Convert `.toggleClass()` to `classList.toggle()`
8. Convert `.find()` to `querySelector()`

#### Expected Changes:
```javascript
// BEFORE (v12)
activateListeners(html) {
    super.activateListeners(html);
    html.find('#optionChatType > img').on('click', (event) => { 
        let chosenValue = event.currentTarget.getAttribute("value");
        html.find('#optionChatType > img').removeClass('bibliosoph-option-image-selected');
        event.currentTarget.classList.add('bibliosoph-option-image-selected');
        html.find('#hiddenOptionChatType').val(chosenValue);
    });
    html.find('div[name="selectable-div"]').on('click', (event) => {
        let divValue = $(event.currentTarget).attr('value');
        $(event.currentTarget).toggleClass('bibliosoph-option-div-selected');
        // ...
    });
}

// AFTER (v13)
activateListeners(html) {
    super.activateListeners(html);
    
    // v13: Detect and convert jQuery to native DOM if needed
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    
    // SELECTING IMAGES
    const images = nativeHtml.querySelectorAll('#optionChatType > img');
    images.forEach(img => {
        img.addEventListener('click', (event) => {
            let chosenValue = event.currentTarget.getAttribute("value");
            images.forEach(i => i.classList.remove('bibliosoph-option-image-selected'));
            event.currentTarget.classList.add('bibliosoph-option-image-selected');
            const hiddenInput = nativeHtml.querySelector('#hiddenOptionChatType');
            if (hiddenInput) hiddenInput.value = chosenValue;
        });
    });
    
    // SELECTING DIVS
    const selectableDivs = nativeHtml.querySelectorAll('div[name="selectable-div"]');
    selectableDivs.forEach(div => {
        div.addEventListener('click', (event) => {
            let divValue = event.currentTarget.getAttribute('value');
            event.currentTarget.classList.toggle('bibliosoph-option-div-selected');
            // ...
        });
    });
}
```

---

### Task 2: jQuery Removal - `scripts/bibliosoph.js`

**File:** `scripts/bibliosoph.js`  
**Lines Affected:** 614-617, 1404  
**Complexity:** Low-Medium

#### Issues Found:
1. Line 615: `$('#optionChatType > i').on('click', function() {...})`
2. Line 616: `$(this).attr("value")`
3. Line 1404: `html.find(".category-button").click(async (event) => {...})`

#### Migration Steps:
1. Convert `$('#optionChatType > i')` to `document.querySelector('#optionChatType > i')` or search within hook's `html` parameter
2. Convert `.on('click', ...)` to `addEventListener('click', ...)`
3. Convert `$(this)` to `event.currentTarget`
4. Convert `.attr("value")` to `.getAttribute("value")`
5. Convert `html.find(".category-button")` to `html.querySelectorAll(".category-button")`
6. Convert `.click()` to `addEventListener('click', ...)`
7. Add jQuery detection for `html` parameter (Pattern 10)

#### Expected Changes:
```javascript
// BEFORE (v12)
Hooks.on('renderChatLog', (app, html, data) => {
    $('#optionChatType > i').on('click', function() {
        let chosenValue = $(this).attr("value");
    });
});

Hooks.on("renderChatMessage", (message, html) => {
    html.find(".category-button").click(async (event) => {
        // ...
    });
});

// AFTER (v13)
Hooks.on('renderChatLog', (app, html, data) => {
    // v13: Detect and convert jQuery to native DOM if needed
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    
    const icons = nativeHtml.querySelectorAll('#optionChatType > i');
    icons.forEach(icon => {
        icon.addEventListener('click', (event) => {
            let chosenValue = event.currentTarget.getAttribute("value");
            // ...
        });
    });
});

Hooks.on("renderChatMessage", (message, html) => {
    // v13: Detect and convert jQuery to native DOM if needed
    let nativeHtml = html;
    if (html && (html.jquery || typeof html.find === 'function')) {
        nativeHtml = html[0] || html.get?.(0) || html;
    }
    
    const buttons = nativeHtml.querySelectorAll(".category-button");
    buttons.forEach(button => {
        button.addEventListener('click', async (event) => {
            // ...
        });
    });
});
```

---

### Task 3: Font Awesome 5 to 6 Migration - `scripts/manager-toolbar.js`

**File:** `scripts/manager-toolbar.js`  
**Lines Affected:** 84, 105, 126, 148, 168, 188, 208, 228, 248, 268, 288, 308, 328, 348, 368, 388, 408, 428, 448, 468  
**Complexity:** Low

#### Issues Found:
20 instances of `fas` class prefix that need to be converted to `fa-solid`

#### Migration Steps:
1. Replace all `"fas fa-*"` with `"fa-solid fa-*"` in icon definitions
2. Verify all icons exist in Font Awesome 6 subset
3. Test all toolbar icons render correctly

#### Expected Changes:
```javascript
// BEFORE (v12)
icon: "fas fa-burst",
icon: "fas fa-heart-crack",
icon: "fas fa-bandage",
// ... etc

// AFTER (v13)
icon: "fa-solid fa-burst",
icon: "fa-solid fa-heart-crack",
icon: "fa-solid fa-bandage",
// ... etc
```

#### Icons to Update:
- `fas fa-burst` → `fa-solid fa-burst`
- `fas fa-heart-crack` → `fa-solid fa-heart-crack`
- `fas fa-bandage` → `fa-solid fa-bandage`
- `fas fa-mug-hot` → `fa-solid fa-mug-hot`
- `fas fa-restroom` → `fa-solid fa-restroom`
- `fas fa-face-angry` → `fa-solid fa-face-angry`
- `fas fa-face-smile` → `fa-solid fa-face-smile`
- `fas fa-gift` → `fa-solid fa-gift`
- `fas fa-mask` → `fa-solid fa-mask`
- `fas fa-lightbulb` → `fa-solid fa-lightbulb`
- `fas fa-dice-d20` → `fa-solid fa-dice-d20`
- `fas fa-mountain` → `fa-solid fa-mountain`
- `fas fa-sun` → `fa-solid fa-sun`
- `fas fa-dungeon` → `fa-solid fa-dungeon`
- `fas fa-tree` → `fa-solid fa-tree`
- `fas fa-cloud` → `fa-solid fa-cloud`
- `fas fa-snowflake` → `fa-solid fa-snowflake`
- `fas fa-city` → `fa-solid fa-city`
- `fas fa-water` → `fa-solid fa-water`

**Note:** Some icons in `manager-toolbar.js` already use `fa-solid` (lines 27, 42, 63) - these are correct and should remain unchanged.

---

### Task 4: Font Awesome 5 to 6 Migration - Templates

**Files:** `templates/chat-card.hbs`, `templates/dialogue-messages.hbs`  
**Lines Affected:** Multiple  
**Complexity:** Low

#### Issues Found:
11 instances of `fas` class prefix in Handlebars templates

#### Migration Steps:
1. Replace all `class="fas` with `class="fa-solid` in templates
2. Replace all `class='fas` with `class='fa-solid` in templates
3. Verify all icons render correctly after migration

#### Expected Changes:
```handlebars
<!-- BEFORE (v12) -->
<i class="fas {{iconStyle}}" id="cards-icon-{{cardStyle}}"></i>
<i class="fas fa-circle-up"></i>
<i class="fas fa-heart-pulse" id="cards-icon-{{cardStyle}}"></i>
<i class="fas fa-chevron-down fa-fw"></i>
<i class="fas fa-hourglass-half" id="cards-icon-{{cardStyle}}"></i>
<i class="fas fa-heart-crack" id="cards-icon-{{cardStyle}}"></i>
<i class="fas fa-sparkles" id="cards-icon-{{cardStyle}}"></i>

<!-- AFTER (v13) -->
<i class="fa-solid {{iconStyle}}" id="cards-icon-{{cardStyle}}"></i>
<i class="fa-solid fa-circle-up"></i>
<i class="fa-solid fa-heart-pulse" id="cards-icon-{{cardStyle}}"></i>
<i class="fa-solid fa-chevron-down fa-fw"></i>
<i class="fa-solid fa-hourglass-half" id="cards-icon-{{cardStyle}}"></i>
<i class="fa-solid fa-heart-crack" id="cards-icon-{{cardStyle}}"></i>
<i class="fa-solid fa-sparkles" id="cards-icon-{{cardStyle}}"></i>
```

#### Files to Update:
1. **`templates/chat-card.hbs`** - 10 instances
   - Line 5: `class="fas {{iconStyle}}"`
   - Line 33: `class="fas {{iconSubStyle}}"`
   - Line 67: `class="fas fa-heart-pulse"`
   - Line 68: `class="fas fa-chevron-down fa-fw"`
   - Line 82: `class="fas fa-hourglass-half"`
   - Line 85: `class="fas fa-heart-crack"`
   - Line 88: `class="fas fa-sparkles"`
   - Line 118: `class="fas {{this.buttonicon}}"`
   - Line 124: `class="fas {{iconStyle}}"`
   - Line 129: `class="fas fa-circle-up"`

2. **`templates/dialogue-messages.hbs`** - 1 instance
   - Line 30: `class="fas fa-circle-up"`

---

### Task 5: FormApplication jQuery Detection

**File:** `scripts/window.js`  
**Class:** `BiblioWindowChat`  
**Complexity:** Low

#### Migration Steps:
1. Add `_getNativeElement()` helper method to handle `this.element` (Pattern 10)
2. Ensure all methods that use `this.element` go through the helper
3. Document this as technical debt to remove after migration

#### Expected Changes:
```javascript
export class BiblioWindowChat extends FormApplication {
    // ... existing code ...
    
    /**
     * Get native DOM element from this.element (handles jQuery conversion)
     * @returns {HTMLElement|null} Native DOM element
     */
    _getNativeElement() {
        if (!this.element) return null;
        // v13: Detect and convert jQuery to native DOM if needed
        if (this.element.jquery || typeof this.element.find === 'function') {
            return this.element[0] || this.element.get?.(0) || this.element;
        }
        return this.element;
    }
    
    // ... rest of class ...
}
```

**Note:** This is transitional code (technical debt). After migration, audit and remove unnecessary detections where the source is guaranteed to be native DOM.

---

## Testing Checklist

### Phase 1: Critical Path Testing

After completing all migration tasks:

- [ ] Module loads without console errors
- [ ] All hooks that receive `html` parameter work correctly:
  - [ ] `renderChatLog` hook
  - [ ] `renderChatMessage` hook
- [ ] FormApplication (`BiblioWindowChat`) renders correctly
- [ ] All Font Awesome icons render correctly:
  - [ ] Toolbar icons (20 icons)
  - [ ] Chat card icons (10+ icons)
  - [ ] Dialogue message icons (1 icon)
- [ ] No deprecation warnings in console

### Phase 2: Functionality Testing

- [ ] Party message dialog opens and works
- [ ] Private message dialog opens and works
- [ ] Image selection in dialog works (click handlers)
- [ ] Div selection in dialog works (click handlers)
- [ ] Form submission works correctly
- [ ] Category buttons in chat messages work
- [ ] All toolbar tools render and function correctly
- [ ] Event handlers fire correctly
- [ ] DOM manipulation works as expected

### Phase 3: Integration Testing

- [ ] Test with other v13-compatible modules
- [ ] Test with Coffee Pub Blacksmith (required dependency)
- [ ] Verify no conflicts with other modules
- [ ] Test performance (no regressions)

### Phase 4: Edge Cases

- [ ] Test with empty data
- [ ] Test with different user permissions (GM vs Player)
- [ ] Test dialog in different scenarios (public/private)
- [ ] Test chat message rendering with various card types

---

## Migration Workflow

### Step 1: Preparation (30 minutes)
1. Complete Pre-Migration Checklist
2. Create feature branch: `v13-migration`
3. Set up v13 testing environment

### Step 2: jQuery Removal (2-3 hours)
1. **Task 1:** Migrate `scripts/window.js` (1-1.5 hours)
   - Add jQuery detection
   - Convert all jQuery selectors and methods
   - Test dialog functionality
2. **Task 2:** Migrate `scripts/bibliosoph.js` (1-1.5 hours)
   - Convert hook jQuery usage
   - Test chat log and message rendering

### Step 3: Font Awesome Migration (30 minutes)
1. **Task 3:** Update `scripts/manager-toolbar.js` (15 minutes)
   - Replace all `fas` with `fa-solid`
   - Test toolbar icons
2. **Task 4:** Update templates (15 minutes)
   - Update `templates/chat-card.hbs`
   - Update `templates/dialogue-messages.hbs`
   - Test icon rendering

### Step 4: FormApplication Helper (15 minutes)
1. **Task 5:** Add `_getNativeElement()` helper
2. Document as technical debt

### Step 5: Testing (1-2 hours)
1. Run through Testing Checklist
2. Fix any issues found
3. Test with other modules

### Step 6: Release Preparation (30 minutes)
1. Update `module.json` version and compatibility
2. Update CHANGELOG
3. Create release notes
4. Tag and release

---

## Files to Modify

### JavaScript Files:
1. `scripts/window.js` - jQuery removal, FormApplication helper
2. `scripts/bibliosoph.js` - jQuery removal in hooks
3. `scripts/manager-toolbar.js` - Font Awesome class prefix update

### Template Files:
1. `templates/chat-card.hbs` - Font Awesome class prefix update
2. `templates/dialogue-messages.hbs` - Font Awesome class prefix update

### Configuration Files:
1. `module.json` - Version and compatibility updates

---

## Risk Assessment

### Low Risk:
- Font Awesome migration (simple find/replace)
- Template updates (no logic changes)

### Medium Risk:
- jQuery removal in `window.js` (FormApplication complexity)
- jQuery removal in hooks (multiple hook handlers)

### Mitigation:
- Test each file after migration
- Keep v12 branch available for rollback
- Test thoroughly before release

---

## Post-Migration Cleanup

### Technical Debt to Address Later:
1. **jQuery Detection Patterns** - After confirming all call sites pass native DOM:
   - Audit all jQuery detection code
   - Remove unnecessary detections
   - Document which detections are still needed and why

2. **Code Review:**
   - Review all migrated code for consistency
   - Ensure no jQuery patterns remain
   - Verify all Font Awesome icons are correct

---

## Resources

- [Migration Global Guide](./migration-global.md) - Comprehensive reference
- [FoundryVTT v13 API Migration](https://foundryvtt.com/article/migration/)
- [FoundryVTT v13 API Reference](https://foundryvtt.com/api/)
- [ApplicationV2 API](https://foundryvtt.wiki/en/development/api/applicationv2)

---

## Notes

- No `getSceneControlButtons` hooks found - no migration needed
- No deprecated APIs (`token.target`, `FilePicker`) found - no migration needed
- CSS is handled by Coffee Pub Blacksmith - no CSS migration needed
- All Font Awesome icons should be verified in FoundryVTT v13 to ensure they exist in the subset

---

**Last Updated:** 2025-01-XX  
**Status:** Ready for Migration  
**Estimated Completion:** TBD

