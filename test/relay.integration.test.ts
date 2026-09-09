import { describe, expect, it } from 'vitest';
import { Contract, Keypair, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import {
  ledgerCloseTime,
  parseCycleInfo,
  queryLatestCycle,
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

  it('queries the latest cycle boundary without error', async () => {
    const server = new rpc.Server(rpcUrl);
    const vault = new Contract(vaultContract);
    const keypair = Keypair.fromSecret(oracleSecret);
    const cycle = await queryLatestCycle(server, vault, keypair.publicKey(), networkPassphrase('testnet'));
    // Either no cycle yet (cycle 0) or a well-formed CycleInfo.
    if (cycle !== null) {
      expect(cycle.cycleId).toBeTypeOf('number');
      expect(cycle.endLedger).toBeGreaterThan(0);
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
  function vec(...values: xdr.ScVal[]): xdr.ScVal {
    return xdr.ScVal.scvVec(values);
  }

  it('parses a u32-based CycleInfo vec', () => {
    const info = parseCycleInfo(
      vec(xdr.ScVal.scvU32(3), xdr.ScVal.scvU32(100), xdr.ScVal.scvU32(150)),
    );
    expect(info).toEqual({ cycleId: 3, startLedger: 100, endLedger: 150 });
  });

  it('parses an i128-based CycleInfo vec', () => {
    const info = parseCycleInfo(
      vec(nativeToScVal(4n, { type: 'i128' }), nativeToScVal(200n, { type: 'i128' }), nativeToScVal(260n, { type: 'i128' })),
    );
    expect(info).toEqual({ cycleId: 4, startLedger: 200, endLedger: 260 });
  });

  it('treats void / missing results as "no previous cycle"', () => {
    expect(parseCycleInfo(xdr.ScVal.scvVoid())).toBeNull();
    expect(parseCycleInfo(undefined)).toBeNull();
    expect(parseCycleInfo(null)).toBeNull();
  });

  it('throws on malformed replies rather than guessing', () => {
    expect(() => parseCycleInfo(xdr.ScVal.scvU32(1))).toThrow();
    expect(() => parseCycleInfo(vec(xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(2)))).toThrow();
    expect(() =>
      parseCycleInfo(vec(xdr.ScVal.scvBool(true), xdr.ScVal.scvU32(2), xdr.ScVal.scvU32(3))),
    ).toThrow();
  });
});