import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Keypair, rpc } from '@stellar/stellar-sdk';
import {
  defaultRpcUrl,
  describeError,
  loadRegistry,
  networkPassphrase,
} from './registry.js';
import { ingestCycle } from './ingest.js';
import { countIssuesByContributor } from './counts.js';
import { buildManifest, computePayouts, readLastManifestWindow } from './manifest.js';
import { buildMerkleRoot } from './merkle.js';
import { queryCycleInfo, relayCycleRoot } from './relay.js';

/**
 * Orchestrator:
 *   1. Validate inputs + contributor registry (fail loudly on any malformed entry).
 *   2. Determine the cycle window — the last committed manifest's `generatedAt`
 *      (this repo's audit trail, the source of truth), or the `since` input for
 *      cycle 0 / dry runs. get_cycle_info is used only as a sanity check.
 *   3. Crawl merged PRs across every repo in the registry, resolve closing
 *      issues, count each contributor's distinct closed issues (summed across
 *      repos). No labels are read — any issue closed via a merged PR with a
 *      closing keyword qualifies.
 *   4. Compute payouts (floor formula over issue counts), dust remainder,
 *      Merkle root.
 *   5. Write the manifest to manifests/cycle-<id>.json as the audit trail.
 *   6. Unless dry-run: relay post_cycle_root via Soroban RPC and confirm it
 *      landed; print the tx to the job summary.
 */

class ActionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ActionError';
  }
}

function parseStroops(input: string, name: string): bigint {
  if (!/^\d+$/.test(input)) {
    throw new ActionError(`${name} must be a non-negative integer string (stroops), got '${input}'`);
  }
  const value = BigInt(input);
  if (value <= 0n) {
    throw new ActionError(`${name} must be greater than 0, got '${input}'`);
  }
  return value;
}

function parseCycleId(input: string): number {
  if (!/^\d+$/.test(input)) {
    throw new ActionError(`cycle_id must be a non-negative integer string, got '${input}'`);
  }
  const value = Number(input);
  if (!Number.isSafeInteger(value)) {
    throw new ActionError(`cycle_id is out of the safe integer range: '${input}'`);
  }
  return value;
}

function parseSince(input: string): string {
  if (Number.isNaN(Date.parse(input))) {
    throw new ActionError(`since must be a valid ISO 8601 timestamp, got '${input}'`);
  }
  return input;
}

async function main(): Promise<void> {
  const poolAmount = parseStroops(core.getInput('cycle_pool_amount', { required: true }).trim(), 'cycle_pool_amount');
  const dryRun = core.getBooleanInput('dry_run');
  const configPath = core.getInput('config_path') || '.github/splitstream.yml';
  const manifestDir = core.getInput('manifest_dir') || 'manifests';
  const rpcUrlInput = core.getInput('rpc_url');
  const cycleIdInput = core.getInput('cycle_id');
  const sinceInput = core.getInput('since');

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken === undefined || githubToken === '') {
    throw new ActionError('GITHUB_TOKEN environment variable is required');
  }
  const oracleSecret = process.env.ORACLE_SECRET_KEY;
  if (!dryRun && (oracleSecret === undefined || oracleSecret === '')) {
    throw new ActionError('ORACLE_SECRET_KEY environment variable is required unless dry_run=true');
  }

  // --- registry (fail loudly on malformed entries; never skip) ---
  const registry = loadRegistry(configPath);
  core.info(
    `registry OK: ${registry.contributors.length} contributor(s), ${registry.repos.length} repo(s), network=${registry.network}`,
  );

  // --- cycle boundary ---
  let cycleId: number;
  let sinceIso: string;
  let relayContext: { server: rpc.Server; vault: Contract; keypair: Keypair } | undefined;

  if (dryRun) {
    if (sinceInput === '') throw new ActionError('`since` input is required in dry-run mode');
    if (cycleIdInput === '') throw new ActionError('`cycle_id` input is required in dry-run mode');
    sinceIso = parseSince(sinceInput);
    cycleId = parseCycleId(cycleIdInput);
    core.info(`dry-run: cycle #${cycleId}, window since ${sinceIso} (no on-chain queries)`);
  } else {
    const rpcUrl = rpcUrlInput || defaultRpcUrl(registry.network);
    const server = new rpc.Server(rpcUrl);
    const vault = new Contract(registry.vaultContract);
    const keypair = Keypair.fromSecret(oracleSecret!);

    const manifestWindow = readLastManifestWindow(manifestDir);
    if (manifestWindow !== null) {
      // The committed audit trail is the source of truth: the contract has no
      // "latest cycle" call, so chain state cannot define the window.
      cycleId = manifestWindow.cycleId + 1;
      sinceIso = manifestWindow.generatedAt;
      core.info(
        `last committed cycle manifest: #${manifestWindow.cycleId} (generated ${sinceIso}); ` +
          `new cycle #${cycleId} window starts ${sinceIso}`,
      );

      // Sanity check ONLY — never the primary source of truth. The relay for
      // the manifest's cycle should have landed with a matching posted_at.
      try {
        const onChain = await queryCycleInfo(
          server,
          vault,
          keypair.publicKey(),
          networkPassphrase(registry.network),
          manifestWindow.cycleId,
        );
        if (onChain === null) {
          core.warning(
            `sanity check: get_cycle_info(${manifestWindow.cycleId}) returned no cycle on-chain even though ` +
              `cycle-${manifestWindow.cycleId}.json is committed — that cycle's relay may never have landed; ` +
              `proceeding with the committed manifest window`,
          );
        } else {
          const postedIso = new Date(onChain.postedAt * 1000).toISOString();
          const driftSecs = Math.abs(onChain.postedAt - Date.parse(sinceIso) / 1000);
          if (driftSecs > 3600) {
            core.warning(
              `sanity check: on-chain posted_at (${postedIso}) differs from the committed manifest's ` +
                `generatedAt (${sinceIso}) by ${Math.round(driftSecs / 60)} min; using the committed manifest timestamp`,
            );
          } else {
            core.info(
              `sanity check OK: get_cycle_info(${manifestWindow.cycleId}) posted_at ${postedIso} matches the committed manifest`,
            );
          }
        }
      } catch (err) {
        core.warning(
          `sanity check skipped — could not read get_cycle_info(${manifestWindow.cycleId}) via ${rpcUrl}: ` +
            `${describeError(err)}; proceeding with the committed manifest window`,
        );
      }
    } else {
      core.warning(
        `no committed cycle manifest found in '${manifestDir}'; falling back to \`since\`/\`cycle_id\` inputs (cycle 0)`,
      );
      if (sinceInput === '') throw new ActionError('`since` input is required when no previous cycle manifest exists');
      if (cycleIdInput === '') throw new ActionError('`cycle_id` input is required when no previous cycle manifest exists');
      sinceIso = parseSince(sinceInput);
      cycleId = parseCycleId(cycleIdInput);
    }
    relayContext = { server, vault, keypair };
  }

  // --- ingestion + issue counts ---
  const octokit = getOctokit(githubToken);
  const { contributions, mergedPrCount, warnings } = await ingestCycle(octokit, registry.repos, sinceIso);
  for (const warning of warnings) core.warning(warning);
  core.info(
    `ingested ${mergedPrCount} merged PR(s) in window; ${contributions.length} (PR, issue) contribution(s) with closing references`,
  );

  const { countsByGithub, unregistered } = countIssuesByContributor(contributions, registry);
  if (unregistered.length > 0) {
    core.warning(
      `unregistered PR authors are NOT paid this cycle; add them to ${configPath} before the next cycle:`,
    );
    for (const entry of unregistered) {
      core.warning(`  - ${entry.github}: ${entry.issues} issue(s) (${entry.repos.join(', ')})`);
    }
  }
  core.info(
    `issues counted: ${[...countsByGithub.entries()].map(([g, c]) => `${g}=${c}`).join(', ') || '(none)'}`,
  );

  // --- payouts + manifest + merkle ---
  const payouts = computePayouts(countsByGithub, registry, poolAmount);
  const merkle = buildMerkleRoot(
    payouts.entries.map((entry) => ({ stellar: entry.stellar, amount: BigInt(entry.amount) })),
  );
  const merkleRootHex = merkle.root.toString('hex');
  const manifest = buildManifest({
    cycleId,
    poolAmount: poolAmount.toString(),
    totalIssuesClosed: payouts.totalIssuesClosed,
    entries: payouts.entries,
    dustRemainder: payouts.dustRemainder,
    merkleRoot: merkleRootHex,
  });

  const manifestPath = join(manifestDir, dryRun ? `cycle-${cycleId}.dry-run.json` : `cycle-${cycleId}.json`);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  core.info(`wrote distribution manifest to ${manifestPath}`);
  core.info(
    `pool=${manifest.poolAmount} stroops, totalIssuesClosed=${manifest.totalIssuesClosed}, ` +
      `dustRemainder=${manifest.dustRemainder} stroops (left in vault), merkleRoot=${merkleRootHex}`,
  );

  core.setOutput('cycle_id', String(cycleId));
  core.setOutput('manifest_path', manifestPath);
  core.setOutput('merkle_root', merkleRootHex);
  core.setOutput('dust_remainder', manifest.dustRemainder);
  core.setOutput('dry_run', String(dryRun));

  // --- relay (skip in dry-run) ---
  if (dryRun) {
    core.info('dry_run=true: skipping on-chain relay — manifest and Merkle root computed only');
    return;
  }

  const { server, vault, keypair } = relayContext!;
  const totalAmount = payouts.entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  const feeBumpSecret = process.env.FEE_BUMP_SECRET_KEY;
  const feeBumpKeypair = feeBumpSecret !== undefined && feeBumpSecret !== '' ? Keypair.fromSecret(feeBumpSecret) : undefined;
  const relayResult = await relayCycleRoot({
    server,
    vault,
    keypair,
    networkPassphrase: networkPassphrase(registry.network),
    cycleId,
    root: merkle.root,
    totalAmount,
    feeBumpKeypair,
  });
  core.info(
    `relayed merkle root on-chain: tx=${relayResult.hash} status=${relayResult.status} ledger=${relayResult.ledger}`,
  );
  await core.summary
    .addHeading('Wave cycle closed on-chain')
    .addTable([
      ['cycle', 'tx hash', 'status', 'ledger'],
      [String(cycleId), relayResult.hash, relayResult.status, String(relayResult.ledger)],
    ])
    .addRaw(`Merkle root: \`${merkleRootHex}\` — manifest: \`${manifestPath}\``)
    .write();
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (err) {
    const message = describeError(err);
    core.setFailed(message);
    process.exitCode = 1;
  }
}

void run();