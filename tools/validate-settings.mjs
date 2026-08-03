// ==================================================================
// ===== SETTINGS VALIDATOR (tools/validate-settings.mjs) ============
// ==================================================================
// Checks one rule that is invisible until a player complains:
//
//   A HEADING MUST BE VISIBLE TO EXACTLY THE PEOPLE WHO CAN SEE
//   SOMETHING UNDER IT.
//
// Foundry hides `scope: 'world'` settings from non-GM users entirely.
// Headings are just settings with an empty body, so they obey the same
// rule — which means a heading's scope silently decides whether players
// get any context at all.
//
// Two ways it goes wrong, both of which shipped at once:
//
//   HEADING TOO PRIVATE — a world heading above player-visible settings.
//   Players get a bare list of switches with no section titles, and no
//   way to tell which feature a given "Enabled" belongs to.
//
//   HEADING TOO PUBLIC — a player-visible heading with nothing under it
//   that players can see. They get an empty section title introducing
//   nothing, which reads as a bug or a permissions failure.
//
// The rule is structural, so it is checked rather than remembered:
// a heading is player-visible IFF at least one config:true player-visible
// setting appears beneath it, at any depth (H1 covers everything until the
// next H1, H2 until the next H2 of the same or higher level, and so on).
//
// Run: node tools/validate-settings.mjs [--quiet]
// Exits 1 on any violation, so it can gate a build.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'scripts', 'settings.js');
const QUIET = process.argv.includes('--quiet');

// 'client' is Foundry's older alias for 'user'; both mean per-user, and a
// setting with no scope at all defaults to per-user. Only 'world' is GM-only.
const PLAYER_SCOPES = new Set(['user', 'client']);
const isPlayerVisible = (scope) => PLAYER_SCOPES.has(scope);

const src = fs.readFileSync(SOURCE, 'utf8');

/** Every game.settings.register call, in source order (= display order). */
function parseRegistrations(text) {
    const out = [];
    const re = /game\.settings\.register\(\s*MODULE\.ID\s*,\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*\{/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const open = m.index + m[0].length - 1;
        let depth = 0;
        let close = -1;
        for (let i = open; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') {
                depth--;
                if (depth === 0) { close = i; break; }
            }
        }
        if (close === -1) continue;
        const body = text.slice(open, close + 1);
        const scope = /scope:\s*['"](\w+)['"]/.exec(body)?.[1] ?? 'user';
        const config = /config:\s*(true|false)/.exec(body)?.[1] === 'true';
        out.push({
            key: m[1],
            scope,
            config,
            line: text.slice(0, m.index).split('\n').length
        });
    }
    return out;
}

/** "headingH2Messaging" -> 2; a normal setting -> null. */
const headingLevel = (key) => {
    const m = /^headingH(\d)/.exec(key);
    return m ? Number(m[1]) : null;
};

const registrations = parseRegistrations(src);
const scopeOf = new Map(registrations.map((r) => [r.key, r.scope]));
const lineOf = new Map(registrations.map((r) => [r.key, r.line]));

// Walk in order, keeping the currently open heading at each level. A setting
// belongs to every heading still open above it.
const openChain = new Map();
const playerKidsOf = new Map();
for (const { key, scope, config } of registrations) {
    const level = headingLevel(key);
    if (level !== null) {
        openChain.set(level, key);
        for (const deeper of [...openChain.keys()].filter((l) => l > level)) openChain.delete(deeper);
        if (!playerKidsOf.has(key)) playerKidsOf.set(key, []);
        continue;
    }
    if (!config) continue;                 // hidden settings need no heading
    if (!isPlayerVisible(scope)) continue; // GM-only settings: the GM sees every heading anyway
    for (const heading of [...openChain.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h)) {
        playerKidsOf.get(heading).push(key);
    }
}

const errors = [];
for (const [heading, kids] of playerKidsOf) {
    const scope = scopeOf.get(heading);
    const shouldBeVisible = kids.length > 0;
    const isVisible = isPlayerVisible(scope);
    if (shouldBeVisible && !isVisible) {
        errors.push(
            `${heading} (line ${lineOf.get(heading)}): scope '${scope}' hides it from players, but `
            + `${kids.length} player-visible setting(s) sit under it — they would appear with no section title. `
            + `Needs scope 'user'. [${kids.slice(0, 4).join(', ')}${kids.length > 4 ? ', …' : ''}]`
        );
    } else if (!shouldBeVisible && isVisible) {
        errors.push(
            `${heading} (line ${lineOf.get(heading)}): scope '${scope}' shows it to players, but nothing `
            + `under it is player-visible — they would see an empty section title. Needs scope 'world'.`
        );
    }
}

// Registrations whose key is a variable rather than a literal — the message
// sounds are registered in a for-loop, for instance. They cannot be placed in
// the heading tree by reading the source, so they are reported rather than
// silently skipped: an unreported blind spot is worse than a known one,
// because "OK" would imply a coverage this check does not have.
const dynamic = [...src.matchAll(/game\.settings\.register\(\s*MODULE\.ID\s*,\s*([A-Za-z_$][\w$]*)\s*,/g)]
    .map((m) => ({ variable: m[1], line: src.slice(0, m.index).split('\n').length }));

const headings = registrations.filter((r) => headingLevel(r.key) !== null);
const settings = registrations.filter((r) => headingLevel(r.key) === null);
const playerSettings = settings.filter((r) => r.config && isPlayerVisible(r.scope));

const byScope = (s) => settings.filter((r) => r.scope === s).length;

if (!QUIET) {
    console.log(`Validating ${registrations.length} registrations from scripts/settings.js`);
    console.log(`  ${headings.length} headings · ${settings.length} settings `
        + `(${playerSettings.length} player-visible, ${settings.filter((r) => r.config).length - playerSettings.length} GM-only)`);
    console.log(`  scopes: ${byScope('world')} world · ${byScope('user')} user · ${byScope('client')} client (per-device)`);
    if (dynamic.length) {
        console.log(`  ! ${dynamic.length} registration(s) use a variable key and are NOT covered by this check:`);
        for (const d of dynamic) console.log(`      line ${d.line}: register(MODULE.ID, ${d.variable}, …)`);
    }
}

if (errors.length) {
    console.error(`\n--- ${errors.length} heading scope error(s) ---`);
    for (const e of errors) console.error(`  x ${e}`);
    console.error('\nFAILED');
    process.exit(1);
}

console.log(`OK — every heading is visible to exactly the people who can see something under it`);
