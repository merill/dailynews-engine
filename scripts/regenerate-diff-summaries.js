#!/usr/bin/env node

require('dotenv').config();
const path = require('path');
const DocsMonitor = require('../src/monitor-docs');
const { openAIConfigured } = require('../src/openai-client');
const {
  allDocumentationChanges,
  readJson,
  serializeAnalysis,
  writeJsonAtomic
} = require('../src/update-state');

function requestedDates(argumentsList) {
  const argument = argumentsList.find(value => value.startsWith('--dates='));
  if (!argument) throw new Error('Pass one or more recovery dates with --dates=YYYY-MM-DD[,YYYY-MM-DD]');
  const dates = [...new Set(argument.slice('--dates='.length).split(',').map(value => value.trim()).filter(Boolean))];
  if (dates.length === 0 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error('Recovery dates must use YYYY-MM-DD format');
  }
  return dates;
}

async function main() {
  if (!openAIConfigured()) throw new Error('OpenAI is not configured: set up workload identity or OPENAI_API_KEY');
  const dates = requestedDates(process.argv.slice(2));
  const websiteDir = path.resolve(process.env.WEBSITE_DIR || 'website');
  const monitor = new DocsMonitor({ websiteDir });

  // Each date is saved as soon as its summaries are back, and a change the
  // model still fails on after its retry keeps its fallback text rather than
  // failing the run: across thousands of changes a few failures are certain,
  // and throwing used to discard every date the run had already finished.
  // Only changes the model has not written are sent, so a rerun of the same
  // dates picks up just the stragglers.
  let regenerated = 0;
  let unchanged = 0;
  const leftover = [];
  for (const date of dates) {
    const filePath = path.join(websiteDir, `${date}.json`);
    const analysis = await readJson(filePath, null);
    if (!analysis) throw new Error(`No daily report exists for ${date}`);
    const changes = allDocumentationChanges(analysis);
    const pending = changes.filter(change => change.englishSummary?.generatedBy !== 'openai');
    if (pending.length === 0) {
      console.log(`ℹ️ ${date}: ${changes.length ? 'every change already has a model summary' : 'no documentation changes'}; skipping`);
      unchanged += changes.length;
      continue;
    }

    console.log(`🧠 Regenerating ${pending.length} of ${changes.length} diff summary/summaries for ${date}...`);
    await monitor.generateDiffEnglishSummaries(analysis, pending);
    const done = pending.filter(change => change.englishSummary?.generatedBy === 'openai').length;
    regenerated += done;
    if (done < pending.length) {
      leftover.push(date);
      console.warn(`⚠️ ${date}: ${pending.length - done} summary/summaries kept their fallback text; rerun this date to retry them`);
    }
    if (done > 0) {
      analysis.englishSummary = monitor.createFallbackEnglishSummary(analysis);
      await writeJsonAtomic(filePath, serializeAnalysis(analysis));
    }
  }

  console.log(`✅ Regenerated ${regenerated} summary/summaries across ${dates.length} date(s); ${unchanged} already had model summaries.`);
  if (leftover.length) console.log(`↻ Dates still needing a rerun: ${leftover.join(',')}`);
  // Fail only when nothing came back at all: that is a credentials or service
  // problem, not a stray failure.
  if (regenerated === 0 && leftover.length) throw new Error('OpenAI returned no summaries in this run');
}

main().catch(error => {
  console.error(`❌ Unable to regenerate recovered diff summaries: ${error.message}`);
  process.exitCode = 1;
});
