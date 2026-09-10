import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildManifest,
  computePayouts,
  ManifestError,
  readLastManifestWindow,
} from '../src/manifest.js';
import { loadRegistry } from '../src/registry.js';

const REGISTRY = loadRegistry(join(import.meta.dirname, 'fixtures', 'splitstream.valid.yml'));

function countsMap(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries);
}

describe('computePayouts (frozen formula)', () => {
  it('computes floor(pool * issues_closed / total) per contributor', () => {
    // Pool 5_000_000_000, octocat closes 3 of 4 issues -> floor(5e9*3/4)
    const result = computePayouts(
      countsMap([
        ['octocat', 3],
        ['some-dev', 1],
      ]),
      REGISTRY,
      5_000_000_000n,
    );
    expect(result.totalIssuesClosed).toBe(4);
    const octocat = result.entries.find((e) => e.github === 'octocat')!;
    expect(octocat.amount).toBe('3750000000'); // 5_000_000_000 * 3 / 4 floored
    expect(octocat.stellar).toBe(REGISTRY.contributors[0]!.stellar);
  });

  it('keeps every amount as a decimal string, never a JS number', () => {
    const result = computePayouts(countsMap([['octocat', 1]]), REGISTRY, 1_000_000_000_000_000_000n);
    for (const entry of result.entries) {
      expect(typeof entry.amount).toBe('string');
      expect(entry.amount).toMatch(/^\d+$/);
    }
    expect(result.dustRemainder).toBe('0');
  });

  it('records the integer-division dust remainder explicitly', () => {
    const result = computePayouts(
      countsMap([
        ['octocat', 3],
        ['some-dev', 1],
      ]),
      REGISTRY,
      10n,
    );
    const amounts = result.entries.map((e) => BigInt(e.amount));
    const sum = amounts.reduce((a, b) => a + b, 0n);
    expect(sum).toBe(9n);
    expect(result.dustRemainder).toBe('1'); // 10 - 9, never silently dropped
  });

  it('distributes exactly the pool when it divides evenly', () => {
    const result = computePayouts(
      countsMap([
        ['octocat', 1],
        ['some-dev', 1],
      ]),
      REGISTRY,
      100n,
    );
    expect(result.entries.map((e) => e.amount).sort()).toEqual(['50', '50']);
    expect(result.dustRemainder).toBe('0');
  });

  it('sorts entries deterministically (issues closed desc, then handle)', () => {
    const result = computePayouts(
      countsMap([
        ['some-dev', 1],
        ['octocat', 3],
      ]),
      REGISTRY,
      400n,
    );
    expect(result.entries.map((e) => e.github)).toEqual(['octocat', 'some-dev']);
  });

  it('rejects a zero pool', () => {
    expect(() => computePayouts(countsMap([['octocat', 1]]), REGISTRY, 0n)).toThrow(ManifestError);
    expect(() => computePayouts(countsMap([['octocat', 1]]), REGISTRY, -5n)).toThrow(ManifestError);
  });

  it('rejects a zero-issue cycle', () => {
    expect(() => computePayouts(new Map(), REGISTRY, 100n)).toThrow(ManifestError);
  });

  it('rejects a counts map referencing an unknown contributor (internal invariant)', () => {
    expect(() => computePayouts(countsMap([['ghost', 5]]), REGISTRY, 100n)).toThrow(ManifestError);
  });
});

describe('readLastManifestWindow (cycle-window detection)', () => {
  function fixtureDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'splitstream-manifest-'));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
    return dir;
  }

  function manifest(cycleId: number, generatedAt: string): string {
    return JSON.stringify({ cycleId, generatedAt, poolAmount: '1', totalIssuesClosed: 0, entries: [], dustRemainder: '0', merkleRoot: '00'.repeat(32) });
  }

  it('returns null when the directory does not exist (cycle 0)', () => {
    expect(readLastManifestWindow(join(tmpdir(), 'no-such-dir-xyz'))).toBeNull();
  });

  it('returns null when no cycle manifests exist (cycle 0)', () => {
    const dir = fixtureDir({ 'unrelated.txt': 'hi' });
    expect(readLastManifestWindow(dir)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('takes the highest cycle id and its generatedAt as the window boundary', () => {
    const dir = fixtureDir({
      'cycle-0.json': manifest(0, '2026-08-25T00:00:00.000Z'),
      'cycle-1.json': manifest(1, '2026-09-01T00:00:00.000Z'),
      'cycle-2.json': manifest(2, '2026-09-08T00:00:00.000Z'),
    });
    expect(readLastManifestWindow(dir)).toEqual({
      cycleId: 2,
      generatedAt: '2026-09-08T00:00:00.000Z',
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('ignores dry-run artifacts (cycle-<id>.dry-run.json)', () => {
    const dir = fixtureDir({
      'cycle-1.dry-run.json': manifest(1, '2026-09-01T00:00:00.000Z'),
      'cycle-2.json': manifest(2, '2026-09-08T00:00:00.000Z'),
    });
    expect(readLastManifestWindow(dir)).toEqual({
      cycleId: 2,
      generatedAt: '2026-09-08T00:00:00.000Z',
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when a manifest filename id disagrees with its content', () => {
    const dir = fixtureDir({ 'cycle-2.json': manifest(3, '2026-09-08T00:00:00.000Z') });
    expect(() => readLastManifestWindow(dir)).toThrow(ManifestError);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws on malformed JSON in the highest manifest', () => {
    const dir = fixtureDir({
      'cycle-1.json': manifest(1, '2026-09-01T00:00:00.000Z'),
      'cycle-2.json': '{not json',
    });
    expect(() => readLastManifestWindow(dir)).toThrow(ManifestError);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when the highest manifest lacks a valid generatedAt', () => {
    const dir = fixtureDir({
      'cycle-2.json': JSON.stringify({ cycleId: 2 }),
    });
    expect(() => readLastManifestWindow(dir)).toThrow(ManifestError);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('buildManifest', () => {
  it('produces the shared manifest contract shape', () => {
    const manifest = buildManifest({
      cycleId: 4,
      poolAmount: '5000000000',
      totalIssuesClosed: 4,
      entries: [
        { github: 'octocat', stellar: 'GAAAA', issuesClosed: 3, amount: '3750000000' },
      ],
      dustRemainder: '3',
      merkleRoot: '00'.repeat(32),
      generatedAt: '2026-09-08T00:00:00.000Z',
    });
    expect(manifest).toEqual({
      cycleId: 4,
      generatedAt: '2026-09-08T00:00:00.000Z',
      poolAmount: '5000000000',
      totalIssuesClosed: 4,
      entries: [{ github: 'octocat', stellar: 'GAAAA', issuesClosed: 3, amount: '3750000000' }],
      dustRemainder: '3',
      merkleRoot: '00'.repeat(32),
    });
    expect(typeof manifest.merkleRoot).toBe('string');
  });
});