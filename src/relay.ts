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
 * splitstream-core contract. The contract interface (verified against
 * splitstream-core's source, which is immutable at its deployed contract id):
 *
 *   get_cycle_info(cycle_id: u64) -> Option<CycleInfo>
 *     where CycleInfo is a #[contracttype] record serialized as an ScVal map
 *     keyed by field-name symbols:
 *       { root: Bytes(32), total_amount: i128, posted_at: u64,
 *         claims_started: bool, replaced: bool }
 *     and None is ScVal void. Adjust `parseCycleInfo` here if the contract's
 *     shape ever differs — this is the one place to look.
 *
 *   post_cycle_root(cycle_id: u64, root: Bytes(32), total_amount: i128)
 *
 * The contract CANNOT enumerate posted cycles (there is no "latest cycle"
 * call), so the window for the next cycle is derived from this repo's own
 * committed audit trail (manifests/cycle-<id>.json) — see
 * `readLastManifestWindow` in manifest.ts. get_cycle_info(cycle_id) is used
 * only as a sanity check against that manifest. Failure modes are loud: a
 * failed submission, an unconfirmed transaction, or an unparseable contract
 * reply all throw RelayError — never "submitted" treated as "succeeded".
 */

export class RelayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RelayError';
  }
}

export interface CycleInfo {
  /** 32-byte Merkle root of the payout manifest (BytesN<32>). */
  root: Buffer;
  /** Total amount the manifest allocates for this cycle (i128, stroops). */
  totalAmount: bigint;
  /** Ledger timestamp (Unix seconds) the root was posted. */
  postedAt: number;
  /** True after the first successful claim — locks out replacement. */
  claimsStarted: boolean;
  /** True once the root was challenged and replaced (one replacement max). */
  replaced: boolean;
}

export function scvU64(value: number | bigint): xdr.ScVal {
  let asBigInt: bigint;
  if (typeof value === 'bigint') {
    asBigInt = value;
  } else if (Number.isSafeInteger(value) && value >= 0) {
    asBigInt = BigInt(value);
  } else {
    throw new RelayError(`invalid u64 value: ${value}`);
  }
  if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RelayError(`invalid u64 value: ${value}`);
  }
  return xdr.ScVal.scvU64(asBigInt);
}

/**
 * Parses `get_cycle_info`'s return value. Returns `null` when the contract
 * has no record for the queried cycle (ScVal void / missing result). Throws on
 * anything else — an unparseable contract reply must never be guessed at.
 *
 * CycleInfo is a `#[contracttype]` struct, which soroban-sdk serializes as an
 * ScVal map keyed by field-name symbols (root, total_amount, posted_at,
 * claims_started, replaced); `Option<CycleInfo>` is Void for None and the map
 * itself for Some. Lookup is by key, so map entry order does not matter.
 */
export function parseCycleInfo(retval: xdr.ScVal | undefined | null): CycleInfo | null {
  if (retval === undefined || retval === null || retval.type === 'scvVoid') return null;
  if (retval.type !== 'scvMap') {
    throw new RelayError(
      `unexpected get_cycle_info return type: '${retval.type}' (expected scvMap or scvVoid)`,
    );
  }
  const entries = retval.map;
  if (entries === null || entries === undefined || entries.length === 0) {
    throw new RelayError('get_cycle_info returned an empty map');
  }

  const byKey = new Map<string, xdr.ScVal>();
  for (const entry of entries) {
    if (entry.key.type !== 'scvSymbol') {
      throw new RelayError(
        `get_cycle_info returned a map entry with a non-symbol key ('${entry.key.type}')`,
      );
    }
    byKey.set(entry.key.sym.toString(), entry.val);
  }

  const root = byKey.get('root');
  const totalAmount = byKey.get('total_amount');
  const postedAt = byKey.get('posted_at');
  const claimsStarted = byKey.get('claims_started');
  const replaced = byKey.get('replaced');
  if (
    root === undefined ||
    totalAmount === undefined ||
    postedAt === undefined ||
    claimsStarted === undefined ||
    replaced === undefined
  ) {
    throw new RelayError(
      `get_cycle_info returned a map missing required fields (found: ${[...byKey.keys()].join(', ') || 'none'})`,
    );
  }

  if (root.type !== 'scvBytes' || root.bytes.value.length !== 32) {
    throw new RelayError(
      `get_cycle_info root must be a 32-byte Bytes value, got '${root.type}'` +
        (root.type === 'scvBytes' ? ` (${root.bytes.value.length} bytes)` : ''),
    );
  }
  if (totalAmount.type !== 'scvI128') {
    throw new RelayError(`get_cycle_info total_amount must be an i128, got '${totalAmount.type}'`);
  }
  if (postedAt.type !== 'scvU64') {
    throw new RelayError(`get_cycle_info posted_at must be a u64, got '${postedAt.type}'`);
  }
  const postedAtValue = postedAt.u64;
  if (postedAtValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RelayError(
      `get_cycle_info posted_at is too large for a safe JS integer: ${postedAtValue}`,
    );
  }
  if (claimsStarted.type !== 'scvBool' || replaced.type !== 'scvBool') {
    throw new RelayError(
      `get_cycle_info claims_started/replaced must be booleans, got '${claimsStarted.type}'/'${replaced.type}'`,
    );
  }

  return {
    root: Buffer.from(root.bytes.value),
    totalAmount: scValToBigInt(totalAmount),
    postedAt: Number(postedAtValue),
    claimsStarted: claimsStarted.b,
    replaced: replaced.b,
  };
}

/**
 * Reads one cycle's info from splitstream-core by id (the contract cannot
 * enumerate cycles — the caller supplies the id). Returns `null` when the
 * contract has no record for that cycle. Throws on RPC/auth errors — we never
 * guess when the chain is unreachable.
 */
export async function queryCycleInfo(
  server: rpc.Server,
  vault: Contract,
  sourcePubkey: string,
  networkPassphrase: string,
  cycleId: number,
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
    .addOperation(vault.call('get_cycle_info', scvU64(cycleId)))
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
        scvU64(cycleId),
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