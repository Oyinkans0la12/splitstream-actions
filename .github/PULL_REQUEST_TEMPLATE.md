## Description
<!-- Provide a brief description of the changes in this pull request. -->

## Non-negotiables checklist
<!-- Ensure all applicable non-negotiables from CONTRIBUTING.md are satisfied. -->
- [ ] Merkle leaf hashing verified byte-identical to splitstream-core via the golden test.
- [ ] Relay secret never logged, never committed, never echoed in a workflow debug step.
- [ ] All monetary amounts are strings/BigInt, never JS `number`.
- [ ] `dustRemainder` always explicitly computed and recorded — never silently dropped, never auto-redistributed.
- [ ] Action fails loudly (non-zero exit, `core.setFailed`) on any registry validation error, RPC submission failure, or unconfirmed transaction.

## Verification
<!-- Describe tests run and verification steps. Confirm whether the Merkle golden fixture passes. -->
- [ ] `npm run typecheck` passes cleanly
- [ ] `npm test` passes cleanly (including `test/fixtures/merkle.golden.json`)
- [ ] Details / notes:
