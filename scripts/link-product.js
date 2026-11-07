#!/usr/bin/env node

// Links this engine checkout into a product repository's node_modules, for
// local development. In CI the setup action does this.
//
//   node ../dailynews-engine/scripts/link-product.js      (run from the product)
//
// Every product carried an identical copy of this as scripts/link-engine.js;
// it lives here now, beside the engine it links.

const fs = require('fs');
const path = require('path');

const engine = path.resolve(__dirname, '..');
const product = process.cwd();
if (!fs.existsSync(path.join(product, 'dailynews.config.js'))) {
  console.error(`${product} has no dailynews.config.js; run this from a product repository.`);
  process.exit(1);
}

const modules = path.join(product, 'node_modules');
const link = path.join(modules, '@merill', 'dailynews-engine');
fs.mkdirSync(path.dirname(link), { recursive: true });
fs.rmSync(link, { recursive: true, force: true });
fs.symlinkSync(engine, link, 'junction');

// npm resolves `dailynews` in the product's scripts from node_modules/.bin, and
// only creates that shim for a package it installed itself.
const bin = path.join(modules, '.bin');
const shim = path.join(bin, 'dailynews');
fs.mkdirSync(bin, { recursive: true });
fs.rmSync(shim, { force: true });
fs.symlinkSync(path.join(engine, 'bin', 'dailynews.js'), shim);
fs.chmodSync(path.join(engine, 'bin', 'dailynews.js'), 0o755);

if (!fs.existsSync(path.join(engine, 'node_modules'))) {
  console.warn(`Linked, but ${engine} has no node_modules: run npm ci there.`);
}
console.log(`@merill/dailynews-engine -> ${engine}`);
