# Introduction

SplitStream is a Soroban settlement protocol that lets a Drips Wave team turn
pooled treasury funds into a verifiable, disputable, on-chain distribution to
contributors, instead of calculating payouts by hand off-chain. The pieces are
[splitstream-core] — the vault contract that holds the pool, enforces the cycle
rules, and pays claims — [splitstream-sdk-cli] — the client SDK and CLI
contributors use to read a cycle and claim their share — and this repo,
splitstream-actions.

splitstream-actions is the bridge between GitHub activity and on-chain
settlement. It never holds funds. On each cycle it reads the contributor
registry, crawls merged PRs across every repo in that registry, counts the
issues each contributor closed, computes each contributor's share with the
frozen payout formula, builds a Merkle root over the payout leaves, writes the
result as a distribution manifest committed to this repo as an audit trail, and
relays the root to splitstream-core with `post_cycle_root`.

## What this repo owns

This repo is the **authoritative source for the distribution manifest format**.
[splitstream-sdk-cli] consumes that format; this repo produces it. Both the
manifest shape and the Merkle leaf scheme are cross-repo contracts — a change to
either is a breaking change for the other two repos, not an internal refactor.

- [How it works](./how-it-works.md) — the pipeline, the payout rule, and the
  cross-repo aggregation rules.
- [Manifest reference](./manifest-reference.md) — the JSON shape, the Merkle
  leaf and tree format.
- [For maintainers](./for-maintainers.md) — triggering a cycle, the registry,
  dry runs.
- [Developer guide](./developer-guide.md) — local setup, the golden fixture
  cross-check, the gated integration tests.
- [Contributing](./contributing.md) — where to start, and what breaks other
  repos.

[splitstream-core]: https://github.com/Oyinkans0la12/splitstream-core
[splitstream-sdk-cli]: https://github.com/Oyinkans0la12/splitstream-sdk-cli
