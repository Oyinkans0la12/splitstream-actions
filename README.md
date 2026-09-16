<p align="center">
  <img src="assets/splitstream-banner.svg" alt="SplitStream banner" width="700" />
</p>

# SplitStream Actions

**Closes a contributor sprint cycle and puts contributor payouts on-chain — computed from GitHub, relayed to Stellar, in one workflow run.**

![CI](https://github.com/Oyinkans0la12/splitstream-actions/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-24-green)
![Network](https://img.shields.io/badge/network-testnet-orange)
![License](https://img.shields.io/github/license/Oyinkans0la12/splitstream-actions)

[Docs](https://splitstream.gitbook.io/splitstream-actions/) · [Testnet Explorer](https://stellar.expert/explorer/testnet/contract/CCC2LP2LOYZOLA2JW4C4K7JMR3TRJZIKHDSQYSFJ3R3MCDJLVBT3PZOC) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

For a maintainer, one run of this action does the whole weekly close-out. It
crawls the merged PRs from the cycle window across every repo in your registry,
counts the issues each contributor closed, computes each contributor's share of
the cycle pool with a frozen integer-only formula, writes the result as a
distribution manifest committed to the repo as an audit trail, and relays the
Merkle root of those payouts to the deployed [splitstream-core] contract.

It runs as a GitHub Action on the contributor sprint boundary (weekly schedule) or
manually. **This repo never holds funds** — it only computes and relays.
Contributors then claim their share against that root with [splitstream-sdk-cli].

> Org-level settlement: an open-source team's approved work is often spread across
> several repos under the same org (core contracts + app + tooling). SplitStream
> settles at the org/treasury level — issues closed in **every repo listed in
> `splitstream.yml`** are summed per contributor before shares are computed.

> **Part of SplitStream** — this repo is one of three: [splitstream-core] (the
> Soroban vault contract the root is relayed to), **splitstream-actions** (this
> repo, the GitHub→chain bridge), and [splitstream-sdk-cli] (the client SDK and
> CLI that reads the manifests this action writes).

---

## Quick start

Three things must exist in the repo that runs the cycle:

1. **A registry** at `.github/splitstream.yml`. This file **must exist in the
   repo running the action** — it is read from the job's working directory
   (`config_path` defaults to `.github/splitstream.yml`), not from any of the
   repos it lists. If it is missing, the run fails validation before doing
   anything else. This is the most common setup mistake; see
   [Configuration](#configuration--githubsplitstreamyml) for the shape.
2. **The workflow**, invoking this action with a pool amount.
3. **Secrets and variables** — `ORACLE_SECRET_KEY` (a repository **secret**) and,
   for scheduled runs, `CYCLE_POOL_AMOUNT` (a repository **variable**).

```yaml
- uses: actions/checkout@v4
- uses: Oyinkans0la12/splitstream-actions@main
  with:
    cycle_pool_amount: ${{ vars.CYCLE_POOL_AMOUNT }}   # required; stroops, as a string
    cycle_id: ${{ vars.CYCLE_ID }}                     # only needed for cycle 0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ORACLE_SECRET_KEY: ${{ secrets.ORACLE_SECRET_KEY }} # required unless dry_run
```

The working example is this repo's own
[`.github/workflows/cycle-close.yml`](.github/workflows/cycle-close.yml):
weekly `schedule` plus `workflow_dispatch`, with `CYCLE_POOL_AMOUNT` and
`CYCLE_ID` read from repository variables on the scheduled path. Set
`CYCLE_POOL_AMOUNT` under Settings → Secrets and variables → Actions → Variables
**before** the first scheduled run, or the run has no pool to distribute.

Pass `dry_run: true` for a first run — it computes the manifest, dust remainder
and Merkle root while skipping every ledger query and the relay.

## The count-based payout rule

The single most important behavioural fact about this action. It is frozen, and
it is the exact rule [splitstream-sdk-cli] mirrors when it re-simulates a cycle.

**Any issue closed via a merged PR containing a recognized closing keyword
(`Closes #N` / `Fixes #N` / `Resolves #N`, case-insensitive) in one of the
tracked repos, inside the cycle window.** That is the whole rule.

- **No label of any kind is read.** Complexity, type, size and `points:*` labels
  are informational only and play no part in payout math.
- Every qualifying issue counts equally — **one issue, one share** of the pool
  denominator. Nothing weights an issue by difficulty.
- Each distinct issue closed by a contributor's PRs increments their count
  exactly once, and counts are summed across every repo in the registry before
  shares are computed.
- Credit is attributed to the **PR author** (the PR closes the issue, the PR
  author did the work), not the issue author. PR authors missing from the
  registry are never paid; they are reported loudly so they can be added before
  the next cycle.

The formula, applied in BigInt, never JS number:

```
contributor_amount = floor(cycle_pool_amount * contributor_issues_closed / total_issues_closed_this_cycle)
```

The integer-division remainder is recorded as `dustRemainder` in the manifest
and left in the vault — never silently dropped, never auto-redistributed.

## How it works

```
splitstream.yml (registry) ──┐
cycle_pool_amount (input) ───┤
since / last committed manifest ─┼─► ingest (Octokit) ─► counts ─► manifest ─► merkle ─► relay (Soroban RPC)
GITHUB_TOKEN / ORACLE_SECRET ┘                                                     └─► manifests/cycle-<id>.json
```

1. **Registry** — loads and zod-validates `.github/splitstream.yml`. Any
   malformed strkey, duplicate handle, empty repo list, or missing
   `vaultContract` fails the run loudly (`core.setFailed`, non-zero exit).
   Nothing is ever silently skipped.
2. **Cycle window** — the window for cycle *N* starts at the `generatedAt` of
   the last committed manifest, `manifests/cycle-(N-1).json`, this repo's own
   audit trail. The deployed contract has no "latest cycle" call and is never
   queried for the boundary; `get_cycle_info(cycle_id)` is called only as a
   sanity check that the committed manifest's cycle actually landed on-chain.
   For cycle 0 (no committed manifest) and dry runs, the `since` input supplies
   the boundary. One shared window for the whole org.
3. **Ingest** — for every repo in the registry, crawls merged PRs inside the
   window and matches GitHub closing keywords in PR bodies. Issue numbers are
   always resolved as owner/repo/issueNumber — numbers are only unique per repo.
4. **Payouts** — the
   [count-based payout rule](#the-count-based-payout-rule) is applied per
   contributor. The leaf format is unchanged by that formula: the contract only
   ever verifies `(address, amount)` pairs, so the formula never enters the leaf.
5. **Manifest + Merkle** — the distribution manifest is written to
   `manifests/cycle-<id>.json` **before** any relay, so the on-chain root is
   always independently reproducible from a file in git history. The Merkle
   leaves are `sha256(Address XDR || i128 XDR)` — byte-identical to
   splitstream-core's `merkle::leaf_hash` (see
   [Merkle leaf format](#merkle-leaf-format)).
6. **Relay** — unless `dry_run`, builds and signs
   `post_cycle_root(cycle_id, root, total_amount)` with the oracle keypair,
   submits via Soroban RPC, **polls until the transaction lands**, and fails the
   run if it doesn't. Before any RPC call, the configured secret is asserted to
   resolve to the registry's `oracleAccount` — a mismatch fails loudly instead of
   relaying from the wrong identity. The tx hash + ledger are written to the job
   summary. An optional `FEE_BUMP_SECRET_KEY` wraps the tx in a fee bump when the
   relay account's own balance is a concern.

## Configuration — `.github/splitstream.yml`

The registry must be present in the repo that runs the action — normally the
org's treasury repo, whichever repo runs the scheduled workflow (see
[Quick start](#quick-start)). It is validated against the strict zod schema in
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

`vaultContract` and `tokenContract` must match the ids under
[Deployed — Testnet](#deployed--testnet), and `oracleAccount` must be the
account that `ORACLE_SECRET_KEY` signs for.

## Workflow

[`.github/workflows/cycle-close.yml`](.github/workflows/cycle-close.yml)
runs the action weekly (`schedule`) or via `workflow_dispatch`. For schedule runs,
per-cycle configuration comes from repo variables:

- `CYCLE_POOL_AMOUNT` — required; the pool for that week's cycle, in stroops.
- `CYCLE_ID` — only needed for cycle 0; subsequent ids come from the committed
  `manifests/` audit trail (last committed cycle + 1).

The workflow commits the generated manifest (`manifests/cycle-<id>.json`) as the
audit trail and pushes it — the on-chain root must always be reproducible from
git history. Manual runs can pass `dry_run: true` to self-test without touching
the chain.

## Action inputs & outputs

See [`action.yml`](action.yml) for the full reference. Key inputs:

| Input | Required | Meaning |
|---|---|---|
| `cycle_pool_amount` | yes | Pool to distribute, in stroops (string). Set per cycle — never inferred. |
| `cycle_id` | cycle 0 / dry runs | Cycle id for the manifest and relay; otherwise inferred from the committed `manifests/` audit trail (last cycle + 1). |
| `since` | cycle 0 / dry runs | Cycle start boundary (ISO 8601); otherwise taken from the last committed manifest's `generatedAt`. |
| `dry_run` | no | Compute manifest + Merkle root only; skip queries and relay. |
| `config_path` | no | Path to the registry (default `.github/splitstream.yml`). |
| `rpc_url` | no | Soroban RPC override; defaults from `network`. |
| `manifest_dir` | no | Manifest output dir (default `manifests`). |

Outputs: `cycle_id`, `manifest_path`, `merkle_root`, `dust_remainder`, `dry_run`.

### Secrets / environment

- `GITHUB_TOKEN` — Octokit auth (workflow supplies `secrets.GITHUB_TOKEN`).
- `ORACLE_SECRET_KEY` — the relay/oracle keypair (S... secret). **Required unless
  `dry_run=true`. Never logged, never written to a file, never echoed in a debug
  step.** This is the account that signs `post_cycle_root`; it must exist, be
  funded on the target network, and resolve to the registry's `oracleAccount`
  (enforced before every relay).
- `FEE_BUMP_SECRET_KEY` — optional; a second funded keypair used as the fee-bump
  source when the oracle's own XLM balance is a concern.

## Manifest format

The action is the **producer** of this format; [splitstream-sdk-cli] consumes it.

```json
{
  "cycleId": 4,
  "generatedAt": "2026-09-10T00:00:00Z",
  "poolAmount": "5000000000",
  "totalIssuesClosed": 4,
  "entries": [
    { "github": "octocat", "stellar": "GABCD...", "issuesClosed": 3, "amount": "3750000000" }
  ],
  "dustRemainder": "3",
  "merkleRoot": "hex-encoded-32-byte-root"
}
```

All amounts are decimal strings (stroops). `totalIssuesClosed` is the sum of
`entries[].issuesClosed` — the payout denominator. `dustRemainder` is always
present — even when it is `"0"`.

## Merkle leaf format

```
leaf = sha256( xdr_encode(ScVal(Address(stellar_pubkey))) || xdr_encode(ScVal(i128(amount))) )

Address XDR (44 bytes):  u32(SCV_ADDRESS=18) | u32(SC_ADDRESS_TYPE_ACCOUNT=0) | u32(publickey ED25519=0) | ed25519(32)
i128 XDR     (20 bytes):  u32(SCV_I128=10) | int64 hi | uint64 lo
```

This is the full ScVal-form XDR produced by soroban-sdk's `ToXdr` trait (verified
against the Rust SDK source — `ToXdr` serializes "to XDR in its ScVal form"). We
deliberately do **not** use any Merkle library's default leaf hashing. **The leaf
format is independent of the payout formula** — it hashes only `(address,
amount)` pairs, so the count-based formula needed no contract change.

Tree construction: **sorted-pair Merkle tree** — at each level, children are
paired left-to-right and concatenated in ascending byte order before hashing; an
odd node is promoted unchanged. Leaves are ordered by **ascending stellar pubkey
bytes** (deterministic, independent of handle casing), so the root is
reproducible from the manifest alone. `splitstream-core`'s verifier must use the
same leaf order and pair sorting.

The cross-language golden test (`test/merkle.test.ts` +
`test/fixtures/merkle.golden.json`) pins the leaf hash and tree roots; see
[CONTRIBUTING.md](CONTRIBUTING.md#merkle-golden-fixture) for the verified
2026-09-10 cross-check against splitstream-core's Rust test suite.

## Contract interface (splitstream-core)

The one integration point with the deployed contract, isolated in
[`src/relay.ts`](src/relay.ts):

- `get_cycle_info(cycle_id: u64) -> Option<CycleInfo>` — one cycle's info,
  keyed by the id the caller supplies (the contract cannot enumerate cycles);
  `None` (ScVal void) when that cycle has no record. `CycleInfo` is a
  `#[contracttype]` record serialized as an ScVal map keyed by field-name
  symbols: `{ root: Bytes(32), total_amount: i128, posted_at: u64,
  claims_started: bool, replaced: bool }`.
- `post_cycle_root(cycle_id: u64, root: Bytes(32), total_amount: i128)`

If the deployed contract's field types/order differ, adjust `parseCycleInfo`
there — it is the only place that decodes the reply, and it throws rather than
guess on any unexpected shape.

## Deployed — Testnet

| | |
|---|---|
| Vault contract (relay target) | `CCC2LP2LOYZOLA2JW4C4K7JMR3TRJZIKHDSQYSFJ3R3MCDJLVBT3PZOC` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CCC2LP2LOYZOLA2JW4C4K7JMR3TRJZIKHDSQYSFJ3R3MCDJLVBT3PZOC |
| Network | Test SDF Network ; September 2015 (Testnet) |

## Development

```bash
npm install
npm run check      # typecheck + unit tests + ncc build
npm test           # unit tests only
npm run test:integration  # gated testnet suite (skips unless gates are set)
npm run typecheck
npm run build      # ncc bundle -> dist/ (action runtime uses dist/index.js)
```

Testnet integration tests are gated behind env flags — see
[CONTRIBUTING.md](CONTRIBUTING.md#testing).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
build/test workflow and PR expectations, and [SECURITY.md](SECURITY.md) for
the security model and responsible-disclosure process. Found a bug or have a
feature idea? [Open an issue](https://github.com/Oyinkans0la12/splitstream-actions/issues).

## Contributors

[![Contributors](https://contrib.rocks/image?repo=Oyinkans0la12/splitstream-actions)](https://github.com/Oyinkans0la12/splitstream-actions/graphs/contributors)

## Community

- 💬 **GitHub Issues** — bug reports, feature requests, and design discussion
- 🔒 **Security** — report vulnerabilities privately per [SECURITY.md](SECURITY.md)

## Socials

- 💬 **Discord** — [join the server](https://discord.gg/DzSUheDtQ)
- ✈️ **Telegram** — [join the group](https://t.me/+zOMeL6fD6uY1ODhk)

## Maintainers

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Oyinkans0la12">
        <img src="https://github.com/Oyinkans0la12.png" width="100" alt="Oyinkans0la12" />
      </a>
      <br />
      <strong>Oyinkans0la12</strong>
      <br />
      Smart Contract Engineer
      <br />
      <a href="https://github.com/Oyinkans0la12">GitHub</a>
    </td>
    <td align="left">
      <strong>Contact</strong>
      <br />
      <a href="https://github.com/Oyinkans0la12/splitstream-actions/issues">GitHub Issues</a> — primary channel for bugs, feature requests, and design discussion
      <br />
      🔒 For vulnerabilities, use a <a href="https://github.com/Oyinkans0la12/splitstream-actions/security/advisories/new">private security advisory</a> per SECURITY.md
    </td>
  </tr>
</table>

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

[splitstream-core]: https://github.com/Oyinkans0la12/splitstream-core
[splitstream-sdk-cli]: https://github.com/Oyinkans0la12/splitstream-sdk-cli
