// ==================================================================
// ===== INJURY JOURNAL GENERATOR ====================================
// ===== (tools/build-injury-journals.mjs) ==========================
// ==================================================================
// Generates packs/_source/injuries/*.json from resources/injuries.json
// per documentation/spec-injury-schema.md Part 4.
//
//   node tools/build-injury-journals.mjs
//   npm run injuries:build      (validate + generate)
//
// Every page is generated from its record, so the human-readable half
// and the machine-readable metadata can never disagree — the drift this
// replaces had pages claiming "Duration: 50" over metadata saying 300.
//
// Stability:
//   - journal ids are reused from the existing pack files (by category),
//     so a rebuild updates journals in place instead of orphaning them
//   - page ids are derived deterministically from category + title, so
//     regenerating unchanged content produces an identical diff
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, displayCategory } from './injury-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const OUT_DIR = path.join(ROOT, 'packs', '_source', 'injuries');
const MODULE_ID = 'coffee-pub-bibliosoph';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Deterministic 16-char Foundry-style id from a seed string. */
function idFrom(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest();
    let out = '';
    for (let i = 0; i < 16; i++) out += ID_CHARS[hash[i] % ID_CHARS.length];
    return out;
}

/**
 * Pages are the typed `coffee-pub-bibliosoph.injury` subtype: every
 * mechanical field lives in `system`, validated by Foundry on write, and
 * rendered by the injury page sheet. Nothing is encoded in HTML any more,
 * which is what let the old displayed values drift from the real ones.
 *
 * `text.content` is left empty and belongs to the GM as free-form notes.
 */
function buildPage(rec, journalId, sort) {
    const pageId = idFrom(`${MODULE_ID}:page:${rec.category}:${rec.title}`);
    const { title, ...system } = rec;      // the page name IS the title
    return {
        type: `${MODULE_ID}.injury`,
        name: title,
        text: { content: '', format: 1 },
        _id: pageId,
        system: {
            ...system,
            treatmentdc: rec.treatmentdc ?? null
        },
        title: { show: true, level: 1 },
        image: {},
        video: { controls: true, volume: 0.5 },
        src: null,
        category: null,
        sort,
        flags: {},
        _stats: {
            compendiumSource: null,
            duplicateSource: null,
            exportSource: null,
            coreVersion: '13.351',
            systemId: 'dnd5e',
            systemVersion: '5.2.5',
            lastModifiedBy: null
        },
        ownership: { default: -1 },
        _key: `!journal.pages!${journalId}.${pageId}`
    };
}

// ---- existing journal ids, so rebuilds update in place ----------
const existingIds = new Map();
if (fs.existsSync(OUT_DIR)) {
    for (const file of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
        try {
            const doc = JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'));
            if (doc?.name && doc?._id) existingIds.set(String(doc.name).toLowerCase(), doc._id);
        } catch { /* unreadable file: a fresh id gets generated below */ }
    }
}

// ---- generate ---------------------------------------------------
const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const byCategory = new Map();
for (const rec of records) {
    if (!byCategory.has(rec.category)) byCategory.set(rec.category, []);
    byCategory.get(rec.category).push(rec);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
// Clear old files so a renamed/removed category cannot leave an orphan
for (const file of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
    fs.unlinkSync(path.join(OUT_DIR, file));
}

let journals = 0;
let pages = 0;
const summary = [];

for (const category of CATEGORIES) {
    const recs = (byCategory.get(category) ?? []).slice()
        .sort((a, b) => a.title.localeCompare(b.title));
    if (!recs.length) {
        summary.push(`  ${displayCategory(category).padEnd(12)} SKIPPED (no injuries)`);
        continue;
    }

    const name = displayCategory(category);
    const journalId = existingIds.get(name.toLowerCase()) ?? idFrom(`${MODULE_ID}:journal:${category}`);
    const reused = existingIds.has(name.toLowerCase());

    const doc = {
        name,
        pages: recs.map((rec, i) => buildPage(rec, journalId, i * 100)),
        folder: null,
        _id: journalId,
        categories: [],
        flags: {},
        _stats: {
            compendiumSource: null,
            duplicateSource: null,
            exportSource: null,
            coreVersion: '13.351',
            systemId: 'dnd5e',
            systemVersion: '5.2.5',
            createdTime: 1784237483935,
            modifiedTime: Date.now(),
            lastModifiedBy: 'B4d9pDwUBOtAfJFE'
        },
        ownership: { default: 0, B4d9pDwUBOtAfJFE: 3 },
        sort: 0,
        _key: `!journal!${journalId}`
    };

    fs.writeFileSync(path.join(OUT_DIR, `${name}_${journalId}.json`), JSON.stringify(doc, null, 2) + '\n', 'utf8');
    journals++;
    pages += recs.length;
    summary.push(`  ${name.padEnd(12)} ${String(recs.length).padStart(3)} injuries  ${reused ? 'id reused' : 'NEW id'}`);
}

console.log(`Generated ${journals} journals / ${pages} pages into packs/_source/injuries\n`);
console.log(summary.join('\n'));
console.log('\nNext: npm run packs:build  (Foundry must be closed)');
