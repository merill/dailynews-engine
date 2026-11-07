#!/usr/bin/env node

// Removes changes that touched only a page's front matter from saved daily
// reports. Until v1.4.3 the monitor recognised a metadata-only change only when
// its diff began on line one, so a date or taxonomy-link change further down a
// long front matter block was reported, summarised and briefed as an update.
//
//   dailynews prune-metadata --dates=2026-11-06[,2026-11-07]
//
// It reads the documentation clone the monitor uses (LOCAL_REPO_PATH, or the
// product's build.docsCloneDir, where `dailynews clone-docs` and the workflows
// put it) and compares each modified
// page's body before and after its commit, the same test the monitor now runs.
// Run it before `dailynews summaries --dates=... --force` so the briefs are
// rewritten from what remains.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const DocsMonitor = require('../src/monitor-docs');
const { getConfig } = require('../src/config');
const { readJson, serializeAnalysis, writeJsonAtomic } = require('../src/update-state');

function requestedDates(argumentsList) {
  const argument = argumentsList.find(value => value.startsWith('--dates='));
  if (!argument) throw new Error('Pass the report dates with --dates=YYYY-MM-DD[,YYYY-MM-DD]');
  const dates = [...new Set(argument.slice('--dates='.length).split(',').map(value => value.trim()).filter(Boolean))];
  if (dates.length === 0 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error('Report dates must use YYYY-MM-DD format');
  }
  return dates;
}

async function main() {
  const dates = requestedDates(process.argv.slice(2));
  const websiteDir = path.resolve(process.env.WEBSITE_DIR || 'website');
  const monitor = new DocsMonitor({ websiteDir });
  monitor.localRepoPath = process.env.LOCAL_REPO_PATH || `./${getConfig().build.docsCloneDir}`;
  if (!fs.existsSync(path.join(monitor.localRepoPath, '.git'))) {
    throw new Error(`No documentation clone at ${monitor.localRepoPath}; run dailynews clone-docs first`);
  }
  monitor.git = require('simple-git')(monitor.localRepoPath);

  let removed = 0;
  for (const date of dates) {
    const filePath = path.join(websiteDir, `${date}.json`);
    const analysis = await readJson(filePath, null);
    if (!analysis) {
      console.log(`ℹ️ ${date}: no daily report; skipping`);
      continue;
    }
    const kept = [];
    for (const file of analysis.modifiedFiles || []) {
      if (await monitor.isFrontMatterOnlyChange(file, file.baseCommitSha, file.commitSha, file.patch)) continue;
      kept.push(file);
    }
    const dropped = (analysis.modifiedFiles || []).length - kept.length;
    if (dropped === 0) {
      console.log(`ℹ️ ${date}: no metadata-only changes`);
      continue;
    }
    analysis.modifiedFiles = kept;
    if (analysis.summary) {
      analysis.summary.totalFiles = analysis.newFiles.length + kept.length + analysis.deletedFiles.length;
    }
    analysis.englishSummary = monitor.createFallbackEnglishSummary(analysis);
    await writeJsonAtomic(filePath, serializeAnalysis(analysis));
    removed += dropped;
    console.log(`🧹 ${date}: removed ${dropped} metadata-only change(s); ${kept.length} modified page(s) remain`);
  }
  console.log(`✅ Removed ${removed} metadata-only change(s) across ${dates.length} date(s).`);
}

main().catch(error => {
  console.error(`❌ Unable to prune metadata-only changes: ${error.message}`);
  process.exitCode = 1;
});
