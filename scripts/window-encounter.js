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

/**
 * Compute difficulty label and CSS class from Party CR and Target CR (like encounter worksheet).
 * Ratio = targetCR / (partyCR || 1). Trivial < 0.25, Easy < 0.5, Moderate < 1, Hard < 1.5, Deadly < 2, else Impossible.
 * @param {number} partyCR - Party (hero) CR
 * @param {number} targetCR - Target encounter CR
 * @returns {{ label: string, class: string }}
 */
function getDifficultyFromPartyAndTarget(partyCR, targetCR) {
    const ratio = (partyCR && targetCR >= 0) ? targetCR / (partyCR || 1) : 0;
    if (ratio < 0.25) return { label: 'Trivial', class: 'trivial' };
    if (ratio < 0.5) return { label: 'Easy', class: 'easy' };
    if (ratio < 1) return { label: 'Moderate', class: 'moderate' };
    if (ratio < 1.5) return { label: 'Hard', class: 'hard' };
    if (ratio < 2) return { label: 'Deadly', class: 'deadly' };
    return { label: 'Impossible', class: 'impossible' };
}

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
    /** Target encounter CR (slider value). Difficulty is derived from party CR vs this. */
    _targetCR = null;
    _recommendations = [];
    /** True while recommend request is in progress (show spinner). */
    _recommendLoading = false;
    /** True while roll-for-encounter is in progress. */
    _rollLoading = false;
    /** True after at least one recommend run (so we can show "No monsters found" vs initial hint). */
    _recommendAttempted = false;
    /** After "Roll for Encounter" had an encounter: post deploy card when user clicks Deploy. */
    _lastRollHadEncounter = false;
    _lastRollIntroEntry = null;
    /** UUIDs of recommendation cards selected for deploy. */
    _selectedForDeploy = new Set();
    /** Blacksmith deployMonsters options: pattern and visibility. */
    _deploymentPattern = 'sequential';
    _deploymentHidden = false;
    /** True while building/refreshing the encounter cache. */
    _cacheBuilding = false;
    /** Progress text during cache build (e.g. "2/5 compendiums"). */
    _cacheBuildingText = '';

    /** AppV2: parts go here so Foundry injects template into .window-content (not in DEFAULT_OPTIONS). */
    static PARTS = {
        content: { template: WINDOW_ENCOUNTER_TEMPLATE }
    };

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        super.DEFAULT_OPTIONS ?? {},
        {
            id: WINDOW_ENCOUNTER_APP_ID,
            classes: ['window-encounter', 'bibliosoph-window'],
            position: { width: 500, height: 750 },
            window: {
                title: 'Quick Encounter',
                resizable: true,
                minimizable: true
            }
        },
        { inplace: false }
    );

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

        const partyBase = Number.isNaN(heroCRNum) ? 5 : heroCRNum;
        if (this._targetCR == null || this._targetCR === undefined) {
            this._targetCR = partyBase;
        }
        const targetCRNum = Number(this._targetCR);
        const monsterGapNum = Number.isNaN(monsterCRNum) ? targetCRNum : Math.max(0, targetCRNum - monsterCRNum);
        const encounterCRDisplay = formatCRDisplay(targetCRNum);
        const monsterGapDisplay = formatCRDisplay(monsterGapNum);

        const difficultyInfo = getDifficultyFromPartyAndTarget(partyBase, targetCRNum);
        const difficultyLabel = difficultyInfo.label;
        const difficultyClass = difficultyInfo.class;

        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const isBuiltEncounter = recommendations.length > 0 && recommendations.every(r => typeof r.count === 'number' && r.count >= 1);
        const recommendationsWithSelection = recommendations.map(r => ({
            ...r,
            selected: this._selectedForDeploy.has(r.id)
        }));
        const deploySelectedCount = isBuiltEncounter
            ? recommendations.filter(r => this._selectedForDeploy.has(r.id)).reduce((s, r) => s + (r.count ?? 1), 0)
            : (this._selectedForDeploy.size > 0 ? this._selectedForDeploy.size : recommendations.length);
        const hasDeploySelection = recommendations.length > 0;

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
            oddsOfEncounter: Math.max(0, Math.min(100, Number(game.settings.get(MODULE.ID, 'encounterOdds')) ?? 20)),
            targetCRValue: Math.max(0, Number(this._targetCR) || 0),
            crSliderMin: 0,
            crSliderMax: (partyBase || monsterCRNum) ? Math.min(200, Math.max(20, Math.max(partyBase || 0, monsterCRNum || 0) * 2.5 + 10)) : 200,
            habitats: this._habitats.map(h => ({ name: h, selected: h === this._selectedHabitat })),
            recommendations: recommendationsWithSelection,
            hasRecommendations: recommendations.length > 0,
            showSearchingSpinner: this._recommendLoading || this._rollLoading,
            recommendLoading: this._recommendLoading,
            rollLoading: this._rollLoading,
            recommendAttempted: this._recommendAttempted,
            isBuiltEncounter,
            deploySelectedCount,
            hasDeploySelection,
            deploymentPatterns: [
                { value: 'sequential', label: 'Sequential', selected: this._deploymentPattern === 'sequential' },
                { value: 'circle', label: 'Circle', selected: this._deploymentPattern === 'circle' },
                { value: 'line', label: 'Line', selected: this._deploymentPattern === 'line' },
                { value: 'scatter', label: 'Scatter', selected: this._deploymentPattern === 'scatter' },
                { value: 'grid', label: 'Grid', selected: this._deploymentPattern === 'grid' }
            ],
            deploymentHidden: this._deploymentHidden,
            cacheBuilding: this._cacheBuilding,
            cacheBuildingText: this._cacheBuildingText,
            cacheStatusText: this._getCacheStatusText(),
            cacheStatusTitle: this._getCacheStatusTitle()
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

    /** Cache status line for UI. */
    _getCacheStatusText() {
        if (this._cacheBuilding) return '';
        if (typeof window.bibliosophGetEncounterCacheStatus !== 'function') return '';
        const { valid, count } = window.bibliosophGetEncounterCacheStatus();
        if (valid && count > 0) return game.i18n?.format?.('coffee-pub-bibliosoph.quickEncounterCacheStatus-Label', { count }) ?? `Cache: ${count} monsters`;
        return game.i18n?.localize?.('coffee-pub-bibliosoph.quickEncounterCacheNone-Label') ?? 'No cache — click Refresh to build';
    }

    /** Cache status tooltip. */
    _getCacheStatusTitle() {
        if (this._cacheBuilding) return '';
        if (typeof window.bibliosophGetEncounterCacheStatus !== 'function') return '';
        const { valid, count } = window.bibliosophGetEncounterCacheStatus();
        if (valid && count > 0) return game.i18n?.localize?.('coffee-pub-bibliosoph.quickEncounterCacheStatusTitle-Hint') ?? 'Recommend and Roll use cached data for speed.';
        return game.i18n?.localize?.('coffee-pub-bibliosoph.quickEncounterCacheNoneTitle-Hint') ?? 'Build a cache to make Recommend and Roll much faster.';
    }

    /** Build or refresh the monster cache; updates progress and re-renders. */
    async _onRefreshCache() {
        if (this._cacheBuilding || typeof window.bibliosophBuildEncounterCache !== 'function') return;
        this._cacheBuilding = true;
        this._cacheBuildingText = game.i18n?.localize?.('coffee-pub-bibliosoph.quickEncounterCacheBuilding-Label') ?? 'Building cache…';
        this.render();
        try {
            await window.bibliosophBuildEncounterCache((packIndex, totalPacks, entryCount) => {
                this._cacheBuildingText = game.i18n?.format?.('coffee-pub-bibliosoph.quickEncounterCacheBuildingProgress-Label', { current: packIndex, total: totalPacks, count: entryCount }) ?? `${packIndex}/${totalPacks} compendiums, ${entryCount} monsters`;
                this.render();
            });
        } finally {
            this._cacheBuilding = false;
            this._cacheBuildingText = '';
            this.render();
        }
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
     * Return the root element that contains our window content (for event delegation).
     * Application V2 may render parts in a structure where this.element doesn't contain the part.
     */
    _getEncounterRoot() {
        const byId = document.getElementById(WINDOW_ENCOUNTER_APP_ID);
        if (byId) return byId;
        const byClass = document.querySelector('.bibliosoph-window.window-encounter') ?? document.querySelector('.window-encounter');
        return byClass ?? this.element ?? null;
    }

    /**
     * Attach click/change delegation once. Uses document so we catch events however the app is rendered.
     * This is the reliable path for PARTS-based apps where activateListeners may not run.
     */
    _attachDelegationOnce() {
        if (this._encounterDelegationAttached) return;
        this._encounterDelegationAttached = true;
        const self = this;
        document.addEventListener('click', function _encounterDelegation(e) {
            const root = self._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const habitatBtn = e.target?.closest?.('.window-encounter-habitat');
            if (habitatBtn?.dataset?.habitat) {
                self._selectedHabitat = habitatBtn.dataset.habitat;
                log('Quick Encounter: habitat selected', self._selectedHabitat, false);
                self.render();
                return;
            }
            const rollBtn = e.target?.closest?.('.window-encounter-roll');
            if (rollBtn) {
                self._onRollForEncounter();
                return;
            }
            const recommendBtn = e.target?.closest?.('.window-encounter-recommend');
            if (recommendBtn) {
                self._onRecommend();
                return;
            }
            const refreshCacheBtn = e.target?.closest?.('.window-encounter-refresh-cache');
            if (refreshCacheBtn) {
                self._onRefreshCache();
                return;
            }
            const resultCard = e.target?.closest?.('.window-encounter-result-card');
            const uuid = resultCard?.getAttribute?.('data-actor-id') ?? resultCard?.dataset?.actorId;
            if (resultCard && uuid) {
                if (self._selectedForDeploy.has(uuid)) self._selectedForDeploy.delete(uuid);
                else self._selectedForDeploy.add(uuid);
                log('Quick Encounter: selection toggled', `${self._selectedForDeploy.size} selected`, false);
                self.render();
                return;
            }
            const patternBtn = e.target?.closest?.('.window-encounter-deploy-pattern');
            if (patternBtn?.getAttribute?.('data-pattern') && !patternBtn.disabled) {
                self._deploymentPattern = patternBtn.getAttribute('data-pattern') ?? patternBtn.dataset.pattern;
                log('Quick Encounter: deploy with pattern', self._deploymentPattern, false);
                self._onDeploy();
                return;
            }
        });
        document.addEventListener('change', function _encounterChange(e) {
            const root = self._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const visibleCheck = e.target?.closest?.('.window-encounter-deploy-visible');
            if (visibleCheck) {
                self._deploymentHidden = !visibleCheck.checked;
                log('Quick Encounter: deploy visible', visibleCheck.checked ? 'visible' : 'hidden', false);
                self.render();
            }
        });
        // Sliders: only update and re-render on 'change' (mouseup / keyup) so drag stays responsive
        document.addEventListener('change', function _encounterSliderChange(e) {
            const root = self._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const oddsSlider = e.target?.closest?.('.window-encounter-odds-slider');
            if (oddsSlider) {
                const val = Math.max(0, Math.min(100, parseInt(oddsSlider.value, 10) || 0));
                game.settings.set(MODULE.ID, 'encounterOdds', val);
                log('Quick Encounter: odds of encounter', val, false);
                self.render();
                return;
            }
            const crSlider = e.target?.closest?.('.window-encounter-cr-slider');
            if (crSlider) {
                const raw = parseFloat(crSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    self._targetCR = raw;
                    log('Quick Encounter: target CR', self._targetCR, false);
                    self.render();
                }
            }
        });
        // Update displayed value during drag without full re-render (keeps drag responsive)
        document.addEventListener('input', function _encounterSliderInput(e) {
            const root = self._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const oddsSlider = e.target?.closest?.('.window-encounter-odds-slider');
            if (oddsSlider) {
                const val = Math.max(0, Math.min(100, parseInt(oddsSlider.value, 10) || 0));
                game.settings.set(MODULE.ID, 'encounterOdds', val);
                const currentEl = root?.querySelector('.window-encounter-odds-current');
                if (currentEl) currentEl.textContent = `${val}%`;
                return;
            }
            const crSlider = e.target?.closest?.('.window-encounter-cr-slider');
            if (crSlider) {
                const raw = parseFloat(crSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    self._targetCR = raw;
                    const box = root?.querySelector('.window-encounter-cr-box-target .window-encounter-cr-box-value');
                    if (box) box.textContent = raw === 0.5 ? '1/2' : String(Math.round(raw * 100) / 100);
                }
            }
        });
        log('Quick Encounter: delegation listeners attached', 'habitat, recommend, roll, refresh cache, pattern deploy, sliders', false);
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

        root.querySelectorAll('.window-encounter-habitat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitat = e.currentTarget?.dataset?.habitat;
                if (!habitat) return;
                this._selectedHabitat = habitat;
                log('Quick Encounter: habitat selected', habitat, false);
                this.render();
            });
        });
        root.querySelector('.window-encounter-odds-slider')?.addEventListener('change', (e) => {
            const val = Math.max(0, Math.min(100, parseInt(e.target?.value, 10) || 0));
            game.settings.set(MODULE.ID, 'encounterOdds', val);
            this.render();
        });
        root.querySelector('.window-encounter-cr-slider')?.addEventListener('change', (e) => {
            const raw = parseFloat(e.target?.value);
            if (!Number.isNaN(raw) && raw >= 0) {
                this._targetCR = raw;
                this.render();
            }
        });
        root.querySelector('.window-encounter-roll')?.addEventListener('click', () => this._onRollForEncounter());
        root.querySelector('.window-encounter-recommend')?.addEventListener('click', () => this._onRecommend());
        root.querySelectorAll('.window-encounter-refresh-cache').forEach(btn => btn.addEventListener('click', () => this._onRefreshCache()));
        root.querySelectorAll('.window-encounter-result-card').forEach(card => {
            card.addEventListener('click', () => {
                const uuid = card.getAttribute?.('data-actor-id') ?? card.dataset?.actorId;
                if (!uuid) return;
                if (this._selectedForDeploy.has(uuid)) this._selectedForDeploy.delete(uuid);
                else this._selectedForDeploy.add(uuid);
                log('Quick Encounter: selection toggled', `${this._selectedForDeploy.size} selected`, false);
                this.render();
            });
        });
        root.querySelectorAll('.window-encounter-deploy-pattern').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.disabled) return;
                const pattern = e.currentTarget?.getAttribute?.('data-pattern') ?? e.currentTarget?.dataset?.pattern;
                if (pattern) {
                    this._deploymentPattern = pattern;
                    this._onDeploy();
                }
            });
        });
        root.querySelector('.window-encounter-deploy-visible')?.addEventListener('change', (e) => {
            this._deploymentHidden = !e.target?.checked;
            this.render();
        });
    }

    /**
     * Roll for encounter using Global Encounter Settings; post card and optionally run recommend.
     */
    async _onRollForEncounter() {
        log('Quick Encounter: Roll for Encounter clicked', `habitat=${this._selectedHabitat}`, false);
        if (typeof window.bibliosophRollForEncounter !== 'function') {
            log('Quick Encounter: roll', 'bibliosophRollForEncounter not available', true);
            return;
        }
        this._rollLoading = true;
        this._recommendLoading = true;
        this.render();
        try {
            const targetCR = Math.max(0, Number(this._targetCR) || 5);
            const partyBase = parseCR(this._assessment?.partyCR ?? this._assessment?.partyCRDisplay);
            const difficultyLabel = getDifficultyFromPartyAndTarget(partyBase, targetCR).label;
            const result = await window.bibliosophRollForEncounter(
                this._selectedHabitat,
                difficultyLabel,
                targetCR
            );
            this._lastRollHadEncounter = result.encounter === true;
            this._lastRollIntroEntry = result.introEntry ?? null;
            if (result.encounter && Array.isArray(result.recommendations)) {
                this._recommendations = result.recommendations;
                this._recommendAttempted = true;
            }
            log('Quick Encounter: roll complete', result.encounter ? `${result.recommendations?.length ?? 0} types` : 'no encounter', false);
        } finally {
            this._rollLoading = false;
            this._recommendLoading = false;
            this.render();
        }
    }

    async _onRecommend() {
        const targetCR = Math.max(0, Number(this._targetCR) || 5);
        const partyBase = parseCR(this._assessment?.partyCR ?? this._assessment?.partyCRDisplay);
        const difficultyLabel = getDifficultyFromPartyAndTarget(partyBase, targetCR).label;
        log('Quick Encounter: Recommend clicked', `habitat=${this._selectedHabitat}, targetCR=${targetCR}, difficulty=${difficultyLabel}`, false);
        if (typeof window.bibliosophEncounterRecommend !== 'function') {
            log('Quick Encounter: recommend', 'bibliosophEncounterRecommend not available', true);
            return;
        }
        this._recommendLoading = true;
        this.render();
        try {
            this._recommendations = await window.bibliosophEncounterRecommend(
                this._selectedHabitat,
                difficultyLabel,
                targetCR
            );
            this._selectedForDeploy = new Set((this._recommendations || []).map(r => r.id).filter(Boolean));
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
        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const isBuiltEncounter = recommendations.length > 0 && recommendations.every(r => typeof r.count === 'number' && r.count >= 1);
        const selectedRecommendations = recommendations.filter(r => this._selectedForDeploy.has(r.id));
        let uuids;
        if (isBuiltEncounter) {
            uuids = selectedRecommendations.flatMap(r => Array(r.count ?? 1).fill(r.id));
        } else if (this._selectedForDeploy.size > 0) {
            uuids = Array.from(this._selectedForDeploy);
        } else {
            uuids = recommendations.map(r => r.id).filter(Boolean);
        }
        if (uuids.length === 0) {
            log('Quick Encounter: deploy', 'No monsters selected', true);
            return;
        }
        const selectedMonsters = selectedRecommendations.map(r => ({
            name: r.name ?? 'Unknown',
            count: r.count ?? 1,
            cr: r.cr ?? '—',
            img: r.img ?? ''
        }));
        const metadata = { monsters: uuids, npcs: [] };
        const options = {
            deploymentPattern: this._deploymentPattern,
            deploymentHidden: this._deploymentHidden
        };
        try {
            if (this._lastRollHadEncounter && typeof window.bibliosophPostEncounterDeployCard === 'function') {
                await window.bibliosophPostEncounterDeployCard(this._lastRollIntroEntry, selectedMonsters);
                this._lastRollHadEncounter = false;
                this._lastRollIntroEntry = null;
            }
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
