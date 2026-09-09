import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRegistry, RegistryError } from '../src/registry.js';
import { splitstreamConfigSchema } from '../schemas/splitstream.schema.js';

const VALID_YAML = readFileSync(join(import.meta.dirname, 'fixtures', 'splitstream.valid.yml'), 'utf8');

// A valid base config object for schema-level tests (strkeys verified).
const BASE = {
  version: 1,
  repos: [
    { owner: 'your-org', name: 'splitstream-core' },
    { owner: 'your-org', name: 'splitstream-actions' },
  ],
  contributors: [
    { github: 'octocat', stellar: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' },
    { github: 'some-dev', stellar: 'GC3BLRQMHJGDIBAVHA2WQOY6Q7CBLAZUNZPIR5NYAX6XTQZUSTVRHHPK' },
  ],
  oracleAccount: 'GCWSW5ZMOHGEBLUFKL7PZGPZKW3OMMDCAT4OMBFKWHXNIUGWGG43HQ7C',
  tokenContract: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  vaultContract: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ',
  network: 'testnet',
} as const;

function expectInvalid(config: unknown, messagePart: string): void {
  const result = splitstreamConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  if (!result.success) {
    const joined = result.error.issues.map((i) => i.message).join('\n');
    expect(joined).toContain(messagePart);
  }
}

function tempYaml(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'splitstream-test-'));
  const file = join(dir, 'splitstream.yml');
  writeFileSync(file, contents);
  return file;
}

describe('splitstream.yml schema', () => {
  it('accepts a well-formed registry', () => {
    expect(() => loadRegistry(join(import.meta.dirname, 'fixtures', 'splitstream.valid.yml'))).not.toThrow();
    const result = splitstreamConfigSchema.safeParse(BASE);
    expect(result.success).toBe(true);
  });

  it('rejects a malformed G... strkey (bad length)', () => {
    expectInvalid({ ...BASE, contributors: [{ github: 'octocat', stellar: 'GABC' }] }, 'not a valid G... strkey');
  });

  it('rejects a G... strkey with a corrupt checksum (flipped char)', () => {
    const stellar = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const flipped = stellar.slice(0, -1) + (stellar.endsWith('F') ? 'E' : 'F');
    expectInvalid({ ...BASE, contributors: [{ github: 'octocat', stellar: flipped }] }, 'not a valid G... strkey');
  });

  it('rejects a wrong-prefix strkey (C... in a G... slot)', () => {
    expectInvalid(
      { ...BASE, contributors: [{ github: 'octocat', stellar: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526' }] },
      'not a valid G... strkey',
    );
  });

  it('rejects malformed C... strkeys (oracle/vault/token slots)', () => {
    // oracleAccount is a G... slot — a C...-looking value must be rejected as a bad G... strkey.
    expectInvalid({ ...BASE, oracleAccount: 'C-not-a-strkey' }, 'not a valid G... strkey');
    expectInvalid({ ...BASE, vaultContract: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' }, 'not a valid C... strkey');
    expectInvalid({ ...BASE, tokenContract: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC52' }, 'not a valid C... strkey');
  });

  it('rejects duplicate github handles (case-insensitively)', () => {
    expectInvalid(
      { ...BASE, contributors: [BASE.contributors[0], { github: 'OctoCAt', stellar: 'GC3BLRQMHJGDIBAVHA2WQOY6Q7CBLAZUNZPIR5NYAX6XTQZUSTVRHHPK' }] },
      'duplicate github handle',
    );
  });

  it('rejects an empty repos list', () => {
    expectInvalid({ ...BASE, repos: [] }, 'repos must not be empty');
  });

  it('rejects duplicate repo entries', () => {
    expectInvalid({ ...BASE, repos: [BASE.repos[0], { owner: 'YOUR-ORG', name: 'splitstream-core' }] }, 'duplicate repo entry');
  });

  it('rejects a missing vaultContract', () => {
    const { vaultContract: _omitted, ...rest } = BASE;
    expectInvalid(rest, 'vaultContract is required');
  });

  it('rejects an unknown top-level key (typo guard)', () => {
    expectInvalid({ ...BASE, vaultContractt: BASE.vaultContract }, 'Unrecognized key');
  });

  it('rejects an invalid network value', () => {
    expectInvalid({ ...BASE, network: 'futurenet' }, 'testnet');
  });

  it('rejects a non-1 version', () => {
    expectInvalid({ ...BASE, version: 2 }, 'version');
  });

  it('rejects an empty contributors list', () => {
    expectInvalid({ ...BASE, contributors: [] }, 'contributors must not be empty');
  });
});

describe('loadRegistry', () => {
  it('fails loudly on a missing file', () => {
    expect(() => loadRegistry('does/not/exist.yml')).toThrow(RegistryError);
  });

  it('fails loudly on invalid YAML', () => {
    expect(() => loadRegistry(tempYaml('version: [unclosed\n  - nope'))).toThrow(/not valid YAML/);
  });

  it('fails loudly with a detailed message on schema violations', () => {
    const bad = tempYaml(VALID_YAML.replace('some-dev', 'octocat'));
    let message = '';
    try {
      loadRegistry(bad);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain('failed validation');
    expect(message).toContain('duplicate github handle');
  });
});