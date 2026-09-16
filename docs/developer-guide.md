# Developer guide

## Local setup

Node 24. `.nvmrc` pins `24` and `package.json` sets `engines.node` to
`>=24.0.0`; CI (`.github/workflows/ci.yml`) uses `node-version: 24`.

```bash
git clone https://github.com/Oyinkans0la12/splitstream-actions
cd splitstream-actions
npm install
```

| Command | Does |
|---|---|
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | `vitest run` — all unit tests. |
| `npm run test:watch` | vitest in watch mode. |
| `npm run test:integration` | `vitest run test/relay.integration.test.ts` — gated, see below. |
| `npm run build` | `ncc build src/index.ts -o dist` — the action bundle. |
| `npm run check` | `typecheck` + `test` + `build`. This is exactly what CI runs on every push and PR to `main`. |

`dist/` is deliberately not gitignored, because `action.yml` runs `dist/index.js`
(`using: node24`, `main: dist/index.js`) and `uses: ./` resolves there. **Any
change under `src/` needs a rebuilt bundle committed with it** — run
`npm run build` (or `npm run check`) and commit `dist/` in the same commit.

Layout:

```
src/index.ts                   orchestrator (inputs -> pipeline -> relay)
src/registry.ts                loads + validates splitstream.yml
src/ingest.ts                  Octokit: merged PRs + closing refs (no label reading)
src/counts.ts                  distinct closed issues per contributor
src/manifest.ts                floor payout formula + dust remainder + manifest format
src/merkle.ts                  leaf XDR hashing + sorted-pair tree
src/relay.ts                   Soroban RPC: cycle query, build/sign/submit/confirm
schemas/splitstream.schema.ts  the zod registry schema
```

Unit suites cover `registry`, `counts`, `manifest`, `merkle` (golden), and
`ingest`. `test/relay.integration.test.ts` also holds two always-on unit blocks —
the oracle self-verification check and `parseCycleInfo` — which run under plain
`npm test` against stubbed RPC servers; only the testnet blocks in that file are
gated.

## Verifying the Merkle implementation

This is the check that matters most: `src/merkle.ts` must produce the same bytes
as splitstream-core's Rust `merkle::leaf_hash` and `hash_pair`. If it drifts,
every root this repo relays is unclaimable.

`test/fixtures/merkle.golden.json` pins:

- the 64-byte leaf pre-image (`leaf.leafPayloadHex`) and the leaf hash
  (`leaf.leafHex`) for one `(address, amount)` pair;
- a 3-leaf root (`tree3.rootHex`, exercises odd-node promotion) and a 4-leaf
  root (`tree4.rootHex`).

`test/merkle.test.ts` asserts all of these, plus that the i128 encoding matches
the Rust SDK's `nativeToScVal` for amounts up to `2^127 - 1` and down to
`-2^127`.

Procedure after any change to `src/merkle.ts`, or to splitstream-core's
`merkle.rs`:

1. In a checkout of `splitstream-core`, regenerate the same three values from
   Rust (`Address::to_xdr` + `i128::to_xdr` concatenated, then `sha256`, and the
   same pair/tree construction). [CONTRIBUTING.md](../CONTRIBUTING.md#merkle-golden-fixture)
   carries a runnable `cargo test` snippet and the expected hex.
2. Compare against the fixture. The last recorded cross-check, on **2026-09-10**
   against `Oyinkans0la12/splitstream-core@main` (soroban-sdk 27.0.6), matched
   all three: leaf `e89c8b63…33c206`, `tree3` `42cb7efa…0663f94f`, `tree4`
   `b9f5a8ae…36197b24`.
3. If the Rust value differs, **fix `src/merkle.ts` first.** Update the fixture
   only once both implementations agree, in the same commit, and record the new
   values there too. Never re-pin the fixture to make a failing test pass — the
   fixture is pinned to the contract's implementation, not this repo's.

`splitstream-core`'s `merkle.rs` is frozen; treat any change to it as a breaking
protocol change and re-run this cross-check before trusting a relayed root.

## Gated integration tests (testnet)

`test/relay.integration.test.ts` runs its testnet blocks only when every gate is
set:

| Env var | Value |
|---|---|
| `RUN_RELAY_INTEGRATION` | `1` — required for the read-only suite |
| `SOROBAN_RPC_URL` | e.g. `https://soroban-testnet.stellar.org` |
| `SPLITSTREAM_VAULT_CONTRACT` | a deployed `C...` vault contract |
| `ORACLE_SECRET_KEY` | a funded `S...` relay keypair |
| `RUN_RELAY_SUBMIT` | `1` — additionally required for the state-changing submit test |

```bash
RUN_RELAY_INTEGRATION=1 \
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org \
SPLITSTREAM_VAULT_CONTRACT=C... \
ORACLE_SECRET_KEY=S... \
npm run test:integration
```

- **Read-only** (`RUN_RELAY_INTEGRATION=1`): `queryCycleInfo` against cycle 0
  (a `None` reply for a never-posted cycle is a valid result and passes) and
  `ledgerCloseTime` against the latest ledger.
- **Submit** (`RUN_RELAY_SUBMIT=1`): posts a real `post_cycle_root` with cycle id
  `999999`, a 32-byte root of `0xab`, and `totalAmount = 1`. The absurd cycle id
  keeps it from colliding with a real cycle, but it is still a real state change
  — run it only against a throwaway vault and a throwaway keypair, never the
  treasury vault or the production oracle secret.

### The manual `integration-check.yml` workflow

`.github/workflows/integration-check.yml` runs the gated suite on demand:
**`workflow_dispatch` only**, never on a schedule and never on push. It takes
one input, `run_submit` (boolean, default `false`), sets
`RUN_RELAY_INTEGRATION=1`, passes `run_submit` through as `RUN_RELAY_SUBMIT`,
supplies `SOROBAN_RPC_URL` and `SPLITSTREAM_VAULT_CONTRACT` from repository
variables and `ORACLE_SECRET_KEY` from a repository secret, and runs
`npm run test:integration`.

It starts with a gate check that fails the run when any of those three is unset.
Without it, unmet gates mean every test skips and the job reports green having
verified nothing.

It is separate from `cycle-close.yml` on purpose. That workflow is the real
cycle close: it runs on the sprint boundary, relays to the production vault, and
cannot be made conditional on a flag, because closing the cycle is the whole
point of the schedule. The integration check is never scheduled, is read-only
unless `run_submit` is set, and is pointed at a throwaway vault — so running it
costs nothing and cannot move treasury funds.
