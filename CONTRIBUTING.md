# Contributing to splitstream-actions

## Git workflow — non-negotiable

Same as splitstream-core:

- **Never `git add .`** — stage exactly what belongs to the change.
- **One commit per logical unit** — a feature, a fix, a doc, not a grab-bag.
- **Push immediately** after each commit; keep the branch short-lived.
- **Conventional commit format**: `feat(...)`, `fix(...)`, `test(...)`,
  `docs(...)`, `chore(...)`, `refactor(...)`.

Reference build sequence (each is its own commit):

```
chore(scaffold): initialize action.yml, package.json, tsconfig
feat(schema): add zod schema for splitstream.yml
feat(registry): load and validate contributor registry
feat(ingest): fetch merged PRs and extract closing issue references
feat(points): parse points labels and attribute points per contributor
feat(manifest): compute payout amounts and dust remainder
feat(merkle): leaf hashing matching splitstream-core
test(merkle): cross-language golden test against splitstream-core fixture
feat(merkle): sorted-pair tree construction and root computation
feat(relay): build and submit post_cycle_root via Soroban RPC
feat(workflow): wire wave-cycle-close.yml schedule trigger
test: schema validator unit tests (100-pt issue)
test: PR/points parser unit tests (150-pt issue)
test: end-to-end testnet relay integration test (200-pt issue, gated)
docs: add README, CONTRIBUTING, SECURITY
```

## Non-negotiables checklist

- [ ] Merkle leaf hashing verified byte-identical to splitstream-core via the
      golden test — never skip this before relaying a real cycle.
- [ ] Relay secret never logged, never committed, never echoed in a workflow
      debug step.
- [ ] All monetary amounts are strings/BigInt, never JS `number`.
- [ ] `dustRemainder` always explicitly computed and recorded — never silently
      dropped, never auto-redistributed.
- [ ] The Action fails loudly (non-zero exit, `core.setFailed`) on any registry
      validation error, RPC submission failure, or unconfirmed transaction.

## Layout

```
src/index.ts                 orchestrator (inputs -> pipeline -> relay)
src/registry.ts              loads + validates splitstream.yml
src/ingest.ts                Octokit: merged PRs, closing refs, issue labels
src/points.ts                label -> points, cross-repo attribution
src/manifest.ts              floor payout formula + dust remainder + manifest
src/merkle.ts                leaf XDR hashing + sorted-pair tree
src/relay.ts                 Soroban RPC: cycle query, build/sign/submit/confirm
schemas/splitstream.schema.ts  zod schema (exported for reuse/tests)
```

## Testing

```bash
npm run typecheck   # strict TS, no implicit any
npm test            # vitest — unit tests always run
```

Unit suites: `registry`, `points`, `manifest`, `merkle` (golden), `ingest`.

### Testnet integration tests (gated)

`test/relay.integration.test.ts` runs only when every gate is set:

```bash
RUN_RELAY_INTEGRATION=1 \
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org \
SPLITSTREAM_VAULT_CONTRACT=C... \
ORACLE_SECRET_KEY=S... \
npm test
```

- Read-only tests: `queryCycleInfo` + `ledgerCloseTime` against testnet.
- The state-changing submit test additionally requires `RUN_RELAY_SUBMIT=1` —
  it posts a real `post_cycle_root` with a deliberately absurd cycle id
  (`999999`) so it can never collide with a real cycle. Run it only against a
  throwaway vault/contract.

## Merkle golden fixture

`test/fixtures/merkle.golden.json` pins the leaf pre-image bytes, the leaf hash,
and two tree roots. The values were derived independently from the XDR layout
(ScVal-form `ToXdr`, cross-checked against soroban-sdk's Rust source), but the
**authoritative check is splitstream-core's own Rust test suite**. Before the
first real relay, regenerate the fixture there:

```rust
// In splitstream-core's tests (soroban-sdk):
use soroban_sdk::{xdr::{ToXdr, Hash}, Address, Env};

#[test]
fn leaf_hash_golden() {
    let env = Env::default();
    let address = Address::from_string(&env, &String::from_str(&env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"));
    let amount: i128 = 1052631578;
    let mut buf = Vec::new();
    address.to_xdr(&env).into_iter().for_each(|b| buf.push(b));
    // or: buf.extend(address.to_xdr(&env).to_vec());
    buf.extend(amount.to_xdr(&env).to_vec());
    let hash = env.crypto().sha256(&buf.into());
    println!("leaf_hex={}", hex::encode(hash.to_array()));
    // Expect: e89c8b63a02273483139b1e3ebeda17e3354993ebf3a8da9400a52d79c33c206
}
```

Then confirm `test/merkle.test.ts` still passes; if the Rust value differs,
**fix `src/merkle.ts` first** — nothing else in this repo matters until leaf
hashing matches the contract. Update the fixture only after the implementations
agree, and record the regenerated values in the same commit.

The tree fixtures (3-leaf with an odd-node promotion, 4-leaf) use the same leaf
format with ascending-pubkey-byte leaf order and sorted-pair hashing; mirror the
same procedure in splitstream-core's `merkle.rs` tests.