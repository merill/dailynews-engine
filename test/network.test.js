'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { HOME, EDITIONS, currentEdition, networkBar, networkFooter } = require('../src/network');

test('every edition has a unique key and https host', () => {
  const keys = new Set();
  const hosts = new Set();
  for (const edition of EDITIONS) {
    const url = new URL(edition.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.pathname, '/', `${edition.key} url should be a bare origin`);
    assert.ok(!keys.has(edition.key) && !hosts.has(url.host), `${edition.key} is listed twice`);
    keys.add(edition.key);
    hosts.add(url.host);
    assert.match(edition.name, /^Daily .+ News$/);
  }
});

test('the bar marks the current edition and links home', () => {
  const html = networkBar('daily.purview.admin.news');
  assert.ok(html.includes(`href="${HOME.url}/"`));
  const current = html.match(/<a [^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g);
  assert.equal(current.length, 1);
  assert.match(current[0], />Purview</);
  // The current edition links to its own root, the others to their sites.
  assert.match(current[0], /href="\/"/);
  assert.ok(html.includes('href="https://daily.entra.news/"'));
});

test('an unlisted host renders the bar with nothing current', () => {
  assert.equal(currentEdition('example.com'), null);
  assert.ok(!networkBar('example.com').includes('aria-current="page"'));
  assert.ok(!networkFooter('example.com').includes('aria-current="page"'));
});

test('the footer lists every edition', () => {
  const html = networkFooter('daily.teams.admin.news');
  for (const edition of EDITIONS) assert.ok(html.includes(`>${edition.label}</a>`), edition.label);
});
