// ==================================================================
// ===== INJURY PROFILE VERIFIER (tools/verify-injury-profile.mjs) ===
// ==================================================================
// Gate for scripts/data/injury-import-profile.js — the declaration
// Blacksmith's importer uses to build our injury pages.
//
//   node tools/verify-injury-profile.mjs
//
// The checks live in tools/check-declaration-mirrors-model.mjs, which is
// module-agnostic and written to be hosted by Blacksmith. This file is the
// injury-specific half: it stubs the Foundry globals both browser modules
// need at import time, supplies the four things only Bibliosoph knows, and
// reports.
//
// The fourth of those is the one that matters. Without
// `expectedContainerName` and the shipped journal names, a mirror check
// only proves the declaration agrees with itself; the value is that it
// agrees with the data we actually ship.
//
// Exits 1 on any error so it can gate the pack build.
// ==================================================================

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, displayCategory } from './injury-schema.mjs';
// HOSTED BY BLACKSMITH, imported through its contract path rather than
// copied. This file was written here and moved there once it proved
// generic; a local copy was kept only while no import path existed, and
// it forked within the hour -- `isEnvelope` here against `isRoled` there,
// the same rule reached twice under two names. A tool whose whole
// argument is that two descriptions of one thing drift apart should not
// be two descriptions of one thing.
//
// `api/` rather than `tools/` for the same reason as the schema walk:
// `api/` is the sibling-facing directory and is a promise, while `tools/`
// is free to move or gain a dependency.
//
// If the next check belongs in it, add it THERE.
import { checkDeclarationMirrorsModel } from '../../coffee-pub-blacksmith/api/check-declaration-mirrors-model.mjs';
import { validateDeclaration } from '../../coffee-pub-blacksmith/api/validate-declaration.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = pathToFileURL(path.join(ROOT, 'scripts', 'data')).href + '/';

// ---- Foundry / browser stubs -------------------------------------
//
// The profile imports `const.js`, which does a top-level `await fetch` of
// module.json, and the page model extends `foundry.abstract.TypeDataModel`.
// Node has neither. The stubs only need to record what the schema
// declares -- nothing here exercises Foundry behaviour.

globalThis.fetch = async (url) => {
    const body = await readFile(fileURLToPath(url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

// A stub must carry the CLASS DEFAULTS a real field instance would, not
// only the options the model passes. Foundry merges `static _defaults`
// into every instance, so a field carries properties the model never
// mentioned -- and the walk reads the instance, not the model's source.
//
// This was not theoretical. `ArrayField._defaults` is `{min: 0, max:
// Infinity}` (common/data/fields.mjs:1802), so a real `modifiers` field
// carries a numeric `min` that is an ELEMENT COUNT. The walk lifted it
// onto an `array` descriptor and registration rejected it -- while this
// gate passed, because a stub without the defaults built a declaration
// the runtime would never produce. A thin stub does not make the check
// weaker in an obvious way; it makes it check a different object.
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

// `const.js` logs the module banner at import time; keep the output ours.
const realLog = console.log;
console.log = () => {};
const { InjuryPageModel } = await import(DATA + 'injury-page-model.js');
const { buildInjuryDeclaration } = await import(DATA + 'injury-import-profile.js');
console.log = realLog;

// The machine shape of the declaration is DERIVED by Blacksmith's schema
// walk, so the gate needs the same walk the runtime uses -- checking a
// declaration we built differently from the one that ships would verify
// nothing. `api/declaration-from-model.mjs` is a pure re-export with no
// imports of its own, which is what makes it importable here at all; if
// that ever stops being true, this is where it surfaces.
//
// A HARD FAILURE, not a skip. Blacksmith missing means the sibling
// checkout is not where it is expected, and quietly disabling the gate at
// exactly that moment is how a build goes green on a declaration nobody
// checked.
const WALK_PATH = path.join(ROOT, '..', 'coffee-pub-blacksmith', 'api', 'declaration-from-model.mjs');
let declarationFromModel;
try {
    ({ declarationFromModel } = await import(pathToFileURL(WALK_PATH).href));
} catch (error) {
    console.log('\nINJURY PROFILE VERIFIER\n');
    console.log(`  ERROR  Could not import Blacksmith's schema walk from:`);
    console.log(`           ${WALK_PATH}`);
    console.log('         Bibliosoph must sit beside coffee-pub-blacksmith under Data/modules/');
    console.log('         for this gate to run. Refusing to pass without checking.\n');
    console.log(`         (${error.message})\n`);
    process.exit(1);
}

// ---- What only this module knows ---------------------------------

// Blacksmith owns these operations; we mirror the ones we use so the check
// can predict the name the importer will actually produce.
const KNOWN_TRANSFORMS = {
    // What we declare: first character uppercased, everything after it
    // UNTOUCHED. That is `displayCategory` exactly, so the two agree by
    // construction rather than by every category happening to be one word.
    sentenceCase: (value) => value.charAt(0).toUpperCase() + value.slice(1),
    // Every word capitalised, each remainder LOWERED. Agrees with
    // displayCategory on all fourteen categories today and diverges on any
    // interior capital (`coldIron` -> `Coldiron`, not `ColdIron`).
    //
    // Blacksmith's `toSentenceCase` in api-core.js does NOT do sentence
    // case -- it matches this, not `sentenceCase` above. The name there is
    // wrong and depended on, so it stays; do not wire the two together
    // expecting agreement.
    titleCase: (value) => value.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    slug: (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
};

/** The journal names our compendium actually ships, if they can be read. */
async function shippedJournalNames() {
    const packDir = path.join(ROOT, 'packs', '_source', 'injuries');
    try {
        const files = (await readdir(packDir)).filter((f) => f.endsWith('.json'));
        const names = await Promise.all(
            files.map(async (f) => JSON.parse(await readFile(path.join(packDir, f), 'utf8')).name)
        );
        return new Set(names.filter(Boolean));
    } catch {
        return null;
    }
}

// ---- Run ----------------------------------------------------------
//
// THREE CHECKS THAT PROVE DIFFERENT THINGS, in the order a failure is
// cheapest to read:
//
//   declarationFromModel     builds it from the model
//   validateDeclaration      the registry will accept it
//   checkDeclarationMirrors  it still describes the model
//
// The middle one is the registry's OWN function, split out of
// registration rather than copied, so this gate cannot drift from the
// rules by reimplementing part of them. It is what catches a declaration
// that is a faithful description of the model and still illegal -- which
// is how `min` from an ArrayField's element count reached a live console.

const declaration = buildInjuryDeclaration(declarationFromModel);

try {
    validateDeclaration(declaration);
} catch (error) {
    console.log('\nINJURY PROFILE VERIFIER\n');
    console.log('  ERROR  The registry would refuse this declaration at registration:');
    console.log(`           ${error.message}\n`);
    process.exit(1);
}


const { errors, notes } = checkDeclarationMirrorsModel({
    schema: InjuryPageModel.defineSchema(),
    declaration,
    titleField: 'title',
    expectedType: 'coffee-pub-bibliosoph.injury',
    expectedDocumentName: 'JournalEntryPage',
    knownTransforms: KNOWN_TRANSFORMS,
    // The key the journal kind routes payloads on; Blacksmith resolves the
    // registered profile from it via `declaredProfileFor`.
    expectedSelector: 'journaltype',
    expectedContainerName: displayCategory,
    shippedContainerNames: await shippedJournalNames()
});

console.log('\nINJURY PROFILE VERIFIER');
for (const note of notes) console.log(`  ${note}`);

if (errors.length) {
    console.log(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.log(`  ERROR  ${error}`);
    console.log('');
    process.exit(1);
}

console.log(`\n  The declaration mirrors InjuryPageModel across all ${CATEGORIES.length} categories. No drift.\n`);
