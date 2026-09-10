import { getOctokit } from '@actions/github';
import type { RepoRef } from '../schemas/splitstream.schema.js';
import { describeError } from './registry.js';

/**
 * Ingestion layer: crawls every repo in the registry for PRs merged inside the
 * cycle window and resolves GitHub closing-keyword references to the issues
 * they closed. That is all — a qualifying issue is simply one closed via a
 * merged PR containing a recognized closing keyword. No label of any kind is
 * read or required: issue labels are informational only and play no role in
 * payout math.
 *
 * The window is one shared boundary for the whole org — a contributor who
 * shipped work in two repos this cycle gets one combined amount, not two
 * separate claims. Issue numbers are only unique *within* a repo, so an issue
 * is always resolved as the (owner, repo, issueNumber) triple.
 *
 * Every external call is wrapped with explicit error handling. API/network
 * failures abort the run (loud, via IngestError).
 */

export type Octokit = ReturnType<typeof getOctokit>;

export class IngestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'IngestError';
  }
}

export interface MergedPullRequest {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  mergedAt: string; // ISO 8601
  body: string | null;
}

/** One (PR, closing issue) pair that survived ingestion. */
export interface Contribution {
  owner: string;
  repo: string;
  prNumber: number;
  prAuthor: string;
  prTitle: string;
  issueNumber: number;
}

export interface IngestedCycle {
  contributions: Contribution[];
  mergedPrCount: number;
  warnings: string[];
}

/**
 * GitHub's closing-keyword set: close/closes/closed, fix/fixes/fixed,
 * resolve/resolves/resolved, followed by #<issue-number>. Issue references are
 * only ever matched inside the PR's own repo — cross-repo refs like
 * `owner/repo#123` are not (GitHub only auto-closes same-repo issues).
 */
const CLOSING_KEYWORD_RE = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s+#(\d+)\b/gi;

export function extractClosingIssueRefs(body: string | null): number[] {
  if (body === null || body === '') return [];
  const refs = new Set<number>();
  CLOSING_KEYWORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLOSING_KEYWORD_RE.exec(body)) !== null) {
    refs.add(Number(match[1]));
  }
  return [...refs];
}

export async function findMergedPullRequests(
  octokit: Octokit,
  repos: RepoRef[],
  sinceIso: string,
): Promise<{ prs: MergedPullRequest[]; warnings: string[] }> {
  const prs: MergedPullRequest[] = [];
  const warnings: string[] = [];

  for (const { owner, name: repo } of repos) {
    let results: Array<{
      number: number;
      title: string;
      body: string | null;
      merged_at: string | null;
      user: { login: string } | null;
    }>;
    try {
      results = await octokit.paginate(octokit.rest.pulls.list, {
        owner,
        repo,
        state: 'closed',
        per_page: 100,
      });
    } catch (err) {
      throw new IngestError(
        `failed to list closed PRs for ${owner}/${repo}: ${describeError(err)}`,
        { cause: err },
      );
    }

    for (const pr of results) {
      if (pr.merged_at === null) continue; // closed without merging
      if (pr.merged_at < sinceIso) continue; // outside this cycle's window
      const author = pr.user?.login;
      if (author === undefined || author === '') {
        warnings.push(`PR #${pr.number} in ${owner}/${repo} has no author; skipped`);
        continue;
      }
      prs.push({
        owner,
        repo,
        number: pr.number,
        title: pr.title,
        author,
        mergedAt: pr.merged_at,
        body: pr.body ?? null,
      });
    }
  }

  return { prs, warnings };
}

export async function ingestCycle(
  octokit: Octokit,
  repos: RepoRef[],
  sinceIso: string,
): Promise<IngestedCycle> {
  const { prs, warnings } = await findMergedPullRequests(octokit, repos, sinceIso);

  const contributions: Contribution[] = [];
  for (const pr of prs) {
    const refs = extractClosingIssueRefs(pr.body);
    for (const issueNumber of refs) {
      contributions.push({
        owner: pr.owner,
        repo: pr.repo,
        prNumber: pr.number,
        prAuthor: pr.author,
        prTitle: pr.title,
        issueNumber,
      });
    }
  }

  return { contributions, mergedPrCount: prs.length, warnings };
}