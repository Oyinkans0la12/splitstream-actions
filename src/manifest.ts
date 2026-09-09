import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeError, findContributor, type SplitstreamConfig } from './registry.js';

/**
 * Points -> payout computation. The formula is FROZEN (shared contract with
 * splitstream-core and splitstream-sdk-cli):
 *
 *   contributor_amount = floor(cycle_pool_amount * contributor_points / total_points_this_cycle)
 *
 * `cycle_pool_amount` is an explicit workflow input in stroops (never
 * inferred). The integer-division remainder is never silently dropped and never
 * redistributed: it is recorded as `dustRemainder` and left in the vault for a
 * future reserve sweep. All monetary amounts are decimal strings end-to-end —
 * BigInt only at the point of use, never JS number.
 */

export class ManifestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManifestError';
  }
}

export interface PayoutEntry {
  github: string;
  stellar: string;
  points: number;
  /** Stroops as a decimal string. */
  amount: string;
}

export interface PayoutResult {
  entries: PayoutEntry[];
  totalPoints: number;
  /** Stroops as a decimal string. */
  totalDistributed: string;
  /** Stroops as a decimal string; pool - sum(amounts). */
  dustRemainder: string;
}

export interface DistributionManifest {
  cycleId: number;
  generatedAt: string;
  /** Stroops as a decimal string. */
  poolAmount: string;
  totalPoints: number;
  entries: PayoutEntry[];
  /** Stroops as a decimal string. */
  dustRemainder: string;
  /** Hex-encoded 32-byte Merkle root over the payout leaves. */
  merkleRoot: string;
}

export function computePayouts(
  pointsByGithub: Map<string, number>,
  registry: SplitstreamConfig,
  poolAmount: bigint,
): PayoutResult {
  if (poolAmount <= 0n) {
    throw new ManifestError(
      `cycle_pool_amount must be a positive integer (stroops), got ${poolAmount}`,
    );
  }

  const totalPoints = [...pointsByGithub.values()].reduce((sum, points) => sum + points, 0);
  if (totalPoints <= 0) {
    throw new ManifestError(
      'no points were attributed this cycle; refusing to compute a distribution over a zero-point cycle',
    );
  }

  const entries: PayoutEntry[] = [];
  for (const [github, points] of pointsByGithub) {
    const contributor = findContributor(registry, github);
    if (contributor === undefined) {
      // attributePoints() guarantees membership; reaching this is a bug, fail loudly.
      throw new ManifestError(
        `internal error: contributor '${github}' has points but is missing from the registry`,
      );
    }
    const amount = (poolAmount * BigInt(points)) / BigInt(totalPoints); // floor
    entries.push({
      github: contributor.github,
      stellar: contributor.stellar,
      points,
      amount: amount.toString(),
    });
  }

  // Deterministic review order: most points first, then handle.
  entries.sort((a, b) => b.points - a.points || a.github.localeCompare(b.github));

  const totalDistributed = entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  const dustRemainder = poolAmount - totalDistributed;

  return {
    entries,
    totalPoints,
    totalDistributed: totalDistributed.toString(),
    dustRemainder: dustRemainder.toString(),
  };
}

export interface ManifestWindow {
  cycleId: number;
  /** `generatedAt` of the last committed manifest — the new cycle's `since` boundary. */
  generatedAt: string;
}

/**
 * Finds the last posted cycle from this repo's committed audit trail
 * (`manifests/cycle-<id>.json`), which is the source of truth for the next
 * cycle's window — the deployed contract cannot enumerate cycles.
 *
 * Returns `null` when no manifest exists yet (cycle 0 — the caller falls back
 * to the `since`/`cycle_id` workflow inputs). Throws on a corrupt audit trail
 * (unreadable directory, malformed JSON, missing `generatedAt`, or a filename
 * whose `<id>` disagrees with the manifest's `cycleId`) — never guesses.
 */
export function readLastManifestWindow(manifestDir: string): ManifestWindow | null {
  let entries;
  try {
    entries = readdirSync(manifestDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // no audit trail yet — this is cycle 0
    }
    throw new ManifestError(
      `cannot read manifest directory '${manifestDir}': ${describeError(err)}`,
      { cause: err },
    );
  }

  // cycle-<id>.json only — dry-run artifacts (cycle-<id>.dry-run.json) never count.
  const ids = entries
    .filter((entry) => entry.isFile())
    .map((entry) => /^cycle-(\d+)\.json$/.exec(entry.name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .filter((id) => Number.isSafeInteger(id));
  if (ids.length === 0) return null;

  const lastCycleId = Math.max(...ids);
  const path = join(manifestDir, `cycle-${lastCycleId}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ManifestError(`cannot read committed manifest '${path}': ${describeError(err)}`, {
      cause: err,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ManifestError(`committed manifest '${path}' is not valid JSON: ${describeError(err)}`, {
      cause: err,
    });
  }

  const cycleId = (parsed as { cycleId?: unknown }).cycleId;
  if (cycleId !== lastCycleId) {
    throw new ManifestError(
      `committed manifest '${path}' has cycleId=${cycleId}; filename and content disagree`,
    );
  }
  const generatedAt = (parsed as { generatedAt?: unknown }).generatedAt;
  if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) {
    throw new ManifestError(
      `committed manifest '${path}' is missing a valid generatedAt timestamp`,
    );
  }
  return { cycleId: lastCycleId, generatedAt };
}

export function buildManifest(opts: {
  cycleId: number;
  poolAmount: string;
  totalPoints: number;
  entries: PayoutEntry[];
  dustRemainder: string;
  merkleRoot: string;
  generatedAt?: string;
}): DistributionManifest {
  return {
    cycleId: opts.cycleId,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    poolAmount: opts.poolAmount,
    totalPoints: opts.totalPoints,
    entries: opts.entries,
    dustRemainder: opts.dustRemainder,
    merkleRoot: opts.merkleRoot,
  };
}