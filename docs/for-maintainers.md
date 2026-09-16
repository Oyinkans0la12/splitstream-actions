# For maintainers

## Before the first cycle

Three things must exist in the repo that runs the cycle, and **only** that repo
— the registry is read from the job's working directory, never from the repos it
lists.

| What | Where | Required for |
|---|---|---|
| `.github/splitstream.yml` | the repo running the workflow | every run |
| `ORACLE_SECRET_KEY` | repository **secret** | every run except `dry_run=true` |
| `CYCLE_POOL_AMOUNT` | repository **variable** | every scheduled run |
| `CYCLE_ID` | repository **variable** | cycle 0 only |
| `GITHUB_TOKEN` | supplied by the workflow as `secrets.GITHUB_TOKEN` | every run |
| `FEE_BUMP_SECRET_KEY` | repository **secret** | optional |

Set `CYCLE_POOL_AMOUNT` under **Settings → Secrets and variables → Actions →
Variables** before the first scheduled run, or that run has no pool to
distribute.

## Triggering a cycle

`.github/workflows/cycle-close.yml` has two entry points.

**`schedule`** — `cron: "0 0 * * 1"`, Monday 00:00 UTC. Adjust it to your org's
sprint day. Per-cycle values come from variables: `cycle_pool_amount` from
`vars.CYCLE_POOL_AMOUNT`, `cycle_id` from `vars.CYCLE_ID`, and `dry_run` is
forced to `false`. `since` is not settable on this path.

**`workflow_dispatch`** — run it from the Actions tab:

| Input | Default | Meaning |
|---|---|---|
| `cycle_pool_amount` | — | Pool in stroops (string). Ignored on the schedule path. |
| `cycle_id` | — | Required for cycle 0 and dry runs; otherwise inferred from the committed `manifests/` trail. |
| `since` | — | Cycle start boundary (ISO 8601). Required for cycle 0 and dry runs; otherwise the last committed manifest's `generatedAt`. |
| `dry_run` | `false` | Compute the manifest and root only; skips queries, relay, and the manifest commit. |
| `commit_manifest` | `true` | Commit the generated manifest as the audit trail. |

The workflow requests `contents: write`, `issues: read`, `pull-requests: read`.

### The unset-variable guard

A schedule-only step fails the run when `vars.CYCLE_POOL_AMOUNT` is empty,
because otherwise the failure surfaces as the opaque platform error
`Input required and not supplied: cycle_pool_amount`. The guard's message points
at the setting to fix.

There is no equivalent guard for `CYCLE_ID`. It is only needed for cycle 0, and
by design the run fails with a clear action-level error
(`cycle_id input is required when no previous cycle manifest exists`) if it is
missing when there is nothing in `manifests/` yet. Note that a cycle-0 run
cannot use the schedule path at all: `since` is required in that case and the
schedule path never supplies it. Run cycle 0 manually.

## The registry — `.github/splitstream.yml`

```yaml
version: 1
repos:
  - owner: your-org
    name: splitstream-core
  - owner: your-org
    name: splitstream-actions
  - owner: your-org
    name: splitstream-sdk-cli
contributors:
  - github: octocat
    stellar: GABCD1234...   # G... public key, 56 chars, checksum verified
  - github: some-dev
    stellar: GXYZ9876...
oracleAccount: GORACLE...   # the relay's own public key
tokenContract: CABCDEF...   # deployed SEP-41 token contract id
vaultContract: CVAULT...    # the deployed splitstream-core contract for this treasury
network: testnet            # testnet | mainnet
```

| Field | Rules |
|---|---|
| `version` | must be `1`. |
| `repos` | non-empty. Each entry is `{ owner, name }`. Duplicate `(owner, name)` pairs are rejected, compared case-insensitively. Every repo listed is crawled; repos left out contribute nothing. |
| `contributors` | non-empty. `github` is validated against GitHub's handle shape (1–39 characters, alphanumeric or hyphen, no leading or trailing hyphen). `stellar` must be a checksum-verified `G...` ed25519 public key. Duplicate handles are rejected, compared case-insensitively. |
| `oracleAccount` | checksum-verified `G...` key. Must be the public key that `ORACLE_SECRET_KEY` signs for. |
| `tokenContract` | checksum-verified `C...` contract id. |
| `vaultContract` | checksum-verified `C...` contract id. Required. |
| `network` | `testnet` or `mainnet`. Selects the default RPC endpoint: `https://soroban-testnet.stellar.org` or `https://soroban-rpc.mainnet.stellar.gateway.fm`. Override with the `rpc_url` input. |

Unknown top-level keys are rejected, so a typo like `vaultContractt` fails the
run instead of being ignored. Nothing is skipped, repaired, or defaulted: any
validation failure aborts the cycle with a non-zero exit.

### Adding a contributor

Append `{ github, stellar }` to `contributors` and merge it before the cycle
that should pay them. A PR author who is not in the registry is never paid — the
run warns loudly with their handle, issue count, and the repos involved, and
carries on, so the fix always lands in the *next* cycle. Get both values right:
the `stellar` key is where the money goes, and a wrong-but-valid key is
undetectable until someone fails to claim.

### `oracleAccount` must match what is deployed

This is a property of the deployment, not of this file. The vault fixes its
oracle at `initialize()` and exposes no setter, so the account in instance
storage is the only one `post_cycle_root` will accept; this repo can only report
a mismatch (it refuses to relay), never resolve one. Changing the vault's oracle
means changing it on splitstream-core's side first — see its
[contract reference][splitstream-core-contract-reference] for how the oracle is
configured — and updating this registry in the same change. This repo has already been burned by getting it wrong once; see the
`fix(config)` commit that repointed `oracleAccount` at the deployed vault's
on-chain oracle. Rotating the keypair follows the same rule: new secret, new
`oracleAccount`, one change, never a half-applied rotation.

## Running a dry run first

Dispatch the workflow with `dry_run: true`. Dry-run mode still requires
`cycle_id` and `since` (there is no window to infer and no chain to query), still
requires `GITHUB_TOKEN`, and does **not** require `ORACLE_SECRET_KEY`. It writes
`manifests/cycle-<id>.dry-run.json`, skips every RPC call and the manifest
commit, and never advances the next cycle's window.

What to check in the log:

- `registry OK: N contributor(s), M repo(s), network=...` — the registry parsed,
  with the counts you expect.
- `ingested N merged PR(s) in window; M (PR, issue) contribution(s) with closing
  references` — N is PR volume, M is how many closing references were found.
- `issues counted: handle=N, ...` — the denominator. Confirm nobody is missing.
- Warnings for unregistered authors, each with their handle and issue count. Add
  them to the registry before the real cycle; they are paid nothing this cycle.
- The summary line `pool=... totalIssuesClosed=... dustRemainder=... (left in
  vault), merkleRoot=...`. `dustRemainder` is expected to be small; a large one
  means the pool barely divides among the counts.
- The manifest filename uses the `cycle_id` you passed, and for a real run the
  window log line reads `last committed cycle manifest: #N ...; new cycle #N+1
  window starts ...`.

## What the run commits

After a successful non-dry run, the workflow commits the generated manifest:
`git add manifests/`, commit `chore(manifest): record cycle <id> distribution
manifest` (or a "no manifest changes to commit" notice), then `git push`.

That push targets the branch the workflow runs on. If `main` is protected by a
ruleset requiring a pull request, the push is rejected unless the ruleset exempts
the workflow's token — exempt it, or change that step to open a PR instead. The
manifest commit is not optional housekeeping: it is what defines the next
cycle's window.

[splitstream-core-contract-reference]: https://splitstream.gitbook.io/splitstream-core/contract-reference
