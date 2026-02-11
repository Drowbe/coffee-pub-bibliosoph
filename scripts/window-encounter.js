// ==================================================================
// ===== QUICK ENCOUNTER WINDOW (Application V2) ===================
// ==================================================================
// Foundry v13 only. Uses HandlebarsApplicationMixin for _renderHTML/_replaceHTML.
// Options follow ApplicationV2 (v13): PARTS (what injects into .window-content), DEFAULT_OPTIONS (sizing, title).

import { MODULE, getDetectionLevelInfo } from './const.js';

/** Template path for the encounter window. */
export const WINDOW_ENCOUNTER_TEMPLATE = `modules/${MODULE.ID}/templates/window-encounter.hbs`;

/** Unique application id so no other module's window can be reused. */
export const WINDOW_ENCOUNTER_APP_ID = `${MODULE.ID}-quick-encounter`;

/** Module-level: only one document delegation listener is ever attached; it dispatches to the current window ref. */
let _encounterDelegationAttached = false;
let _currentEncounterWindowRef = null;

/** Window height when results/deploy sections are hidden (configure + CR + habitat + buttons only). */
export const WINDOW_ENCOUNTER_HEIGHT_COLLAPSED = 520;
/** Window height when results and deploy sections are shown. */
export const WINDOW_ENCOUNTER_HEIGHT_EXPANDED = 750;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

/** Minimum allowed gap between min/max CR sliders. */
const MIN_CR_GAP = 1;

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

/** D&D 5e CR to XP (DMG); used to compute effective CR of selected monsters. */
const CR_TO_XP = [
    10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000
];

function crToXp(crNum) {
    if (crNum == null || Number.isNaN(crNum) || crNum < 0) return 0;
    const idx = crNum === 0 ? 0 : crNum <= 0.125 ? 1 : crNum <= 0.25 ? 2 : crNum <= 0.5 ? 3 : Math.min(3 + Math.floor(crNum), CR_TO_XP.length - 1);
    return CR_TO_XP[Math.max(0, idx)] ?? 0;
}

/** Convert total XP back to an effective single CR for display (largest CR whose XP <= total). */
function xpToEffectiveCR(totalXp) {
    if (totalXp <= 0) return 0;
    let idx = 0;
    for (let i = CR_TO_XP.length - 1; i >= 0; i--) {
        if (CR_TO_XP[i] <= totalXp) {
            idx = i;
            break;
        }
    }
    return idx < 4 ? [0, 0.125, 0.25, 0.5][idx] : idx - 1;
}

/**
 * Compute party CR from character actors using the standard formula:
 * PC_CR = (Level / 4) + MartialBonus; Party CR = sum(PC_CR).
 * MartialBonus = +0.25 per: Barbarian, Fighter, Paladin, Moon Druid; cap +0.5 per character.
 * Used only as the default for the Minimum CR slider.
 * @returns {number|null} Party CR or null if no characters / not dnd5e
 */
function getPartyAverageCRFromCharacters() {
    const system = game.system?.id;
    if (system !== 'dnd5e') return null;
    // Only player-owned characters (the party), not every character in the world
    const characters = game.actors?.filter((a) => a.type === 'character' && a.hasPlayerOwner) ?? [];
    if (characters.length === 0) return null;
    let partyCR = 0;
    for (const actor of characters) {
        const level = Math.max(1, Math.min(20, Number(actor.system?.details?.level) || 1));
        const baseCR = level / 4;
        let martialBonus = 0;
        const classes = actor.system?.classes ?? {};
        if (typeof classes !== 'object' || Array.isArray(classes)) continue;
        const classKeys = Object.keys(classes).map((k) => String(k).toLowerCase());
        const has = (name) => classKeys.some((k) => k.includes(name) || name.includes(k));
        if (has('barbarian')) martialBonus += 0.25;
        if (martialBonus < 0.5 && has('fighter')) martialBonus += 0.25;
        if (martialBonus < 0.5 && has('paladin')) martialBonus += 0.25;
        if (martialBonus < 0.5 && has('druid')) {
            const druidEntry = Object.entries(classes).find(([k]) => k.toLowerCase().includes('druid'));
            const druidData = druidEntry?.[1];
            const sub = String(druidData?.subclass ?? druidData?.subclassIdentifier ?? '').toLowerCase();
            if (sub.includes('moon')) martialBonus += 0.25;
        }
        martialBonus = Math.min(0.5, martialBonus);
        partyCR += baseCR + martialBonus;
    }
    return partyCR;
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
    /** Minimum CR for creatures in Recommend/Roll; defaults to party CR. */
    _minCR = null;
    /** Maximum CR for creatures in Recommend/Roll; default 30. */
    _maxCR = null;
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
    /** Per-id count when selected (for recommend list; built encounter uses r.count). */
    _selectedCounts = new Map();
    /** Blacksmith deployMonsters options: pattern and visibility. */
    _deploymentPattern = null;
    _deploymentHidden = false;
    /** True while building/refreshing the encounter cache. */
    _cacheBuilding = false;
    /** Progress text during cache build (e.g. "2/5 compendiums"). */
    _cacheBuildingText = '';
    /** Include box: comma-separated monster names to always add to results (override filters). */
    _includeMonsterNamesText = '';
    /** Recent include names (most recent first), for quick-add chips. */
    _recentIncludeNames = [];

    /** AppV2: parts go here so Foundry injects template into .window-content (not in DEFAULT_OPTIONS). */
    static PARTS = {
        content: { template: WINDOW_ENCOUNTER_TEMPLATE }
    };

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        super.DEFAULT_OPTIONS ?? {},
        {
            id: WINDOW_ENCOUNTER_APP_ID,
            classes: ['window-encounter', 'bibliosoph-window'],
            position: { width: 1000, height: 800 },
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
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: prepareContext', `habitats=${ourData.habitats?.length ?? 0}, assessment=${ourData.partyCRDisplay ?? '—'}`, true, false);
        return foundry.utils.mergeObject(base, ourData);
    }

    /**
     * On close, clear the current window ref so the single document listener
     * does not dispatch to a closed instance when the user reopens the window.
     */
    close(options = {}) {
        if (_currentEncounterWindowRef === this) {
            _currentEncounterWindowRef = null;
        }
        return super.close(options);
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
        const canvasMonsterCRNum = parseCR(a?.monsterCR ?? a?.monsterCRDisplay);
        const heroCRDisplay = formatCRDisplay(heroCRNum);
        if (this._selectedHabitat === 'Any') {
            const savedHab = game.settings.get?.(MODULE.ID, 'quickEncounterHabitat');
            if (savedHab && this._habitats.includes(savedHab)) {
                this._selectedHabitat = savedHab;
            }
        }

        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const selectedRecs = recommendations.filter(r => this._selectedForDeploy.has(r.id));
        const canvasCRNum = Number.isNaN(canvasMonsterCRNum) ? 0 : canvasMonsterCRNum;
        const selectedCRNum = selectedRecs.reduce((sum, r) => {
            const crNum = parseCR(r.cr);
            const count = this._selectedCounts.get(r.id) ?? (typeof r.count === 'number' && r.count >= 1 ? r.count : 1);
            return sum + count * crNum;
        }, 0);
        const totalMonsterCRNum = canvasCRNum + selectedCRNum;
        const monsterCRDisplay = selectedRecs.length > 0
            ? `${formatCRDisplay(canvasCRNum)} + ${formatCRDisplay(selectedCRNum)}`
            : formatCRDisplay(canvasMonsterCRNum);

        const partyBase = Number.isNaN(heroCRNum) ? 5 : heroCRNum;
        if (this._targetCR == null || this._targetCR === undefined) {
            this._targetCR = Math.round(partyBase);
        }
        if (this._minCR == null || this._minCR === undefined) {
            const saved = Number(game.settings.get?.(MODULE.ID, 'quickEncounterMinCR'));
            if (!Number.isNaN(saved)) {
                this._minCR = Math.max(0, Math.min(30, saved));
            } else {
                const partyCRFromChars = getPartyAverageCRFromCharacters();
                this._minCR = partyCRFromChars != null ? Math.max(0, Math.min(30, partyCRFromChars)) : 0;
            }
        }
        if (this._maxCR == null || this._maxCR === undefined) {
            const saved = Number(game.settings.get?.(MODULE.ID, 'quickEncounterMaxCR'));
            this._maxCR = Number.isNaN(saved) ? 30 : Math.max(0, Math.min(30, saved));
        }
        // Enforce a minimum gap so thumbs cannot cross
        if (this._minCR > 29) this._minCR = 29;
        if (this._maxCR < 1) this._maxCR = 1;
        if (this._minCR > this._maxCR - MIN_CR_GAP) {
            this._minCR = Math.max(0, this._maxCR - MIN_CR_GAP);
        }
        if (this._maxCR < this._minCR + MIN_CR_GAP) {
            this._maxCR = Math.min(30, this._minCR + MIN_CR_GAP);
        }
        const targetCRNum = Number(this._targetCR);
        const minCRValue = Math.max(0, Math.min(30, Number(this._minCR) ?? 0));
        const minCRDisplay = formatCRDisplay(minCRValue);
        const maxCRValue = Math.max(0, Math.min(30, Number(this._maxCR) ?? 30));
        const maxCRDisplay = formatCRDisplay(maxCRValue);
        const crSliderMin = 0;
        const crSliderMax = (partyBase || totalMonsterCRNum)
            ? Math.min(200, Math.max(20, Math.max(partyBase || 0, totalMonsterCRNum || 0) * 2.5 + 10))
            : 200;
        const partyCRMarkerPercent = (() => {
            if (Number.isNaN(heroCRNum)) return null;
            const span = Math.max(1, crSliderMax - crSliderMin);
            return Math.max(0, Math.min(100, ((heroCRNum - crSliderMin) / span) * 100));
        })();
        const partyAvgCR = getPartyAverageCRFromCharacters();
        const crRangeMax = 30;
        const crRangeHighlightLeft = Math.min(100, (minCRValue / crRangeMax) * 100);
        const crRangeHighlightWidth = Math.max(0, Math.min(100 - crRangeHighlightLeft, ((maxCRValue - minCRValue) / crRangeMax) * 100));
        const crRangeLabel = `${minCRDisplay} to ${maxCRDisplay}`;
        /* Split between thumbs so min can be >50% (e.g. range 80–90%). Boundary = midpoint. */
        const midpoint = (minCRValue + maxCRValue) / 2;
        const crRangeSplitPercent = Math.max(10, Math.min(90, (midpoint / crRangeMax) * 100));
        const crRangeRightWidth = 100 - crRangeSplitPercent;
        const crRangeMinInputWidth = crRangeSplitPercent > 0 ? (100 / crRangeSplitPercent) * 100 : 100;
        const crRangeMaxInputLeft = crRangeRightWidth > 0 ? -(crRangeSplitPercent / crRangeRightWidth) * 100 : 0;
        const crRangeMaxInputWidth = crRangeRightWidth > 0 ? (100 / crRangeRightWidth) * 100 : 100;
        const markerCR = Number.isFinite(partyAvgCR) ? partyAvgCR : heroCRNum;
        const crRangePartyMarkerPercent = Number.isNaN(markerCR) ? null : Math.max(0, Math.min(100, (markerCR / crRangeMax) * 100));
        const monsterGapNum = Math.max(0, targetCRNum - totalMonsterCRNum);
        const encounterCRDisplay = formatCRDisplay(targetCRNum);
        const monsterGapDisplay = formatCRDisplay(monsterGapNum);
        const encounterCROver = totalMonsterCRNum > targetCRNum;
        const encounterOverageNum = encounterCROver ? totalMonsterCRNum - targetCRNum : 0;
        const encounterOverageDisplay = encounterCROver ? `+${formatCRDisplay(encounterOverageNum)}` : '';
        const crSliderFill = (() => {
            const min = Number(crSliderMin);
            const max = Number(crSliderMax);
            const span = Math.max(1, max - min);
            return Math.max(0, Math.min(100, ((targetCRNum - min) / span) * 100));
        })();

        const difficultyInfo = getDifficultyFromPartyAndTarget(partyBase, targetCRNum);
        const difficultyLabel = difficultyInfo.label;
        const difficultyClass = difficultyInfo.class;

        const isBuiltEncounter = recommendations.length > 0 && recommendations.every(r => typeof r.count === 'number' && r.count >= 1);
        const recommendationsWithSelection = recommendations.map(r => {
            const selected = this._selectedForDeploy.has(r.id);
            const selectedCount = selected
                ? (this._selectedCounts.get(r.id) ?? (typeof r.count === 'number' && r.count >= 1 ? r.count : 1))
                : 0;
            return { ...r, selected, selectedCount };
        });
        const deploySelectedCount = isBuiltEncounter
            ? recommendations.filter(r => this._selectedForDeploy.has(r.id)).reduce((s, r) => s + (r.count ?? 1), 0)
            : Array.from(this._selectedForDeploy).reduce((s, id) => s + (this._selectedCounts.get(id) ?? 1), 0);
        const hasDeploySelection = recommendations.length > 0;
        const monsterCRFromSelection = selectedRecs.length > 0;

        return {
            appId: this.id || WINDOW_ENCOUNTER_APP_ID,
            title: this.options.window?.title ?? 'Quick Encounter',
            assessment: this._assessment,
            partyCRDisplay: this._assessment?.partyCRDisplay ?? heroCRDisplay,
            monsterCRDisplay,
            heroCRDisplay,
            monsterCRDisplayNum: totalMonsterCRNum,
            monsterGapDisplay,
            encounterCRDisplay,
            encounterCROver,
            encounterOverageDisplay,
            difficulty: difficultyLabel,
            difficultyClass,
            oddsOfEncounter: Math.max(0, Math.min(100, Number(game.settings.get(MODULE.ID, 'encounterOdds')) ?? 20)),
            maxRecommendationsValue: Math.max(5, Math.min(30, Number(game.settings.get(MODULE.ID, 'quickEncounterMaxRecommendations')) ?? 10)),
            maxRecommendationsFill: (() => {
                const v = Math.max(5, Math.min(30, Number(game.settings.get(MODULE.ID, 'quickEncounterMaxRecommendations')) ?? 10));
                return ((v - 5) / 25) * 100;
            })(),
            variabilityValue: Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterVariability')) ?? 3)),
            variabilityFill: (() => {
                const v = Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterVariability')) ?? 3));
                return ((v - 1) / 4) * 100;
            })(),
            detectionValue: Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterDetection')) ?? 3)),
            detectionFill: (() => {
                const v = Math.max(1, Math.min(5, Number(game.settings.get(MODULE.ID, 'quickEncounterDetection')) ?? 3));
                return ((v - 1) / 4) * 100;
            })(),
            detectionLevelLabel: (() => {
                const info = getDetectionLevelInfo(game.settings.get(MODULE.ID, 'quickEncounterDetection'));
                return info.label;
            })(),
            detectionLevelTooltip: (() => {
                const info = getDetectionLevelInfo(game.settings.get(MODULE.ID, 'quickEncounterDetection'));
                return info.tooltip;
            })(),
            targetCRValue: Math.round(Math.max(0, Number(this._targetCR) || 0)),
            crSliderMin,
            crSliderMax,
            partyCRMarkerPercent,
            minCRValue,
            minCRDisplay,
            minCRSliderMin: 0,
            minCRSliderMax: 30,
            maxCRValue,
            maxCRDisplay,
            maxCRSliderMin: 0,
            maxCRSliderMax: 30,
            crRangeHighlightLeft,
            crRangeHighlightWidth,
            crRangeLabel,
            crRangeSplitPercent,
            crRangeRightWidth,
            crRangeMinInputWidth,
            crRangeMaxInputLeft,
            crRangeMaxInputWidth,
            crRangePartyMarkerPercent,
            crSliderFill,
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
            showResultsSection: true,
            deploymentPatterns: [
                { value: 'sequential', label: 'Sequential' },
                { value: 'circle', label: 'Circle' },
                { value: 'line', label: 'Line' },
                { value: 'scatter', label: 'Scatter' },
                { value: 'grid', label: 'Grid' }
            ],
            deploymentHidden: this._deploymentHidden,
            deploymentPostChatCard: game.settings.get(MODULE.ID, 'quickEncounterPostChatCard') !== false,
            cacheBuilding: this._cacheBuilding,
            cacheBuildingText: this._cacheBuildingText,
            cacheStatusText: this._getCacheStatusText(),
            cacheStatusTitle: this._getCacheStatusTitle(),
            monsterCRFromSelection,
            includeMonsterNamesText: this._includeMonsterNamesText ?? '',
            recentIncludeNames: (() => {
                const raw = game.settings.get?.(MODULE.ID, 'quickEncounterRecentIncludeNames');
                this._recentIncludeNames = Array.isArray(raw) ? raw.filter((s) => typeof s === 'string') : [];
                return this._recentIncludeNames.map((name, index) => ({ name, index }));
            })(),
            hasRecentIncludeNames: (this._recentIncludeNames?.length ?? 0) > 0
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
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: combat assessment', `from API — Party ${this._assessment?.partyCRDisplay ?? '—'}, Monster ${this._assessment?.monsterCRDisplay ?? '—'}`, true, false);
                return;
            }
            const bridge = await import('modules/coffee-pub-blacksmith/api/blacksmith-api.js').catch(() => null);
            if (bridge?.BlacksmithAPI?.getCombatAssessment) {
                this._assessment = await bridge.BlacksmithAPI.getCombatAssessment();
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: combat assessment', `from bridge — Party ${this._assessment?.partyCRDisplay ?? '—'}, Monster ${this._assessment?.monsterCRDisplay ?? '—'}`, true, false);
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
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: combat assessment', this._assessment.partyCRDisplay !== '—' ? `Party ${this._assessment.partyCRDisplay}, Monster ${this._assessment.monsterCRDisplay}` : 'using fallback (no Blacksmith)', true, false);
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
     * Expand window height when results section is shown (loading, recommendations, or attempted).
     * Called after render so the window grows to fit results/deploy sections.
     */
    _expandIfResults() {
        const showResults = this._recommendLoading || this._rollLoading
            || (this._recommendations?.length > 0) || this._recommendAttempted;
        const currentHeight = this.position?.height ?? 0;
        const currentWidth = this.position?.width ?? 1000;
        const minWidthWithTray = 820;
        if (showResults && currentHeight < WINDOW_ENCOUNTER_HEIGHT_EXPANDED) {
            const width = currentWidth < minWidthWithTray ? minWidthWithTray : currentWidth;
            this.setPosition({ height: WINDOW_ENCOUNTER_HEIGHT_EXPANDED, width });
        }
    }

    async render(...args) {
        const result = await super.render(...args);
        queueMicrotask(() => this._expandIfResults());
        return result;
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
     * Update the Monster CR range label and highlight bar during slider drag (input event).
     * @param {HTMLElement} root - Encounter window root
     * @param {number} minCR - Current min CR value
     * @param {number} maxCR - Current max CR value
     */
    _updateCRRangeDisplay(root, minCR, maxCR) {
        const appId = this.id || WINDOW_ENCOUNTER_APP_ID;
        const labelEl = root?.querySelector?.(`#${appId}-cr-range-value`);
        if (labelEl) labelEl.textContent = `${formatCRDisplay(minCR)} to ${formatCRDisplay(maxCR)}`;
        const crMax = 30;
        const left = Math.min(100, (minCR / crMax) * 100);
        const width = Math.max(0, Math.min(100 - left, ((maxCR - minCR) / crMax) * 100));
        const highlightEl = root?.querySelector?.(`#${appId}-cr-range-highlight`);
        if (highlightEl) {
            highlightEl.style.left = `${left}%`;
            highlightEl.style.width = `${width}%`;
        }
        /* Move split between thumbs so both stay grabbable (e.g. min at 80%, max at 90%) */
        const midpoint = (minCR + maxCR) / 2;
        const splitPercent = Math.max(10, Math.min(90, (midpoint / crMax) * 100));
        const rightWidth = 100 - splitPercent;
        const leftHalf = root?.querySelector?.(`#${appId}-cr-range-left-half`);
        const rightHalf = root?.querySelector?.(`#${appId}-cr-range-right-half`);
        const minInput = root?.querySelector?.(`#${appId}-min-cr`);
        const maxInput = root?.querySelector?.(`#${appId}-max-cr`);
        if (leftHalf) leftHalf.style.width = `${splitPercent}%`;
        if (rightHalf) {
            rightHalf.style.left = `${splitPercent}%`;
            rightHalf.style.width = `${rightWidth}%`;
        }
        if (splitPercent > 0 && minInput) minInput.style.width = `${(100 / splitPercent) * 100}%`;
        if (rightWidth > 0 && maxInput) {
            maxInput.style.left = `${-(splitPercent / rightWidth) * 100}%`;
            maxInput.style.width = `${(100 / rightWidth) * 100}%`;
        }
    }

    /**
     * Attach click/change delegation once per session. Uses document so we catch events however the app is rendered.
     * Listener is added only once (module-level); it dispatches to _currentEncounterWindowRef so closing and
     * reopening the window does not stack duplicate listeners (which caused multiple cards per click).
     */
    _attachDelegationOnce() {
        _currentEncounterWindowRef = this;
        if (_encounterDelegationAttached) return;
        _encounterDelegationAttached = true;

        document.addEventListener('input', function _encounterInputDelegation(e) {
            const w = _currentEncounterWindowRef;
            if (!w) return;
            const root = w._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const appId = w.id || WINDOW_ENCOUNTER_APP_ID;
            const includeInput = e.target?.id === `${appId}-include-input` ? e.target : null;
            if (includeInput && typeof includeInput.value === 'string') {
                w._includeMonsterNamesText = includeInput.value;
            }
        });

        document.addEventListener('click', function _encounterDelegation(e) {
            const w = _currentEncounterWindowRef;
            if (!w) return;
            const root = w._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const appId = w.id || WINDOW_ENCOUNTER_APP_ID;
            const habitatBtn = e.target?.closest?.('[data-encounter-role="habitat"]');
            if (habitatBtn?.dataset?.habitat) {
                w._selectedHabitat = habitatBtn.dataset.habitat;
                game.settings.set?.(MODULE.ID, 'quickEncounterHabitat', w._selectedHabitat);
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: habitat selected', w._selectedHabitat, true, false);
                w.render();
                return;
            }
            const rollBtn = e.target?.closest?.(`[id="${appId}-roll"]`);
            if (rollBtn) {
                w._onRollForEncounter();
                return;
            }
            const recommendBtn = e.target?.closest?.(`[id="${appId}-recommend"]`);
            if (recommendBtn) {
                w._onRecommend();
                return;
            }
            const resetBtn = e.target?.closest?.(`[id="${appId}-reset"]`);
            if (resetBtn) {
                w._onReset();
                return;
            }
            const refreshCacheBtn = e.target?.closest?.('[data-encounter-action="refresh-cache"]');
            if (refreshCacheBtn) {
                w._onRefreshCache();
                return;
            }
            const countMinus = e.target?.closest?.('[data-encounter-action="count-minus"]');
            if (countMinus) {
                const uuid = countMinus.getAttribute?.('data-actor-id') ?? countMinus.dataset?.actorId;
                if (uuid && w._selectedForDeploy.has(uuid)) {
                    const n = (w._selectedCounts.get(uuid) ?? 1) - 1;
                    if (n <= 0) {
                        w._selectedForDeploy.delete(uuid);
                        w._selectedCounts.delete(uuid);
                    } else {
                        w._selectedCounts.set(uuid, n);
                    }
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: count', `${uuid.slice(-8)} → ${n <= 0 ? 'removed' : n}`, true, false);
                    w.render();
                }
                return;
            }
            const countPlus = e.target?.closest?.('[data-encounter-action="count-plus"]');
            if (countPlus) {
                const uuid = countPlus.getAttribute?.('data-actor-id') ?? countPlus.dataset?.actorId;
                if (uuid && w._selectedForDeploy.has(uuid)) {
                    const n = Math.min(99, (w._selectedCounts.get(uuid) ?? 1) + 1);
                    w._selectedCounts.set(uuid, n);
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: count', `${uuid.slice(-8)} → ${n}`, true, false);
                    w.render();
                }
                return;
            }
            const resultCard = e.target?.closest?.('[data-encounter-role="result-card"]');
            const uuid = resultCard?.getAttribute?.('data-actor-id') ?? resultCard?.dataset?.actorId;
            if (resultCard && uuid) {
                if (w._selectedForDeploy.has(uuid)) {
                    w._selectedForDeploy.delete(uuid);
                    w._selectedCounts.delete(uuid);
                } else {
                    w._selectedForDeploy.add(uuid);
                    const rec = (w._recommendations || []).find((r) => r.id === uuid);
                    const initialCount = rec && typeof rec.count === 'number' && rec.count >= 1 ? rec.count : 1;
                    w._selectedCounts.set(uuid, initialCount);
                }
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: selection toggled', `${w._selectedForDeploy.size} selected`, true, false);
                w.render();
                return;
            }
            const includeClear = e.target?.closest?.('[data-encounter-action="include-clear"]');
            if (includeClear) {
                w._includeMonsterNamesText = '';
                w.render();
                return;
            }
            const recentRemove = e.target?.closest?.('[data-encounter-action="recent-include-remove"]');
            if (recentRemove) {
                const idx = parseInt(recentRemove.getAttribute?.('data-encounter-recent-index'), 10);
                if (!Number.isNaN(idx) && Array.isArray(w._recentIncludeNames) && idx >= 0 && idx < w._recentIncludeNames.length) {
                    w._recentIncludeNames = w._recentIncludeNames.filter((_, i) => i !== idx);
                    game.settings.set?.(MODULE.ID, 'quickEncounterRecentIncludeNames', w._recentIncludeNames);
                    w.render();
                }
                return;
            }
            const recentAdd = e.target?.closest?.('[data-encounter-action="recent-include-add"]');
            if (recentAdd && !e.target?.closest?.('[data-encounter-action="recent-include-remove"]')) {
                const idx = parseInt(recentAdd.getAttribute?.('data-encounter-recent-index'), 10);
                if (!Number.isNaN(idx) && Array.isArray(w._recentIncludeNames) && idx >= 0 && idx < w._recentIncludeNames.length) {
                    const name = w._recentIncludeNames[idx];
                    const current = (w._includeMonsterNamesText ?? '').trim();
                    w._includeMonsterNamesText = current ? `${current}, ${name}` : name;
                    w.render();
                }
                return;
            }
            const patternBtn = e.target?.closest?.('[data-encounter-action="deploy-pattern"]');
            if (patternBtn?.getAttribute?.('data-pattern')) {
                w._deploymentPattern = patternBtn.getAttribute('data-pattern') ?? patternBtn.dataset.pattern;
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy with pattern', w._deploymentPattern, true, false);
                w._onDeploy();
                w.close();
                return;
            }
            const postCardOnlyBtn = e.target?.closest?.('[data-encounter-action="post-card-only"]');
            if (postCardOnlyBtn) {
                w._onPostCardOnly();
                return;
            }
            const requestDetectionRollBtn = e.target?.closest?.('[data-encounter-action="request-detection-roll"]');
            if (requestDetectionRollBtn) {
                const api = game.modules.get('coffee-pub-blacksmith')?.api;
                if (api?.openRequestRollDialog) {
                    api.openRequestRollDialog({
                        title: game.i18n?.localize?.('coffee-pub-bibliosoph.quickEncounterRequestDetectionRoll-Label') ?? 'Roll for Detection',
                        initialType: 'skill',
                        initialValue: 'perception',
                        dc: 15,
                        initialFilter: 'party'
                    });
                }
                return;
            }
        });
        document.addEventListener('change', function _encounterChange(e) {
            const w = _currentEncounterWindowRef;
            if (!w) return;
            const root = w._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const visibleCheck = e.target?.closest?.(`[id="${w.id || WINDOW_ENCOUNTER_APP_ID}-deploy-visible"]`);
            if (visibleCheck) {
                w._deploymentHidden = !visibleCheck.checked;
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy visible', visibleCheck.checked ? 'visible' : 'hidden', true, false);
                w.render();
            }
            const chatCardCheck = e.target?.closest?.(`[id="${w.id || WINDOW_ENCOUNTER_APP_ID}-deploy-chat-card"]`);
            if (chatCardCheck) {
                game.settings.set(MODULE.ID, 'quickEncounterPostChatCard', !!chatCardCheck.checked);
                w.render();
            }
        });
        // Sliders: only update and re-render on 'change' (mouseup / keyup) so drag stays responsive
        document.addEventListener('change', function _encounterSliderChange(e) {
            const w = _currentEncounterWindowRef;
            if (!w) return;
            const root = w._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const settingSlider = e.target?.closest?.('[data-encounter-setting]');
            if (settingSlider) {
                const key = settingSlider.getAttribute('data-encounter-setting');
                const min = parseFloat(settingSlider.getAttribute('data-encounter-setting-min')) || 0;
                const max = parseFloat(settingSlider.getAttribute('data-encounter-setting-max')) || 100;
                const val = Math.max(min, Math.min(max, parseInt(settingSlider.value, 10) || min));
                game.settings.set(MODULE.ID, key, val);
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: setting', `${key}=${val}`, true, false);
                w.render();
                return;
            }
            const crSlider = e.target?.closest?.('[data-encounter-cr-slider="target"]');
            if (crSlider) {
                const raw = parseFloat(crSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    w._targetCR = Math.round(raw);
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: target CR', w._targetCR, true, false);
                    w.render();
                }
                return;
            }
            const minCRSlider = e.target?.closest?.('[data-encounter-cr-slider="min"]');
            if (minCRSlider) {
                const raw = parseFloat(minCRSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    const v = Math.min(29, Math.max(0, raw));
                    const currentMax = Math.max(MIN_CR_GAP, Math.min(30, Number(w._maxCR) ?? 30));
                    w._minCR = Math.min(v, currentMax - MIN_CR_GAP);
                    w._maxCR = Math.max(w._maxCR ?? 30, w._minCR + MIN_CR_GAP);
                    game.settings.set?.(MODULE.ID, 'quickEncounterMinCR', w._minCR);
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: minimum CR', w._minCR, true, false);
                    w.render();
                }
                return;
            }
            const maxCRSlider = e.target?.closest?.('[data-encounter-cr-slider="max"]');
            if (maxCRSlider) {
                const raw = parseFloat(maxCRSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    const v = Math.min(30, Math.max(MIN_CR_GAP, raw));
                    const currentMin = Math.max(0, Math.min(29, Number(w._minCR) ?? 0));
                    w._maxCR = Math.max(v, currentMin + MIN_CR_GAP);
                    w._minCR = Math.min(w._minCR ?? 0, w._maxCR - MIN_CR_GAP);
                    game.settings.set?.(MODULE.ID, 'quickEncounterMaxCR', w._maxCR);
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: maximum CR', w._maxCR, true, false);
                    w.render();
                }
            }
        });
        // Update displayed value during drag without full re-render (keeps drag responsive)
        document.addEventListener('input', function _encounterSliderInput(e) {
            const w = _currentEncounterWindowRef;
            if (!w) return;
            const root = w._getEncounterRoot();
            if (!root || !root.contains(e.target)) return;
            const settingSlider = e.target?.closest?.('[data-encounter-setting]');
            if (settingSlider) {
                const key = settingSlider.getAttribute('data-encounter-setting');
                const min = parseFloat(settingSlider.getAttribute('data-encounter-setting-min')) || 0;
                const max = parseFloat(settingSlider.getAttribute('data-encounter-setting-max')) || 100;
                const suffix = settingSlider.getAttribute('data-encounter-setting-suffix') || '';
                const val = Math.max(min, Math.min(max, parseInt(settingSlider.value, 10) || min));
                game.settings.set(MODULE.ID, key, val);
                const valueEl = root?.querySelector(`[data-encounter-setting-value="${key}"]`);
                if (valueEl) {
                    if (key === 'quickEncounterDetection') {
                        const info = getDetectionLevelInfo(val);
                        valueEl.textContent = info.label;
                        valueEl.setAttribute('data-tooltip', info.tooltip);
                    } else {
                        valueEl.textContent = val + suffix;
                    }
                }
                const span = Math.max(1, max - min);
                const pct = Math.max(0, Math.min(100, ((val - min) / span) * 100));
                settingSlider.style.setProperty('--slider-fill', `${pct}%`);
                return;
            }
            const crSlider = e.target?.closest?.('[data-encounter-cr-slider="target"]');
            if (crSlider) {
                const raw = parseFloat(crSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    w._targetCR = Math.round(raw);
                    const box = root?.querySelector('[data-encounter-cr-display="target"]');
                    if (box) box.textContent = String(Math.round(raw));
                    const min = parseFloat(crSlider.min ?? '0') || 0;
                    const max = parseFloat(crSlider.max ?? '100') || 100;
                    const span = Math.max(1, max - min);
                    const pct = Math.max(0, Math.min(100, ((raw - min) / span) * 100));
                    crSlider.style.setProperty('--cr-fill', `${pct}%`);
                    const partyCRNum = parseCR(w._assessment?.partyCR ?? w._assessment?.partyCRDisplay);
                    const partyBase = Number.isNaN(partyCRNum) ? 5 : partyCRNum;
                    const targetCRNum = Math.round(raw);
                    const difficultyInfo = getDifficultyFromPartyAndTarget(partyBase, targetCRNum);
                    const badge = root?.querySelector('.window-encounter-difficulty-badge-large');
                    if (badge) {
                        const labelEl = badge.querySelector('.window-encounter-difficulty-label');
                        if (labelEl) labelEl.textContent = difficultyInfo.label;
                        ['trivial', 'easy', 'moderate', 'hard', 'deadly', 'impossible'].forEach((c) => badge.classList.remove(c));
                        badge.classList.add(difficultyInfo.class);
                    }
                }
                return;
            }
            const minCRSlider = e.target?.closest?.('[data-encounter-cr-slider="min"]');
            if (minCRSlider) {
                const raw = parseFloat(minCRSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    const v = Math.min(29, Math.max(0, raw));
                    const maxVal = parseFloat(root?.querySelector?.(`#${w.id || WINDOW_ENCOUNTER_APP_ID}-max-cr`)?.value ?? 30);
                    const clampedMax = Math.max(MIN_CR_GAP, Math.min(30, maxVal));
                    const minVal = Math.min(v, clampedMax - MIN_CR_GAP);
                    const maxVal2 = Math.max(clampedMax, minVal + MIN_CR_GAP);
                    if (Number(minCRSlider.value) !== minVal) minCRSlider.value = minVal;
                    w._updateCRRangeDisplay(root, minVal, maxVal2);
                }
                return;
            }
            const maxCRSlider = e.target?.closest?.('[data-encounter-cr-slider="max"]');
            if (maxCRSlider) {
                const raw = parseFloat(maxCRSlider.value);
                if (!Number.isNaN(raw) && raw >= 0) {
                    const v = Math.min(30, Math.max(MIN_CR_GAP, raw));
                    const minVal = parseFloat(root?.querySelector?.(`#${w.id || WINDOW_ENCOUNTER_APP_ID}-min-cr`)?.value ?? 0);
                    const clampedMin = Math.max(0, Math.min(29, minVal));
                    const maxVal2 = Math.max(v, clampedMin + MIN_CR_GAP);
                    const minVal2 = Math.min(clampedMin, maxVal2 - MIN_CR_GAP);
                    if (Number(maxCRSlider.value) !== maxVal2) maxCRSlider.value = maxVal2;
                    w._updateCRRangeDisplay(root, minVal2, maxVal2);
                }
            }
        });
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: delegation listeners attached', 'habitat, recommend, roll, refresh cache, pattern deploy, sliders', false);
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

        const appId = this.id || WINDOW_ENCOUNTER_APP_ID;

        root.querySelectorAll('[data-encounter-role="habitat"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitat = e.currentTarget?.dataset?.habitat;
                if (!habitat) return;
                this._selectedHabitat = habitat;
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: habitat selected', habitat, true, false);
                this.render();
            });
        });
        root.querySelector(`#${appId}-include-input`)?.addEventListener('input', (e) => {
            this._includeMonsterNamesText = e.target?.value ?? '';
        });
        /* Setting sliders handled by document listener via [data-encounter-setting]; target CR via [data-encounter-cr-slider] */
        root.querySelector('[data-encounter-cr-slider="target"]')?.addEventListener('change', (e) => {
            const raw = parseFloat(e.target?.value);
            if (!Number.isNaN(raw) && raw >= 0) {
                this._targetCR = Math.round(raw);
                this.render();
            }
        });
        /* Roll, Recommend, Reset, Refresh cache: handled only by document-level delegation (_attachDelegationOnce) so one click = one action (activateListeners can run on every render and would add duplicate listeners). */
        root.querySelectorAll('[data-encounter-role="result-card"]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target?.closest?.('[data-encounter-action="count-minus"], [data-encounter-action="count-plus"]')) return;
                const uuid = card.getAttribute?.('data-actor-id') ?? card.dataset?.actorId;
                if (!uuid) return;
                if (this._selectedForDeploy.has(uuid)) {
                    this._selectedForDeploy.delete(uuid);
                    this._selectedCounts.delete(uuid);
                } else {
                    this._selectedForDeploy.add(uuid);
                    const rec = (this._recommendations || []).find((r) => r.id === uuid);
                    const initialCount = rec && typeof rec.count === 'number' && rec.count >= 1 ? rec.count : 1;
                    this._selectedCounts.set(uuid, initialCount);
                }
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: selection toggled', `${this._selectedForDeploy.size} selected`, true, false);
                this.render();
            });
        });
        root.querySelectorAll('[data-encounter-action="count-minus"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const uuid = btn.getAttribute?.('data-actor-id') ?? btn.dataset?.actorId;
                if (!uuid || !this._selectedForDeploy.has(uuid)) return;
                const n = (this._selectedCounts.get(uuid) ?? 1) - 1;
                if (n <= 0) {
                    this._selectedForDeploy.delete(uuid);
                    this._selectedCounts.delete(uuid);
                } else this._selectedCounts.set(uuid, n);
                this.render();
            });
        });
        root.querySelectorAll('[data-encounter-action="count-plus"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const uuid = btn.getAttribute?.('data-actor-id') ?? btn.dataset?.actorId;
                if (!uuid || !this._selectedForDeploy.has(uuid)) return;
                const n = Math.min(99, (this._selectedCounts.get(uuid) ?? 1) + 1);
                this._selectedCounts.set(uuid, n);
                this.render();
            });
        });
        /* Deploy-pattern buttons: handled only by document-level delegation so one click = one deploy (same duplicate-listener issue as Roll/Recommend). */
        root.querySelector(`#${appId}-deploy-visible`)?.addEventListener('change', (e) => {
            this._deploymentHidden = !e.target?.checked;
            this.render();
        });
        root.querySelector(`#${appId}-min-cr`)?.addEventListener('change', (e) => {
            const raw = parseFloat(e.target?.value);
            if (!Number.isNaN(raw) && raw >= 0) {
                const v = Math.min(29, Math.max(0, raw));
                const currentMax = Math.max(MIN_CR_GAP, Math.min(30, Number(this._maxCR) ?? 30));
                this._minCR = Math.min(v, currentMax - MIN_CR_GAP);
                this._maxCR = Math.max(this._maxCR ?? 30, this._minCR + MIN_CR_GAP);
                game.settings.set?.(MODULE.ID, 'quickEncounterMinCR', this._minCR);
                this.render();
            }
        });
        root.querySelector(`#${appId}-max-cr`)?.addEventListener('change', (e) => {
            const raw = parseFloat(e.target?.value);
            if (!Number.isNaN(raw) && raw >= 0) {
                const v = Math.min(30, Math.max(MIN_CR_GAP, raw));
                const currentMin = Math.max(0, Math.min(29, Number(this._minCR) ?? 0));
                this._maxCR = Math.max(v, currentMin + MIN_CR_GAP);
                this._minCR = Math.min(this._minCR ?? 0, this._maxCR - MIN_CR_GAP);
                game.settings.set?.(MODULE.ID, 'quickEncounterMaxCR', this._maxCR);
                this.render();
            }
        });
    }

    /**
     * Roll for encounter using Global Encounter Settings; post card and optionally run recommend.
     */
    async _onRollForEncounter() {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Roll for Encounter clicked', `habitat=${this._selectedHabitat}`, true, false);
        if (typeof window.bibliosophRollForEncounter !== 'function') {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: roll', 'bibliosophRollForEncounter not available', true, true);
            return;
        }
        this._rollLoading = true;
        this._recommendLoading = true;
        this.render();
        try {
            const targetCR = Math.max(0, Number(this._targetCR) || 5);
            const partyBase = parseCR(this._assessment?.partyCR ?? this._assessment?.partyCRDisplay);
            const difficultyLabel = getDifficultyFromPartyAndTarget(partyBase, targetCR).label;
            const minCR = Math.max(0, Math.min(30, Number(this._minCR) ?? 0));
            const maxCR = Math.max(0, Math.min(30, Number(this._maxCR) ?? 30));
            const result = await window.bibliosophRollForEncounter(
                this._selectedHabitat,
                difficultyLabel,
                targetCR,
                minCR,
                maxCR
            );
            this._lastRollHadEncounter = result.encounter === true;
            this._lastRollIntroEntry = result.introEntry ?? null;
            if (result.encounter && Array.isArray(result.recommendations)) {
                this._recommendations = await this._mergeIncludeMonsters(result.recommendations);
                this._recommendAttempted = true;
                // Pre-select roll monsters (optimized encounter) and set counts for badge
                this._selectedForDeploy = new Set();
                this._selectedCounts.clear();
                for (const r of this._recommendations) {
                    if (r?.id && typeof r.count === 'number' && r.count >= 1) {
                        this._selectedForDeploy.add(r.id);
                        this._selectedCounts.set(r.id, r.count);
                    }
                }
            }
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: roll complete', result.encounter ? `${result.recommendations?.length ?? 0} types` : 'no encounter', true, false);
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
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Recommend clicked', `habitat=${this._selectedHabitat}, targetCR=${targetCR} (Encounter CR slider), difficulty=${difficultyLabel}`, true, false);
        if (typeof window.bibliosophEncounterRecommend !== 'function') {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: recommend', 'bibliosophEncounterRecommend not available', true);
            return;
        }
        this._recommendLoading = true;
        this.render();
        try {
            const minCR = Math.max(0, Math.min(30, Number(this._minCR) ?? 0));
            const maxCR = Math.max(0, Math.min(30, Number(this._maxCR) ?? 30));
            const maxRec = Math.max(5, Math.min(30, Number(game.settings.get(MODULE.ID, 'quickEncounterMaxRecommendations')) ?? 10));
            const newRecommendations = await window.bibliosophEncounterRecommend(
                this._selectedHabitat,
                difficultyLabel,
                targetCR,
                minCR,
                maxCR,
                maxRec
            );
            const existing = Array.isArray(this._recommendations) ? this._recommendations : [];
            const hadSelection = this._selectedForDeploy.size > 0;
            if (existing.length > 0 && hadSelection) {
                // Keep only what the GM selected; drop the rest. Then append new Recommend results. Do not auto-select the new ones.
                const kept = existing.filter((r) => this._selectedForDeploy.has(r.id));
                const combinedIds = new Set(kept.map((r) => r.id).filter(Boolean));
                const combined = [...kept];
                for (const r of (newRecommendations || [])) {
                    if (r?.id && !combinedIds.has(r.id)) {
                        combined.push(r);
                        combinedIds.add(r.id);
                    }
                }
                this._recommendations = combined;
                // Selection stays exactly what the GM had selected (only kept items remain selected; new items are not selected)
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: recommend (add more)', `kept ${kept.length} selected, +${(newRecommendations || []).length} new, ${combined.length} total`, true, false);
            } else {
                this._recommendations = newRecommendations || [];
                this._selectedForDeploy = new Set();
                this._selectedCounts.clear();
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: recommend returned', `${this._recommendations?.length ?? 0} results`, true, false);
            }
            this._recommendations = await this._mergeIncludeMonsters(this._recommendations);
        } finally {
            this._recommendLoading = false;
            this._recommendAttempted = true;
            this.render();
        }
    }

    /**
     * Add names to the recent-include list (most recent first, deduped, max 20).
     * @param {string[]} names - Names to add (will be trimmed).
     */
    _pushToRecentInclude(names) {
        if (!Array.isArray(names) || names.length === 0) return;
        const key = (n) => String(n).trim().toLowerCase();
        let recent = Array.isArray(this._recentIncludeNames) ? [...this._recentIncludeNames] : [];
        for (const n of names) {
            const s = String(n).trim();
            if (!s) continue;
            recent = recent.filter((r) => key(r) !== key(s));
            recent.unshift(s);
        }
        this._recentIncludeNames = recent.slice(0, 20);
        game.settings.set?.(MODULE.ID, 'quickEncounterRecentIncludeNames', this._recentIncludeNames);
    }

    /**
     * Parse Include text, fetch matching monsters (ignore filters), merge into list with override flag.
     * @param {Array<{id: string}>} list - Current recommendations
     * @returns {Promise<Array>} list with include monsters appended (deduped by id)
     */
    async _mergeIncludeMonsters(list) {
        const root = this._getEncounterRoot();
        const appId = this.id || WINDOW_ENCOUNTER_APP_ID;
        const includeInput = root?.querySelector?.(`#${appId}-include-input`);
        if (includeInput && typeof includeInput.value === 'string') this._includeMonsterNamesText = includeInput.value;

        const text = (this._includeMonsterNamesText ?? '').trim();
        const names = text ? text.split(/\s*,\s*/).map((n) => n.trim()).filter(Boolean) : [];
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Encounter Include', text ? `raw: "${text}" | parsed: [${names.join(', ')}]` : '(empty)', true, false);
        if (!text || typeof window.bibliosophEncounterGetIncludeMonsters !== 'function') return list;
        if (names.length === 0) return list;
        this._pushToRecentInclude(names);
        const includeList = await window.bibliosophEncounterGetIncludeMonsters(names);
        if (!Array.isArray(includeList) || includeList.length === 0) return list;
        const existingIds = new Set((list || []).map((r) => r.id).filter(Boolean));
        const merged = [...(list || [])];
        for (const r of includeList) {
            if (r?.id && !existingIds.has(r.id)) {
                merged.push(r);
                existingIds.add(r.id);
            }
        }
        return merged;
    }

    /**
     * Reset: clear results, selection, and roll state; collapse window to config-only.
     */
    _onReset() {
        this._recommendations = [];
        this._recommendAttempted = false;
        this._selectedForDeploy = new Set();
        this._selectedCounts.clear();
        this._lastRollHadEncounter = false;
        this._lastRollIntroEntry = null;
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: reset', 'Results and selection cleared', true, false);
        this.render();
    }

    /**
     * Post a chat card with the selected monsters only (no deploy). Ignores the "Chat Card" checkbox.
     */
    async _onPostCardOnly() {
        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const selectedRecommendations = recommendations.filter(r => this._selectedForDeploy.has(r.id));
        if (selectedRecommendations.length === 0) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: Chat Card', 'No monsters selected', true, false);
            return;
        }
        const selectedMonsters = selectedRecommendations.map(r => {
            const count = this._selectedCounts.get(r.id) ?? (typeof r.count === 'number' && r.count >= 1 ? r.count : 1);
            return { name: r.name ?? 'Unknown', count, cr: r.cr ?? '—', img: r.img ?? '', id: r.id };
        });
        if (typeof window.bibliosophPostEncounterDeployCard !== 'function') return;
        const introEntry = this._lastRollHadEncounter ? this._lastRollIntroEntry : null;
        await window.bibliosophPostEncounterDeployCard(introEntry, selectedMonsters, this._selectedHabitat);
    }

    /**
     * Deploy selected monsters to the canvas via Blacksmith deployment API.
     * When position is not provided, the user is prompted to click on the canvas.
     */
    async _onDeploy() {
        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];
        const selectedRecommendations = recommendations.filter(r => this._selectedForDeploy.has(r.id));
        // Always use user's selected counts (_selectedCounts); for rolled encounters we pre-filled these but user can +/- in UI.
        const uuids = selectedRecommendations.length > 0
            ? selectedRecommendations.flatMap(r => Array(this._selectedCounts.get(r.id) ?? (typeof r.count === 'number' && r.count >= 1 ? r.count : 1)).fill(r.id))
            : [];
        if (uuids.length === 0) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy', 'No monsters selected', true, false);
            return;
        }
        const selectedMonsters = selectedRecommendations.map(r => {
            const count = this._selectedCounts.get(r.id) ?? (typeof r.count === 'number' && r.count >= 1 ? r.count : 1);
            return { name: r.name ?? 'Unknown', count, cr: r.cr ?? '—', img: r.img ?? '', id: r.id };
        });
        const metadata = { monsters: uuids, npcs: [] };
        const options = {
            deploymentPattern: this._deploymentPattern || 'sequential',
            deploymentHidden: this._deploymentHidden
        };
        try {
            const postChatCard = game.settings.get(MODULE.ID, 'quickEncounterPostChatCard') !== false;
            if (postChatCard && typeof window.bibliosophPostEncounterDeployCard === 'function') {
                const introEntry = this._lastRollHadEncounter ? this._lastRollIntroEntry : null;
                await window.bibliosophPostEncounterDeployCard(introEntry, selectedMonsters, this._selectedHabitat);
            }
            this._lastRollHadEncounter = false;
            this._lastRollIntroEntry = null;
            const api = game.modules.get('coffee-pub-blacksmith')?.api;
            if (api?.deployMonsters) {
                const tokens = await api.deployMonsters(metadata, options);
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy', `Placed ${tokens?.length ?? 0} token(s) via API`, true, false);
            } else {
                const bridge = await import('modules/coffee-pub-blacksmith/api/blacksmith-api.js').catch(() => null);
                if (bridge?.BlacksmithAPI?.deployMonsters) {
                    const tokens = await bridge.BlacksmithAPI.deployMonsters(metadata, options);
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy', `Placed ${tokens?.length ?? 0} token(s) via bridge`, true, false);
                } else {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy', 'Blacksmith deployMonsters not available', true, true);
                    return;
                }
            }
            this._selectedForDeploy.clear();
            this._selectedCounts.clear();
            this.render();
        } catch (e) {
            console.error(MODULE.NAME, 'Quick Encounter: deploy failed', e);
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Quick Encounter: deploy', String(e?.message ?? e), true, true);
        }
    }
}
