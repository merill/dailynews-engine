// The checks every product repository runs against itself.
//
// Each product used to carry its own copy of these tests, edited per product,
// and the copies drifted: one checked for leftover product names and the others
// did not. A product now calls this once and adds only the assertions that are
// genuinely its own (its Learn routes, its classification cases).
//
//   const { defineProductConformance } = require('@merill/dailynews-engine/product-conformance');
//   defineProductConformance({ root: path.join(__dirname, '..'), foreignNames: /\b(other|names)\b/i });
//
// This module names no product: the names a product must not contain are
// passed in by that product.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { normalize, runRoute, runRules } = require('./config');

const FAVICONS = ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'og-image.png'];

function readConfig(root) {
  return require(path.join(root, 'dailynews.config.js'));
}

function workflowSources(root) {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}

function engineRefs(source) {
  return [...source.matchAll(/uses:\s*merill\/dailynews-engine\/[^@\s]+@(\S+)/g)].map(match => match[1]);
}

// Pairs of [repository path, Learn URL] recorded by a learn-mirror crawl, which
// fetched every one of those URLs: the strongest evidence there is of where a
// file publishes. Case is ignored because Learn ignores it and lowercases paths.
function mirrorPages(statePath) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return Object.entries(state.pages || {})
    .filter(([, page]) => page && page.path)
    .map(([url, page]) => [page.path, url]);
}

function defineProductConformance(options) {
  const root = path.resolve(options.root);
  const raw = readConfig(root);
  const config = normalize(raw);
  const assets = path.join(root, 'assets', 'site');
  const foreign = options.foreignNames;

  test('the configuration is valid', () => {
    assert.doesNotThrow(() => normalize(raw));
  });

  test('every product and topic renders a committed SVG', () => {
    for (const [entries, dir] of [[config.taxonomy.products, 'products'], [config.taxonomy.topics, 'topics']]) {
      assert.ok(entries.length, `${dir} should declare at least one entry`);
      for (const entry of entries) {
        assert.equal(path.extname(entry.icon.file), '.svg', `${entry.slug} should name an SVG`);
        const file = path.join(assets, dir, entry.icon.file);
        assert.ok(fs.existsSync(file), `${entry.slug} has no asset at ${file}`);
        assert.match(fs.readFileSync(file, 'utf8'), /^(<\?xml[^>]*\?>\s*)?<svg\b/, `${file} is not an SVG`);
      }
    }
  });

  test('each topic has a drawing of its own', () => {
    const files = config.taxonomy.topics.map(topic => topic.icon.file);
    assert.equal(new Set(files).size, files.length);
  });

  test('every icon records where it came from', () => {
    for (const entry of [...config.taxonomy.products, ...config.taxonomy.topics]) {
      assert.ok(entry.icon.sourcePath, `${entry.slug} records no icon sourcePath`);
      assert.match(entry.icon.match || '', /^(exact|closest|shared)$/, `${entry.slug} icon match`);
    }
  });

  test('the brand and favicon assets are committed', () => {
    for (const name of FAVICONS) assert.ok(fs.existsSync(path.join(assets, name)), `missing assets/site/${name}`);
    for (const name of config.brand.uiAssets) {
      assert.ok(fs.existsSync(path.join(assets, 'ui', name)), `missing assets/site/ui/${name}`);
    }
    assert.ok(config.brand.uiAssets.includes(config.brand.logo), 'brand.logo should be listed in brand.uiAssets');
    const aboutIcon = config.brand.aboutIcon.replace(/^\/assets\//, '');
    assert.ok(fs.existsSync(path.join(assets, aboutIcon)), `brand.aboutIcon ${config.brand.aboutIcon} is not committed`);
  });

  test('every declared product is reachable by classification', () => {
    const reachable = new Set(config.classify.products.map(rule => rule.slug));
    reachable.add(config.taxonomy.defaultProduct);
    for (const product of config.taxonomy.products) {
      assert.ok(reachable.has(product.slug), `${product.slug} has no classification rule`);
    }
  });

  test('fragment directories are never tracked', () => {
    const sample = (options.trackedSamples || [])[0];
    if (!sample) return;
    const base = path.posix.dirname(sample);
    for (const fragment of ['includes/banner.md', 'media/thing.md', 'breadcrumb/toc.md']) {
      assert.equal(config.docs.trackedPaths.test(`${base}/${fragment}`), false, `${base}/${fragment}`);
    }
    for (const tracked of options.trackedSamples) {
      assert.equal(config.docs.trackedPaths.test(tracked), true, tracked);
    }
  });

  if (options.routeCases) {
    test('each sample maps to the Learn path it publishes under', () => {
      for (const [source, target] of Object.entries(options.routeCases)) {
        assert.equal(runRoute(config.docs.learnRoutes, source), target, source);
      }
    });
  }

  if (options.productCases) {
    test('a file classifies to the product it documents', () => {
      for (const [source, slug] of Object.entries(options.productCases)) {
        const [file, title = ''] = Array.isArray(source) ? source : [source];
        assert.equal(runRules(config.classify.products, config.taxonomy.products,
          config.taxonomy.defaultProduct, file, title, '').slug, slug, source);
      }
    });
  }

  // When the documentation clone is a learn-mirror and is present, check every
  // page it recorded. Skipped rather than failed without the clone, so the suite
  // still runs on a laptop that has not cloned it.
  if (options.mirrorState) {
    const statePath = path.resolve(root, options.mirrorState);
    test('every mirrored page routes to the URL the crawl fetched it from', { skip: !fs.existsSync(statePath) && 'no mirror clone' }, () => {
      const exceptions = options.mirrorExceptions || {};
      const wrong = [];
      let checked = 0;
      for (const [file, url] of mirrorPages(statePath)) {
        if (!config.docs.trackedPaths.test(file)) continue;
        checked += 1;
        const learnPath = runRoute(config.docs.learnRoutes, file);
        const routed = `https://learn.microsoft.com/en-us/${learnPath}`.toLowerCase().replace(/\/index$/, '/');
        const expected = url.toLowerCase();
        if (routed === expected) continue;
        if (Object.hasOwn(exceptions, file)) continue;
        wrong.push(`${file} -> ${routed} (crawled ${expected})`);
      }
      assert.ok(checked > 0, 'no mirrored page matched docs.trackedPaths');
      // A page Learn publishes under a slug of its own still answers at the
      // routed URL (Learn redirects), but the list must stay a known one.
      assert.deepEqual(wrong, [], `pages route elsewhere than they publish:\n${wrong.slice(0, 40).join('\n')}`);
    });
  }

  test('every workflow pins the same engine version, to a tag or a sha', () => {
    const refs = new Set();
    for (const [name, source] of workflowSources(root)) {
      for (const ref of engineRefs(source)) {
        assert.match(ref, /^(v\d+\.\d+\.\d+|[0-9a-f]{40})$/, `${name} pins the engine to '${ref}'`);
        refs.add(ref);
      }
    }
    assert.ok(refs.size <= 1, `workflows pin different engine versions: ${[...refs].join(', ')}`);
  });

  test('a workflow that calls the engine monitor lets it request an OIDC token', () => {
    // The monitor authenticates to OpenAI with workload identity federation.
    // A reusable workflow cannot hold more permissions than its caller grants,
    // so without id-token: write every summary silently falls back.
    for (const [name, source] of workflowSources(root)) {
      if (!/workflows\/product-monitor\.yml@/.test(source)) continue;
      assert.match(source, /id-token:\s*write/, `${name} calls product-monitor.yml without granting id-token: write`);
    }
  });

  test('workflow inputs never reach a run block directly', () => {
    for (const [name, source] of workflowSources(root)) {
      for (const block of source.split(/^\s*(?:-\s*)?run:/m).slice(1)) {
        assert.doesNotMatch(block.split(/^\s*-\s/m)[0], /\$\{\{\s*(inputs|github\.event\.inputs)\./,
          `${name} interpolates a workflow input into a run block`);
      }
    }
  });

  if (foreign) {
    test('nothing in this repository names another product', () => {
      // Files are copied between product repositories, and a leftover name is
      // invisible until it reaches a rendered page.
      const offenders = [];
      const files = ['dailynews.config.js', 'package.json', 'README.md'];
      for (const dir of ['scripts', 'src', '.github/workflows']) {
        const base = path.join(root, dir);
        if (!fs.existsSync(base)) continue;
        for (const name of fs.readdirSync(base)) files.push(path.join(dir, name));
      }
      const allowed = options.foreignAllowed || /^$/;
      for (const file of files) {
        const full = path.join(root, file);
        if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
        const text = fs.readFileSync(full, 'utf8');
        // The test that declares the names necessarily contains them.
        if (text.includes('defineProductConformance(')) continue;
        text.split('\n').forEach((line, index) => {
          if (foreign.test(line) && !allowed.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 110)}`);
        });
      }
      assert.deepEqual(offenders, [], `another product is named here:\n${offenders.join('\n')}`);
    });
  }

  return config;
}

module.exports = { defineProductConformance, mirrorPages };
