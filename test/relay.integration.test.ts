import { describe, expect, it } from 'vitest';
import { Contract, Keypair, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import {
  ledgerCloseTime,
  parseCycleInfo,
  queryCycleInfo,
  relayCycleRoot,
} from '../src/relay.js';
import { networkPassphrase } from '../src/registry.js';

/**
 * Testnet-only integration tests. Skipped unless every gate is satisfied:
 *
 *   RUN_RELAY_INTEGRATION=1        run the read-only suite
 *   SOROBAN_RPC_URL=...            e.g. https://soroban-testnet.stellar.org
 *   SPLITSTREAM_VAULT_CONTRACT=... deployed splitstream-core contract (C...)
 *   ORACLE_SECRET_KEY=...          funded relay keypair secret (S...)
 *
 * The submit test additionally requires RUN_RELAY_SUBMIT=1 because it is
 * state-changing on testnet (posts a real cycle root). Run it against a throwaway
 * vault/contract, never a shared one.
 */

const rpcUrl = process.env.SOROBAN_RPC_URL ?? '';
const vaultContract = process.env.SPLITSTREAM_VAULT_CONTRACT ?? '';
const oracleSecret = process.env.ORACLE_SECRET_KEY ?? '';

const runReadOnly =
  process.env.RUN_RELAY_INTEGRATION === '1' &&
  rpcUrl !== '' &&
  vaultContract !== '' &&
  oracleSecret !== '';
const runSubmit = runReadOnly && process.env.RUN_RELAY_SUBMIT === '1';

describe.skipIf(!runReadOnly)('relay integration (testnet, read-only)', () => {
  // Construction happens inside the tests: describe.skipIf still evaluates the
  // callback body, so building the client here would throw when gated off.

  it('queries cycle info for an explicit cycle id without error', async () => {
    const server = new rpc.Server(rpcUrl);
    const vault = new Contract(vaultContract);
    const keypair = Keypair.fromSecret(oracleSecret);
    // The contract cannot enumerate cycles: the caller supplies the id. Cycle 0
    // exists on a vault that has run once; a never-posted cycle returns None
    // (ScVal void). Either is a well-formed reply.
    const cycle = await queryCycleInfo(
      server,
      vault,
      keypair.publicKey(),
      networkPassphrase('testnet'),
      0,
    );
    if (cycle !== null) {
      expect(cycle.root).toHaveLength(32);
      expect(cycle.postedAt).toBeGreaterThan(0);
      expect(typeof cycle.totalAmount).toBe('bigint');
      expect(typeof cycle.claimsStarted).toBe('boolean');
      expect(typeof cycle.replaced).toBe('boolean');
    }
  });

  it('resolves a ledger close time to ISO 8601', async () => {
    const server = new rpc.Server(rpcUrl);
    const latest = await server.getLatestLedger();
    const iso = await ledgerCloseTime(server, latest.sequence);
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    expect(new Date(iso).getUTCFullYear()).toBeGreaterThan(2020);
  });
});

describe.skipIf(!runSubmit)('relay submit (testnet, state-changing)', () => {
  it('posts a cycle root and confirms it landed', async () => {
    const server = new rpc.Server(rpcUrl);
    const vault = new Contract(vaultContract);
    const keypair = Keypair.fromSecret(oracleSecret);
    const result = await relayCycleRoot({
      server,
      vault,
      keypair,
      networkPassphrase: networkPassphrase('testnet'),
      // Deliberately absurd cycle id so it can never collide with a real cycle.
      cycleId: 999_999,
      root: Buffer.alloc(32, 0xab),
      totalAmount: 1n,
    });
    expect(result.status).toBe('SUCCESS');
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.ledger).toBeGreaterThan(0);
  });
});

describe('parseCycleInfo (unit)', () => {
  /** Builds the ScVal map soroban-sdk emits for a #[contracttype] CycleInfo. */
  function cycleInfoMap(overrides: {
    root?: xdr.ScVal;
    totalAmount?: xdr.ScVal;
    postedAt?: xdr.ScVal;
    claimsStarted?: xdr.ScVal;
    replaced?: xdr.ScVal;
    extra?: Array<[string, xdr.ScVal]>;
    drop?: string[];
    nonSymbolKey?: boolean;
  } = {}): xdr.ScVal {
    const entry = (key: string, val: xdr.ScVal) =>
      new xdr.ScMapEntry({
        key: overrides.nonSymbolKey === true ? xdr.ScVal.scvU32(1) : xdr.ScVal.scvSymbol(key),
        val,
      });
    const fields: Array<[string, xdr.ScVal]> = [
      ['root', xdr.ScVal.scvBytes(Buffer.alloc(32, 7))],
      ['total_amount', nativeToScVal(5000000000n, { type: 'i128' })],
      ['posted_at', xdr.ScVal.scvU64(1757520000n)],
      ['claims_started', xdr.ScVal.scvBool(false)],
      ['replaced', xdr.ScVal.scvBool(true)],
      ...(overrides.extra ?? []),
    ];
    const byName = {
      root: overrides.root,
      total_amount: overrides.totalAmount,
      posted_at: overrides.postedAt,
      claims_started: overrides.claimsStarted,
      replaced: overrides.replaced,
    };
    const entries = fields
      .filter(([name]) => !(overrides.drop ?? []).includes(name))
      .map(([name, val]) => entry(name, (byName as Record<string, xdr.ScVal | undefined>)[name] ?? val));
    return xdr.ScVal.scvMap(entries);
  }

  it('parses the real 5-field CycleInfo map', () => {
    const info = parseCycleInfo(cycleInfoMap());
    expect(info).toEqual({
      root: Buffer.alloc(32, 7),
      totalAmount: 5000000000n,
      postedAt: 1757520000,
      claimsStarted: false,
      replaced: true,
    });
  });

  it('is order-independent (soroban-sdk emits keys sorted alphabetically)', () => {
    const info = parseCycleInfo(
      cycleInfoMap({ extra: [['zzz', xdr.ScVal.scvU32(9)]] }), // unsorted extra entry
    );
    expect(info?.postedAt).toBe(1757520000);
    expect(info?.replaced).toBe(true);
  });

  it('treats void / missing results as "no such cycle"', () => {
    expect(parseCycleInfo(xdr.ScVal.scvVoid())).toBeNull();
    expect(parseCycleInfo(undefined)).toBeNull();
    expect(parseCycleInfo(null)).toBeNull();
  });

  it('throws on a non-map reply rather than guessing', () => {
    expect(() => parseCycleInfo(xdr.ScVal.scvU32(1))).toThrow();
    expect(() => parseCycleInfo(xdr.ScVal.scvVec([]))).toThrow();
  });

  it('throws on an empty map', () => {
    expect(() => parseCycleInfo(xdr.ScVal.scvMap([]))).toThrow();
  });

  it('throws when a required field is missing', () => {
    expect(() => parseCycleInfo(cycleInfoMap({ drop: ['root'] }))).toThrow(/missing required fields/);
    expect(() => parseCycleInfo(cycleInfoMap({ drop: ['posted_at', 'replaced'] }))).toThrow(
      /missing required fields/,
    );
  });

  it('throws on a non-symbol map key', () => {
    expect(() => parseCycleInfo(cycleInfoMap({ nonSymbolKey: true }))).toThrow(/non-symbol key/);
  });

  it('throws on wrong field types', () => {
    expect(() =>
      parseCycleInfo(cycleInfoMap({ root: xdr.ScVal.scvU32(1) })),
    ).toThrow(/root must be a 32-byte Bytes/);
    expect(() =>
      parseCycleInfo(cycleInfoMap({ root: xdr.ScVal.scvBytes(Buffer.alloc(16)) })),
    ).toThrow(/32-byte/);
    expect(() =>
      parseCycleInfo(cycleInfoMap({ postedAt: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: xdr.Int64(0n), lo: xdr.Uint64(0n) })) })),
    ).toThrow(/posted_at must be a u64/);
    expect(() =>
      parseCycleInfo(cycleInfoMap({ claimsStarted: xdr.ScVal.scvU64(1n) })),
    ).toThrow(/must be booleans/);
    expect(() =>
      parseCycleInfo(cycleInfoMap({ totalAmount: xdr.ScVal.scvU64(1n) })),
    ).toThrow(/total_amount must be an i128/);
  });
});