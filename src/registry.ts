import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { Networks } from '@stellar/stellar-sdk';
import {
  splitstreamConfigSchema,
  type ContributorRef,
  type SplitstreamConfig,
} from '../schemas/splitstream.schema.js';

export type { ContributorRef, SplitstreamConfig } from '../schemas/splitstream.schema.js';

/**
 * Loads and zod-validates the org contributor registry (`.github/splitstream.yml`).
 *
 * Any validation failure throws a {@link RegistryError} — the Action entrypoint
 * converts it into a loud `core.setFailed`. We never silently skip a malformed
 * entry: a typo'd strkey or a duplicate handle aborts the whole cycle.
 */

export class RegistryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RegistryError';
  }
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function loadRegistry(configPath: string): SplitstreamConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (err) {
    throw new RegistryError(
      `cannot read contributor registry at '${configPath}': ${describeError(err)}`,
      { cause: err },
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new RegistryError(
      `contributor registry at '${configPath}' is not valid YAML: ${describeError(err)}`,
      { cause: err },
    );
  }

  const result = splitstreamConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `${path}: ${issue.message}`;
      })
      .join('\n  - ');
    throw new RegistryError(
      `contributor registry at '${configPath}' failed validation:\n  - ${details}`,
    );
  }

  return result.data;
}

export function networkPassphrase(network: SplitstreamConfig['network']): string {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Default Soroban RPC endpoint per network. Override with the `rpc_url` input.
 * Sources: Stellar docs "RPC providers" (SDF testnet; Gateway public mainnet).
 */
export function defaultRpcUrl(network: SplitstreamConfig['network']): string {
  return network === 'mainnet'
    ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
    : 'https://soroban-testnet.stellar.org';
}

/** Case-insensitive registry lookup by GitHub handle. */
export function findContributor(
  registry: SplitstreamConfig,
  github: string,
): ContributorRef | undefined {
  const lower = github.toLowerCase();
  return registry.contributors.find((c) => c.github.toLowerCase() === lower);
}