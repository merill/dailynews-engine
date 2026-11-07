const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const simpleGit = require('simple-git');
const { setConfig } = require('../src/config');
const { ALPHA } = require('./fixtures/profile');

setConfig(ALPHA);
const DocsMonitor = require('../src/monitor-docs');
const { markdownBody } = DocsMonitor;

// Front matter the length of a learn-mirror page: long enough that a change to
// ms.date or the taxonomy links produces a hunk that starts well below line one.
function page({ date = '2026-05-24', products = ['a', 'b', 'c'], body = '# Devices\n\nEnroll devices before you assign policy.\n' } = {}) {
  return [
    '---',
    'title: Devices pillar',
    ...Array.from({ length: 12 }, (_, index) => `key${index}: value ${index}`),
    `ms.date: ${date}T00:00:00.0000000Z`,
    'ms.service: security',
    ...Array.from({ length: 8 }, (_, index) => `other${index}: ${index}`),
    'cmProducts:',
    ...products.map(product => `- https://example.poolparty.biz/devrel/${product}`),
    'platformId: 5a644632',
    '---',
    '',
    body
  ].join('\n');
}

async function repoWith(revisions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'front-matter-'));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test');
  const shas = [];
  for (const [index, content] of revisions.entries()) {
    fs.writeFileSync(path.join(dir, 'page.md'), content);
    await git.add('page.md');
    await git.commit(`revision ${index}`);
    shas.push((await git.revparse(['HEAD'])).trim());
  }
  const monitor = Object.create(DocsMonitor.prototype);
  monitor.git = git;
  return { monitor, git, shas, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('markdownBody drops front matter and normalises whitespace', () => {
  assert.equal(markdownBody('---\na: 1\n---\n\n# Title  \r\nText\n'), '# Title\nText');
  assert.equal(markdownBody('# No metadata\n'), '# No metadata');
  assert.equal(markdownBody(''), '');
});

test('a date and taxonomy change deep in long front matter is metadata only', async () => {
  const { monitor, git, shas, cleanup } = await repoWith([
    page(),
    page({ date: '2026-11-06', products: ['z'] })
  ]);
  try {
    const patch = await git.show(['--format=', shas[1], '--', 'page.md']);
    // The old patch heuristic is what let these through.
    assert.equal(monitor.isOnlyFrontMatterChanges(patch, 'page.md'), false);
    assert.equal(await monitor.isFrontMatterOnlyChange({ filename: 'page.md', status: 'modified' }, shas[0], shas[1], patch), true);
  } finally {
    cleanup();
  }
});

test('a body change is kept even when the metadata changes too', async () => {
  const { monitor, shas, cleanup } = await repoWith([
    page(),
    page({ date: '2026-11-06', body: '# Devices\n\nEnroll devices, then assign compliance policy.\n' })
  ]);
  try {
    assert.equal(await monitor.isFrontMatterOnlyChange({ filename: 'page.md', status: 'modified' }, shas[0], shas[1], ''), false);
  } finally {
    cleanup();
  }
});

test('new pages and non-Markdown files are never treated as metadata only', async () => {
  const monitor = Object.create(DocsMonitor.prototype);
  assert.equal(await monitor.isFrontMatterOnlyChange({ filename: 'page.md', status: 'added' }, 'a', 'b', ''), false);
  assert.equal(await monitor.isFrontMatterOnlyChange({ filename: 'toc.yml', status: 'modified' }, 'a', 'b', ''), false);
});

test('without a readable base revision it falls back to the patch', async () => {
  const { monitor, shas, cleanup } = await repoWith([page()]);
  try {
    const patch = '@@ -1,3 +1,3 @@\n ---\n-ms.date: 2026-05-24\n+ms.date: 2026-11-06\n ---\n';
    assert.equal(await monitor.isFrontMatterOnlyChange({ filename: 'page.md', status: 'modified' }, 'deadbeef', shas[0], patch), true);
  } finally {
    cleanup();
  }
});
