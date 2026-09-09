import { createHash } from 'node:crypto';
import { StrKey, xdr } from '@stellar/stellar-sdk';

/**
 * Merkle generation — must match splitstream-core's `merkle::leaf_hash` exactly.
 *
 * A leaf is
 *
 *   sha256( xdr_encode(ScVal(Address(stellar_pubkey))) || xdr_encode(ScVal(i128(amount))) )
 *
 * where both halves are the full ScVal XDR produced by soroban-sdk's `ToXdr`
 * trait (verified against the Rust SDK source: ToXdr serializes "to XDR in its
 * ScVal form", i.e. with the ScVal union discriminant):
 *
 *   - Address:   u32(SCV_ADDRESS=18) || u32(SC_ADDRESS_TYPE_ACCOUNT=0) || 32-byte ed25519
 *   - i128:      u32(SCV_I128=10) || int64 hi || uint64 lo   (two's complement, 128-bit)
 *
 * We do NOT use any Merkle library's default leaf hashing (e.g.
 * merkletreejs's double-sha256 of raw buffers) — the leaf bytes are produced
 * here, from the contract's exact XDR layout, and pinned by the cross-language
 * golden fixture in test/fixtures/merkle.golden.json.
 *
 * Tree construction: sorted-pair Merkle tree. At each level, children are
 * paired left-to-right and concatenated in ascending byte order before
 * hashing; an odd node is promoted to the next level unchanged. This must match
 * the verification algorithm in the contract's merkle.rs.
 */

export class MerkleError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MerkleError';
  }
}

const I128_MIN = -(2n ** 127n);
const I128_MAX = 2n ** 127n - 1n;

/** ScVal encoding of a signed 128-bit amount (stroops), byte-identical to soroban-sdk's `i128.to_xdr()`. */
export function scvI128(amount: bigint): xdr.ScVal {
  if (amount < I128_MIN || amount > I128_MAX) {
    throw new MerkleError(`amount out of i128 range: ${amount}`);
  }
  const hi = BigInt.asIntN(64, amount >> 64n);
  const lo = amount & 0xffffffffffffffffn;
  return xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: xdr.Int64(hi), lo: xdr.Uint64(lo) }));
}

/** ScVal encoding of an ed25519 address, byte-identical to soroban-sdk's `Address.to_xdr()`. */
export function addressScVal(stellarPubkey: string): xdr.ScVal {
  if (!StrKey.isValidEd25519PublicKey(stellarPubkey)) {
    throw new MerkleError(`invalid stellar public key: '${stellarPubkey}'`);
  }
  const pkBytes = StrKey.decodeEd25519PublicKey(stellarPubkey);
  const publicKey = xdr.PublicKey.publicKeyTypeEd25519(pkBytes);
  const scAddress = xdr.ScAddress.scAddressTypeAccount(publicKey);
  return xdr.ScVal.scvAddress(scAddress);
}

/** The 64-byte pre-image (Address XDR || i128 XDR) hashed into a leaf. */
export function leafPayload(stellarPubkey: string, amount: bigint): Buffer {
  return Buffer.concat([addressScVal(stellarPubkey).toXDR(), scvI128(amount).toXDR()]);
}

/** sha256 of the leaf pre-image — the value compared against splitstream-core's `merkle::leaf_hash`. */
export function leafHash(stellarPubkey: string, amount: bigint): Buffer {
  return createHash('sha256').update(leafPayload(stellarPubkey, amount)).digest();
}

export interface MerkleLeaf {
  stellar: string;
  amount: bigint;
}

function hashSortedPair(a: Buffer, b: Buffer): Buffer {
  const [lo, hi] = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  return createHash('sha256').update(Buffer.concat([lo, hi])).digest();
}

export interface MerkleTree {
  root: Buffer;
  leaves: Buffer[];
  levels: Buffer[][];
}

/**
 * Builds the sorted-pair Merkle tree over the payout leaves.
 *
 * Leaf order is deterministic: ascending stellar pubkey bytes. The manifest
 * entries may be in any order; the tree pins the order itself, so the root is
 * reproducible from the manifest alone.
 */
export function buildMerkleRoot(entries: MerkleLeaf[]): MerkleTree {
  if (entries.length === 0) {
    throw new MerkleError('cannot build a Merkle tree from zero leaves');
  }

  const sorted = [...entries].sort((a, b) => {
    const aKey = Buffer.from(StrKey.decodeEd25519PublicKey(a.stellar));
    const bKey = Buffer.from(StrKey.decodeEd25519PublicKey(b.stellar));
    return Buffer.compare(aKey, bKey);
  });

  let level = sorted.map((entry) => leafHash(entry.stellar, entry.amount));
  const levels: Buffer[][] = [level];

  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1];
      next.push(right === undefined ? left : hashSortedPair(left, right));
    }
    level = next;
    levels.push(level);
  }

  return { root: level[0]!, leaves: levels[0]!, levels };
}