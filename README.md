# dailynews-engine

The shared engine behind the Daily.\*.News sites. It holds everything that is not
specific to one product: the documentation monitor, the static site generator,
the search index, and the Discord and Kit publishers.

A product repository holds its `dailynews.config.js`, its assets, its committed
`website/`, and its own conformance tests. It holds no generator code.

Today's products:

| Repository | Site |
|---|---|
| `merill/daily-intune` | daily.intune.admin.news |
| `merill/entra-doc-diff` | daily.entra.news |

## How a product reaches the engine

Through the composite action, not through npm:

```yaml
- uses: merill/dailynews-engine/.github/actions/setup@<sha>
- run: dailynews build-site
```

Both repositories are private, and so is this one. A git dependency on a private
repository needs a personal access token that expires and has to be rotated in
every consumer. A composite action needs none: GitHub checks this repository out
using the calling workflow's own token, provided this repository allows it.

That permission is a one-time setting:

```bash
gh api -X PUT /repos/merill/dailynews-engine/actions/permissions/access -f access_level=user
```

The action installs the engine's dependencies, symlinks the engine into the
caller's `node_modules/@merill/dailynews-engine`, and puts `dailynews` on `PATH`.
So both of these work in a product repository's workflow:

```bash
dailynews build-site
node -e "require('@merill/dailynews-engine/static-site')"
```

Locally, link a sibling checkout instead:

```bash
npm run engine:link
```

## Commands

Run from a product repository. The working directory is where
`dailynews.config.js`, `assets/site/` and `website/` are read and written.

| Command | What it does |
|---|---|
| `dailynews monitor` | Poll the docs repository and Message Center, update state |
| `dailynews build-site` | Generate the static site into `website/` |
| `dailynews search-index` | Build the Pagefind index over the generated site |
| `dailynews summaries` | Generate period summaries |
| `dailynews publish-kit` | Publish the daily broadcast to Kit |
| `dailynews regenerate-diffs` | Regenerate diff summaries |
| `dailynews serve` | Serve `website/` for local preview |

Each subcommand runs its script in a child process rather than requiring it, so
a script behaves identically whether it is reached through `dailynews` or run by
path. That is what makes a cutover verifiable: the same file, run the same way.

### Reaching a command as a module

The CLI entry points keep their `module.exports` alongside their
`require.main === module` guard, so a product's tests can drive one directly
rather than shelling out:

```js
const { main } = require('@merill/dailynews-engine/publish-kit-broadcast');
```

`publish-kit-broadcast`, `generate-period-summaries` and
`regenerate-diff-summaries` are exported this way.

## Dependencies

Runtime dependencies are exactly these nine, and adding a tenth is a deliberate
act rather than something that arrives with a refactor:

```
diff  dotenv  marked  moment-timezone  node-html-parser
node-htmldiff  openai  pagefind  simple-git
```

`test/engine-boundaries.test.js` asserts the list, and asserts that neither the
sources nor `package-lock.json` reintroduce a Microsoft Graph mail client. Both
products removed that capability deliberately; the lockfile is checked because
once the products depend on this engine, their own `package.json` no longer
names what actually gets installed.

**Versions are pinned to what the products run in production.** `diff@5.2.0`,
`openai@7.3.0` and `simple-git@3.28.0` were held back rather than floated,
because the two product repositories had silently drifted onto different
resolutions of the same carets and their committed sites were built with
different ones. A bump changes rendered output, so it belongs in its own change
with a site diff to review — not in a cutover.

## No product may be named here

`test/engine-boundaries.test.js` fails if any engine source contains `entra`,
`intune`, `defender` or `memdocs`.

This is not stylistic. The two products were converged by comparing them with
`s/Entra|Intune/PROD/` applied, and that normalisation cannot see a product
literal by construction — both repositories held the same code with their own
name baked in, and read as identical while being unable to share a copy. The
first extraction attempt built one product's site with the other product's name
in 673 pages. Here there is nothing to normalise, so the check is exact.

The same reasoning drives the two fixture profiles in `test/fixtures/profile.js`.
They share no vocabulary, so a value that leaks from one into the other's output
is caught by name.

## Configuration

`dailynews.config.js` in the product repository, validated by `src/config.js` on
load. Three fields under `identity` are not prose — they are written into
persisted state and into published records, and changing one makes the code stop
recognising what it wrote before:

| Field | Consequence of changing it |
|---|---|
| `identity.docEventPrefix` | Every tracked documentation change is re-emitted |
| `identity.batchEventPrefix` | The daily Discord batch is re-posted |
| `identity.kitMarkerPrefix` | **The subscriber email is sent twice** |

`kitMarkerPrefix` builds the marker that Kit is re-listed by before a broadcast
is created. It is the entire double-send guard. Product test suites assert the
marker by typing the literal out in full — never by rebuilding it from config,
which would assert nothing.

## Verifying a change

The product repositories commit their generated sites, so a change is proven by
rebuilding and finding no diff:

```bash
SITE_GENERATED_AT=<pinned> dailynews build-site && git diff --exit-code -- website/
```

`verify-site-build.yml` in each product repository does this on every pull
request. Pagefind re-hashes its index files on every run even when the indexed
content is identical, so the index is compared on coverage counts rather than
bytes.
