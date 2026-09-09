# Security Policy

## Threat model

splitstream-actions **never holds funds**. It is a compute-and-relay bridge:
it reads GitHub data, computes a distribution manifest, builds a Merkle root,
and submits one `post_cycle_root` invocation per cycle to the deployed
splitstream-core vault contract. The blast radius of a compromised action is
therefore limited to:

- **A wrong root being relayed on-chain** — a malicious or buggy action could
  compute a manifest that allocates the vault's pool to wrong addresses. The
  vault contract itself remains the final gate (it should enforce its own
  invariants: oracle signature, cycle id monotonicity, total amount bounds).
  The committed manifest audit trail makes any divergence detectable in git
  history.
- **Spurious GitHub API usage / data exposure** — the action reads PR/issue
  data across the org's repos with `GITHUB_TOKEN`. A compromised token leaks
  only what the workflow's `permissions` block allows (see
  `.github/workflows/wave-cycle-close.yml` — `contents: write`, issues/pulls
  read; tighten further if possible).

## Secret handling — hard rules

1. `ORACLE_SECRET_KEY` (and `FEE_BUMP_SECRET_KEY`) are read from the
   environment inside `src/index.ts` and used **only in memory** to sign the
   relay transaction.
2. They are **never logged** (no `core.info`/`warning`/`error` with secret
   material), **never written to a file**, and **never included in the
   manifest commit**.
3. Never add a workflow `debug: true` / step that echoes environment variables.
4. The oracle account is a dedicated relay account — it should hold only the
   XLM needed to pay fees (plus a fee-bump source if used). Do not reuse
   treasury or maintainer keys.
5. Rotate the oracle keypair if it is ever suspected of exposure, and update
   `oracleAccount` in the registry in the same change.

## Reporting a vulnerability

Do **not** open a public issue. Report privately to the maintainers via GitHub
Security Advisories ("Report a vulnerability" on this repository), or by
contacting the org's security contact directly.

When reporting, include:

- The affected file/version and the vulnerability class (e.g. "invalid strkey
  accepted by the schema", "secret material could appear in logs").
- A minimal reproduction if possible.
- Whether the issue could affect a real on-chain cycle.

Maintainers will acknowledge within 5 business days and coordinate disclosure.
For issues that could move funds on a live treasury, priority goes to halting
the scheduled workflow before any disclosure is published.