#!/usr/bin/env node

// Clones the product's documentation repository into build.docsCloneDir.
//
// Workflows used to spell the repository out in a `git clone` line of their
// own, once per workflow per product, which is how a product's monitor and its
// verify job came to read different repositories. The source is configuration
// (`docs.source`), so the clone is read from there.
//
//   dailynews clone-docs                   blob-filtered clone, enough to diff
//   dailynews clone-docs --filter=none     every blob, for `dailynews backfill`
//   dailynews clone-docs --print           print the URL and directory only

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../src/config');

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function main() {
  const config = getConfig();
  const { owner, repo, branch } = config.docs.source;
  const url = `https://github.com/${owner}/${repo}.git`;
  const dir = path.resolve(argument('dir', config.build.docsCloneDir));

  if (process.argv.includes('--print')) {
    process.stdout.write(`${url} ${branch} ${dir}\n`);
    return;
  }
  if (fs.existsSync(path.join(dir, '.git'))) {
    console.log(`${dir} is already a clone; leaving it as it is.`);
    return;
  }

  // A blob-filtered clone is all the monitor needs. The backfill reads every
  // historical blob, and a filtered clone fails partway through it with
  // "could not fetch ... from promisor remote", so it asks for none.
  const filter = argument('filter', 'blob:limit=100k');
  const args = ['clone', '--single-branch', '--branch', branch];
  if (filter !== 'none') args.push(`--filter=${filter}`);
  args.push(url, dir);
  console.log(`git ${args.join(' ')}`);
  execFileSync('git', args, { stdio: 'inherit' });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`clone-docs failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
