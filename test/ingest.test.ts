import { describe, expect, it } from 'vitest';
import { IngestError, extractClosingIssueRefs, findMergedPullRequests, type Octokit } from '../src/ingest.js';
import type { RepoRef } from '../schemas/splitstream.schema.js';

interface StubPr {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  user: { login: string } | null;
}

function pr(number: number, mergedAt: string | null, login = 'octocat'): StubPr {
  return {
    number,
    title: `PR ${number}`,
    body: 'Closes #1',
    merged_at: mergedAt,
    user: login === '' ? null : { login },
  };
}

/** Minimal Octokit stand-in: `paginate` returns the stub's PRs for the repo asked for. */
function stubOctokit(prsByRepo: Record<string, StubPr[]>): Octokit {
  return {
    paginate: async (_fn: unknown, params: { owner: string; repo: string }) =>
      prsByRepo[`${params.owner}/${params.repo}`] ?? [],
    rest: { pulls: { list: {} } },
  } as unknown as Octokit;
}

const REPOS: RepoRef[] = [{ owner: 'acme', name: 'app' }];

async function window(prs: StubPr[], sinceIso: string, repos: RepoRef[] = REPOS) {
  return findMergedPullRequests(stubOctokit({ 'acme/app': prs }), repos, sinceIso);
}

describe('extractClosingIssueRefs', () => {
  it('matches the canonical closing keywords', () => {
    expect(extractClosingIssueRefs('Closes #42')).toEqual([42]);
    expect(extractClosingIssueRefs('This fixes #7')).toEqual([7]);
    expect(extractClosingIssueRefs('Resolves #9')).toEqual([9]);
    expect(extractClosingIssueRefs('closed #1\nfixed #2\nresolved #3')).toEqual([1, 2, 3]);
  });

  it('matches multiple references in one body', () => {
    expect(extractClosingIssueRefs('Closes #42 and also fixes #7')).toEqual([42, 7]);
  });

  it('deduplicates repeated references', () => {
    expect(extractClosingIssueRefs('Closes #42, fixes #42')).toEqual([42]);
  });

  it('does not match plain issue mentions without a keyword', () => {
    expect(extractClosingIssueRefs('see issue #5 for context')).toEqual([]);
    expect(extractClosingIssueRefs('#42 alone is not a closing reference')).toEqual([]);
  });

  it('does not match partial words or partial numbers', () => {
    expect(extractClosingIssueRefs('this resolves #12abc')).toEqual([]);
    expect(extractClosingIssueRefs('uncloses #3')).toEqual([]);
    expect(extractClosingIssueRefs('refix #3')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    expect(extractClosingIssueRefs('CLOSES #42')).toEqual([42]);
    expect(extractClosingIssueRefs('FiXeS #42')).toEqual([42]);
  });

  it('does not match issue references in other repos', () => {
    // GitHub only auto-closes same-repo issues; owner/repo#N is not a closing ref.
    expect(extractClosingIssueRefs('closes your-org/other#42')).toEqual([]);
  });

  it('handles null and empty bodies', () => {
    expect(extractClosingIssueRefs(null)).toEqual([]);
    expect(extractClosingIssueRefs('')).toEqual([]);
  });
});

describe('findMergedPullRequests (cycle window)', () => {
  it('selects on parsed instants, not on the raw strings', async () => {
    // `since` as a +02:00 offset is 2026-07-31T22:00:00Z, so a PR merged at
    // 23:00Z that day IS inside the window. A lexicographic string comparison
    // ('2026-07-31T23:00:00Z' < '2026-08-01T00:00:00+02:00') drops it silently,
    // understating totalIssuesClosed and overpaying everyone else.
    const result = await window([pr(1, '2026-07-31T23:00:00Z')], '2026-08-01T00:00:00+02:00');
    expect(result.prs.map((p) => p.number)).toEqual([1]);
  });

  it('accepts a date-only `since` as midnight UTC and excludes the day before', async () => {
    const result = await window(
      [pr(1, '2026-07-31T23:59:59Z'), pr(2, '2026-08-01T00:00:00Z'), pr(3, '2026-08-02T12:00:00Z')],
      '2026-08-01',
    );
    expect(result.prs.map((p) => p.number)).toEqual([2, 3]);
  });

  it('includes the boundary instant itself (half-open window: [since, now))', async () => {
    const result = await window(
      [pr(1, '2026-07-31T23:59:59Z'), pr(2, '2026-08-01T00:00:00Z'), pr(3, '2026-08-01T00:00:01Z')],
      '2026-08-01T00:00:00Z',
    );
    expect(result.prs.map((p) => p.number)).toEqual([2, 3]);
  });

  it('normalises equivalent instants written in different offsets', async () => {
    // 2026-08-01T02:00:00+02:00 === 2026-08-01T00:00:00Z — the same instant, so
    // the PR sits exactly on the boundary and must be included either way round.
    const inWindow = await window([pr(1, '2026-08-01T00:00:00Z')], '2026-08-01T02:00:00+02:00');
    expect(inWindow.prs.map((p) => p.number)).toEqual([1]);

    const outOfWindow = await window([pr(2, '2026-08-01T00:00:00Z')], '2026-08-01T03:00:00+02:00');
    expect(outOfWindow.prs).toEqual([]);
  });

  it('skips closed-but-unmerged PRs', async () => {
    const result = await window([pr(1, null), pr(2, '2026-08-05T00:00:00Z')], '2026-08-01T00:00:00Z');
    expect(result.prs.map((p) => p.number)).toEqual([2]);
  });

  it('warns and skips a PR whose merged_at cannot be parsed, rather than counting it', async () => {
    const result = await window([pr(1, 'not-a-timestamp')], '2026-08-01T00:00:00Z');
    expect(result.prs).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('unparseable merged_at');
  });

  it('warns and skips a PR with no author', async () => {
    const result = await window([pr(1, '2026-08-05T00:00:00Z', '')], '2026-08-01T00:00:00Z');
    expect(result.prs).toEqual([]);
    expect(result.warnings[0]).toContain('has no author');
  });

  it('fails loudly on an unparseable window boundary', async () => {
    await expect(window([pr(1, '2026-08-05T00:00:00Z')], 'yesterday')).rejects.toThrow(IngestError);
  });
});