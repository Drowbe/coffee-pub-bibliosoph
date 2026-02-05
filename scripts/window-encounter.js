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
    _selectedDifficulty = '';
    _recommendations = [];

    /** AppV2: parts go here so Foundry injects template into .window-content (not in DEFAULT_OPTIONS). */
    static PARTS = {
        content: { template: WINDOW_ENCOUNTER_TEMPLATE }
    };

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
        id: WINDOW_ENCOUNTER_APP_ID,
        classes: ['window-encounter', 'bibliosoph-window'],
        position: { width: 720, height: 560 },
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
        return foundry.utils.mergeObject(base, ourData);
    }

    /**
     * Template context for the Handlebars template.
     * @param {Object} options - Render options
     * @returns {Object} Context for the Handlebars template
     */
    async getData(options = {}) {
        await this._loadCombatAssessment();

        const difficulties = ['Easy', 'Medium', 'Hard', 'Deadly'];
        const recommendations = Array.isArray(this._recommendations) ? this._recommendations : [];

        return {
            appId: this.id || WINDOW_ENCOUNTER_APP_ID,
            title: this.options.window?.title ?? 'Quick Encounter',
            assessment: this._assessment,
            partyCRDisplay: this._assessment?.partyCRDisplay ?? '—',
            monsterCRDisplay: this._assessment?.monsterCRDisplay ?? '—',
            difficulty: this._assessment?.difficulty ?? '—',
            difficultyClass: this._assessment?.difficultyClass ?? '',
            habitats: this._habitats.map(h => ({ name: h, selected: h === this._selectedHabitat })),
            difficulties: difficulties.map(d => ({ value: d, label: d, selected: d === this._selectedDifficulty })),
            recommendations,
            hasRecommendations: recommendations.length > 0
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
                return;
            }
            const bridge = await import('modules/coffee-pub-blacksmith/api/blacksmith-api.js').catch(() => null);
            if (bridge?.BlacksmithAPI?.getCombatAssessment) {
                this._assessment = await bridge.BlacksmithAPI.getCombatAssessment();
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
    }

    /**
     * Attach listeners after render. In AppV2, root may be the part's root (the .window-encounter div)
     * or the app element; handle "html is already the root" so selectors don't miss.
     * @param {HTMLElement} html - Rendered element (native DOM)
     */
    activateListeners(html) {
        const root = html?.matches?.('.window-encounter') ? html : html?.querySelector?.('.window-encounter');
        if (!root) return;

        root.querySelector('.window-encounter-close')?.addEventListener('click', () => this.close());

        root.querySelectorAll('.window-encounter-habitat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitat = e.currentTarget?.dataset?.habitat;
                if (!habitat) return;
                this._selectedHabitat = habitat;
                this.render();
            });
        });

        const difficultySelect = root.querySelector('.window-encounter-difficulty');
        difficultySelect?.addEventListener('change', (e) => {
            this._selectedDifficulty = e.target?.value ?? '';
            this.render();
        });

        const recommendBtn = root.querySelector('.window-encounter-recommend');
        recommendBtn?.addEventListener('click', () => this._onRecommend());
    }

    async _onRecommend() {
        if (typeof window.bibliosophEncounterRecommend === 'function') {
            this._recommendations = await window.bibliosophEncounterRecommend(
                this._selectedHabitat,
                this._selectedDifficulty
            );
            this.render();
        }
    }
}
