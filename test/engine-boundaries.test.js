const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');

function engineSources() {
  const files = [];
  for (const dir of ['src', 'scripts', 'bin']) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (name.endsWith('.js')) files.push(path.join(dir, name));
    }
  }
  files.push('index.js');
  return files;
}

test('no engine source names a product', () => {
  // This is the check that the convergence gate could not make. Comparing the
  // two product repositories with the product name normalised away made a
  // literal invisible by construction: both held the same code with their own
  // name baked in. Here there is nothing to normalise — a product name in the
  // engine is simply wrong, and the first extraction attempt found forty-one
  // of them.
  const named = /entra|intune|defender|\bmemdocs\b/i;
  const offenders = [];
  for (const file of engineSources()) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    source.split('\n').forEach((line, index) => {
      if (named.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [], `product names in engine sources:\n${offenders.join('\n')}`);
});

test('the engine ships no Microsoft Graph email capability', () => {
  // package-lock.json is checked as well as package.json: once the products
  // depend on the engine rather than on these packages directly, package.json
  // alone stops naming what actually gets installed.
  const banned = /@azure\/msal-node|@microsoft\/microsoft-graph-client|graph\.microsoft\.com|sendMail|AZURE_CLIENT_ID|Mail\.Send/;
  const files = [...engineSources(), 'package.json', 'package-lock.json'];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, banned, `${file} reintroduces Graph email`);
  }
});

test('the dependency set is exactly what the engine declares it to be', () => {
  // Stated as a rule in the README: adding a runtime dependency is a deliberate
  // act, not something that arrives with a refactor.
  const declared = Object.keys(require(path.join(ROOT, 'package.json')).dependencies).sort();
  assert.deepEqual(declared, [
    'diff', 'dotenv', 'marked', 'moment-timezone',
    'node-html-parser', 'node-htmldiff', 'openai', 'pagefind', 'simple-git'
  ]);
});

test('nothing outside the exports map is reachable', () => {
  assert.throws(() => require.resolve('@merill/dailynews-engine/src/static-site'), /ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find/);
});

test('every exported subpath resolves', () => {
  const { exports: map } = require(path.join(ROOT, 'package.json'));
  for (const [subpath, target] of Object.entries(map)) {
    assert.ok(fs.existsSync(path.join(ROOT, target)), `${subpath} -> ${target} is missing`);
  }
});
