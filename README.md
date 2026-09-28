# dailynews-engine

The shared engine behind the Daily.\*.News sites. It holds everything that is not
specific to one product: the documentation monitor, the static site generator,
the search index, and the Discord and Kit publishers.

A product repository holds its `dailynews.config.js`, its assets, its committed
`website/`, and its own conformance tests. It holds no generator code and, in
practice, no dependencies at all.

| Product repository | Site | Documentation source |
|---|---|---|
| `merill/daily-intune` | daily.intune.admin.news | `MicrosoftDocs/memdocs` |
| `merill/entra-doc-diff` | daily.entra.news | `MicrosoftDocs/entra-docs` |
| `merill/daily-defender` | daily.defender.admin.news | `MicrosoftDocs/defender-docs` |

Microsoft is taking these documentation repositories private. Each product has a
mirror repository that [learn-mirror](https://github.com/merill/learn-mirror)
rebuilds from Microsoft Learn itself — see
[Mirroring Microsoft Learn](#mirroring-microsoft-learn).

| Mirror repository | Stands in for | Product cut over |
|---|---|---|
| `merill/intune-docs-mirror` | `MicrosoftDocs/memdocs` | not yet |
| `merill/defender-docs-mirror` | `MicrosoftDocs/defender-docs` | yes |
| `merill/entra-docs-mirror` | `MicrosoftDocs/entra-docs` | not yet |

## Contents

- [Architecture](#architecture) — how the pieces fit together
- [What the engine does](#what-the-engine-does) — the feature set
- [Mirroring Microsoft Learn](#mirroring-microsoft-learn) — cutting a product over to a docs mirror
- [Commands](#commands) — the CLI reference
- [Configuration](#configuration) — the `dailynews.config.js` schema
- [Adding a new product](#adding-a-new-product) — the runbook, and a prompt for an AI agent
- [Design rules](#design-rules) — the constraints that keep this working
- [Verifying a change](#verifying-a-change)

## Architecture

Each product is a documentation repository turned into a website. The engine is
the turning; the product repository is the description of what to turn and the
record of what came out.

```
MicrosoftDocs/<product>-docs ──┐
                               ├──> dailynews monitor ──> website/*.json  (dated reports)
merill/mc  (Message Center) ───┘            │             website/monitor-state.json
                                            │
                                            ├──> Discord   (optional)
                                            └──> Kit       (optional, daily email)

website/*.json ──> dailynews build-site ──> website/**/index.html
                            ▲               website/rss.xml, sitemap.xml, llms.txt
                            │
        dailynews.config.js ┘  assets/site/

website/**  ──> dailynews search-index ──> website/pagefind/**
                                           website/search-manifest.json

website/  ──> Cloudflare Pages  (builds from the repository, no deploy step)
```

Four properties hold this together.

**The generated site is committed.** `website/` is not a build artifact that gets
thrown away — it is the record. That makes every change provable: rebuild and
diff. It also means deployment is just a push.

**The build is a pure function of its inputs.** Given the same reports, the same
config, and the same `SITE_GENERATED_AT`, the generator produces byte-identical
output. Every refactor in this engine was verified that way.

**Configuration reaches the code through a memoised singleton**, not through
constructor arguments. `src/config.js` exposes `getConfig()`; the site generator
reads it once at module load into `SITE`, `PRODUCTS`, `TOPICS` and `STOPWORDS`.
The alternative — threading `this.config` through 1,400 lines of template
literals — was rejected as a rewrite with no test net.

**The engine reaches products, never the reverse.** Nothing here knows a product
exists. A product name appearing in engine source is a bug, and the test suite
fails on it.

### Repository layout

```
bin/dailynews.js        dispatcher: monitor | build-site | search-index |
                        summaries | publish-kit | regenerate-diffs | serve
src/
  config.js             load, normalise, validate; getConfig/setConfig
  monitor-docs.js       poll the docs repo and Message Center, write reports
  static-site.js        generate every page, plus CSS and client JS
  search-index.js       build the Pagefind index over the generated site
  update-state.js       monitor state, event ids, refresh schedule
  period-summaries.js   day, week and month editorial briefs
  discord-publisher.js  post a daily batch to Discord
  kit-publisher.js      create and schedule the Kit broadcast
scripts/                one CLI entry point per command
test/
  fixtures/profile.js   two complete product profiles sharing no vocabulary
.github/actions/setup   how a product gets the engine
```

Assets are not here. Favicons, OG images, product and topic icons and the shared
chrome all live in `assets/site/` in each product repository.

### How a product reaches the engine

Through the composite action, not through npm:

```yaml
- uses: merill/dailynews-engine/.github/actions/setup@v1.1.0
- run: dailynews build-site
```

Every repository involved is private. A git dependency on a private repository
needs a personal access token that expires and must be rotated in every consumer.
A composite action needs none: GitHub checks this repository out using the
calling workflow's own token, provided this repository allows it.

That permission is a one-time setting:

```bash
gh api -X PUT /repos/merill/dailynews-engine/actions/permissions/access -f access_level=user
```

The action installs the engine's dependencies, symlinks the engine into the
caller's `node_modules/@merill/dailynews-engine`, and puts `dailynews` on `PATH`.
So both of these work in a product workflow:

```bash
dailynews build-site
node -e "require('@merill/dailynews-engine/static-site')"
```

Locally, link a sibling checkout instead:

```bash
npm run engine:link
```

## What the engine does

### Monitoring

- Polls a documentation repository for commits touching tracked paths, on a
  six-hour cadence.
- Filters to articles that publish to Microsoft Learn, excluding fragment
  directories that have no URL of their own.
- Tracks the Microsoft 365 Message Center archive alongside the documentation.
- Keeps state in `website/monitor-state.json` so each change is processed once,
  keyed by an event id built from `identity.docEventPrefix`.
- Writes `website/refresh-status.json` — last check, last content change, next
  scheduled refresh — which the site footer reads and which pins a reproducible
  rebuild.

### Summarising

- Generates a plain-English headline, summary and administrator impact per
  change, through OpenAI when `OPENAI_API_KEY` is set.
- Falls back to source metadata when it is not, marking the result so the site
  can say which it is.
- Produces day, week and month editorial briefs under a token budget, and
  distinguishes an AI-written brief from a deterministically assembled one in the
  rendered disclosure.

### Generating the site

- Day, week and month pages; product and topic directories; a detail page per
  change; a Message Center section; search, compare and about pages.
- `rss.xml`, `sitemap.xml`, `robots.txt`, `llms.txt` and `CNAME`.
- CSS and client JavaScript, emitted from the generator rather than stored as
  files, so they cannot drift from the markup.
- A full-page diff link to `mx.merill.net` for historical changes, and a rendered
  word-level diff of the changed extract on every detail page.
- Copies product assets from `assets/site/` in the product repository.
- Vendor browser bundles resolved through the engine's own dependency graph, so
  they work wherever the engine is installed.

### Searching

- Builds a Pagefind index over the generated site, with product, topic, source
  and record-type filters and configurable query aliases.
- Writes `website/search-manifest.json` with coverage counts.

### Publishing

- Discord: one batched daily post, idempotent by event id, silently disabled when
  no webhook is configured.
- Kit: creates and schedules the daily subscriber broadcast, guarded against
  double sends by a marker (see [Design rules](#design-rules)). A product can
  ship without email entirely.

## Mirroring Microsoft Learn

The monitor diffs commits in a documentation repository. When that repository
is no longer public, [merill/learn-mirror](https://github.com/merill/learn-mirror)
rebuilds it from Microsoft Learn, and the monitor clones the mirror instead.

Each mirror has the same layout as the original repository, because every page
is written to the source path Learn records for it. A product's `trackedPaths`
and `learnRoutes` therefore work against the mirror unchanged.

The mirror tool lives in its own public repository because the mirrors are
public, and GitHub lets only private repositories use a private repository's
actions.

**Cutting a product over** to its mirror:

1. Clone the mirror in place of the documentation repository. Change every
   workflow that clones it: the monitor, the site build, and the site
   verification. Keep the clone directory, `build.docsCloneDir`, as it is.
2. Set `TARGET_REPO_OWNER` and `TARGET_REPO_NAME` on the monitor step, so each
   change's GitHub link points at the mirror.
3. Set `docsHead` in `website/monitor-state.json` to a commit in the mirror.
   Otherwise the monitor finds the old cursor unreachable, falls back to the last
   24 hours, and reports the mirror's baseline as thousands of new pages.

The site build reads the clone only to find the parent commits of recent changes
that lack a stored `baseCommitSha`. Recorded changes carry one, so history built
from the original repository still renders after the cutover.

## Commands

Run from a product repository. The working directory is where
`dailynews.config.js`, `assets/site/` and `website/` are read and written.

| Command | What it does | Flags |
|---|---|---|
| `dailynews monitor` | Poll the docs repository and Message Center, update state, write reports | — |
| `dailynews build-site` | Generate the static site into `website/` | — |
| `dailynews search-index` | Build the Pagefind index over the generated site | — |
| `dailynews summaries` | Generate period briefs | `--all`, `--current`, `--dates=`, `--days`, `--weeks`, `--months`, `--force`, `--ignore-budget` |
| `dailynews publish-kit` | Publish the daily broadcast to Kit | `--auto`, `--date=` |
| `dailynews regenerate-diffs` | Re-summarise changes that are not AI-generated | `--dates=` (required) |
| `dailynews serve` | Serve `website/` for local preview | `--port=`, `--host=` |

Each subcommand runs its script in a child process rather than requiring it. The
scripts are the same files a product used to run directly, and some guard their
entry on `require.main === module`. Spawning keeps that guard true, so a script
behaves identically whether reached through `dailynews` or run by path.

`regenerate-diffs` is the tool for enriching a deterministic backfill: it selects
changes whose `englishSummary.generatedBy` is not `openai` and regenerates them.
It requires `OPENAI_API_KEY` and takes an explicit date list, so a large archive
can be done in batches.

### Reaching a command as a module

The CLI entry points keep their `module.exports` alongside their
`require.main === module` guard, so a product's tests can drive one directly:

```js
const { main } = require('@merill/dailynews-engine/publish-kit-broadcast');
```

`publish-kit-broadcast`, `generate-period-summaries` and
`regenerate-diff-summaries` are exported this way.

## Configuration

`dailynews.config.js` at the product repository root, validated by `src/config.js`
on load. It is CommonJS rather than JSON because the classification and path
rules are regular expressions.

Validation is strict: a missing required field throws at load with the field's
path in the message. Run `npm test` in the product repository to check a config
without building anything.

### Required sections

| Section | Fields |
|---|---|
| `site` | `name`, `host`, `url` (no trailing slash), `description`, `productName`, `audience` |
| `brand` | `wordmark`, `ogAlt`, `themeStorageKey`, `tokenStorageKey`, `emailEyebrow`, `logo`, `aboutIcon`, `uiAssets` (may be empty), `extraCss` |
| `identity` | `docEventPrefix`, `batchEventPrefix`, `kitMarkerPrefix` |
| `build` | `docsCloneDir`, `detailDays` |
| `discord` | `botName` |
| `ai` | `schemaPrefix`, `subject`, `forbiddenOpeners`, `impactBoost` (RegExp) |
| `docs` | `learnRootUrl`, `trackedPaths` (RegExp), `learnRoutes`, `areas` |
| `messageCenter` | `servicePattern` (RegExp) |
| `taxonomy` | `products`, `topics`, `defaultProduct`, `defaultTopic`, `iconSource`, `stopwords` |
| `classify` | `products`, `topics` |
| `copy` | see below |
| `links` | `related`, `footer`, `stayCurrent`, `followProject` (all may be empty) |

`copy` carries every string the generator writes that names the product:
`rssFeedLabel`, `messageCenterHeading`, and the `landing`, `directory`, `search`,
`compare`, `dailyEmail`, `detail`, `footer` and `about` groups. Anything a page
renders that mentions the product belongs here, so the markup stays neutral.

### Optional

| Field | Default |
|---|---|
| `email.enabled` | `true` — set `false` to remove every signup affordance |
| `analytics.piqoSite` | `''` |
| `docs.areas.stripPrefix` | `null` — for a repository whose paths are already Learn paths |
| `taxonomy.searchAliases` | `{}` |
| `taxonomy.products[].icon`, `topics[].icon` | `{ file: '<slug>.svg' }` |

### Ordered rules

`docs.learnRoutes`, `docs.areas.rules`, `classify.products` and `classify.topics`
are ordered lists where the first match wins. `$1`, `$2` in a route template are
the captured groups.

This matters more than it looks. If one subtree name is a prefix of another —
`defender-for-cloud` and `defender-for-cloud-apps` — the longer name must come
first, or it is never reached. Assert the ordering in the product's tests.

Classification rules take an optional `scope` (`'title'` or `'text'`, default
`'text'`) and an optional `unless` guard, for the case where a broader product
name appears inside a narrower one.

## Adding a new product

### What you will need

- A public documentation repository, and the branch it publishes from.
- A domain, and a Cloudflare account that holds its zone.
- `OPENAI_API_KEY` for summaries. Everything else is optional.

### Steps

1. **Establish what publishes, from the repository itself.** Read the
   documentation repository's `.openpublishing.publish.config.json`. It lists
   every docset and its build source folder. That is the authoritative set — not
   the top-level directory listing, which includes fragment directories, retired
   docsets, and folders that no longer publish.

2. **Verify each Learn URL against the live site.** A docset's folder name is
   often, but not always, its Learn path. In `defender-docs`, six of fifteen
   differ: `sentinel` publishes as `azure/sentinel`, `easm` as
   `azure/external-attack-surface-management`, `exposure-management` as
   `security-exposure-management`. Take one real file per docset, build the URL
   you think it has, and request it:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     "https://learn.microsoft.com/en-us/<candidate-path>/<slug>"
   ```

   Getting one wrong breaks every link for that service while the site looks
   entirely healthy.

3. **Create the repository from an existing product.** Copy the workflows,
   `scripts/link-engine.js`, and the shared UI SVGs from `assets/site/ui/`. Write
   `dailynews.config.js`. Remove the Kit workflow if the product ships without
   email.

4. **Source icons.** Product and topic icons come from
   `github.com/DanielBradley1/msicons`. Where a service has no mark of its own,
   share another product's drawing and record `match: 'shared'` in the icon's
   provenance rather than forcing a poor match.

5. **Generate the brand assets.** Rasterise favicons from the product's official
   mark, and compose an OG image:

   ```bash
   rsvg-convert -w 32 -h 32 mark.svg -o assets/site/favicon-32x32.png
   ```

6. **Backfill the archive.** `scripts/generate-historical-data.js` walks the
   documentation history and writes deterministic daily reports and period
   briefs. It makes no OpenAI calls, so it costs nothing.

   It needs a clone with real blobs. A `--filter=blob:limit=100k` clone fails
   partway through with `could not fetch ... from promisor remote`:

   ```bash
   git clone --single-branch --branch <branch> --shallow-since=<start-minus-a-month> \
     https://github.com/<owner>/<repo>.git ../<clone-dir>
   TZ=UTC node scripts/generate-historical-data.js --repo=../<clone-dir> --start=YYYY-MM-DD
   ```

7. **Build and look at the site.** `npm run build:site`, then `npm run dev`. Open
   it. Read a day brief and a detail page.

8. **Deploy.** Cloudflare Pages, connected to the repository: production branch
   `main`, no build command, output directory `website`. Add the custom domain.
   Set the repository secrets.

### What to look out for

These are failures this engine has actually had, in roughly the order they cost
the most time.

**A product name surviving a copy.** Every file copied from a sibling repository
carries that sibling's product name somewhere. It happened three times in one
day, and each time it was invisible to the tests and visible only on a rendered
page — including a backfill that published 190 days of briefs announcing
"Microsoft Intune documentation changes" on the Defender site.

Guard against it, and do not trust a green test run in place of looking:

```js
const foreign = /\b(intune|entra|defender|memdocs)\b/i;
```

**Comparing two repositories with the product name normalised away.** Convergence
work used `s/Entra|Intune/PROD/` before diffing, which cannot see a product
literal by construction: both repositories held the same code with their own name
baked in, and read as identical while being unable to share a copy. The engine's
`test/engine-boundaries.test.js` makes the check exact instead.

**Ordered rules whose order is accidental.** See
[Ordered rules](#ordered-rules). Assert the ordering, not just the mappings.

**Path-exclusion regular expressions.** A lookahead requiring a slash before
`includes` will not match when `includes` is the first segment after the subtree.
Test the exclusions explicitly, in both directions.

**`TZ=UTC` when building locally.** Without it every date bucket shifts and
hundreds of pages appear to change.

**Scripts that run on import.** A one-shot backfill script rewrites every dated
report. If it calls `main()` at module scope, merely requiring it destroys the
archive — which is how 442 curated summaries were overwritten during a routine
"does this still load?" check. Guard the entry.

**A test that quietly stops testing.** A guard that selects workflows by matching
a command string covers nothing once that command is renamed. Assert how many
things a guard matched.

### A prompt for an AI agent

Paste this, with the placeholders filled in:

> Add a new product to the Daily.\*.News engine
> (`github.com/merill/dailynews-engine`), following `merill/daily-defender` as
> the closest example.
>
> - Product: `<name>`, hosted at `<domain>`
> - Documentation source: `<owner>/<repo>`, branch `<branch>`
> - Email in v1: `<yes|no>`
> - Backfill the archive from `<date>`
>
> Read the engine's README first. Then:
>
> 1. Derive the tracked subtrees from the documentation repository's own
>    `.openpublishing.publish.config.json`, not from its directory listing.
> 2. **Verify every Learn URL with a real HTTP request before writing it into
>    config.** Folder names and published paths often differ. Report which ones
>    differ rather than silently mapping them.
> 3. Watch for subtree names that are prefixes of other subtree names, and order
>    the routes longest-first. Assert that ordering in the product's tests.
> 4. Every file you copy from a sibling product repository contains that
>    product's name somewhere. Find them all, move them into configuration, and
>    add a test that fails if any remain.
> 5. Backfill deterministically — no OpenAI calls. It needs a clone with real
>    blobs; a blob-filtered clone fails partway through.
> 6. **Build the site and look at the rendered pages before committing.** Several
>    real defects here were invisible to a passing test suite and obvious on
>    screen.
> 7. Tell me what needs a human: DNS, Cloudflare, and repository secrets.
>
> Do not merge anything that changes rendered output without showing me the diff
> first.

## Design rules

**Runtime dependencies are exactly these nine**, and adding a tenth is a
deliberate act rather than something that arrives with a refactor:

```
diff  dotenv  marked  moment-timezone  node-html-parser
node-htmldiff  openai  pagefind  simple-git
```

Versions are pinned to what the products run in production. `diff@5.2.0`,
`openai@7.3.0` and `simple-git@3.28.0` were held back rather than floated,
because two product repositories had silently drifted onto different resolutions
of the same carets and their committed sites were built with different ones. A
bump changes rendered output, so it belongs in its own change with a site diff to
review.

**No product may be named here.** `test/engine-boundaries.test.js` fails if any
engine source contains `entra`, `intune`, `defender` or `memdocs`.

**Two fixture profiles, not one.** `test/fixtures/profile.js` holds two complete
products sharing no vocabulary, so a value leaking from one into the other's
output is caught by name. One profile lets product-specific behaviour hide inside
code that looks shared.

**Three identity fields are not prose.** They are written into persisted state and
into published records, and changing one makes the code stop recognising what it
wrote before:

| Field | Consequence of changing it |
|---|---|
| `identity.docEventPrefix` | Every tracked documentation change is re-emitted |
| `identity.batchEventPrefix` | The daily Discord batch is re-posted |
| `identity.kitMarkerPrefix` | **The subscriber email is sent twice** |

`kitMarkerPrefix` builds the marker Kit is re-listed by before a broadcast is
created. It is the entire double-send guard. Product test suites assert the
marker by typing the literal out in full — never by rebuilding it from config,
which would assert nothing.

**A product without email** sets `email: { enabled: false }`, which removes the
rail box, the dialog and the about-page section. Without it, a product with no
Kit form still advertises "Get daily email updates" and opens a dialog that can
only report that the form is not configured.

## Verifying a change

The product repositories commit their generated sites, so a change is proven by
rebuilding and finding no diff:

```bash
TZ=UTC SITE_GENERATED_AT=<pinned> dailynews build-site && git diff --exit-code -- website/
```

`verify-site-build.yml` in each product repository does this on every pull
request, taking `SITE_GENERATED_AT` from the committed `refresh-status.json`.
Pagefind re-hashes its index files on every run even when the indexed content is
byte-identical, so the index is compared on coverage counts rather than bytes.

The engine's own suite runs on every push and pull request here, and includes a
job that consumes the setup action cross-repository — the way a product does,
placing it under `_actions` — because the layout it used to test locally is
exactly the one that hides caching bugs.
