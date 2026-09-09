import { describe, expect, it } from 'vitest';
import {
  attributePoints,
  extractPointsLabel,
  parsePointsLabel,
} from '../src/points.js';
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
    labels: [],
    ...partial,
  };
}

describe('parsePointsLabel / extractPointsLabel', () => {
  it('recognizes the exact points labels', () => {
    expect(parsePointsLabel('points:100')).toBe(100);
    expect(parsePointsLabel('points:150')).toBe(150);
    expect(parsePointsLabel('points:200')).toBe(200);
  });

  it('normalizes casing and whitespace in one place', () => {
    expect(extractPointsLabel([' Points:150 '])?.points).toBe(150);
    expect(extractPointsLabel(['bug', 'POINTS:200'])).toEqual({ label: 'points:200', points: 200 });
  });

  it('returns null when no points label is present', () => {
    expect(parsePointsLabel('points:300')).toBeNull();
    expect(extractPointsLabel(['bug', 'enhancement'])).toBeNull();
    expect(extractPointsLabel([])).toBeNull();
  });

  it('uses the first points label in list order', () => {
    expect(extractPointsLabel(['points:100', 'points:200'])?.points).toBe(100);
  });
});

describe('attributePoints', () => {
  it('sums a contributor\'s points across repos into one amount', () => {
    const attribution = attributePoints(
      [
        contribution({ repo: 'splitstream-core', prAuthor: 'octocat', labels: ['points:200'] }),
        contribution({ repo: 'splitstream-actions', prAuthor: 'octocat', labels: ['points:100'] }),
        contribution({ repo: 'splitstream-sdk-cli', prAuthor: 'some-dev', labels: ['points:150'] }),
      ],
      REGISTRY,
    );
    expect(attribution.pointsByGithub.get('octocat')).toBe(300);
    expect(attribution.pointsByGithub.get('some-dev')).toBe(150);
    expect(attribution.pointsByGithub.size).toBe(2);
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('matches registry handles case-insensitively', () => {
    const attribution = attributePoints(
      [contribution({ prAuthor: 'OctoCAt', labels: ['points:150'] })],
      REGISTRY,
    );
    expect(attribution.pointsByGithub.get('octocat')).toBe(150);
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('excludes unregistered PR authors and reports them loudly', () => {
    const attribution = attributePoints(
      [
        contribution({ prAuthor: 'not-in-registry', labels: ['points:200'] }),
        contribution({ prAuthor: 'octocat', labels: ['points:100'] }),
      ],
      REGISTRY,
    );
    expect(attribution.pointsByGithub.get('octocat')).toBe(100);
    expect(attribution.pointsByGithub.size).toBe(1);
    expect(attribution.unregistered).toEqual([
      expect.objectContaining({ github: 'not-in-registry', points: 200 }),
    ]);
  });

  it('attributes nothing when no points label is present', () => {
    const attribution = attributePoints(
      [contribution({ labels: ['bug'] }), contribution({ labels: [] })],
      REGISTRY,
    );
    expect(attribution.pointsByGithub.size).toBe(0);
    expect(attribution.unregistered).toHaveLength(0);
  });

  it('flags issues carrying multiple distinct points labels', () => {
    const attribution = attributePoints(
      [contribution({ issueNumber: 42, labels: ['points:100', 'points:200'] })],
      REGISTRY,
    );
    expect(attribution.labelConflicts.length).toBe(1);
    expect(attribution.labelConflicts[0]).toContain('#42');
  });
});