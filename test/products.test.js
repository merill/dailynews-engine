// The pieces a product repository now gets from the engine instead of copying:
// the documentation source, the clone and backfill commands, the shared
// browser assets, and the reusable workflows.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { normalize } = require('../src/config');
const { ALPHA } = require('./fixtures/profile');

const ROOT = path.join(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value, (key, item) => item instanceof RegExp ? { __re: [item.source, item.flags] } : item),
  (key, item) => item && item.__re ? new RegExp(...item.__re) : item);

test('docs.source defaults to MicrosoftDocs/<docsCloneDir> on main', () => {
  assert.deepEqual({ ...normalize(ALPHA).docs.source }, { owner: 'MicrosoftDocs', repo: 'alpha-docs', branch: 'main' });
});

test('docs.source can name a mirror instead', () => {
  const raw = clone(ALPHA);
  raw.docs.source = { owner: 'someone', repo: 'alpha-docs-mirror' };
  assert.deepEqual({ ...normalize(raw).docs.source }, { owner: 'someone', repo: 'alpha-docs-mirror', branch: 'main' });
  raw.docs.source.branch = '';
  assert.throws(() => normalize(raw), /docs\.source\.branch/);
});

test('clone-docs reads the repository from configuration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dailynews-'));
  const raw = clone(ALPHA);
  raw.docs.source = { owner: 'someone', repo: 'alpha-docs-mirror', branch: 'live' };
  // A config file is CommonJS; RegExps survive by being written as literals.
  const source = `module.exports = ${serialize(raw)};\n`;
  fs.writeFileSync(path.join(dir, 'dailynews.config.js'), source);
  const out = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'dailynews.js'), 'clone-docs', '--print'], { cwd: dir, encoding: 'utf8' });
  assert.equal(out.trim(), `https://github.com/someone/alpha-docs-mirror.git live ${fs.realpathSync(dir)}/alpha-docs`);
});

test('the dispatcher knows the backfill and clone commands', () => {
  const help = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'dailynews.js'), '--help'], { encoding: 'utf8' });
  assert.match(help, /\bbackfill\b/);
  assert.match(help, /\bclone-docs\b/);
});

test('requiring the backfill does not run it', () => {
  // A backfill rewrites every dated report; one that ran on require once
  // overwrote a curated archive during a "does this still load?" check.
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill.js'), 'utf8');
  assert.match(script, /if \(require\.main === module\)/);
  assert.doesNotMatch(script.split('if (require.main === module)')[0], /^main\(\)/m);
});

test('the engine carries every shared browser asset the generator copies', () => {
  const site = fs.readFileSync(path.join(ROOT, 'src', 'static-site.js'), 'utf8');
  const list = site.match(/const SHARED_UI_ASSETS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(name => name.slice(1, -1));
  assert.equal(list.length, 14);
  for (const name of list) assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'site', 'ui', name)), name);
  for (const name of ['learn-diff.js', 'diff-config.js']) assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'site', name)), name);
});

test('the shared compare script names no product', () => {
  // It used to read one product's token key and retitle every compare page
  // with that product's name.
  const source = fs.readFileSync(path.join(ROOT, 'assets', 'site', 'learn-diff.js'), 'utf8');
  assert.doesNotMatch(source, /entra|intune|defender|memdocs|purview/i);
});

test('the reusable workflows pin the setup action to this release', () => {
  const { version } = require('../package.json');
  const dir = path.join(ROOT, '.github', 'workflows');
  const reusable = fs.readdirSync(dir).filter(name => name.startsWith('product-'));
  assert.equal(reusable.length, 4, 'expected monitor, build, verify and test');
  for (const name of reusable) {
    const source = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.match(source, /^\s+workflow_call:/m, `${name} is not reusable`);
    const refs = [...source.matchAll(/merill\/dailynews-engine\/\.github\/actions\/setup@(\S+)/g)].map(match => match[1]);
    assert.ok(refs.length, `${name} does not set up the engine`);
    for (const ref of refs) assert.equal(ref, `v${version}`, `${name} pins setup@${ref}, not v${version}`);
    assert.doesNotMatch(source, /entra|intune|defender|memdocs|purview/i, `${name} names a product`);
    for (const block of source.split(/^\s*(?:-\s*)?run:/m).slice(1)) {
      assert.doesNotMatch(block.split(/^\s*-\s/m)[0], /\$\{\{\s*inputs\./, `${name} interpolates an input into a run block`);
    }
  }
});

function serialize(value) {
  if (value instanceof RegExp) return value.toString();
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}:${serialize(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

test('an optional route group that did not match substitutes nothing', () => {
  const { runRoute } = require('../src/config');
  const routes = [{ match: /^a(-x)?\/(.*)\.md$/, template: 'learn$1/$2' }];
  assert.equal(runRoute(routes, 'a/page.md'), 'learn/page');
  assert.equal(runRoute(routes, 'a-x/page.md'), 'learn-x/page');
});

test('docs.titleSuffix is optional and must be a RegExp', () => {
  assert.equal(normalize(ALPHA).docs.titleSuffix, null);
  const raw = clone(ALPHA);
  raw.docs.titleSuffix = ' | Microsoft Learn';
  assert.throws(() => normalize(raw), /docs\.titleSuffix/);
});

test('the backfill turns a nested subtree into a git pathspec git can match', () => {
  // `Exchange\/ExchangeOnline` reached git with its backslash, matched nothing,
  // and the backfill reported no commits without complaint.
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill.js'), 'utf8');
  const body = source.match(/function trackedSubtrees\(config\) \{([\s\S]*?)\n\}/)[1];
  const trackedSubtrees = new Function('config', body);
  assert.deepEqual(trackedSubtrees({ docs: { trackedPaths: /^(Product\/Online|Product\/Hybrid)\/.+\.md$/ } }),
    ['Product/Online', 'Product/Hybrid']);
});
