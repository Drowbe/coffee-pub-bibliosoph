// ==================================================================
// ===== QUICK ENCOUNTER WINDOW (Application V2) ===================
// ==================================================================
// Foundry v13 only. Uses HandlebarsApplicationMixin for _renderHTML/_replaceHTML.
// Options follow ApplicationV2 (v13): PARTS (what injects into .window-content), DEFAULT_OPTIONS (sizing, title).

import { MODULE } from './const.js';

/** Template path for the encounter window. */
export const WINDOW_ENCOUNTER_TEMPLATE = `modules/${MODULE.ID}/templates/window-encounter.hbs`;

/** Unique application id so no other module's window can be reused. */
export const WINDOW_ENCOUNTER_APP_ID = `${MODULE.ID}-quick-encounter`;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

/** Difficulty slider steps: 0=Easy, 1=Medium, 2=Hard, 3=Deadly. CR offset from party. */
const DIFFICULTY_OFFSETS = [-2, 0, 2, 4];
const DIFFICULTY_LABELS = ['Easy', 'Medium', 'Hard', 'Deadly'];

/**
 * Parse numeric CR from assessment (partyCR/monsterCR) or display string (e.g. "1/2", "5").
 * @param {*} value - number or string
 * @returns {number}
 */
function parseCR(value) {
    if (value == null) return NaN;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'object' && typeof value.value === 'number') return value.value;
    const s = String(value).trim();
    if (s === '—' || s === '' || s === '–') return NaN;
    if (s === '1/2' || s === '½') return 0.5;
    const n = parseFloat(s);
    return Number.isNaN(n) ? NaN : n;
}

/** Format CR for display (2 decimals, or "1/2" for 0.5). */
function formatCRDisplay(num) {
    if (num == null || Number.isNaN(num)) return '—';
    if (num === 0.5) return '1/2';
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

/** Log to console and optionally show notification (when Blacksmith available). */
function log(msg, detail = '', showNotification = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, msg, detail, true, showNotification);
    } else {
        console.log(MODULE.NAME, msg, detail !== '' ? detail : '');
    }
}

/**
 * Quick Encounter configuration window — Application V2 + HandlebarsApplicationMixin.
 * Blacksmith-style layout: header, canvas CR, filters (habitat, difficulty), results grid, deployment.
 */
export class WindowEncounter extends Base {
    _assessment = null;
    _habitats = [
        'Any', 'Arctic', 'Coastal', 'Desert', 'Forest', 'Grassland',
        'Hill', 'Mountain', 'Planar', 'Swamp', 'Underdark', 'Underwater', 'Urban'
    ];
    _selectedHabitat = 'Any';
    /** Slider index 0–3: Easy, Medium, Hard, Deadly. Replaces dropdown. */
    _crSliderIndex = 1;
    _selectedDifficulty = 'Medium';
    _recommendations = [];
    /** True while recommend request is in progress (show spinner). */
    _recommendLoading = false;
    /** True after at least one recommend run (so we can show "No monsters found" vs initial hint). */
    _recommendAttempted = false;
    /** UUIDs of recommendation cards selected for deploy. */
    _selectedForDeploy = new Set();
    /** Blacksmith deployMonsters options: pattern and visibility. */
    _deploymentPattern = 'sequential';
    _deploymentHidden = false;

    /** AppV2: parts go here so Foundry injects template into .window-content (not in DEFAULT_OPTIONS). */
    static PARTS = {
        content: { template: WINDOW_ENCOUNTER_TEMPLATE }
    };

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
        id: WINDOW_ENCOUNTER_APP_ID,
        classes: ['window-encounter', 'bibliosoph-window'],
        position: { width: 500, height: 750 },
        window: {
            title: 'Quick Encounter',
            resizable: true,
            minimizable: true
        }
    });

    /**
     * Shared context for all parts: include our getData() so part templates receive it.
     */
    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        const ourData = await this.getData(options);
        log('Quick Encounter: prepareContext', `habitats=${ourData.habitats?.length ?? 0}, assessment=${ourData.partyCRDisplay ?? '—'}`, false);
        return foundry.utils.mergeObject(base, ourData);
    }

    /**
     * Template context for the Handlebars template.
     * @param {Object} options - Render options
     * @returns {Object} Context for the Handlebars template
     */
    async getData(options = {}) {
        await this._loadCombatAssessment();

        const a = this._assessment;
        const heroCRNum = parseCR(a?.partyCR ?? a?.partyCRDisplay);
        const monsterCRNum = parseCR(a?.monsterCR ?? a?.monsterCRDisplay);
        const heroCRDisplay = formatCRDisplay(heroCRNum);
        const monsterCRDisplay = formatCRDisplay(monsterCRNum);

        const offset = DIFFICULTY_OFFSETS[this._crSliderIndex] ?? 0;
        const partyBase = Number.isNaN(heroCRNum) ? 5 : heroCRNum;
        const encounterCRNum = Math.max(0, partyBase + offset);
        const monsterGapNum = Number.isNaN(monsterCRNum) ? encounterCRNum : Math.max(0, encounterCRNum - monsterCRNum);
        const encounterCRDisplay = formatCRDisplay(encounterCRNum);
        const monsterGapDisplay = formatCRDisplay(monsterGapNum);

        const difficultyLabel = DIFFICULTY_LABELS[this._crSliderIndex] ?? 'Medium';
        const difficultyClass = difficultyLabel.toLowerCase();

        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const recommendationsWithSelection = recommendations.map(r => ({
            ...r,
            selected: this._selectedForDeploy.has(r.id)
        }));
        const deploySelectedCount = this._selectedForDeploy.size;

        return {
            appId: this.id || WINDOW_ENCOUNTER_APP_ID,
            title: this.options.window?.title ?? 'Quick Encounter',
            assessment: this._assessment,
            partyCRDisplay: this._assessment?.partyCRDisplay ?? heroCRDisplay,
            monsterCRDisplay: this._assessment?.monsterCRDisplay ?? monsterCRDisplay,
            heroCRDisplay,
            monsterCRDisplayNum: monsterCRDisplay,
            monsterGapDisplay,
            encounterCRDisplay,
            difficulty: difficultyLabel,
            difficultyClass,
            crSliderIndex: this._crSliderIndex,
            crSliderMin: 0,
            crSliderMax: 3,
            habitats: this._habitats.map(h => ({ name: h, selected: h === this._selectedHabitat })),
            recommendations: recommendationsWithSelection,
            hasRecommendations: recommendations.length > 0,
            recommendLoading: this._recommendLoading,
            recommendAttempted: this._recommendAttempted,
            deploySelectedCount,
            hasDeploySelection: deploySelectedCount > 0,
            deploymentPatterns: [
                { value: 'sequential', label: 'Sequential', selected: this._deploymentPattern === 'sequential' },
                { value: 'circle', label: 'Circle', selected: this._deploymentPattern === 'circle' },
                { value: 'line', label: 'Line', selected: this._deploymentPattern === 'line' },
                { value: 'scatter', label: 'Scatter', selected: this._deploymentPattern === 'scatter' },
                { value: 'grid', label: 'Grid', selected: this._deploymentPattern === 'grid' }
            ],
            deploymentHidden: this._deploymentHidden
        };
    }

    /**
     * Load current canvas CR from Blacksmith combat assessment API.
     */
    async _loadCombatAssessment() {
        try {
            const api = game.modules.get('coffee-pub-blacksmith')?.api;
            if (api?.getCombatAssessment) {
                this._assessment = await api.getCombatAssessment();
                log('Quick Encounter: combat assessment', `from API — Party ${this._assessment?.partyCRDisplay ?? '—'}, Monster ${this._assessment?.monsterCRDisplay ?? '—'}`, false);
                return;
            }
            const bridge = await import('modules/coffee-pub-blacksmith/api/blacksmith-api.js').catch(() => null);
            if (bridge?.BlacksmithAPI?.getCombatAssessment) {
                this._assessment = await bridge.BlacksmithAPI.getCombatAssessment();
                log('Quick Encounter: combat assessment', `from bridge — Party ${this._assessment?.partyCRDisplay ?? '—'}, Monster ${this._assessment?.monsterCRDisplay ?? '—'}`, false);
                return;
            }
        } catch (e) {
            console.warn(MODULE.NAME, 'Encounter window: Blacksmith combat assessment unavailable', e);
        }
        this._assessment = {
            partyCRDisplay: '—',
            monsterCRDisplay: '—',
            difficulty: '—',
            difficultyClass: ''
        };
        log('Quick Encounter: combat assessment', this._assessment.partyCRDisplay !== '—' ? `Party ${this._assessment.partyCRDisplay}, Monster ${this._assessment.monsterCRDisplay}` : 'using fallback (no Blacksmith)', false);
    }

    /**
     * After first render, ensure delegation is attached on the app element so Recommend
     * and other buttons work even if activateListeners is never called (e.g. with PARTS).
     */
    async _onFirstRender(_context, options) {
        await super._onFirstRender?.(_context, options);
        this._attachDelegationOnce();
    }

    /**
     * Persist window position/size when the user moves or resizes (Application V2 calls this).
     * @param {ApplicationPosition} position - Current position (left, top, width, height, etc.)
     */
    _onPosition(position) {
        super._onPosition?.(position);
        this._saveWindowBounds(position);
    }

    /** Save current window bounds to client settings (used on position change and close). */
    _saveWindowBounds(position) {
        if (!game.settings?.get || typeof game.settings.get !== 'function') return;
        const pos = position ?? this.position;
        const bounds = {};
        if (typeof pos?.left === 'number') bounds.left = pos.left;
        if (typeof pos?.top === 'number') bounds.top = pos.top;
        if (typeof pos?.width === 'number') bounds.width = pos.width;
        else if (this.options?.position?.width != null) bounds.width = this.options.position.width;
        if (typeof pos?.height === 'number') bounds.height = pos.height;
        else if (this.options?.position?.height != null) bounds.height = this.options.position.height;
        if (Object.keys(bounds).length > 0) {
            const current = game.settings.get(MODULE.ID, 'quickEncounterWindowBounds') ?? {};
            game.settings.set(MODULE.ID, 'quickEncounterWindowBounds', { ...current, ...bounds });
        }
    }

    /** Save bounds when closing so final size/position are remembered. */
    async _preClose(options) {
        await super._preClose?.(options);
        this._saveWindowBounds();
    }

    /**
     * Attach click/change delegation on the app element once. Safe to call multiple times.
     * This is the reliable path for PARTS-based apps where activateListeners may not run.
     */
    _attachDelegationOnce() {
        if (this._encounterDelegationAttached) return;
        const appEl = this.element ?? document.getElementById(WINDOW_ENCOUNTER_APP_ID);
        if (!appEl) {
            requestAnimationFrame(() => this._attachDelegationOnce());
            return;
        }
        this._encounterDelegationAttached = true;
        appEl.addEventListener('click', (e) => {
            const closeBtn = e.target?.closest?.('.window-encounter-close');
            if (closeBtn) {
                this.close();
                return;
            }
            const habitatBtn = e.target?.closest?.('.window-encounter-habitat');
            if (habitatBtn?.dataset?.habitat) {
                this._selectedHabitat = habitatBtn.dataset.habitat;
                log('Quick Encounter: habitat selected', this._selectedHabitat, false);
                this.render();
                return;
            }
            const recommendBtn = e.target?.closest?.('.window-encounter-recommend');
            if (recommendBtn) {
                this._onRecommend();
                return;
            }
            const resultCard = e.target?.closest?.('.window-encounter-result-card');
            if (resultCard?.dataset?.actorId) {
                const uuid = resultCard.dataset.actorId;
                if (this._selectedForDeploy.has(uuid)) this._selectedForDeploy.delete(uuid);
                else this._selectedForDeploy.add(uuid);
                log('Quick Encounter: selection toggled', `${this._selectedForDeploy.size} selected`, false);
                this.render();
                return;
            }
            const deployBtn = e.target?.closest?.('.window-encounter-deploy-btn');
            if (deployBtn) {
                this._onDeploy();
                return;
            }
            const patternBtn = e.target?.closest?.('.window-encounter-deploy-pattern');
            if (patternBtn?.dataset?.pattern) {
                this._deploymentPattern = patternBtn.dataset.pattern;
                log('Quick Encounter: deployment pattern', this._deploymentPattern, false);
                this.render();
                return;
            }
        });
        appEl.addEventListener('change', (e) => {
            const visibleCheck = e.target?.closest?.('.window-encounter-deploy-visible');
            if (visibleCheck) {
                this._deploymentHidden = !visibleCheck.checked;
                log('Quick Encounter: deploy visible', visibleCheck.checked ? 'visible' : 'hidden', false);
                this.render();
            }
        });
        appEl.addEventListener('input', (e) => {
            const slider = e.target?.closest?.('.window-encounter-cr-slider');
            if (slider) {
                const idx = parseInt(slider.value, 10);
                if (!Number.isNaN(idx) && idx >= 0 && idx <= 3) {
                    this._crSliderIndex = idx;
                    this._selectedDifficulty = DIFFICULTY_LABELS[idx];
                    log('Quick Encounter: CR slider', this._selectedDifficulty, false);
                    this.render();
                }
            }
        });
        appEl.addEventListener('change', (e) => {
            const slider = e.target?.closest?.('.window-encounter-cr-slider');
            if (slider) {
                const idx = parseInt(slider.value, 10);
                if (!Number.isNaN(idx) && idx >= 0 && idx <= 3) {
                    this._crSliderIndex = idx;
                    this._selectedDifficulty = DIFFICULTY_LABELS[idx];
                    log('Quick Encounter: difficulty set', this._selectedDifficulty, false);
                    this.render();
                }
            }
        });
        log('Quick Encounter: delegation listeners attached', 'close, habitat, recommend, CR slider, card toggle, deploy', false);
    }

    /**
     * Attach listeners after render (may not be called for PARTS content). Delegation
     * is ensured in _onFirstRender; here we also try to attach and attach direct listeners when root exists.
     * @param {HTMLElement} html - Rendered element (native DOM)
     */
    activateListeners(html) {
        this._attachDelegationOnce();

        const root = html?.matches?.('.window-encounter') ? html : html?.querySelector?.('.window-encounter');
        if (!root) return;

        root.querySelector('.window-encounter-close')?.addEventListener('click', () => this.close());
        root.querySelectorAll('.window-encounter-habitat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitat = e.currentTarget?.dataset?.habitat;
                if (!habitat) return;
                this._selectedHabitat = habitat;
                log('Quick Encounter: habitat selected', habitat, false);
                this.render();
            });
        });
        root.querySelector('.window-encounter-cr-slider')?.addEventListener('input', (e) => {
            const idx = parseInt(e.target?.value, 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx <= 3) {
                this._crSliderIndex = idx;
                this._selectedDifficulty = DIFFICULTY_LABELS[idx];
                this.render();
            }
        });
        root.querySelector('.window-encounter-cr-slider')?.addEventListener('change', (e) => {
            const idx = parseInt(e.target?.value, 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx <= 3) {
                this._crSliderIndex = idx;
                this._selectedDifficulty = DIFFICULTY_LABELS[idx];
                this.render();
            }
        });
        root.querySelector('.window-encounter-recommend')?.addEventListener('click', () => this._onRecommend());
        root.querySelectorAll('.window-encounter-result-card').forEach(card => {
            card.addEventListener('click', () => {
                const uuid = card.dataset?.actorId;
                if (!uuid) return;
                if (this._selectedForDeploy.has(uuid)) this._selectedForDeploy.delete(uuid);
                else this._selectedForDeploy.add(uuid);
                log('Quick Encounter: selection toggled', `${this._selectedForDeploy.size} selected`, false);
                this.render();
            });
        });
        root.querySelector('.window-encounter-deploy-btn')?.addEventListener('click', () => this._onDeploy());
        root.querySelectorAll('.window-encounter-deploy-pattern').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pattern = e.currentTarget?.dataset?.pattern;
                if (pattern) {
                    this._deploymentPattern = pattern;
                    this.render();
                }
            });
        });
        root.querySelector('.window-encounter-deploy-visible')?.addEventListener('change', (e) => {
            this._deploymentHidden = !e.target?.checked;
            this.render();
        });
    }

    async _onRecommend() {
        log('Quick Encounter: Recommend clicked', `habitat=${this._selectedHabitat}, difficulty=${this._selectedDifficulty || 'Any'}`, false);
        if (typeof window.bibliosophEncounterRecommend !== 'function') {
            log('Quick Encounter: recommend', 'bibliosophEncounterRecommend not available', true);
            return;
        }
        this._recommendLoading = true;
        this.render();
        try {
            const partyBase = parseCR(this._assessment?.partyCR ?? this._assessment?.partyCRDisplay);
            const offset = DIFFICULTY_OFFSETS[this._crSliderIndex] ?? 0;
            const targetCR = Number.isNaN(partyBase) ? 5 + offset : Math.max(0, partyBase + offset);
            this._recommendations = await window.bibliosophEncounterRecommend(
                this._selectedHabitat,
                this._selectedDifficulty,
                targetCR
            );
            log('Quick Encounter: recommend returned', `${this._recommendations?.length ?? 0} results`, false);
        } finally {
            this._recommendLoading = false;
            this._recommendAttempted = true;
            this.render();
        }
    }

    /**
     * Deploy selected monsters to the canvas via Blacksmith deployment API.
     * When position is not provided, the user is prompted to click on the canvas.
     */
    async _onDeploy() {
        const uuids = Array.from(this._selectedForDeploy);
        if (uuids.length === 0) {
            log('Quick Encounter: deploy', 'No monsters selected', true);
            return;
        }
        const metadata = { monsters: uuids, npcs: [] };
        const options = {
            deploymentPattern: this._deploymentPattern,
            deploymentHidden: this._deploymentHidden
        };
        try {
            const api = game.modules.get('coffee-pub-blacksmith')?.api;
            if (api?.deployMonsters) {
                const tokens = await api.deployMonsters(metadata, options);
                log('Quick Encounter: deploy', `Placed ${tokens?.length ?? 0} token(s) via API`, true);
            } else {
                const bridge = await import('modules/coffee-pub-blacksmith/api/blacksmith-api.js').catch(() => null);
                if (bridge?.BlacksmithAPI?.deployMonsters) {
                    const tokens = await bridge.BlacksmithAPI.deployMonsters(metadata, options);
                    log('Quick Encounter: deploy', `Placed ${tokens?.length ?? 0} token(s) via bridge`, true);
                } else {
                    log('Quick Encounter: deploy', 'Blacksmith deployMonsters not available', true);
                    return;
                }
            }
            this._selectedForDeploy.clear();
            this.render();
        } catch (e) {
            console.error(MODULE.NAME, 'Quick Encounter: deploy failed', e);
            log('Quick Encounter: deploy', String(e?.message ?? e), true);
        }
    }
}
