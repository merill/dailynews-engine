#!/usr/bin/env node

// Deterministic backfill: walks the documentation repository's history and
// writes the dated reports, monitor state and period briefs a new product starts
// from. It makes no OpenAI calls, so it costs nothing; `dailynews
// regenerate-diffs` can enrich the result afterwards.
//
//   dailynews backfill --start=YYYY-MM-DD [--end=YYYY-MM-DD] [--repo=<clone>]
//
// It needs a clone with real blobs (`dailynews clone-docs --filter=none`): a
// blob-filtered clone fails partway through with "could not fetch ... from
// promisor remote".
//
// This used to be a script in every product repository, each a copy of the last
// with its own repository name baked in. Copying it is how a backfill once
// published 190 days of briefs naming the wrong product.

try { require('dotenv').config(); } catch { /* optional */ }

const { execFileSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const moment = require('moment-timezone');
const DocsMonitor = require('../src/monitor-docs');
const { getConfig } = require('../src/config');
const { StaticSiteGenerator } = require('../src/static-site');
const { selectPeriodEvidence } = require('../src/period-summaries');
const { documentationEventId, nextScheduledRefresh } = require('../src/update-state');

const MAX_BUFFER = 256 * 1024 * 1024;

function argument(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function validDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !moment.utc(value, 'YYYY-MM-DD', true).isValid()) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  return value;
}

function runGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function splitPatches(value) {
  return String(value || '').split(/(?=^diff --git )/m).filter(section => section.startsWith('diff --git '));
}

function patchFilename(patch) {
  const line = patch.split('\n', 1)[0];
  const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
  return match?.[2] || '';
}

function patchStatus(patch) {
  if (/^new file mode /m.test(patch) || /^--- \/dev\/null$/m.test(patch)) return 'added';
  if (/^deleted file mode /m.test(patch) || /^\+\+\+ \/dev\/null$/m.test(patch)) return 'removed';
  return 'modified';
}

function emptyAnalysis() {
  return {
    newFiles: [],
    modifiedFiles: [],
    deletedFiles: [],
    messageCenterItems: [],
    summary: { totalCommits: 0, totalFiles: 0, authors: new Set() }
  };
}

function bucketForStatus(analysis, status) {
  if (status === 'added') return analysis.newFiles;
  if (status === 'removed') return analysis.deletedFiles;
  return analysis.modifiedFiles;
}

function utcDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function clean(value, limit = 500) {
  const result = String(value || '').replace(/\s+/g, ' ').trim();
  return result.length > limit ? `${result.slice(0, limit - 1).trim()}…` : result;
}

function periodSummary(kind, key, items, generatedAt) {
  const label = kind === 'day'
    ? moment.utc(key).format('D MMMM YYYY')
    : kind === 'week'
      ? `Week of ${moment.utc(key).format('D MMMM YYYY')}`
      : moment.utc(`${key}-01`).format('MMMM YYYY');
  const selected = selectPeriodEvidence(items, 5);
  const lead = selected[0];
  const counts = {
    new: items.filter(item => item.changeType === 'New').length,
    updated: items.filter(item => item.changeType === 'Updated').length,
    removed: items.filter(item => item.changeType === 'Removed').length,
    messageCenter: items.filter(item => item.source === 'mc').length
  };
  const productCounts = new Map();
  for (const item of items) productCounts.set(item.product.short, (productCounts.get(item.product.short) || 0) + 1);
  const activeProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const changeSummary = [
    counts.new ? `${counts.new} new` : '',
    counts.updated ? `${counts.updated} updated` : '',
    counts.removed ? `${counts.removed} removed` : ''
  ].filter(Boolean).join(', ');
  const messageText = counts.messageCenter ? ` and ${counts.messageCenter} relevant Message Center announcement${counts.messageCenter === 1 ? '' : 's'}` : '';
  const headline = items.length === 1
    ? clean(lead.title, 180)
    : clean(`${lead.title} leads ${items.length} ${getConfig().ai.subject} updates`, 180);
  return {
    headline,
    overview: `${label} recorded ${changeSummary || `${items.length} tracked`} ${getConfig().site.productName} documentation change${items.length === 1 ? '' : 's'}${messageText}.${activeProducts.length ? ` The most active areas were ${activeProducts.join(', ')}.` : ''}`,
    adminImpact: 'Review the linked Microsoft Learn changes that apply to your managed platforms, policies, applications, and rollout plans. The archive preserves the source diff for verification.',
    keyChanges: selected.map(item => ({
      title: clean(item.title, 180),
      detail: clean(item.summary, 520),
      product: item.product.short,
      sourceId: item.id
    })),
    generatedBy: 'deterministic-backfill',
    generatedAt
  };
}

async function writePeriodSummaries(websiteDir, repo, start, end, generatedAt) {
  const site = new StaticSiteGenerator({ websiteDir, docsRepoPath: repo, generatedAt });
  const reports = await site.loadReports();
  const docs = site.normalizeDocItems(reports);
  const messageCenter = (await site.loadMessageCenterItems()).filter(item => item.date >= start && item.date <= end);
  const items = [...docs, ...messageCenter].filter(item => item.date >= start && item.date <= end);
  const store = {
    version: 3,
    generatedAt,
    generator: { model: 'deterministic-backfill', reasoningEffort: 'none' },
    days: {},
    weeks: {},
    months: {},
    usageByDay: {},
    lastRun: { inputTokens: 0, outputTokens: 0, requests: 0, costUsd: 0 },
    totalUsage: { inputTokens: 0, outputTokens: 0, requests: 0, costUsd: 0 }
  };
  const days = [...new Set(items.map(item => item.date))].sort();
  for (const day of days) {
    const periodItems = items.filter(item => item.date === day);
    if (periodItems.length) store.days[day] = periodSummary('day', day, periodItems, generatedAt);
  }
  const weeks = [...new Set(items.map(item => moment.utc(item.date).startOf('isoWeek').format('YYYY-MM-DD')))].sort();
  for (const week of weeks) {
    const lastDay = moment.utc(week).add(6, 'days').format('YYYY-MM-DD');
    const periodItems = items.filter(item => item.date >= week && item.date <= lastDay);
    if (periodItems.length) store.weeks[week] = periodSummary('week', week, periodItems, generatedAt);
  }
  const months = [...new Set(items.map(item => item.date.slice(0, 7)))].sort();
  for (const month of months) {
    const periodItems = items.filter(item => item.date.startsWith(month));
    if (periodItems.length) store.months[month] = periodSummary('month', month, periodItems, generatedAt);
  }
  await fsp.writeFile(path.join(websiteDir, 'period-summaries.json'), `${JSON.stringify(store, null, 2)}\n`);
  return { items: items.length, days: days.length, weeks: weeks.length, months: months.length };
}

// The subtrees to walk come from docs.trackedPaths rather than a second list
// here. A backfill that scanned a different set from the monitor would produce
// a history the daily runs then contradict.
function trackedSubtrees(config) {
  const source = String(config.docs.trackedPaths);
  const group = source.match(/\^\(([^)]+)\)/);
  if (!group) throw new Error('docs.trackedPaths does not open with a subtree group');
  // The group is regex source: `Exchange\/ExchangeOnline` must reach git as
  // `Exchange/ExchangeOnline`, or the pathspec matches nothing and the backfill
  // quietly reports no commits.
  return group[1].split('|').map(subtree => subtree.replace(/\\(.)/g, '$1'));
}

async function main() {
  const currentYear = moment.utc().format('YYYY');
  const repo = path.resolve(argument('repo', process.env.LOCAL_REPO_PATH || path.join(process.cwd(), getConfig().build.docsCloneDir)));
  const websiteDir = path.resolve(argument('website', process.env.WEBSITE_DIR || 'website'));
  const start = validDate(argument('start', `${currentYear}-01-01`), 'Start date');
  const end = validDate(argument('end', moment.utc().format('YYYY-MM-DD')), 'End date');
  if (start > end) throw new Error('Start date must not be after end date');
  if (!fs.existsSync(path.join(repo, '.git'))) throw new Error(`Git repository not found at ${repo}`);
  await fsp.mkdir(websiteDir, { recursive: true });

  const monitor = new DocsMonitor({ websiteDir, reportsDir: path.join(websiteDir, '.reports') });
  const config = getConfig();
  const subtrees = trackedSubtrees(config);
    const generatedAt = new Date().toISOString();
  const until = moment.utc(end).add(1, 'day').format('YYYY-MM-DD');
  const log = runGit(repo, [
    'log', '--no-merges', '--reverse', `--since=${start}T00:00:00Z`, `--until=${until}T00:00:00Z`,
    '--format=%H%x1f%P%x1f%aI%x1f%an%x1f%s%x1e', '--', ...subtrees
  ]);
  const commits = log.split('\x1e').map(record => record.trim()).filter(Boolean).map(record => {
    const [hash, parents, date, author, ...subject] = record.split('\x1f');
    return { hash, parent: String(parents || '').split(/\s+/)[0], date, author, subject: subject.join('\x1f') };
  });
  console.log(`Backfilling ${start} through ${end} from ${commits.length} ${config.site.productName} documentation commits in ${repo}`);

  const analyses = new Map();
  for (let day = moment.utc(start); day.isSameOrBefore(moment.utc(end)); day.add(1, 'day')) {
    analyses.set(day.format('YYYY-MM-DD'), emptyAnalysis());
  }
  let substantiveFiles = 0;
  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    if (!commit.parent) continue;
    const date = utcDate(commit.date);
    if (date < start || date > end) continue;
    const analysis = analyses.get(date);
    const patchText = runGit(repo, [
      'diff', '--no-ext-diff', '--no-renames', '--unified=3', '--diff-filter=AMD', commit.parent, commit.hash, '--', ...subtrees
    ]);
    let commitIncluded = false;
    for (const patch of splitPatches(patchText)) {
      const filename = patchFilename(patch);
      if (!monitor.isTrackedDocPath(filename) || monitor.isOnlyFrontMatterChanges(patch, filename)) continue;
      const status = patchStatus(patch);
      const { additions, deletions } = monitor.countChanges(patch);
      const file = {
        filename,
        status,
        additions,
        deletions,
        changes: additions + deletions,
        patch,
        baseCommitSha: commit.parent,
        commitSha: commit.hash,
        commitMessage: commit.subject,
        commitAuthor: commit.author,
        commitDate: commit.date,
        githubUrl: `https://github.com/${monitor.targetRepo.owner}/${monitor.targetRepo.repo}/blob/${monitor.targetRepo.branch}/${filename}`,
        publicDocsUrl: monitor.generatePublicDocsUrl(filename),
        firstSeenAt: new Date(commit.date).toISOString()
      };
      file.eventId = documentationEventId(file);
      file.englishSummary = monitor.createFallbackDiffSummary(file);
      bucketForStatus(analysis, status).push(file);
      analysis.summary.authors.add(commit.author);
      substantiveFiles += 1;
      commitIncluded = true;
    }
    if (commitIncluded) analysis.summary.totalCommits += 1;
    if ((index + 1) % 100 === 0 || index + 1 === commits.length) {
      console.log(`Processed ${index + 1}/${commits.length} commits (${substantiveFiles} substantive article changes)`);
    }
  }

  for (const [date, analysis] of analyses) {
    analysis.summary.totalFiles = analysis.newFiles.length + analysis.modifiedFiles.length + analysis.deletedFiles.length;
    analysis.englishSummary = monitor.createFallbackEnglishSummary(analysis);
    analysis.summary.authors = [...analysis.summary.authors].sort();
    await fsp.writeFile(path.join(websiteDir, `${date}.json`), `${JSON.stringify(analysis, null, 2)}\n`);
  }

  const head = runGit(repo, ['rev-parse', 'HEAD']).trim();
  await fsp.writeFile(path.join(websiteDir, 'monitor-state.json'), `${JSON.stringify({
    version: 1,
    docsHead: head,
    messageCenterVersions: {},
    pendingEmailEventIds: [],
    lastEmailDate: '',
    migrated: false
  }, null, 2)}\n`);
  await fsp.writeFile(path.join(websiteDir, 'refresh-status.json'), `${JSON.stringify({
    lastCheckedAt: generatedAt,
    lastContentChangedAt: generatedAt,
    nextScheduledAt: nextScheduledRefresh(generatedAt),
    sourceChanges: { documentation: substantiveFiles, messageCenter: 0 }
  }, null, 2)}\n`);

  const briefs = await writePeriodSummaries(websiteDir, repo, start, end, generatedAt);
  console.log(`Wrote ${analyses.size} daily reports and deterministic briefs for ${briefs.days} active days, ${briefs.weeks} weeks, and ${briefs.months} months (${briefs.items} source items).`);
}

// Guarded. This script rewrites every dated report in website/, so it must not
// run merely because something required it — a `require()` of this file used to
// silently overwrite the whole archive, replacing curated summaries with
// deterministic fallbacks.
if (require.main === module) {
  main().catch(error => {
    console.error(`Backfill failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
