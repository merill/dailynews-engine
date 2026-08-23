#!/usr/bin/env node

// Dispatcher for the engine's command line entry points.
//
// Each subcommand runs its script in a child process rather than requiring it.
// The scripts are the same files a product repository used to run directly with
// `node scripts/<name>.js`, and some of them guard their entry on
// `require.main === module`. Spawning keeps that guard true, so a script behaves
// identically whether it is reached through this dispatcher or run by path —
// which is what makes the cutover verifiable rather than merely plausible.

const path = require('path');
const { spawn } = require('child_process');

const COMMANDS = {
  monitor: '../src/monitor-docs.js',
  'build-site': '../scripts/build-static-site.js',
  'search-index': '../scripts/build-search-index.js',
  summaries: '../scripts/generate-period-summaries.js',
  'publish-kit': '../scripts/publish-kit-broadcast.js',
  'regenerate-diffs': '../scripts/regenerate-diff-summaries.js',
  serve: '../scripts/serve-site.js'
};

const [command, ...rest] = process.argv.slice(2);

function usage(stream, code) {
  stream.write(`Usage: dailynews <command> [options]\n\nCommands:\n${
    Object.keys(COMMANDS).map(name => `  ${name}`).join('\n')
  }\n\nRun from a product repository: the working directory is where
dailynews.config.js, assets/site and website are read and written.\n`);
  process.exit(code);
}

if (!command || command === '--help' || command === '-h') usage(process.stdout, 0);
if (!Object.hasOwn(COMMANDS, command)) {
  process.stderr.write(`dailynews: unknown command '${command}'\n\n`);
  usage(process.stderr, 2);
}

const child = spawn(process.execPath, [path.join(__dirname, COMMANDS[command]), ...rest], {
  stdio: 'inherit'
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
child.on('error', error => {
  console.error(error);
  process.exit(1);
});
