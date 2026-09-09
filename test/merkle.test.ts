import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addressScVal,
  buildMerkleRoot,
  leafHash,
  leafPayload,
  MerkleError,
  scvI128,
} from '../src/merkle.js';
import { nativeToScVal } from '@stellar/stellar-sdk';

interface GoldenFixture {
  leaf: { stellar: string; amount: string; leafPayloadHex: string; leafHex: string };
  tree3: { leaves: Array<{ stellar: string; amount: string }>; rootHex: string };
  tree4: { leaves: Array<{ stellar: string; amount: string }>; rootHex: string };
}

const GOLDEN = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'merkle.golden.json'), 'utf8'),
) as GoldenFixture;

describe('leaf hashing (cross-language golden)', () => {
  it('produces the exact pre-image bytes pinned in the golden fixture', () => {
    const payload = leafPayload(GOLDEN.leaf.stellar, BigInt(GOLDEN.leaf.amount));
    expect(payload.toString('hex')).toBe(GOLDEN.leaf.leafPayloadHex);
  });

  it('matches the golden leaf hash for the pinned (address, amount) pair', () => {
    const hash = leafHash(GOLDEN.leaf.stellar, BigInt(GOLDEN.leaf.amount));
    expect(hash.toString('hex')).toBe(GOLDEN.leaf.leafHex);
  });

  it('matches soroban-sdk nativeToScVal byte-for-byte for i128 (incl. negatives)', () => {
    for (const amount of [0n, 1n, 1052631578n, 2n ** 63n, 2n ** 127n - 1n, -1n, -(2n ** 127n)]) {
      expect(Buffer.from(scvI128(amount).toXDR()).equals(Buffer.from(nativeToScVal(amount, { type: 'i128' }).toXDR()))).toBe(true);
    }
  });

  it('encodes an address as the full ScVal XDR (44 bytes, ed25519 arm)', () => {
    const xdrBytes = Buffer.from(addressScVal(GOLDEN.leaf.stellar).toXDR());
    expect(xdrBytes.length).toBe(44);
    expect(xdrBytes.subarray(0, 8).toString('hex')).toBe('0000001200000000'); // SCV_ADDRESS | SC_ADDRESS_TYPE_ACCOUNT
  });

  it('rejects an invalid stellar pubkey', () => {
    expect(() => leafHash('not-a-key', 1n)).toThrow(MerkleError);
  });

  it('rejects amounts outside the i128 range', () => {
    expect(() => scvI128(2n ** 127n)).toThrow(MerkleError);
    expect(() => scvI128(-(2n ** 127n) - 1n)).toThrow(MerkleError);
  });
});

describe('sorted-pair tree', () => {
  it('matches the golden root for the 3-leaf fixture (odd node promoted)', () => {
    const tree = buildMerkleRoot(
      GOLDEN.tree3.leaves.map((l) => ({ stellar: l.stellar, amount: BigInt(l.amount) })),
    );
    expect(tree.root.toString('hex')).toBe(GOLDEN.tree3.rootHex);
  });

  it('matches the golden root for the 4-leaf fixture', () => {
    const tree = buildMerkleRoot(
      GOLDEN.tree4.leaves.map((l) => ({ stellar: l.stellar, amount: BigInt(l.amount) })),
    );
    expect(tree.root.toString('hex')).toBe(GOLDEN.tree4.rootHex);
  });

  it('is deterministic regardless of input order (leaf order pinned by pubkey bytes)', () => {
    const leaves = GOLDEN.tree4.leaves.map((l) => ({ stellar: l.stellar, amount: BigInt(l.amount) }));
    const a = buildMerkleRoot(leaves).root;
    const b = buildMerkleRoot([...leaves].reverse()).root;
    const c = buildMerkleRoot([leaves[2]!, leaves[0]!, leaves[3]!, leaves[1]!]).root;
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(true);
  });

  it('pairs children in ascending byte order at every level', () => {
    // Two leaves: the root must be sha256(sorted(leafA, leafB)), which differs
    // from sha256(unsorted(leafA, leafB)) — proving we sort, not concat in order.
    const leafA = leafHash(GOLDEN.tree4.leaves[0]!.stellar, BigInt(GOLDEN.tree4.leaves[0]!.amount));
    const leafB = leafHash(GOLDEN.tree4.leaves[1]!.stellar, BigInt(GOLDEN.tree4.leaves[1]!.amount));
    const { root } = buildMerkleRoot([
      { stellar: GOLDEN.tree4.leaves[0]!.stellar, amount: BigInt(GOLDEN.tree4.leaves[0]!.amount) },
      { stellar: GOLDEN.tree4.leaves[1]!.stellar, amount: BigInt(GOLDEN.tree4.leaves[1]!.amount) },
    ]);
    const sorted = Buffer.compare(leafA, leafB) <= 0 ? [leafA, leafB] : [leafB, leafA];
    const unsorted = Buffer.compare(leafA, leafB) <= 0 ? [leafB, leafA] : [leafA, leafB];
    const expectedSorted = createHash('sha256').update(Buffer.concat(sorted)).digest();
    const expectedUnsorted = createHash('sha256').update(Buffer.concat(unsorted)).digest();
    expect(root.equals(expectedSorted)).toBe(true);
    expect(root.equals(expectedUnsorted)).toBe(false);
  });

  it('handles a single leaf (root == leaf)', () => {
    const { root, leaves } = buildMerkleRoot([
      { stellar: GOLDEN.leaf.stellar, amount: BigInt(GOLDEN.leaf.amount) },
    ]);
    expect(root.equals(leaves[0]!)).toBe(true);
    expect(root.toString('hex')).toBe(GOLDEN.leaf.leafHex);
  });

  it('rejects an empty leaf set', () => {
    expect(() => buildMerkleRoot([])).toThrow(MerkleError);
  });
});