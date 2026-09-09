# splitstream-actions

The bridge that turns closed GitHub issues/PRs into a signed on-chain distribution
manifest for [splitstream-core]. Runs as a GitHub Action on the Wave sprint
boundary (weekly schedule) or manually. **This repo never holds funds** — it only
computes and relays: it reads a contributor registry, crawls merged PRs, extracts
point values, computes each contributor's share of the cycle pool, builds a Merkle
tree over the payout leaves, and relays the resulting root to the deployed
splitstream-core contract via Soroban RPC.

> Org-level settlement: a maintainer's Wave-approved work is often spread across
> several repos under the same org (core contracts + app + tooling). SplitStream
> settles at the org/treasury level — points from **every repo listed in
> `splitstream.yml`** are summed per contributor before shares are computed.

---

## How it works

```
splitstream.yml (registry) ──┐
cycle_pool_amount (input) ───┤
since / on-chain last cycle ─┼─► ingest (Octokit) ─► points ─► manifest ─► merkle ─► relay (Soroban RPC)
GITHUB_TOKEN / ORACLE_SECRET ┘                                                     └─► manifests/cycle-<id>.json
```

1. **Registry** — loads and zod-validates `.github/splitstream.yml`. Any
   malformed strkey, duplicate handle, empty repo list, or missing
   `vaultContract` fails the run loudly (`core.setFailed`, non-zero exit).
   Nothing is ever silently skipped.
2. **Cycle window** — for cycles after 0, the window starts at the close time of
   the previous on-chain cycle's `end_ledger` (queried via
   `splitstream-core.get_cycle_info`). For cycle 0 and dry runs, the `since`
   input supplies the boundary. One shared window for the whole org.
3. **Ingest** — for every repo in the registry, crawls merged PRs inside the
   window, matches GitHub closing keywords (`Closes/Fixes/Resolves #N`) in PR
   bodies, and loads the linked issues (always resolved as
   owner/repo/issueNumber — numbers are only unique per repo).
4. **Points** — issues carrying `points:100`, `points:150`, or `points:200`
   attribute points to the **PR author** (not the issue author), summed across
   all repos. PR authors missing from the registry are never paid; they are
   reported loudly so they can be added before the next cycle.
5. **Payouts** — the frozen formula, applied in BigInt, never JS number:

   ```
   contributor_amount = floor(cycle_pool_amount * contributor_points / total_points_this_cycle)
   ```

   The integer-division remainder is recorded as `dustRemainder` in the manifest
   and left in the vault — never silently dropped, never auto-redistributed.
6. **Manifest + Merkle** — the distribution manifest is written to
   `manifests/cycle-<id>.json` **before** any relay, so the on-chain root is
   always independently reproducible from a file in git history. The Merkle
   leaves are `sha256(Address XDR || i128 XDR)` — byte-identical to
   splitstream-core's `merkle::leaf_hash` (see [Merkle leaf](#merkle-leaf-format)).
7. **Relay** — unless `dry_run`, builds and signs
   `post_cycle_root(cycle_id, root, total_amount)` with the oracle keypair,
   submits via Soroban RPC, **polls until the transaction lands**, and fails the
   run if it doesn't. The tx hash + ledger are written to the job summary.
   An optional `FEE_BUMP_SECRET_KEY` wraps the tx in a fee bump when the relay
   account's own balance is a concern.

## Configuration — `.github/splitstream.yml`

The registry typically lives in the org's treasury repo (or whichever repo runs
the scheduled workflow). This repo validates it against the strict zod schema in
[`schemas/splitstream.schema.ts`](schemas/splitstream.schema.ts):

```yaml
version: 1
repos:                                  # every repo whose merged PRs count toward this treasury's cycle
  - owner: your-org
    name: splitstream-core
  - owner: your-org
    name: splitstream-actions
  - owner: your-org
    name: splitstream-sdk-cli
contributors:
  - github: octocat
    stellar: GABCD1234...               # G... public key, 56 chars, checksum-verified
  - github: some-dev
    stellar: GXYZ9876...
oracleAccount: GORACLE...               # the relay's own public key, for self-verification
tokenContract: CABCDEF...               # deployed SEP-41 token contract id
vaultContract: CVAULT123...             # one deployed splitstream-core contract for the whole org treasury
network: testnet                        # "testnet" | "mainnet"
```

Validation is deliberately strict: G/C strkeys are checksum-verified (length +
version byte + CRC16-XModem), duplicate GitHub handles (case-insensitive) and
duplicate repos are rejected, `repos`/`contributors` must be non-empty,
`vaultContract` is required, `network` must be `testnet`|`mainnet`, and unknown
top-level keys are rejected so typos like `vaultContractt` cannot pass silently.

### Points labels

Closed issues carry exactly one of `points:100`, `points:150`, `points:200`
(trimmed, case-insensitive — the single normalization point lives in
[`src/points.ts`](src/points.ts)). If a repo historically uses different label
names, normalize them there, in one place.

## Action inputs & outputs

See [`action.yml`](action.yml) for the full reference. Key inputs:

| Input | Required | Meaning |
|---|---|---|
| `cycle_pool_amount` | yes | Pool to distribute, in stroops (string). Set per cycle — never inferred. |
| `cycle_id` | cycle 0 / dry runs | Cycle id for the manifest and relay; otherwise inferred on-chain. |
| `since` | cycle 0 / dry runs | Cycle start boundary (ISO 8601). |
| `dry_run` | no | Compute manifest + Merkle root only; skip queries and relay. |
| `config_path` | no | Path to the registry (default `.github/splitstream.yml`). |
| `rpc_url` | no | Soroban RPC override; defaults from `network`. |
| `manifest_dir` | no | Manifest output dir (default `manifests`). |

Outputs: `cycle_id`, `manifest_path`, `merkle_root`, `dust_remainder`, `dry_run`.

### Secrets / environment

- `GITHUB_TOKEN` — Octokit auth (workflow supplies `secrets.GITHUB_TOKEN`).
- `ORACLE_SECRET_KEY` — the relay/oracle keypair (S... secret). **Required unless
  `dry_run=true`. Never logged, never written to a file, never echoed in a debug
  step.** This is the account that signs `post_cycle_root`; it must exist and be
  funded on the target network.
- `FEE_BUMP_SECRET_KEY` — optional; a second funded keypair used as the fee-bump
  source when the oracle's own XLM balance is a concern.

## Workflow

[`.github/workflows/wave-cycle-close.yml`](.github/workflows/wave-cycle-close.yml)
runs the action weekly (`schedule`) or via `workflow_dispatch`. For schedule runs,
per-cycle configuration comes from repo variables:

- `CYCLE_POOL_AMOUNT` — required; the pool for that week's cycle, in stroops.
- `CYCLE_ID` — only needed for cycle 0; subsequent ids come from on-chain state.

The workflow commits the generated manifest (`manifests/cycle-<id>.json`) as the
audit trail and pushes it — the on-chain root must always be reproducible from
git history. Manual runs can pass `dry_run: true` to self-test without touching
the chain.

## Manifest format

Shared contract with splitstream-sdk-cli:

```json
{
  "cycleId": 4,
  "generatedAt": "2026-09-08T00:00:00Z",
  "poolAmount": "5000000000",
  "totalPoints": 950,
  "entries": [
    { "github": "octocat", "stellar": "GABCD...", "points": 200, "amount": "1052631578" }
  ],
  "dustRemainder": "3",
  "merkleRoot": "base64-or-hex-encoded-32-byte-root"
}
```

All amounts are decimal strings (stroops). `dustRemainder` is always present —
even when it is `"0"`.

## Merkle leaf format

```
leaf = sha256( xdr_encode(ScVal(Address(stellar_pubkey))) || xdr_encode(ScVal(i128(amount))) )

Address XDR (44 bytes):  u32(SCV_ADDRESS=18) | u32(SC_ADDRESS_TYPE_ACCOUNT=0) | u32(publickey ED25519=0) | ed25519(32)
i128 XDR     (20 bytes):  u32(SCV_I128=10) | int64 hi | uint64 lo
```

This is the full ScVal-form XDR produced by soroban-sdk's `ToXdr` trait (verified
against the Rust SDK source — `ToXdr` serializes "to XDR in its ScVal form"). We
deliberately do **not** use any Merkle library's default leaf hashing.

Tree construction: **sorted-pair Merkle tree** — at each level, children are
paired left-to-right and concatenated in ascending byte order before hashing; an
odd node is promoted unchanged. Leaves are ordered by **ascending stellar pubkey
bytes** (deterministic, independent of handle casing or points), so the root is
reproducible from the manifest alone. `splitstream-core`'s verifier must use the
same leaf order and pair sorting.

The cross-language golden test (`test/merkle.test.ts` +
`test/fixtures/merkle.golden.json`) pins the leaf hash and tree roots; see
[CONTRIBUTING.md](CONTRIBUTING.md#merkle-golden-fixture) for regenerating the
fixture against splitstream-core's Rust test suite.

## Contract interface (splitstream-core)

The one integration point with the deployed contract, isolated in
[`src/relay.ts`](src/relay.ts):

- `get_cycle_info() -> Option<CycleInfo>` — latest posted cycle, encoded as an
  ScVal vec `[cycle_id, start_ledger, end_ledger, root, total_amount]`
  (`cycle_id`/ledgers as u32 or i128); `None` when no cycle exists.
- `post_cycle_root(cycle_id: u32, root: Bytes(32), total_amount: i128)`

If the deployed contract's field types/order differ, adjust `parseCycleInfo`
there — it is the only place that decodes the reply, and it throws rather than
guess on any unexpected shape.

## Development

```bash
npm install
npm run check      # typecheck + unit tests + ncc build
npm test           # unit tests only
npm run typecheck
npm run build      # ncc bundle -> dist/ (action runtime uses dist/index.js)
```

Testnet integration tests are gated behind env flags — see
[CONTRIBUTING.md](CONTRIBUTING.md#testing).

[splitstream-core]: https://github.com/your-org/splitstream-core