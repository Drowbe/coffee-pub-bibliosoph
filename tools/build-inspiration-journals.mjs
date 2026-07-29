// ==================================================================
// ===== INSPIRATION GENERATOR ======================================
// ===== (tools/build-inspiration-journals.mjs) =====================
// ==================================================================
// Generates packs/_source/inspiration from resources/inspiration.json:
// one journal ("Inspiration Cards"), one typed page per card.
// Validates as it goes — the deck is small enough that a separate
// validator would be more ceremony than it is worth.
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ACTION_KEYS, REQUIRED_FIELDS, OPTIONAL_FIELDS } from '../scripts/data/inspiration-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'inspiration.json');
const OUT_DIR = path.join(ROOT, 'packs', '_source', 'inspiration');
const MODULE_ID = 'coffee-pub-bibliosoph';
const PAGE_TYPE = `${MODULE_ID}.inspiration`;
const JOURNAL_NAME = 'Inspiration Cards';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function idFrom(seed) {
    const hash = crypto.createHash('sha256').update(seed).digest();
    let out = '';
    for (let i = 0; i < 16; i++) out += ID_CHARS[hash[i] % ID_CHARS.length];
    return out;
}

const FOUNDRY_PUBLIC = [
    process.env.FOUNDRY_PUBLIC,
    'C:/Program Files/Foundry Virtual Tabletop/resources/app/public',
    '/Applications/FoundryVTT.app/Contents/Resources/app/public'
].filter(Boolean).find((p) => { try { return fs.existsSync(path.join(p, 'icons')); } catch { return false; } });

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const errors = [];
const known = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
const titles = new Set();

records.forEach((rec, i) => {
    const where = `[${i}] ${rec?.title ?? '(untitled)'}`;
    for (const f of REQUIRED_FIELDS) {
        if (rec?.[f] === undefined || rec[f] === null || (typeof rec[f] === 'string' && !rec[f].trim())) {
            errors.push(`${where}: missing "${f}"`);
        }
    }
    for (const f of Object.keys(rec ?? {})) if (!known.has(f)) errors.push(`${where}: unknown field "${f}"`);
    if (rec?.action && !ACTION_KEYS.includes(rec.action)) errors.push(`${where}: unknown action "${rec.action}"`);
    if (rec?.action === 'setHp' && rec.actionamount == null) errors.push(`${where}: action setHp needs actionamount`);
    if (rec?.action === 'percentDamage' && !rec.actionformula) errors.push(`${where}: action percentDamage needs actionformula`);
    if (!Number.isInteger(rec?.odds) || rec.odds < 1 || rec.odds > 100) errors.push(`${where}: odds must be an integer 1-100`);
    if (titles.has(rec?.title)) errors.push(`${where}: duplicate title`);
    titles.add(rec?.title);
    if (FOUNDRY_PUBLIC && rec?.image?.startsWith('icons/') && !fs.existsSync(path.join(FOUNDRY_PUBLIC, rec.image))) {
        errors.push(`${where}: image not found: ${rec.image}`);
    }
});

if (errors.length) {
    console.log(`--- ${errors.length} ERROR(s) ---`);
    for (const e of errors) console.log(`  x ${e}`);
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) fs.unlinkSync(path.join(OUT_DIR, f));

const journalId = idFrom(`${MODULE_ID}:inspirationjournal`);
const pages = records
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((rec, i) => {
        const { title, ...system } = rec;
        const pageId = idFrom(`${MODULE_ID}:inspiration:${title}`);
        return {
            type: PAGE_TYPE,
            name: title,
            text: { content: '', format: 1 },
            _id: pageId,
            system: {
                image: system.image ?? '',
                imagetitle: system.imagetitle ?? '',
                description: system.description ?? '',
                odds: system.odds,
                action: system.action ?? 'none',
                actionamount: system.actionamount ?? null,
                actionformula: system.actionformula ?? '',
                gmnotes: system.gmnotes ?? ''
            },
            title: { show: true, level: 1 },
            image: {}, video: { controls: true, volume: 0.5 }, src: null, category: null,
            sort: i * 100,
            flags: {},
            _stats: {
                compendiumSource: null, duplicateSource: null, exportSource: null,
                coreVersion: '13.351', systemId: 'dnd5e', systemVersion: '5.2.5', lastModifiedBy: null
            },
            ownership: { default: -1 },
            _key: `!journal.pages!${journalId}.${pageId}`
        };
    });

const doc = {
    name: JOURNAL_NAME,
    pages,
    folder: null,
    _id: journalId,
    categories: [],
    flags: {},
    _stats: {
        compendiumSource: null, duplicateSource: null, exportSource: null,
        coreVersion: '13.351', systemId: 'dnd5e', systemVersion: '5.2.5',
        createdTime: 1784237483935, modifiedTime: Date.now(), lastModifiedBy: 'B4d9pDwUBOtAfJFE'
    },
    ownership: { default: 0, B4d9pDwUBOtAfJFE: 3 },
    sort: 0,
    _key: `!journal!${journalId}`
};

fs.writeFileSync(path.join(OUT_DIR, `${JOURNAL_NAME}_${journalId}.json`), JSON.stringify(doc, null, 2) + '\n', 'utf8');

const automated = records.filter((r) => r.action && r.action !== 'none').length;
console.log(`Generated 1 journal / ${pages.length} inspiration cards into packs/_source/inspiration`);
console.log(`  automated: ${automated} · narrative: ${records.length - automated}`);
console.log('\nOK — validated and written.');
