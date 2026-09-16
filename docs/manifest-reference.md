# Manifest reference

The distribution manifest is the artifact of a cycle: who gets paid, how much,
and the Merkle root those amounts hash to. This repo is the **authoritative
source for this format** — it is produced by `buildManifest()` in
`src/manifest.ts` and consumed by [splitstream-sdk-cli].

The manifest is written to `manifests/cycle-<id>.json` and committed to git
before the relay runs. Treat the committed file, not the chain, as the record of
what was distributed.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `cycleId` | integer (JSON number) | Cycle id, taken from the committed audit trail (last cycle + 1) or the `cycle_id` input. Must equal the `<id>` in the filename. |
| `generatedAt` | string, ISO 8601 | `new Date().toISOString()` at build time. This is the next cycle's window start. |
| `poolAmount` | **decimal string** | The `cycle_pool_amount` input in stroops, echoed unchanged. |
| `totalIssuesClosed` | integer (JSON number) | Sum of `entries[].issuesClosed` — the payout denominator. |
| `entries` | array | One entry per contributor with at least one qualifying issue. Contributors with none are absent. |
| `entries[].github` | string | GitHub handle, in the registry's casing. |
| `entries[].stellar` | string | The contributor's `G...` public key. |
| `entries[].issuesClosed` | integer (JSON number) | Distinct issues this contributor closed this cycle. |
| `entries[].amount` | **decimal string** | Payout in stroops, from the floor formula. |
| `dustRemainder` | **decimal string** | `poolAmount - sum(entries[].amount)`. Always present, including `"0"`. |
| `merkleRoot` | string | 64 hex characters — the 32-byte root over the payout leaves. |

Monetary values are decimal strings, never JSON numbers: a pool or a payout
large enough to exceed `Number.MAX_SAFE_INTEGER` must survive a round trip
through a consumer that parses JSON with floats.

`entries` is sorted by `issuesClosed` descending, then by handle. That is review
order only — it does not affect the root, because the tree pins leaf order
itself.

```json
{
  "cycleId": 4,
  "generatedAt": "2026-09-10T00:00:00.000Z",
  "poolAmount": "5000000000",
  "totalIssuesClosed": 7,
  "entries": [
    { "github": "alice", "stellar": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "issuesClosed": 3, "amount": "2142857142" },
    { "github": "bob", "stellar": "GC3BLRQMHJGDIBAVHA2WQOY6Q7CBLAZUNZPIR5NYAX6XTQZUSTVRHHPK", "issuesClosed": 2, "amount": "1428571428" },
    { "github": "carol", "stellar": "GCWSW5ZMOHGEBLUFKL7PZGPZKW3OMMDCAT4OMBFKWHXNIUGWGG43HQ7C", "issuesClosed": 2, "amount": "1428571428" }
  ],
  "dustRemainder": "2",
  "merkleRoot": "8b3adf9e99322e6ba79ec199a035e5dbee758160402c4e15ee357b0f445685f2"
}
```

That root is the real root of the three entries above, computed with
`buildMerkleRoot()` — not a placeholder.

## Merkle leaf format

The leaf is the one thing the contract and every consumer must agree on
byte-for-byte. A leaf hashes exactly two values — the contributor's Stellar
address and their payout amount:

```
leaf = sha256( xdr_encode(ScVal(Address(stellar_pubkey))) || xdr_encode(ScVal(i128(amount))) )

Address XDR (44 bytes):  u32(SCV_ADDRESS=18) | u32(SC_ADDRESS_TYPE_ACCOUNT=0) | u32(publickey ED25519=0) | ed25519(32)
i128 XDR     (20 bytes): u32(SCV_I128=10) | int64 hi | uint64 lo
```

Both halves are the full ScVal-form XDR that soroban-sdk's `ToXdr` trait
produces — including the ScVal union discriminant, not a bare 32-byte key or a
bare integer. `scvI128()` and `addressScVal()` in `src/merkle.ts` build them;
`test/merkle.test.ts` additionally asserts the i128 encoding against the Rust
SDK's `nativeToScVal` for amounts including `i128::MAX`, `i128::MIN` and
negative values.

The leaf deliberately does **not** use any Merkle library's default leaf
hashing. It also hashes only `(address, amount)` pairs, which is why the
count-based payout rule needed no contract change: the formula never enters the
leaf.

## Tree construction

A sorted-pair Merkle tree:

- Leaves are ordered by **ascending stellar public key bytes** — deterministic
  and independent of handle casing, so the root is reproducible from the
  manifest alone, regardless of `entries` order.
- At each level, children are paired left-to-right and concatenated in ascending
  byte order before hashing, so a pair `(a, b)` hashes the same as `(b, a)`.
- An odd node is promoted to the next level unchanged.
- A single-leaf tree's root is that leaf.

`splitstream-core`'s verifier must use the same leaf order and the same pair
sorting; a tree that concats children in insertion order produces a different
root and rejects every claim.

The golden fixture `test/fixtures/merkle.golden.json` pins the leaf pre-image
bytes, the leaf hash, and a 3-leaf root (odd-node promotion) plus a 4-leaf root.
See the [developer guide](./developer-guide.md#verifying-the-merkle-implementation)
for how to re-verify it against splitstream-core's Rust implementation.

## Where manifests live, and why the newest one is the source of truth

Committed manifests are `manifests/cycle-<id>.json`. The workflow's
`wave-cycle-close.yml` commits the generated file as the audit trail.

`readLastManifestWindow()` (`src/manifest.ts`) scans that directory for files
matching `^cycle-(\d+)\.json$`, takes the highest id, and returns its
`cycleId` and `generatedAt`. The next cycle starts at that timestamp. This is
the only way to answer "what was the last cycle?" — the deployed contract cannot
enumerate its cycles, it only answers `get_cycle_info(cycle_id)` for an id you
already know.

Two consequences:

- **Dry-run artifacts never count.** Dry runs write
  `cycle-<id>.dry-run.json`, which the regex above does not match, so a dry run
  can never advance the window.
- **A corrupt audit trail fails the run rather than guessing.** The scan throws
  on an unreadable directory, malformed JSON, a missing or unparseable
  `generatedAt`, or a filename whose `<id>` disagrees with the file's `cycleId`.
  A missing directory (`ENOENT`) is not an error — it means cycle 0.

Deleting or rewriting a committed manifest silently rewinds or jumps the next
cycle's window. Don't.

[splitstream-sdk-cli]: https://github.com/Oyinkans0la12/splitstream-sdk-cli
