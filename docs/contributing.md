# Contributing

The build/test workflow, commit conventions, and the non-negotiables checklist
for this repo live in [CONTRIBUTING.md](../CONTRIBUTING.md) — that file is the
source of truth for how to land a change here, and this page does not duplicate
it. In short: one commit per logical unit, conventional commit subjects, stage
exactly what belongs to the change, and never skip the Merkle golden test before
a real relay.

## What this repo affects

Three repos split the protocol, and a change here can break the other two:

- **splitstream-actions** (this repo) computes what gets settled. It reads
  GitHub activity, decides the amounts, and writes the manifest.
- **[splitstream-core]** enforces and pays it. The vault holds the pool, checks
  the Merkle proof against the root that was relayed, applies the cycle rules,
  and pays claims. Its `merkle::leaf_hash` and `hash_pair` must stay
  byte-identical to `src/merkle.ts`.
- **[splitstream-sdk-cli]** is how people check status and claim. It reads the
  manifest and the on-chain state, and re-simulates the payout formula to
  confirm a cycle it did not compute.

So a change to the **manifest format** or the **Merkle scheme** is a breaking
cross-repo change, not an internal refactor. The manifest format is defined by
this repo and consumed by splitstream-sdk-cli; the leaf format and tree
construction are defined jointly by this repo and splitstream-core. Land either
kind of change in coordination with the other repos, and say so in the PR
description — link to what depends on this repo's output:

- [splitstream-core docs][splitstream-core]
- [splitstream-sdk-cli docs][splitstream-sdk-cli]

Changes to the payout rule fall in the same category: the formula is frozen, and
splitstream-sdk-cli re-simulates it to verify a cycle, so a rule change needs a
coordinated change there.

[splitstream-core]: https://github.com/Oyinkans0la12/splitstream-core
[splitstream-sdk-cli]: https://github.com/Oyinkans0la12/splitstream-sdk-cli
