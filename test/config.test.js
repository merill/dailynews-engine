const assert = require('node:assert/strict');
const test = require('node:test');
const { normalize, setConfig, resetConfig, runRules, runRoute } = require('../src/config');
const { ALPHA, BETA } = require('./fixtures/profile');

test.afterEach(() => resetConfig());

test('both fixture profiles normalise', () => {
  for (const raw of [ALPHA, BETA]) assert.doesNotThrow(() => normalize(raw));
});

test('a missing required field names itself and the product it belongs to', () => {
  const broken = structuredCloneish(ALPHA);
  delete broken.identity.kitMarkerPrefix;
  assert.throws(() => normalize(broken), /identity\.kitMarkerPrefix/);
});

test('a site url with a trailing slash is rejected', () => {
  const broken = structuredCloneish(ALPHA);
  broken.site.url = 'https://alpha.test/';
  assert.throws(() => normalize(broken), /site\.url must not end with a slash/);
});

test('a default that names an undeclared slug is rejected', () => {
  const broken = structuredCloneish(ALPHA);
  broken.taxonomy.defaultTopic = 'not-declared';
  assert.throws(() => normalize(broken), /defaultTopic 'not-declared' is not a declared topic/);
});

test('an icon may be a bare filename, an object, or omitted entirely', () => {
  const raw = structuredCloneish(ALPHA);
  raw.taxonomy.products[0].icon = 'explicit.svg';
  delete raw.taxonomy.topics[0].icon;
  const config = normalize(raw);
  assert.equal(config.taxonomy.products[0].icon.file, 'explicit.svg');
  assert.equal(config.taxonomy.products[0].icon.sourceName, null);
  // An omitted file falls back to the slug, which is the convention every
  // topic icon follows.
  assert.equal(config.taxonomy.topics[0].icon.file, 'general.svg');
});

test('a product that adds no chrome of its own declares an empty list', () => {
  assert.deepEqual(normalize(ALPHA).brand.uiAssets, []);
});

test('classification rules are first match wins, with a negative guard', () => {
  const config = normalize({
    ...ALPHA,
    taxonomy: {
      ...ALPHA.taxonomy,
      topics: [
        { slug: 'general', name: 'General' },
        { slug: 'access', name: 'Access' }
      ]
    },
    classify: {
      products: [],
      topics: [
        { slug: 'access', scope: 'title', match: /\baccess\b/, unless: /\bno access\b/ }
      ]
    }
  });
  const pick = title => runRules(config.classify.topics, config.taxonomy.topics,
    config.taxonomy.defaultTopic, 'file.md', title, '').slug;
  assert.equal(pick('Conditional access rules'), 'access');
  assert.equal(pick('There is no access here'), 'general');
  assert.equal(pick('Something else'), 'general');
});

test('routes substitute captured groups and fall through to null', () => {
  const routes = normalize(ALPHA).docs.learnRoutes;
  assert.equal(runRoute(routes, 'docs/identity/overview.md'), 'alpha/identity/overview');
  assert.equal(runRoute(routes, 'README.md'), null);
});

test('setConfig replaces the memoised singleton', () => {
  assert.equal(setConfig(ALPHA).site.productName, 'Alphaproduct');
  assert.equal(setConfig(BETA).site.productName, 'Zetaproduct');
});

test('the two fixture profiles share no product vocabulary', () => {
  // The point of two profiles: a value that leaks from one into the other's
  // rendered output is caught by name.
  const alpha = JSON.stringify(normalize(ALPHA), replacer);
  const beta = JSON.stringify(normalize(BETA), replacer);
  assert.ok(!alpha.toLowerCase().includes('zeta'));
  assert.ok(!beta.toLowerCase().includes('alpha'));
});

function replacer(key, value) {
  return value instanceof RegExp ? String(value) : (value instanceof Set ? [...value] : value);
}

// A deep clone that carries RegExps through, which structuredClone does not.
function structuredCloneish(value) {
  if (Array.isArray(value)) return value.map(structuredCloneish);
  if (value instanceof RegExp || value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, structuredCloneish(inner)]));
}
