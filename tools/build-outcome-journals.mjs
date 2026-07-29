// ==================================================================
// ===== OUTCOME JOURNAL GENERATOR ==================================
// ===== (tools/build-outcome-journals.mjs) =========================
// ==================================================================
// Generates packs/_source/outcomes/*.json from resources/outcomes.json:
// one journal per kind ("Criticals", "Fumbles"), one typed page per
// entry. Mirrors tools/build-injury-journals.mjs.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { KINDS, SEVERITIES, SEVERITY_LABELS } from '../scripts/data/outcome-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'outcomes.json');
/** One pack per kind; journals inside are the severity buckets. */
const PACK_DIRS = { crit: 'criticals', fumble: 'fumbles' };
const MODULE_ID = 'coffee-pub-bibliosoph';
const PAGE_TYPE = `${MODULE_ID}.outcome`;

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function idFrom(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest();
    let out = '';
    for (let i = 0; i < 16; i++) out += ID_CHARS[hash[i] % ID_CHARS.length];
    return out;
}

function buildPage(rec, journalId, sort) {
    const pageId = idFrom(`${MODULE_ID}:outcome:${rec.kind}:${rec.title}`);
    const { title, ...system } = rec;
    return {
        type: PAGE_TYPE,
        name: title,
        text: { content: '', format: 1 },
        _id: pageId,
        system: {
            ...system,
            modifiers: (rec.modifiers ?? []).map((m) => ({
                stat: m.stat,
                value: Number(m.value) || 0,
                rounds: Number(m.rounds) || 0
            })),
            gmnotes: rec.gmnotes ?? ''
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

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const summary = [];
let pages = 0;
let journals = 0;

for (const kind of KINDS) {
    const outDir = path.join(ROOT, 'packs', '_source', PACK_DIRS[kind]);
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(outDir).filter((f) => f.endsWith('.json'))) {
        fs.unlinkSync(path.join(outDir, file));
    }

    summary.push(`  packs/${PACK_DIRS[kind]}`);
    // One journal per severity bucket, under its real name.
    for (const severity of SEVERITIES) {
        const recs = records
            .filter((r) => r.kind === kind && r.severity === severity)
            .sort((a, b) => a.title.localeCompare(b.title));
        if (!recs.length) continue;

        const name = SEVERITY_LABELS[kind]?.[severity] ?? severity;
        const journalId = idFrom(`${MODULE_ID}:outcomejournal:${kind}:${severity}`);
        // Buckets sort worst-last so the list reads mild -> brutal.
        const bucketSort = SEVERITIES.indexOf(severity) * 1000;

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
            sort: bucketSort,
            _key: `!journal!${journalId}`
        };

        fs.writeFileSync(path.join(outDir, `${name}_${journalId}.json`), JSON.stringify(doc, null, 2) + '\n', 'utf8');
        pages += recs.length;
        journals++;
        summary.push(`    ${name.padEnd(14)} ${String(recs.length).padStart(3)} ${kind}s`);
    }
}

console.log(`Generated ${journals} bucket journals / ${pages} pages\n`);
console.log(summary.join('\n'));

// Round-trip check: every page must read back as its source record
const problems = [];
const byKey = new Map(records.map((r) => [`${r.kind}::${r.title}`, r]));
const seen = new Set();
const allFiles = KINDS.flatMap((kind) => {
    const dir = path.join(ROOT, 'packs', '_source', PACK_DIRS[kind]);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)) : [];
});
for (const file of allFiles) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const page of doc.pages ?? []) {
        if (page.type !== PAGE_TYPE) { problems.push(`${page.name}: wrong page type ${page.type}`); continue; }
        const key = `${page.system.kind}::${page.name}`;
        seen.add(key);
        const rec = byKey.get(key);
        if (!rec) { problems.push(`${page.name}: matches no source record`); continue; }
        for (const [field, value] of Object.entries(rec)) {
            if (field === 'title') continue;
            const got = page.system[field];
            if (JSON.stringify(got) !== JSON.stringify(value)) {
                problems.push(`${page.name}: "${field}" is ${JSON.stringify(got)}, source says ${JSON.stringify(value)}`);
            }
        }
    }
}
for (const key of byKey.keys()) if (!seen.has(key)) problems.push(`source record "${key}" produced no page`);

if (problems.length) {
    console.log(`\n--- ${problems.length} round-trip problem(s) ---`);
    for (const p of problems.slice(0, 20)) console.log(`  x ${p}`);
    process.exit(1);
}
console.log('\nOK — every page is the typed outcome subtype and matches its source record.');
