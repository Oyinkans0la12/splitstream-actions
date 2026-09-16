# How it works

One workflow run closes one cycle. Everything below happens inside
`src/index.ts`'s `main()`, in this order.

1. **Registry load**. `loadRegistry()` (`src/registry.ts`) reads the file at
   `config_path` (default `.github/splitstream.yml`) and validates it against
   the strict zod schema in `schemas/splitstream.schema.ts`. Invalid YAML, a
   `G...`/`C...` strkey that fails its checksum, a duplicate repo or handle, an
   empty `repos`/`contributors` list, or an unknown top-level key aborts the run
   via `core.setFailed`. Nothing is skipped or repaired.
2. **Cycle window**. For a real run the boundary comes from this repo's own
   committed audit trail: `readLastManifestWindow()` (`src/manifest.ts`) finds
   the highest `manifests/cycle-<id>.json`, and the new cycle is that id + 1
   starting at that manifest's `generatedAt`. The deployed contract has no
   "latest cycle" call, so it can never define the window;
   `get_cycle_info(lastCycleId)` is called only as a sanity check, and a
   disagreement only produces a warning. When no manifest exists yet (cycle 0),
   the `since` and `cycle_id` inputs supply the boundary instead, and both are
   required.
3. **Ingest**. `ingestCycle()` (`src/ingest.ts`) lists closed PRs in every repo
   in `repos` (`octokit.paginate(octokit.rest.pulls.list, { state: 'closed',
   per_page: 100 })`), keeps those whose `merged_at` is at or after the window
   start, and matches GitHub closing keywords in each PR body. A PR closed
   without merging, one with an unparseable `merged_at`, or one with no author
   is skipped with a warning.
4. **Count**. `countIssuesByContributor()` (`src/counts.ts`) reduces the
   (PR, issue) pairs to distinct issues per PR author. Distinctness is per
   `owner/repo#issueNumber`, because issue numbers are only unique within a
   repo. Counts are summed across every repo. PR authors missing from the
   registry are warned about and paid nothing.
5. **Compute shares**. `computePayouts()` (`src/manifest.ts`) applies the payout
   rule below. A pool that is not a positive integer, or a cycle in which no
   issue was closed, throws instead of producing a distribution.
6. **Build the Merkle tree**. `buildMerkleRoot()` (`src/merkle.ts`) hashes the
   `(stellar, amount)` pairs — format in
   [Manifest reference](./manifest-reference.md#merkle-leaf-format).
7. **Write the manifest**. `manifests/cycle-<id>.json` (`cycle-<id>.dry-run.json`
   in a dry run) is written **before** any relay, so the on-chain root is always
   reproducible from a file in git history.
8. **Relay**. Unless `dry_run`, `relayCycleRoot()` (`src/relay.ts`) builds and
   signs `post_cycle_root(cycle_id, root, total_amount)`, submits it via Soroban
   RPC, polls until the transaction lands, and fails the run if it does not.
   `total_amount` is the sum of the manifest's entry amounts — the pool minus
   the dust remainder, not the pool.

## The payout rule

The single most important fact about this repo, and the rule
[splitstream-sdk-cli] re-simulates when it checks a cycle.

**An issue counts when it was closed via a merged PR that contains a recognized
GitHub closing keyword in one of the tracked repos, inside the cycle window.
That is the whole rule.**

- **No label of any kind is read.** Complexity, type, size and `points:*` labels
  are informational only and play no part in payout math.
- Recognized keywords are `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, and
  `resolve`/`resolves`/`resolved`, each followed by `#<issue-number>`, matched
  case-insensitively (`CLOSING_KEYWORD_RE` in `src/ingest.ts`). References are
  only matched inside the PR's own repo — `owner/repo#123` is not a closing
  reference, matching GitHub's own behaviour.
- Every qualifying issue counts equally: one issue, one share of the pool
  denominator. Nothing weights an issue by difficulty.
- Each distinct issue closed by a contributor's PRs increments their count
  exactly once; two PRs from the same author referencing the same issue are one
  issue. Counts are summed across every repo in the registry before shares are
  computed.
- Credit goes to the **PR author**, not the issue author. PR authors who are
  missing from the registry are never paid, and are reported loudly so they can
  be added before the next cycle.

The formula, applied in `BigInt`, never in JS `number`:

```
contributor_amount = floor(cycle_pool_amount * contributor_issues_closed / total_issues_closed)
```

Worked example — a pool of 5,000,000,000 stroops (500 XLM) with three
contributors closing 3, 2 and 2 issues (7 distinct issues total):

| Contributor | Issues closed | Amount (stroops) |
|---|---|---|
| alice | 3 | `floor(5000000000 * 3 / 7)` = 2,142,857,142 |
| bob | 2 | `floor(5000000000 * 2 / 7)` = 1,428,571,428 |
| carol | 2 | `floor(5000000000 * 2 / 7)` = 1,428,571,428 |
| **total** | **7** | **4,999,999,998** |

The undistributed 2 stroops are the **dust remainder**: recorded as
`dustRemainder` in the manifest and left in the vault. It is never silently
dropped and never auto-redistributed. Contributors with no qualifying issues do
not appear in the manifest at all.

## Cross-repo aggregation

One cycle covers every repo listed in the registry's `repos` list, not just the
repo the workflow runs in. The window is one shared boundary for the whole org:
a contributor who closed issues in splitstream-core and splitstream-sdk-cli this
cycle gets **one** combined amount and **one** Merkle leaf, not two claims. This
is what makes org-level settlement work — an open-source team's approved work is
usually spread across several repos under the same owner.

Set `repos` to exactly the repos whose merged PRs should pay out of this
treasury. A repo left out of the list contributes nothing, and no warning is
emitted for it.

## Oracle self-verification

Before any RPC call, `relayCycleRoot()` asserts that the configured
`ORACLE_SECRET_KEY` resolves to the exact `oracleAccount` declared in the
registry, and throws when it does not:

> oracle identity mismatch: ORACLE_SECRET_KEY resolves to G..., but the
> registry's oracleAccount is G...; refusing to relay

This matters in both directions. A stale registry means the cycle was computed
under a contributor set that no longer matches the deployed config, and relaying
from the wrong identity means signing a root the contract's oracle gate would
reject — or, worse, signing with a key that was never intended to hold that
authority. There is no override flag: the check runs in `relayCycleRoot` itself,
so every relay path goes through it. See [SECURITY.md](../SECURITY.md) for the
secret-handling rules around this keypair.

## The window boundary is compared as epochs, not strings

The `since` value is operator-supplied and only validated through `Date.parse`,
which also accepts shapes GitHub never emits (a `+02:00` offset, a date-only
value) that do not sort lexicographically next to GitHub's canonical
`YYYY-MM-DDTHH:MM:SSZ` `merged_at`. The window is therefore half-open —
`[since, now)` — and every comparison is on parsed epochs. Comparing the raw
strings would silently drop in-window PRs, which understates
`totalIssuesClosed` and so overpays every contributor in the cycle.

[splitstream-sdk-cli]: https://splitstream.gitbook.io/splitstream-sdk-cli/
