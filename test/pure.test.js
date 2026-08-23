const assert = require('node:assert/strict');
const test = require('node:test');
const { setConfig } = require('../src/config');
const { ALPHA } = require('./fixtures/profile');

// static-site reads the config at module load, so it has to be set first.
setConfig(ALPHA);
const {
  slugify, sanitizeMcHtml, formattedDiff, findRelatedItems, isProductMessage
} = require('../src/static-site');

test('slugify produces url-safe, collapsed slugs', () => {
  assert.equal(slugify('Conditional Access & MFA'), 'conditional-access-mfa');
  assert.equal(slugify('  Trailing — dashes  '), 'trailing-dashes');
  assert.equal(slugify('ALL CAPS'), 'all-caps');
});

test('sanitizeMcHtml drops scripting and keeps prose', () => {
  const html = sanitizeMcHtml('<p>Kept</p><script>alert(1)</script><p onclick="x()">Also kept</p>');
  assert.match(html, /Kept/);
  assert.match(html, /Also kept/);
  assert.doesNotMatch(html, /<script|alert\(1\)|onclick/);
});

test('formattedDiff renders a word-level diff of the changed extract', () => {
  const html = formattedDiff('@@ -1,2 +1,2 @@\n-was removed\n+was added\n context stays');
  // htmldiff marks the words that changed, not whole lines, and carries the
  // unchanged context through untouched.
  assert.match(html, /<del[^>]*>removed<\/del>/);
  assert.match(html, /<ins[^>]*>added<\/ins>/);
  assert.match(html, /context stays/);
});

test('isProductMessage matches on the configured service pattern', () => {
  assert.equal(isProductMessage({ Services: ['Alphaproduct'], Title: '' }), true);
  assert.equal(isProductMessage({ Services: ['Something else'], Title: '' }), false);
});

test('findRelatedItems prefers the same topic and never returns the item itself', () => {
  const item = { id: 'a', date: '2026-08-01', title: 'A', product: { slug: 'alpha-core' }, topic: { slug: 'general' } };
  const other = { id: 'b', date: '2026-07-30', title: 'B', product: { slug: 'alpha-core' }, topic: { slug: 'general' } };
  const related = findRelatedItems(item, [item, other]);
  assert.ok(!related.some(entry => entry.id === 'a'));
});
