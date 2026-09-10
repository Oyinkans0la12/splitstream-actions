import { describe, expect, it } from 'vitest';
import { countIssuesByContributor } from '../src/counts.js';
import type { Contribution } from '../src/ingest.js';
import { loadRegistry } from '../src/registry.js';
import { join } from 'node:path';

const REGISTRY = loadRegistry(join(import.meta.dirname, 'fixtures', 'splitstream.valid.yml'));

function contribution(partial: Partial<Contribution>): Contribution {
  return {
    owner: 'your-org',
    repo: 'splitstream-core',
    prNumber: 1,
    prAuthor: 'octocat',
    prTitle: 'PR',
    issueNumber: 1,
    ...partial,
  };
}

describe('countIssuesByContributor', () => {
  it('counts each distinct issue closed by a contributor\'s PR once', () => {
    const attribution = countIssuesByContributor(
      [
        contribution({ issueNumber: 1 }),
        contribution({ issueNumber: 2 }),
        contribution({ prNumber: 2, issueNumber: 2 }), // same issue via a second PR
      ],
      REGISTRY,
    );
    expect(attribution.countsByGithub.get('octocat')).toBe(2); // issues #1 and #2, not 3
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('sums a contributor\'s closed issues across repos into one amount', () => {
    const attribution = countIssuesByContributor(
      [
        contribution({ repo: 'splitstream-core', issueNumber: 1 }),
        contribution({ repo: 'splitstream-actions', issueNumber: 2 }),
        contribution({ repo: 'splitstream-actions', issueNumber: 3 }),
        contribution({ repo: 'splitstream-sdk-cli', prAuthor: 'some-dev', issueNumber: 4 }),
      ],
      REGISTRY,
    );
    expect(attribution.countsByGithub.get('octocat')).toBe(3);
    expect(attribution.countsByGithub.get('some-dev')).toBe(1);
    expect(attribution.countsByGithub.size).toBe(2);
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('distinguishes same-numbered issues in different repos', () => {
    const attribution = countIssuesByContributor(
      [
        contribution({ repo: 'splitstream-core', issueNumber: 7 }),
        contribution({ repo: 'splitstream-actions', issueNumber: 7 }),
      ],
      REGISTRY,
    );
    expect(attribution.countsByGithub.get('octocat')).toBe(2);
  });

  it('matches registry handles case-insensitively', () => {
    const attribution = countIssuesByContributor(
      [contribution({ prAuthor: 'OctoCAt' })],
      REGISTRY,
    );
    expect(attribution.countsByGithub.get('octocat')).toBe(1);
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('excludes unregistered PR authors and reports them loudly', () => {
    const attribution = countIssuesByContributor(
      [
        contribution({ prAuthor: 'not-in-registry', issueNumber: 1 }),
        contribution({ prAuthor: 'not-in-registry', issueNumber: 2 }),
        contribution({ prAuthor: 'octocat', issueNumber: 3 }),
      ],
      REGISTRY,
    );
    expect(attribution.countsByGithub.get('octocat')).toBe(1);
    expect(attribution.countsByGithub.size).toBe(1);
    expect(attribution.unregistered).toEqual([
      expect.objectContaining({ github: 'not-in-registry', issues: 2 }),
    ]);
  });

  it('attributes nothing for an empty contribution list', () => {
    const attribution = countIssuesByContributor([], REGISTRY);
    expect(attribution.countsByGithub.size).toBe(0);
    expect(attribution.unregistered).toHaveLength(0);
  });
});