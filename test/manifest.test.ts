import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildManifest, computePayouts, ManifestError } from '../src/manifest.js';
import { loadRegistry } from '../src/registry.js';

const REGISTRY = loadRegistry(join(import.meta.dirname, 'fixtures', 'splitstream.valid.yml'));

function pointsMap(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries);
}

describe('computePayouts (frozen formula)', () => {
  it('computes floor(pool * points / total) per contributor', () => {
    // Spec example: pool 5_000_000_000, octocat 200 of 950 pts -> floor(5e9*200/950)
    const result = computePayouts(
      pointsMap([
        ['octocat', 200],
        ['some-dev', 750],
      ]),
      REGISTRY,
      5_000_000_000n,
    );
    expect(result.totalPoints).toBe(950);
    const octocat = result.entries.find((e) => e.github === 'octocat')!;
    expect(octocat.amount).toBe('1052631578'); // 5_000_000_000 * 200 / 950 floored
    expect(octocat.stellar).toBe(REGISTRY.contributors[0]!.stellar);
  });

  it('keeps every amount as a decimal string, never a JS number', () => {
    const result = computePayouts(pointsMap([['octocat', 1]]), REGISTRY, 1_000_000_000_000_000_000n);
    for (const entry of result.entries) {
      expect(typeof entry.amount).toBe('string');
      expect(entry.amount).toMatch(/^\d+$/);
    }
    expect(result.dustRemainder).toBe('0');
  });

  it('records the integer-division dust remainder explicitly', () => {
    const result = computePayouts(
      pointsMap([
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
      pointsMap([
        ['octocat', 1],
        ['some-dev', 1],
      ]),
      REGISTRY,
      100n,
    );
    expect(result.entries.map((e) => e.amount).sort()).toEqual(['50', '50']);
    expect(result.dustRemainder).toBe('0');
  });

  it('sorts entries deterministically (points desc, then handle)', () => {
    const result = computePayouts(
      pointsMap([
        ['some-dev', 100],
        ['octocat', 200],
      ]),
      REGISTRY,
      300n,
    );
    expect(result.entries.map((e) => e.github)).toEqual(['octocat', 'some-dev']);
  });

  it('rejects a zero pool', () => {
    expect(() => computePayouts(pointsMap([['octocat', 1]]), REGISTRY, 0n)).toThrow(ManifestError);
    expect(() => computePayouts(pointsMap([['octocat', 1]]), REGISTRY, -5n)).toThrow(ManifestError);
  });

  it('rejects a zero-point cycle', () => {
    expect(() => computePayouts(new Map(), REGISTRY, 100n)).toThrow(ManifestError);
  });

  it('rejects a points map referencing an unknown contributor (internal invariant)', () => {
    expect(() => computePayouts(pointsMap([['ghost', 5]]), REGISTRY, 100n)).toThrow(ManifestError);
  });
});

describe('buildManifest', () => {
  it('produces the shared manifest contract shape', () => {
    const manifest = buildManifest({
      cycleId: 4,
      poolAmount: '5000000000',
      totalPoints: 950,
      entries: [
        { github: 'octocat', stellar: 'GAAAA', points: 200, amount: '1052631578' },
      ],
      dustRemainder: '3',
      merkleRoot: '00'.repeat(32),
      generatedAt: '2026-09-08T00:00:00.000Z',
    });
    expect(manifest).toEqual({
      cycleId: 4,
      generatedAt: '2026-09-08T00:00:00.000Z',
      poolAmount: '5000000000',
      totalPoints: 950,
      entries: [{ github: 'octocat', stellar: 'GAAAA', points: 200, amount: '1052631578' }],
      dustRemainder: '3',
      merkleRoot: '00'.repeat(32),
    });
    expect(typeof manifest.merkleRoot).toBe('string');
  });
});