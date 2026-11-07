#!/usr/bin/env node

// Generates a product's favicons, header logo and Open Graph card from one mark.
//
//   dailynews brand-assets --mark=<file.svg|file.png> [--logo=<name>.png]
//
// Writes into assets/site/: favicon.ico, favicon-16x16.png, favicon-32x32.png,
// apple-touch-icon.png, og-image.png, og-background.png and ui/<brand.logo>.
// The card follows the shared Daily.*.News layout: paper background, green rules
// top and bottom, the mark, the site name in the serif and a one-line deck.
//
// A local authoring tool, not part of a build: it needs `rsvg-convert` (librsvg)
// on PATH and the Iowan Old Style / Aptos-or-system fonts the site uses. Its
// output is committed, so CI never runs it.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getConfig } = require('../src/config');

const PAPER = '#f7f5ef';
const RULE = '#0d5745';
const INK = '#151b1f';
const MUTED = '#5d6864';

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// The mark as something an SVG can place: inline when it is SVG (so it stays
// vector), a data URI when it is a bitmap.
function markHref(file) {
  const type = path.extname(file).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png';
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

function render(svg, out, width, height) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dailynews-brand-')), 'in.svg');
  fs.writeFileSync(tmp, svg);
  execFileSync('rsvg-convert', ['-w', String(width), '-h', String(height), '-o', out, tmp]);
}

function square(mark, size, padding) {
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<image x="${padding}" y="${padding}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid meet" xlink:href="${markHref(mark)}"/></svg>`;
}

function card(mark, title, deck) {
  // Long names step the title down rather than running off the card.
  const titleSize = title.length > 22 ? Math.round(84 * 22 / title.length) : 84;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="${PAPER}"/>` +
    `<rect width="1200" height="10" fill="${RULE}"/><rect y="620" width="1200" height="10" fill="${RULE}"/>` +
    `<image x="96" y="188" width="144" height="144" preserveAspectRatio="xMidYMid meet" xlink:href="${markHref(mark)}"/>` +
    `<text x="90" y="430" fill="${INK}" font-family="Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif" font-weight="700" font-size="${titleSize}">${escapeXml(title)}</text>` +
    `<text x="90" y="491" fill="${MUTED}" font-family="Aptos, Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="29">${escapeXml(deck)}</text>` +
    `</svg>`;
}

// An .ico holding PNG entries, which every current browser reads.
function writeIco(out, pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  fs.writeFileSync(out, Buffer.concat([header, ...entries, ...pngs.map(png => png.data)]));
}

function main() {
  const config = getConfig();
  const mark = path.resolve(argument('mark', ''));
  if (!fs.existsSync(mark)) throw new Error('--mark=<file.svg|file.png> is required');
  const dir = path.resolve(argument('out', 'assets/site'));
  fs.mkdirSync(path.join(dir, 'ui'), { recursive: true });

  const deck = argument('deck', `What changed across ${config.site.productName} documentation`);
  const og = card(mark, config.site.name, deck);
  render(og, path.join(dir, 'og-image.png'), 1200, 630);
  fs.copyFileSync(path.join(dir, 'og-image.png'), path.join(dir, 'og-background.png'));

  render(square(mark, 64, 2), path.join(dir, 'ui', argument('logo', config.brand.logo)), 64, 64);
  render(square(mark, 180, 18), path.join(dir, 'apple-touch-icon.png'), 180, 180);
  const icons = [];
  for (const size of [16, 32]) {
    const file = path.join(dir, `favicon-${size}x${size}.png`);
    render(square(mark, size, 0), file, size, size);
    icons.push({ size, data: fs.readFileSync(file) });
  }
  writeIco(path.join(dir, 'favicon.ico'), icons);
  console.log(`Wrote favicons, ui/${config.brand.logo} and the Open Graph card into ${dir}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`brand-assets failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
