// ==================================================================
// ===== ROUND-TRIP VERIFIER (tools/verify-injury-roundtrip.mjs) =====
// ==================================================================
// Proves that what the generator wrote is what the runtime will read
// back: for every generated page, re-extract the Metadata block the way
// getHTMLMetadata() does and compare it field-by-field against the
// source record, and check the page flag matches too.
//
//   node tools/verify-injury-roundtrip.mjs
// ==================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'resources', 'injuries.json');
const OUT_DIR = path.join(ROOT, 'packs', '_source', 'injuries');
const MODULE_ID = 'coffee-pub-bibliosoph';

const unesc = (s) => String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/**
 * Mirrors scripts/bibliosoph.js getHTMLMetadata(): find <h2>Metadata</h2>,
 * take the first following sibling <ul>, and read each <li>'s
 * <strong>key:</strong> value pair.
 */
function extractMetadata(html) {
    const h2 = html.indexOf('<h2>Metadata</h2>');
    if (h2 === -1) return { error: 'no <h2>Metadata</h2>' };
    const after = html.slice(h2);
    const ulStart = after.indexOf('<ul>');
    if (ulStart === -1) return { error: 'no <ul> after the Metadata heading' };
    const ulEnd = after.indexOf('</ul>', ulStart);
    if (ulEnd === -1) return { error: 'unterminated <ul>' };
    const ul = after.slice(ulStart, ulEnd);

    const meta = {};
    for (const m of ul.matchAll(/<strong>([^<:]+):<\/strong>\s*([^<]*)</g)) {
        meta[m[1].trim()] = unesc(m[2].trim());
    }
    return { meta };
}

const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const byKey = new Map(records.map((r) => [`${r.category}::${r.title}`, r]));

let checked = 0;
const problems = [];

for (const file of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'));
    for (const page of doc.pages ?? []) {
        const { meta, error } = extractMetadata(page.text?.content ?? '');
        if (error) { problems.push(`${doc.name}/${page.name}: ${error}`); continue; }

        const rec = byKey.get(`${meta.category}::${meta.title}`);
        if (!rec) { problems.push(`${doc.name}/${page.name}: parsed metadata matches no source record`); continue; }

        for (const [field, value] of Object.entries(rec)) {
            const parsed = meta[field];
            if (parsed === undefined) { problems.push(`${doc.name}/${page.name}: field "${field}" missing from metadata`); continue; }
            if (String(value) !== parsed) {
                problems.push(`${doc.name}/${page.name}: "${field}" round-tripped as "${parsed}" but source says "${value}"`);
            }
        }

        // The flag must carry the same record
        const flag = page.flags?.[MODULE_ID]?.injury;
        if (!flag) problems.push(`${doc.name}/${page.name}: missing injury flag`);
        else if (JSON.stringify(flag) !== JSON.stringify(rec)) {
            problems.push(`${doc.name}/${page.name}: flag does not match the source record`);
        }

        // Page identity
        if (page.name !== rec.title) problems.push(`${doc.name}/${page.name}: page name != record title`);
        if (page._key !== `!journal.pages!${doc._id}.${page._id}`) problems.push(`${doc.name}/${page.name}: _key does not match ids`);

        checked++;
    }
}

console.log(`Round-tripped ${checked} pages against ${records.length} source records`);
if (problems.length) {
    console.log(`\n--- ${problems.length} problem(s) ---`);
    for (const p of problems.slice(0, 40)) console.log(`  x ${p}`);
    if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
    process.exit(1);
}
console.log('OK — every page reads back exactly as authored, flags included.');
