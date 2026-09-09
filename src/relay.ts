import * as core from '@actions/core';
import {
  BASE_FEE,
  Contract,
  FeeBumpTransaction,
  Keypair,
  nativeToScVal,
  rpc,
  scValToBigInt,
  TimeoutInfinite,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { scvI128 } from './merkle.js';

/**
 * Soroban RPC layer — the single integration point with the deployed
 * splitstream-core contract. The contract interface assumed here:
 *
 *   get_cycle_info() -> Option<CycleInfo>          // latest posted cycle
 *     where CycleInfo is a #[contracttype] record serialized as an ScVal vec:
 *       [ cycle_id: u32, start_ledger: u32, end_ledger: u32, root: Bytes(32), total_amount: i128 ]
 *     and None is ScVal void. Adjust `parseCycleInfo` here if the contract's
 *     field types/order differ — this is the one place to look.
 *
 *   post_cycle_root(cycle_id: u32, root: Bytes(32), total_amount: i128)
 *
 * The window for the next cycle starts at the close time of the previous
 * cycle's `end_ledger` (via RPC getLedgers). Failure modes are loud: a failed
 * submission, an unconfirmed transaction, or an unparseable contract reply all
 * throw RelayError — never "submitted" treated as "succeeded".
 */

export class RelayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RelayError';
  }
}

export interface CycleInfo {
  cycleId: number;
  startLedger: number;
  endLedger: number;
}

export function scvU32(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RelayError(`invalid u32 value: ${value}`);
  }
  return xdr.ScVal.scvU32(value);
}

function parseU32OrI128(scVal: xdr.ScVal): number {
  switch (scVal.type) {
    case 'scvU32':
      return scVal.u32;
    case 'scvI128': {
      const value = scValToBigInt(scVal);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new RelayError(`contract returned a value too large for a safe JS integer: ${value}`);
      }
      return Number(value);
    }
    default:
      throw new RelayError(
        `unexpected ScVal type '${scVal.type}' where scvU32|scvI128 was expected`,
      );
  }
}

/**
 * Parses `get_cycle_info`'s return value. Returns `null` when there is no
 * previous cycle (ScVal void / missing result). Throws on anything else —
 * an unparseable contract reply must never be guessed at.
 */
export function parseCycleInfo(retval: xdr.ScVal | undefined | null): CycleInfo | null {
  if (retval === undefined || retval === null || retval.type === 'scvVoid') return null;
  if (retval.type !== 'scvVec') {
    throw new RelayError(`unexpected get_cycle_info return type: '${retval.type}'`);
  }
  const fields = retval.vec;
  if (fields === null) {
    throw new RelayError('get_cycle_info returned an empty vec');
  }
  if (fields.length < 3) {
    throw new RelayError(
      `get_cycle_info returned ${fields.length} field(s); expected at least 3 (cycle_id, start_ledger, end_ledger, ...)`,
    );
  }
  return {
    cycleId: parseU32OrI128(fields[0]!),
    startLedger: parseU32OrI128(fields[1]!),
    endLedger: parseU32OrI128(fields[2]!),
  };
}

/**
 * Reads the latest posted cycle from splitstream-core. Returns `null` when no
 * cycle has been posted yet (cycle 0). Throws on RPC/auth errors — we never
 * silently fall back to an input window when the chain is simply unreachable.
 */
export async function queryLatestCycle(
  server: rpc.Server,
  vault: Contract,
  sourcePubkey: string,
  networkPassphrase: string,
): Promise<CycleInfo | null> {
  let account;
  try {
    account = await server.getAccount(sourcePubkey);
  } catch (err) {
    throw new RelayError(
      `cannot load relay account ${sourcePubkey} from Soroban RPC: ${describeRelayError(err)}`,
      { cause: err },
    );
  }

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(vault.call('get_cycle_info'))
    .setTimeout(TimeoutInfinite)
    .build();

  let simulation;
  try {
    simulation = await server.simulateTransaction(tx);
  } catch (err) {
    throw new RelayError(
      `get_cycle_info simulation failed: ${describeRelayError(err)}`,
      { cause: err },
    );
  }

  if ('error' in simulation) {
    throw new RelayError(`get_cycle_info simulation failed: ${simulation.error}`);
  }
  const retval = simulation.result?.retval;
  if (retval === undefined) {
    core.warning('get_cycle_info simulation produced no return value; assuming no previous cycle');
    return null;
  }
  return parseCycleInfo(retval);
}

/** Close time (ISO 8601) of a specific ledger, via RPC getLedgers. */
export async function ledgerCloseTime(server: rpc.Server, ledgerSeq: number): Promise<string> {
  let response;
  try {
    response = await server.getLedgers({ startLedger: ledgerSeq, pagination: { limit: 1 } });
  } catch (err) {
    throw new RelayError(
      `cannot read ledger ${ledgerSeq} close time from Soroban RPC: ${describeRelayError(err)}`,
      { cause: err },
    );
  }
  const ledger = response.ledgers[0];
  if (ledger === undefined || ledger.sequence !== ledgerSeq) {
    throw new RelayError(
      `Soroban RPC returned no ledger ${ledgerSeq} (oldest available: ${response.oldestLedger})`,
    );
  }
  return new Date(ledger.ledgerCloseTime).toISOString();
}

export interface RelayResult {
  hash: string;
  status: string;
  ledger: number;
}

/**
 * Builds, signs, submits and confirms `post_cycle_root(cycle_id, root, total_amount)`.
 *
 * The oracle keypair comes from the `ORACLE_SECRET_KEY` secret (loaded by the
 * caller) and is only ever used in memory. An optional `feeBumpKeypair`
 * (FEE_BUMP_SECRET_KEY) wraps the transaction in a fee bump when the relay
 * account's own balance is a concern. Fails loudly unless the transaction
 * lands with status SUCCESS — polling, not fire-and-forget.
 */
export async function relayCycleRoot(opts: {
  server: rpc.Server;
  vault: Contract;
  keypair: Keypair;
  networkPassphrase: string;
  cycleId: number;
  root: Buffer;
  totalAmount: bigint;
  feeBumpKeypair?: Keypair;
}): Promise<RelayResult> {
  const { server, vault, keypair, networkPassphrase, cycleId, root, totalAmount } = opts;
  if (root.length !== 32) {
    throw new RelayError(`merkle root must be exactly 32 bytes, got ${root.length}`);
  }

  let account;
  try {
    account = await server.getAccount(keypair.publicKey());
  } catch (err) {
    throw new RelayError(
      `cannot load relay account ${keypair.publicKey()} from Soroban RPC (is it funded?): ${describeRelayError(err)}`,
      { cause: err },
    );
  }

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(
      vault.call(
        'post_cycle_root',
        scvU32(cycleId),
        nativeToScVal(root),
        scvI128(totalAmount),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (err) {
    throw new RelayError(
      `prepareTransaction for post_cycle_root failed: ${describeRelayError(err)}`,
      { cause: err },
    );
  }
  prepared.sign(keypair);

  const feeBump = opts.feeBumpKeypair;
  const toSubmit = feeBump === undefined ? prepared : new FeeBumpTransaction(prepared.toEnvelope(), networkPassphrase);
  if (feeBump !== undefined) {
    toSubmit.sign(feeBump);
  }

  let sent;
  try {
    sent = await server.sendTransaction(toSubmit);
  } catch (err) {
    throw new RelayError(
      `sendTransaction for post_cycle_root failed: ${describeRelayError(err)}`,
      { cause: err },
    );
  }
  if (sent.status === 'ERROR') {
    throw new RelayError(
      `Soroban RPC rejected post_cycle_root (hash=${sent.hash}, status=${sent.status}); inspect the RPC response for details`,
    );
  }
  core.info(`post_cycle_root submitted (hash=${sent.hash}, status=${sent.status}); awaiting confirmation...`);

  let confirmed;
  try {
    confirmed = await server.pollTransaction(sent.hash, { attempts: 90 });
  } catch (err) {
    throw new RelayError(
      `post_cycle_root transaction ${sent.hash} was not confirmed in time: ${describeRelayError(err)}`,
      { cause: err },
    );
  }
  if (confirmed.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    const ledger =
      confirmed.status === rpc.Api.GetTransactionStatus.FAILED ? ` (ledger=${confirmed.ledger})` : '';
    throw new RelayError(
      `post_cycle_root transaction ${sent.hash} did not land: status=${confirmed.status}${ledger}; inspect the transaction on an explorer`,
    );
  }

  return { hash: sent.hash, status: confirmed.status, ledger: confirmed.ledger };
}

function describeRelayError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}