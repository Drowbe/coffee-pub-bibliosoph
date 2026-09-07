// ==================================================================
// ===== CONTENT PROFILE VERIFIER ===================================
// ===== (tools/verify-content-profiles.mjs) ========================
// ==================================================================
// Checks the outcome and inspiration import declarations the same way
// verify-injury-profile.mjs checks the injury one: build them offline,
// put them through Blacksmith's OWN validateDeclaration, and compare
// them against the models they describe.
//
// Injuries keep their own verifier because it also closes the container
// loop against the shipped compendium, which needs injury knowledge.
// These three have simpler containers -- a value map and a constant --
// so they share one caller.
//
// WHY THE STUBS CARRY CLASS DEFAULTS: Foundry merges `static _defaults`
// into every field instance, so a real field carries properties the
// model never mentioned, and the walk reads the instance. A thin stub
// does not make this check weaker in an obvious way; it makes it check a
// different object. See verify-injury-profile.mjs for the bug that
// taught us.
// ==================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = pathToFileURL(path.join(ROOT, 'scripts', 'data')).href + '/';
const BLACKSMITH = pathToFileURL(path.join(ROOT, '..', 'coffee-pub-blacksmith', 'api')).href + '/';

// ---- Foundry / browser stubs -------------------------------------
globalThis.fetch = async (url) => {
    const body = await readFile(fileURLToPath(url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

class StubField {
    constructor(options = {}) { Object.assign(this, this.constructor.defaults, options); }
    static defaults = {};
}
globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    data: {
        fields: {
            StringField: class extends StubField {
                static defaults = { required: false, blank: false, trim: true };
            },
            NumberField: class extends StubField {
                static defaults = { required: false, nullable: true, integer: false };
            },
            BooleanField: class extends StubField {
                static defaults = { required: true, nullable: false, initial: false };
            },
            ObjectField: class extends StubField {
                static defaults = { required: true, nullable: false };
            },
            ArrayField: class extends StubField {
                static defaults = { required: true, nullable: false, min: 0, max: Infinity };
                constructor(element, options = {}) { super(options); this.element = element; }
            },
            SchemaField: class extends StubField {
                static defaults = { required: true, nullable: false };
                constructor(fields, options = {}) { super(options); this.fields = fields; }
            }
        }
    },
    utils: { escapeHTML: (s) => s }
};

const realLog = console.log;
console.log = () => {};
const { OutcomePageModel } = await import(DATA + 'outcome-page-model.js');
const { InspirationPageModel } = await import(DATA + 'inspiration-page-model.js');
const { buildOutcomeDeclaration } = await import(DATA + 'outcome-import-profile.js');
const { buildInspirationDeclaration } = await import(DATA + 'inspiration-import-profile.js');
const { SEVERITIES, SEVERITY_LABELS } = await import(DATA + 'outcome-schema.js');
console.log = realLog;

// Blacksmith's schema walk and its REAL registry validator, through the
// contract paths. Importing them rather than reimplementing their rules
// is the whole point: a local copy of another module's format drifts
// from the day it is written.
let declarationFromModel, validateDeclaration;
try {
    ({ declarationFromModel } = await import(BLACKSMITH + 'declaration-from-model.mjs'));
    ({ validateDeclaration } = await import(BLACKSMITH + 'validate-declaration.mjs'));
} catch (error) {
    console.log('  ERROR  Could not import Blacksmith\'s importer API from:');
    console.log(`         ${BLACKSMITH}`);
    console.log('         Blacksmith must be checked out beside this module.');
    console.log(`         ${error.message}`);
    process.exit(1);
}

const errors = [];
const note = (m) => errors.push(m);

/**
 * Every check that does not need to know what the content IS.
 *
 * @param {object} declaration
 * @param {object} schema        the model's defineSchema() output
 * @param {string} expectedType  the subtype module.json registers
 * @param {string} titleField    the declared field carrying the page NAME
 */
function checkProfile(declaration, schema, expectedType, titleField) {
    const where = `${declaration.kind}.${declaration.id}`;

    // 1. The registry will accept it. Its own function, not our reading
    //    of its rules, so this cannot drift from what registration does.
    try {
        validateDeclaration(declaration);
    } catch (error) {
        note(`${where}: registration would refuse this declaration: ${error.message}`);
        return;
    }

    // 2. It still describes the model. A declaration that omits a field
    //    does not fail loudly -- the page lands and that field silently
    //    takes the model's `initial`.
    const declared = new Set((declaration.fields ?? []).map((f) => f.name));
    for (const name of Object.keys(schema)) {
        if (!declared.has(name)) note(`${where}: model field \`${name}\` is not declared`);
    }
    for (const field of declaration.fields ?? []) {
        const known = field.name in schema
            || field.name === titleField
            || typeof field.role === 'string'
            || field.const !== undefined;
        if (!known) note(`${where}: declared field \`${field.name}\` has no counterpart in the model`);
    }

    // 3. The human layer is complete. With the machine shape derived,
    //    this is the check that earns its keep: a field added to the
    //    model appears automatically carrying no guidance, so it goes
    //    from silently absent to loudly undocumented.
    const walk = (fields, prefix = '') => {
        for (const field of fields ?? []) {
            const label = prefix + field.name;
            if (field.const === undefined && !field.guidance) {
                note(`${where}: \`${label}\` has no guidance; it would reach an author as a bare field name`);
            }
            if (field.guidance && (field.guidance.match(/\.\s/g) ?? []).length > 0) {
                note(`${where}: \`${label}\` guidance is more than one sentence`);
            }
            if (field.fields) walk(field.fields, `${label}.`);
        }
    };
    walk(declaration.fields);

    // 4. It builds the right document. Declaring `JournalEntry` produces
    //    an entry carrying a stray `system` object and NO PAGES, which
    //    imports "successfully" and yields nothing.
    const doc = declaration.document ?? {};
    if (doc.documentName !== 'JournalEntryPage') {
        note(`${where}: documentName is \`${doc.documentName}\`, but the declared fields ARE the page`);
    }
    if (doc.type !== expectedType) {
        note(`${where}: declared type \`${doc.type}\` is not the subtype module.json registers`);
    }

    // 5. It can be reached at all. A profile with no selector registers
    //    clean and is then unreachable: no payload can name it.
    const selectors = (declaration.fields ?? []).filter((f) => f.role === 'selector');
    if (selectors.length !== 1) {
        note(`${where}: expected exactly one \`role: 'selector'\` field, found ${selectors.length}`);
    } else if (!(selectors[0].values ?? []).includes(declaration.id)) {
        note(`${where}: selector does not list \`${declaration.id}\`, so no payload could select this profile`);
    }

    // 6. It can say which folder. Without one, every import lands at the
    //    root of the journal directory beside the GM's own organisation.
    if (!(declaration.fields ?? []).some((f) => f.name === 'foldername')) {
        note(`${where}: no \`foldername\` input, so it can only ever write to the root`);
    }
}

const outcomeSchema = OutcomePageModel.defineSchema();
const inspirationSchema = InspirationPageModel.defineSchema();

const critical = buildOutcomeDeclaration(declarationFromModel, 'critical');
const fumble = buildOutcomeDeclaration(declarationFromModel, 'fumble');
const inspiration = buildInspirationDeclaration(declarationFromModel);

checkProfile(critical, outcomeSchema, 'coffee-pub-bibliosoph.outcome', 'title');
checkProfile(fumble, outcomeSchema, 'coffee-pub-bibliosoph.outcome', 'title');
checkProfile(inspiration, inspirationSchema, 'coffee-pub-bibliosoph.inspiration', 'title');

// ---- container rules, which only this caller can judge ------------
//
// The outcome journal names are not stored anywhere and are not a casing
// of the stored value: `minor` is Butchery for a crit and Meek for a
// fumble. So the map must cover every value `severity` can hold, and
// must produce the names the compendium actually ships.
for (const [decl, kind] of [[critical, 'crit'], [fumble, 'fumble']]) {
    const map = decl.document?.containerNameMap ?? {};
    for (const severity of SEVERITIES) {
        const want = SEVERITY_LABELS[kind][severity];
        if (map[severity] !== want) {
            note(`journal.${decl.id}: containerNameMap[${severity}] is \`${map[severity]}\`, expected \`${want}\``);
        }
    }
    if (decl.document?.containerNameFrom !== 'severity') {
        note(`journal.${decl.id}: containerNameFrom should be \`severity\``);
    }
}

// Inspiration is one journal, so it states the name outright. A
// `containerNameFrom` here would have nothing to point at.
if (inspiration.document?.containerName !== 'Inspiration Cards') {
    note(`journal.inspiration: containerName is \`${inspiration.document?.containerName}\`, expected \`Inspiration Cards\``);
}

// ---- report ------------------------------------------------------
console.log('CONTENT PROFILE VERIFIER');
if (errors.length) {
    for (const line of errors) console.log(`  ERROR  ${line}`);
    console.log(`\n  ${errors.length} problem(s).`);
    process.exit(1);
}
const counts = [critical, fumble, inspiration]
    .map((d) => `${d.id} ${d.fields.length} fields`).join(', ');
console.log(`  ${counts}`);
console.log('  critical -> Butchery/Carnage/Slaughter, fumble -> Meek/Nasty/Devastating, inspiration -> Inspiration Cards');
console.log('\n  All three declarations mirror their models and would register. No drift.');
