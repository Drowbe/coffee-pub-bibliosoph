// ==================================================================
// ===== OUTCOME BURSTS (manager-injury-effects.js) =================
// ==================================================================
// Procedural canvas bursts when card outcomes are applied to a token.
// No image assets — all PIXI graphics + Foundry's scrolling-text engine.
//   - Injury: type-colored shockwave ring + shard spray, name rises
//   - Crit:   gold starburst — rotating spikes, double ring, name blazes up
//   - Fumble: sad fizzle — ring implodes, sputter drifts DOWN, name sinks
//
// Fires on EVERY client with no socket work: applied effects carry an
// `outcomeBurst` flag, and Foundry's createActiveEffect hook fires on
// all connected clients, so each draws the burst locally on the token.
// ==================================================================

import { MODULE } from './const.js';

function log(message, data = '', debug = true, notify = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `OUTCOME BURSTS | ${message}`, data, debug, notify);
    } else {
        console.log(`${MODULE.ID} | OUTCOME BURSTS | ${message}`, data);
    }
}

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
export function playInjuryBurst(token = null, category = 'General', text = '') {
    try {
        token = token ?? resolveDefaultToken();
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
        log('Injury burst failed', error?.message, false, false);
    }
}

/**
 * Crit burst: triumphant gold starburst — rotating triangular spikes
 * through a double ring (gold outer, crimson inner), name blazing upward.
 */
export function playCritBurst(token = null, text = '') {
    try {
        token = token ?? resolveDefaultToken();
        if (!canvas?.ready || !token?.center) return;
        const GOLD = 0xFFD700;
        const CRIMSON = 0xE03C4C;
        const { x, y } = token.center;
        const size = Math.max(token.w ?? 100, 100);

        const gfx = new PIXI.Graphics();
        gfx.position.set(x, y);
        canvas.interface.addChild(gfx);

        const SPIKES = 8;
        const DURATION = 1000;
        const start = Date.now();
        const tick = () => {
            const t = (Date.now() - start) / DURATION;
            if (t >= 1 || gfx.destroyed) {
                canvas.app.ticker.remove(tick);
                if (!gfx.destroyed) gfx.destroy();
                return;
            }
            const ease = 1 - Math.pow(1 - t, 3);
            const alpha = 1 - t;
            const rotation = t * 0.6;
            gfx.clear();
            // Double ring: gold outer, crimson chasing inside it
            gfx.lineStyle(Math.max(1, 5 * (1 - t)), GOLD, alpha * 0.9);
            gfx.drawCircle(0, 0, size * 0.35 + ease * size * 1.2);
            gfx.lineStyle(Math.max(1, 3 * (1 - t)), CRIMSON, alpha * 0.7);
            gfx.drawCircle(0, 0, size * 0.25 + ease * size * 0.9);
            // Rotating star spikes: isoceles triangles pointing outward
            for (let i = 0; i < SPIKES; i++) {
                const angle = (Math.PI * 2 * i) / SPIKES + rotation;
                const base = size * 0.3 + ease * size * 0.5;
                const tip = base + size * (0.45 * (1 - t * 0.5));
                const halfWidth = size * 0.06 * (1 - t);
                const perp = angle + Math.PI / 2;
                gfx.beginFill(GOLD, alpha);
                gfx.drawPolygon([
                    Math.cos(angle) * base + Math.cos(perp) * halfWidth,
                    Math.sin(angle) * base + Math.sin(perp) * halfWidth,
                    Math.cos(angle) * base - Math.cos(perp) * halfWidth,
                    Math.sin(angle) * base - Math.sin(perp) * halfWidth,
                    Math.cos(angle) * tip,
                    Math.sin(angle) * tip
                ]);
                gfx.endFill();
            }
        };
        canvas.app.ticker.add(tick);

        if (text) {
            canvas.interface.createScrollingText(
                { x, y: y - size * 0.3 },
                String(text).toUpperCase(),
                {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                    direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                    duration: 2200,
                    distance: size * 1.2,
                    fontSize: 32,
                    fill: GOLD,
                    stroke: 0x000000,
                    strokeThickness: 4,
                    fontWeight: 'bold'
                }
            );
        }
    } catch (error) {
        log('Crit burst failed', error?.message, false, false);
    }
}

/** Default token for macro callers: first targeted, else first selected. */
function resolveDefaultToken() {
    const targeted = Array.from(game.user?.targets ?? []);
    return targeted[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
}

/**
 * Fumble burst: something bad HAPPENED — a jagged impact ring cracks
 * outward, debris chunks are knocked skyward and arc back down under
 * gravity, a low dust cloud spreads, and the name sinks with a wobble.
 */
export function playFumbleBurst(token = null, text = '') {
    try {
        token = token ?? resolveDefaultToken();
        if (!canvas?.ready || !token?.center) return;
        const SLATE = 0x92A0AD;
        const SMOKE = 0x2F343A;
        const { x, y } = token.center;
        const size = Math.max(token.w ?? 100, 100);

        const gfx = new PIXI.Graphics();
        gfx.position.set(x, y);
        canvas.interface.addChild(gfx);

        // Jagged impact ring: fixed per-burst noise so the crack shape holds
        const RING_POINTS = 22;
        const ringNoise = Array.from({ length: RING_POINTS }, () => 0.85 + Math.random() * 0.35);

        // Debris: chunks knocked upward that tumble and arc back down
        const debris = Array.from({ length: 10 }, () => ({
            vx: (Math.random() - 0.5) * size * 2.2,
            vy: -size * (1.2 + Math.random() * 1.4),
            g: size * 5,
            w: 3 + Math.random() * 5,
            h: 2 + Math.random() * 4,
            spin: (Math.random() - 0.5) * 12,
            tint: Math.random() < 0.5 ? SLATE : SMOKE
        }));

        const DURATION = 1200;
        const start = Date.now();
        const tick = () => {
            const t = (Date.now() - start) / DURATION;
            if (t >= 1 || gfx.destroyed) {
                canvas.app.ticker.remove(tick);
                if (!gfx.destroyed) gfx.destroy();
                return;
            }
            const alpha = 1 - t;
            gfx.clear();

            // Low dust cloud spreading outward
            gfx.beginFill(SMOKE, alpha * 0.25);
            gfx.drawEllipse(0, size * 0.15, size * (0.4 + t * 0.9), size * (0.2 + t * 0.45));
            gfx.endFill();

            // Jagged impact ring: fast and violent, gone by 45%
            if (t < 0.45) {
                const rt = t / 0.45;
                const radius = size * (0.3 + rt * 0.8);
                gfx.lineStyle(Math.max(1, 5 * (1 - rt)), SLATE, (1 - rt) * 0.9);
                const pts = [];
                for (let i = 0; i < RING_POINTS; i++) {
                    const a = (Math.PI * 2 * i) / RING_POINTS;
                    const r = radius * ringNoise[i];
                    pts.push(Math.cos(a) * r, Math.sin(a) * r);
                }
                gfx.drawPolygon(pts);
            }

            // Tumbling debris on gravity arcs
            const ts = t * (DURATION / 1000);
            for (const d of debris) {
                const px = d.vx * ts;
                const py = d.vy * ts + 0.5 * d.g * ts * ts;
                const rot = d.spin * t * Math.PI;
                const cos = Math.cos(rot);
                const sin = Math.sin(rot);
                gfx.beginFill(d.tint, alpha);
                gfx.drawPolygon([
                    px + d.w * cos - d.h * sin, py + d.w * sin + d.h * cos,
                    px - d.w * cos - d.h * sin, py - d.w * sin + d.h * cos,
                    px - d.w * cos + d.h * sin, py - d.w * sin - d.h * cos,
                    px + d.w * cos + d.h * sin, py + d.w * sin - d.h * cos
                ]);
                gfx.endFill();
            }
        };
        canvas.app.ticker.add(tick);

        if (text) {
            canvas.interface.createScrollingText(
                { x, y: y + size * 0.2 },
                String(text).toUpperCase(),
                {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                    direction: CONST.TEXT_ANCHOR_POINTS.BOTTOM, // it sinks
                    duration: 2200,
                    distance: size,
                    fontSize: 28,
                    fill: SLATE,
                    stroke: 0x000000,
                    strokeThickness: 4,
                    fontWeight: 'bold',
                    jitter: 0.4 // the defeated wobble
                }
            );
        }
    } catch (error) {
        log('Fumble burst failed', error?.message, false, false);
    }
}

/**
 * Treatment burst: recovery made visible — a soft green ring contracts
 * gently home, bright motes rise like released breath, and the name
 * lifts away in healing green.
 */
export function playTreatmentBurst(token = null, text = '') {
    try {
        token = token ?? resolveDefaultToken();
        if (!canvas?.ready || !token?.center) return;
        const GREEN = 0x7FE3A0;
        const WHITE = 0xEFFFF4;
        const { x, y } = token.center;
        const size = Math.max(token.w ?? 100, 100);

        const gfx = new PIXI.Graphics();
        gfx.position.set(x, y);
        canvas.interface.addChild(gfx);

        const motes = Array.from({ length: 10 }, () => ({
            x0: (Math.random() - 0.5) * size * 0.9,
            y0: size * (0.1 + Math.random() * 0.3),
            rise: size * (0.6 + Math.random() * 0.6),
            sway: 4 + Math.random() * 8,
            phase: Math.random() * Math.PI * 2,
            radius: 2 + Math.random() * 3,
            tint: Math.random() < 0.4 ? WHITE : GREEN
        }));

        const DURATION = 1300;
        const start = Date.now();
        const tick = () => {
            const t = (Date.now() - start) / DURATION;
            if (t >= 1 || gfx.destroyed) {
                canvas.app.ticker.remove(tick);
                if (!gfx.destroyed) gfx.destroy();
                return;
            }
            const easeOut = 1 - Math.pow(1 - t, 2);
            const alpha = 1 - t;
            gfx.clear();
            // Soft ring contracting gently home (the inverse of harm)
            const radius = size * 1.15 - easeOut * size * 0.85;
            gfx.lineStyle(Math.max(1, 3.5 * (1 - t)), GREEN, alpha * 0.8);
            gfx.drawCircle(0, 0, Math.max(radius, size * 0.15));
            // Bright motes rising with a gentle sway
            for (const m of motes) {
                const px = m.x0 + Math.sin(t * 3 + m.phase) * m.sway;
                const py = m.y0 - easeOut * m.rise;
                gfx.beginFill(m.tint, alpha * 0.9);
                gfx.drawCircle(px, py, m.radius * (1 - t * 0.4));
                gfx.endFill();
            }
        };
        canvas.app.ticker.add(tick);

        if (text) {
            canvas.interface.createScrollingText(
                { x, y: y - size * 0.3 },
                String(text).toUpperCase(),
                {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                    direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                    duration: 2200,
                    distance: size,
                    fontSize: 26,
                    fill: GREEN,
                    stroke: 0x000000,
                    strokeThickness: 4,
                    fontWeight: 'bold'
                }
            );
        }
    } catch (error) {
        log('Treatment burst failed', error?.message, false, false);
    }
}

export class InjuryEffectsManager {
    static _initialized = false;

    static initialize() {
        if (this._initialized) return;
        this._initialized = true;

        // Macro API: any macro can fire a burst on the targeted (or
        // selected) token, e.g.
        //   game.modules.get('coffee-pub-bibliosoph').api.playCritBurst();
        //   game.modules.get('coffee-pub-bibliosoph').api.playInjuryBurst(null, 'Fire', 'Roasted!');
        const mod = game.modules.get(MODULE.ID);
        if (mod) {
            mod.api = Object.assign(mod.api ?? {}, {
                playInjuryBurst,
                playCritBurst,
                playFumbleBurst,
                playTreatmentBurst
            });
        }

        // createActiveEffect fires on all connected clients — each draws
        // the burst locally, no relay needed.
        Hooks.on('createActiveEffect', (effect) => {
            try {
                const burst = effect?.getFlag?.(MODULE.ID, 'outcomeBurst');
                if (!burst) return;
                const actor = effect.parent;
                const token = actor?.token?.object ?? actor?.getActiveTokens?.()[0] ?? null;
                if (!token) return;
                if (burst.kind === 'crit') playCritBurst(token, burst.name);
                else if (burst.kind === 'fumble') playFumbleBurst(token, burst.name);
                else playInjuryBurst(token, burst.category, burst.name);
            } catch (error) {
                log('Outcome burst hook failed', error?.message, false, false);
            }
        });

        // Removal of any flagged affliction — treatment button, manual
        // deletion from the sheet, expiry cleanup — plays the recovery
        // burst everywhere, same architecture.
        Hooks.on('deleteActiveEffect', (effect) => {
            try {
                const burst = effect?.getFlag?.(MODULE.ID, 'outcomeBurst');
                if (!burst) return;
                const actor = effect.parent;
                const token = actor?.token?.object ?? actor?.getActiveTokens?.()[0] ?? null;
                if (token) playTreatmentBurst(token, 'Treated');
            } catch (error) {
                log('Treatment burst hook failed', error?.message, false, false);
            }
        });
    }
}
