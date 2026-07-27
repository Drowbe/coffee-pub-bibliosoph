// ==================================================================
// ===== INJURY EFFECTS (manager-injury-effects.js) =================
// ==================================================================
// Procedural canvas burst when an injury is applied: a type-colored
// shockwave ring, a spray of shard fragments, and the injury name
// rising over the token (createScrollingText). No image assets — all
// PIXI graphics and Foundry's scrolling-text engine.
//
// Fires on EVERY client with no socket work: applied injuries carry an
// `injuryBurst` flag, and Foundry's createActiveEffect hook fires on
// all connected clients, so each draws the burst locally on the token.
// ==================================================================

import { MODULE } from './const.js';

/** Burst colors by injury category (dnd5e damage types + General). */
const CATEGORY_COLORS = {
    acid: 0xC8F03C,
    bludgeoning: 0xC9B18C,
    cold: 0x9BDDFF,
    fire: 0xFF7A2F,
    force: 0x9F86FF,
    general: 0xD9D9D9,
    lightning: 0xFFE14D,
    necrotic: 0x7C9A4E,
    piercing: 0xE8E8E8,
    poison: 0x3FBF3F,
    psychic: 0xE070E0,
    radiant: 0xFFF3A0,
    slashing: 0xE03C4C,
    thunder: 0x7FB8FF
};

/**
 * Play the injury burst on a token: shockwave ring + shard spray in the
 * category color, with the injury name rising above. Purely local —
 * callers on other clients draw their own via the createActiveEffect hook.
 */
export function playInjuryBurst(token, category = 'General', text = '') {
    try {
        if (!canvas?.ready || !token?.center) return;
        const color = CATEGORY_COLORS[String(category ?? '').toLowerCase()] ?? CATEGORY_COLORS.general;
        const { x, y } = token.center;
        const size = Math.max(token.w ?? 100, 100);

        // One Graphics object redrawn each frame carries the ring + shards
        const gfx = new PIXI.Graphics();
        gfx.position.set(x, y);
        canvas.interface.addChild(gfx);

        const shards = Array.from({ length: 12 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
            return {
                angle,
                speed: size * (0.9 + Math.random() * 0.9),
                len: size * (0.10 + Math.random() * 0.12),
                width: 2 + Math.random() * 3
            };
        });

        const DURATION = 900; // ms
        const start = Date.now();
        const tick = () => {
            const t = (Date.now() - start) / DURATION;
            if (t >= 1 || gfx.destroyed) {
                canvas.app.ticker.remove(tick);
                if (!gfx.destroyed) gfx.destroy();
                return;
            }
            const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
            const alpha = 1 - t;
            gfx.clear();
            // Shockwave ring
            const radius = (size * 0.3) + ease * size * 1.1;
            gfx.lineStyle(Math.max(1, 6 * (1 - t)), color, alpha * 0.9);
            gfx.drawCircle(0, 0, radius);
            // Shards: slivers flying outward, shrinking as they go
            for (const s of shards) {
                const dist = (size * 0.25) + ease * s.speed;
                const x1 = Math.cos(s.angle) * dist;
                const y1 = Math.sin(s.angle) * dist;
                const x2 = Math.cos(s.angle) * (dist + s.len * (1 - t));
                const y2 = Math.sin(s.angle) * (dist + s.len * (1 - t));
                gfx.lineStyle(s.width * (1 - t) + 0.5, color, alpha);
                gfx.moveTo(x1, y1);
                gfx.lineTo(x2, y2);
            }
        };
        canvas.app.ticker.add(tick);

        // Rising injury name, damage-number style
        if (text) {
            canvas.interface.createScrollingText(
                { x, y: y - size * 0.3 },
                String(text).toUpperCase(),
                {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                    direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                    duration: 2000,
                    distance: size,
                    fontSize: 28,
                    fill: color,
                    stroke: 0x000000,
                    strokeThickness: 4,
                    fontWeight: 'bold'
                }
            );
        }
    } catch (error) {
        console.warn(`${MODULE.ID} | Injury burst failed:`, error);
    }
}

export class InjuryEffectsManager {
    static _initialized = false;

    static initialize() {
        if (this._initialized) return;
        this._initialized = true;
        // createActiveEffect fires on all connected clients — each draws
        // the burst locally, no relay needed.
        Hooks.on('createActiveEffect', (effect) => {
            try {
                const burst = effect?.getFlag?.(MODULE.ID, 'injuryBurst');
                if (!burst) return;
                const actor = effect.parent;
                const token = actor?.token?.object ?? actor?.getActiveTokens?.()[0] ?? null;
                if (token) playInjuryBurst(token, burst.category, burst.name);
            } catch (error) {
                console.warn(`${MODULE.ID} | Injury burst hook failed:`, error);
            }
        });
    }
}
