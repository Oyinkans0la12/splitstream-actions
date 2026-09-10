import type { Contribution } from './ingest.js';
import { findContributor, type SplitstreamConfig } from './registry.js';

/**
 * Issue-count attribution.
 *
 * Qualifying rule (FROZEN): an issue counts for a contributor when it is
 * closed via a merged PR that contains a recognized closing keyword
 * (Closes/Fixes/Resolves #N) in one of the tracked repos, inside the cycle
 * window. No label of any kind is required — complexity/type labels on issues
 * are informational only and play no role in payout math.
 *
 * Each distinct issue closed by a contributor's PR increments that
 * contributor's count exactly once (the same issue referenced by two PRs from
 * the same author is not double-counted). Counts are summed across every repo
 * in the org before shares are computed. Contributors are attributed to the PR
 * author — the PR closes the issue, the PR author did the work — not the issue
 * author.
 */

export interface CountsAttribution {
  /** Contributor handle -> number of distinct issues closed by that contributor's PRs. */
  countsByGithub: Map<string, number>;
  /** PR authors who closed issues but are NOT in the registry — they are never paid. */
  unregistered: Array<{ github: string; issues: number; repos: string[] }>;
}

export function countIssuesByContributor(
  contributions: Contribution[],
  registry: SplitstreamConfig,
): CountsAttribution {
  const totals = new Map<string, { issues: Set<string>; repos: Set<string> }>();

  for (const contribution of contributions) {
    // Distinctness is per (owner, repo, issueNumber) — issue numbers are only
    // unique within a repo.
    const issueKey = `${contribution.owner}/${contribution.repo}#${contribution.issueNumber}`;
    const entry = totals.get(contribution.prAuthor) ?? {
      issues: new Set<string>(),
      repos: new Set<string>(),
    };
    entry.issues.add(issueKey);
    entry.repos.add(`${contribution.owner}/${contribution.repo}`);
    totals.set(contribution.prAuthor, entry);
  }

  const countsByGithub = new Map<string, number>();
  const unregistered: CountsAttribution['unregistered'] = [];

  for (const [handle, { issues, repos }] of totals) {
    const contributor = findContributor(registry, handle);
    if (contributor === undefined) {
      unregistered.push({ github: handle, issues: issues.size, repos: [...repos] });
      continue;
    }
    const current = countsByGithub.get(contributor.github) ?? 0;
    countsByGithub.set(contributor.github, current + issues.size);
  }

  return { countsByGithub, unregistered };
}