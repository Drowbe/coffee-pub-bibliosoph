#!/usr/bin/env node
/*
 * wiki-sync.mjs — mirror the publish set of documentation/ into flat GitHub-wiki pages.
 *
 * Ported from coffee-pub-blacksmith/tools/wiki-sync.mjs. Same contract:
 * the wiki is a pure mirror, each published doc becomes a top-level page named by its basename
 * (architecture-injuries.md -> page "architecture-injuries"), so there are no colons and no
 * subdirectories. Inter-doc links are rewritten from repo paths to wiki page names; links to code
 * files, or to docs not in the publish set, are downgraded to plain text so the wiki has no broken
 * red links.
 *
 * Addition over the Blacksmith version: links that reach into a sibling Coffee Pub module's
 * documentation/ are rewritten to that module's public wiki URL instead of being downgraded, so
 * "see architecture-ownership" stays clickable across module boundaries.
 *
 * Source docs are never modified. The publish/downgrade decision is made fresh each run from the
 * PUBLISH list below, so adding a held doc to that list later auto-links every reference to it.
 *
 * Usage:
 *   node tools/wiki-sync.mjs build              # write reviewable pages to tools/.wiki-build/
 *   node tools/wiki-sync.mjs publish            # build, clone the wiki, mirror, commit (NO push)
 *   node tools/wiki-sync.mjs publish <path>     # same, but use an existing wiki clone at <path>
 *
 * After publish: review the staged commit, then push it yourself:
 *   git -C <wiki-path> push
 *
 * NOTE: a GitHub wiki does not exist until its first page is created through the web UI.
 * Until then the clone fails with "Repository not found" — create any page once, then this works.
 *
 * Env: WIKI_URL overrides the wiki git URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'documentation');
const OUT = path.join(ROOT, 'tools', '.wiki-build');
const WIKI_URL = process.env.WIKI_URL || 'https://github.com/Drowbe/coffee-pub-bibliosoph.wiki.git';

// ---- Publish set. Add held docs here as they are finished and verified clean. ----
const PUBLISH = [
  // Architecture — state of now, written from source
  'architecture/architecture-bibliosoph.md',
  'architecture/architecture-injuries.md',
  'architecture/architecture-outcomes.md',
  'architecture/architecture-inspiration.md',
  'architecture/architecture-toasts.md',
  'architecture/architecture-encounters.md',
  'architecture/architecture-messages.md',
  // Content contracts — read by the authoring prompt, generator, validator and page sheets
  'spec-injury-schema.md',
  'spec-outcome-schema.md',
  'spec-inspiration-schema.md',
];

// Held out of the publish set (documented so intent is explicit; move into PUBLISH when ready):
//   investigation-spec.md                    — spec for unbuilt work, not a consumer doc
//
// Cross-module notes are no longer kept as files at all (suite rule, 2026-08-07): decisions and rules
// live in the doc that owns them, and anything needing a reply is sent as a message. Nothing to hold.

const HOME_SRC = 'architecture/README.md';

const pageName = (p) => path.basename(p, '.md');
const publishedPages = new Set([...PUBLISH.map(pageName), 'Home']);

// Clean sidebar label: strip the architecture-/spec- prefix, kebab -> Sentence case.
function label(rel) {
  if (rel === 'architecture/architecture-bibliosoph.md') return 'Core';
  const base = pageName(rel).replace(/^(architecture|spec|guide)-/, '');
  const spaced = base.replace(/-/g, ' ').replace(/ schema$/, '');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---- Cross-module links: ONE PREDICATE ENFORCES ALL THREE DIRECTIONS ----
//
// Suite rule (Blacksmith TODO-GLOBAL Ground Rule 2), stated as directions:
//   satellite -> Blacksmith   ALLOWED. Blacksmith is a required dependency of every satellite, so the
//                             coupling already exists and is mandatory; the link only makes it legible.
//   Blacksmith -> satellite   REFUSED. Couples the hub to something optional that may not be installed.
//   satellite -> satellite    REFUSED. Two optional things, neither guaranteed present.
//
// Kept identical to the hub's copy so the rule reads the same wherever you find it. The predicate is the
// whole of it: rewrite only when the TARGET is the hub and WE are not the hub. An earlier version here
// carried a map of sibling wikis, which would have permitted satellite -> satellite; testing the target
// against HUB rather than against a list refuses that for free.
//
// FRAGILITY WORTH KNOWING: an inbound link targets a page NAME from the hub's PUBLISH list. A doc that
// leaves that list, or is renamed, silently 404s every inbound link in the suite. The hub's PUBLISH is
// therefore a contract with us. Pages we currently depend on: architecture-ownership, guide-dnd5e-conditions.
const HUB = 'coffee-pub-blacksmith';
const THIS_MODULE = 'coffee-pub-bibliosoph';
const HUB_WIKI = 'https://github.com/Drowbe/coffee-pub-blacksmith/wiki';
const SIBLING_DOC = /coffee-pub-([a-z]+)[\\/]documentation[\\/](?:[^)]*[\\/])?([^/\\)]+)\.md(#.+)?$/i;

function siblingWikiUrl(target) {
  const m = target.match(SIBLING_DOC);
  if (!m) return null;
  const targetModule = `coffee-pub-${m[1].toLowerCase()}`;
  if (targetModule !== HUB) return null;      // -> satellite: refused, whoever is asking
  if (THIS_MODULE === HUB) return null;       // hub -> anywhere: refused
  return `${HUB_WIKI}/${m[2]}${m[3] || ''}`;
}

// ---- Fence-aware link rewriting ----
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const CODE_LINK = /\.(js|mjs|css|hbs|json|txt|webp|png)(#.*)?$/i;
const CODE_PATH = /(scripts|styles|templates|resources|packs)\//;

function rewriteLinks(md, srcRel) {
  const lines = md.split(/\r?\n/);
  let inFence = false;
  const downgraded = [];
  const rewritten = lines.map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    return line.replace(LINK, (whole, text, target) => {
      if (/^(https?:|mailto:|#)/i.test(target)) return whole;        // external / same-page anchor

      const sibling = siblingWikiUrl(target);                        // cross-module doc -> sibling wiki
      if (sibling) return `[${text}](${sibling})`;

      if (CODE_LINK.test(target) || CODE_PATH.test(target)) {         // code / asset -> plain text
        downgraded.push(`${srcRel}: code -> text  (${target})`);
        return text;
      }
      const m = target.match(/([^/]+)\.md(#.+)?$/i);                 // .md doc link
      if (m) {
        const name = m[1];
        const anchor = m[2] || '';
        // If the visible text is just a bare filename, drop its .md too.
        const clean = /^[\w-]+\.md$/.test(text) ? text.replace(/\.md$/, '') : text;
        if (publishedPages.has(name)) return `[${clean}](${name}${anchor})`;
        downgraded.push(`${srcRel}: unpublished -> text  (${target})`);
        return clean;
      }
      return whole;
    });
  });
  return { md: rewritten.join('\n'), downgraded };
}

function readRewriteWrite(rel, outName) {
  const md = fs.readFileSync(path.join(DOCS, rel), 'utf8');
  const { md: out, downgraded } = rewriteLinks(md, rel);
  fs.writeFileSync(path.join(OUT, outName), out);
  return downgraded;
}

function buildSidebar() {
  const group = (prefix) =>
    PUBLISH.filter((p) => p.startsWith(prefix))
      .map((rel) => `- [${label(rel)}](${pageName(rel)})`)
      .join('\n');
  const specs = PUBLISH.filter((p) => !p.includes('/'))
    .map((rel) => `- [${label(rel)}](${pageName(rel)})`)
    .join('\n');
  return [
    '### Getting started',
    '- [Home](Home)',
    '',
    '### Architecture',
    group('architecture/'),
    '',
    '### Content contracts',
    specs,
    '',
    '### Elsewhere',
    '- [Blacksmith wiki](https://github.com/Drowbe/coffee-pub-blacksmith/wiki)',
    '',
  ].join('\n');
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const downgrades = [];
  for (const rel of PUBLISH) downgrades.push(...readRewriteWrite(rel, `${pageName(rel)}.md`));
  downgrades.push(...readRewriteWrite(HOME_SRC, 'Home.md'));
  fs.writeFileSync(path.join(OUT, '_Sidebar.md'), buildSidebar());

  console.log(`Built ${PUBLISH.length} pages + Home + _Sidebar into ${path.relative(ROOT, OUT)}/`);
  const unique = [...new Set(downgrades)].sort();
  if (unique.length) {
    console.log(`\n${unique.length} link(s) downgraded to plain text (target not published):`);
    for (const d of unique) console.log('  ' + d);
    console.log('These auto-become links again once their target is added to PUBLISH.');
  }
}

function publish(wikiPathArg) {
  build();

  let wiki = wikiPathArg;
  if (!wiki) {
    wiki = path.join(ROOT, 'tools', '.wiki-repo');
    // Reuse an existing clone rather than deleting it: on Windows, git's object store is
    // read-only and fs.rmSync fails with EPERM even with force. A fetch + hard reset gets
    // the same clean slate, and is faster besides.
    if (fs.existsSync(path.join(wiki, '.git'))) {
      console.log(`\nRefreshing existing clone: ${path.relative(ROOT, wiki)}`);
      execFileSync('git', ['-C', wiki, 'fetch', 'origin'], { stdio: 'inherit' });
      const head = execFileSync('git', ['-C', wiki, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
      execFileSync('git', ['-C', wiki, 'reset', '--hard', `origin/${head}`], { stdio: 'inherit' });
      execFileSync('git', ['-C', wiki, 'clean', '-fd'], { stdio: 'inherit' });
    } else {
      fs.rmSync(wiki, { recursive: true, force: true });
      console.log(`\nCloning wiki: ${WIKI_URL}`);
      try {
        execFileSync('git', ['clone', WIKI_URL, wiki], { stdio: 'inherit' });
      } catch {
        console.error('\nClone failed. A GitHub wiki does not exist until its first page is created');
        console.error('through the web UI. Create any page once, then re-run this command.');
        process.exit(1);
      }
    }
  } else if (!fs.existsSync(path.join(wiki, '.git'))) {
    console.error(`Not a git clone: ${wiki}`);
    process.exit(1);
  }

  // Mirror: remove existing pages (keep .git), copy the fresh build in.
  for (const f of fs.readdirSync(wiki)) {
    if (f === '.git') continue;
    fs.rmSync(path.join(wiki, f), { recursive: true, force: true });
  }
  for (const f of fs.readdirSync(OUT)) {
    fs.copyFileSync(path.join(OUT, f), path.join(wiki, f));
  }

  execFileSync('git', ['-C', wiki, 'add', '-A'], { stdio: 'inherit' });
  const status = execFileSync('git', ['-C', wiki, 'status', '--porcelain'], { encoding: 'utf8' });
  if (!status.trim()) {
    console.log('\nWiki already up to date — nothing to commit.');
    return;
  }
  execFileSync('git', ['-C', wiki, 'commit', '-m', 'Sync wiki from documentation/'], { stdio: 'inherit' });
  console.log(`\nStaged + committed in ${wiki}`);
  console.log('Review the commit, then push it yourself:');
  console.log(`  git -C "${wiki}" push`);
}

const mode = process.argv[2] || 'build';
if (mode === 'build') build();
else if (mode === 'publish') publish(process.argv[3]);
else {
  console.error('usage: node tools/wiki-sync.mjs [build | publish [wikiClonePath]]');
  process.exit(1);
}
