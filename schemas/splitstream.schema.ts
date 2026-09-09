import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

/**
 * Zod schema for `.github/splitstream.yml` — the org-level contributor registry.
 *
 * Validation rules (enforced strictly — a malformed entry fails the Action run loudly):
 *  - `repos` must be non-empty and contain no duplicate (owner, name) pairs.
 *  - `contributors` must be non-empty and contain no duplicate GitHub handles
 *    (matched case-insensitively — GitHub login names are case-insensitive).
 *  - Every `G...`/`C...` strkey is verified with StrKey's full checksum check
 *    (56 chars, correct version prefix, valid CRC16-XModem checksum) — we never
 *    accept a value just because it "starts with G".
 *  - `vaultContract` is required (the deployed splitstream-core contract).
 *  - Unknown top-level keys are rejected so typos like `vaultContractt` cannot
 *    silently pass.
 */

const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/** A `G...` ed25519 public key (56 chars, prefix + checksum verified). */
function publicKeyStrkey(field: string) {
  return z
    .string({ error: `${field} is required (G... strkey)` })
    .describe('Stellar ed25519 public key (G... strkey)')
    .superRefine((value, ctx) => {
      if (!StrKey.isValidEd25519PublicKey(value)) {
        ctx.addIssue({
          code: 'custom',
          message:
            `'${value}' is not a valid G... strkey: expected 56 chars with the ` +
            `ed25519 version byte and a valid checksum`,
        });
      }
    });
}

/** A `C...` contract id (56 chars, prefix + checksum verified). */
function contractStrkey(field: string) {
  return z
    .string({ error: `${field} is required (C... strkey)` })
    .describe('Stellar contract id (C... strkey)')
    .superRefine((value, ctx) => {
      if (!StrKey.isValidContract(value)) {
        ctx.addIssue({
          code: 'custom',
          message:
            `'${value}' is not a valid C... strkey: expected 56 chars with the ` +
            `contract version byte and a valid checksum`,
        });
      }
    });
}

const repoSchema = z.object({
  owner: z.string().min(1, 'repo owner must not be empty'),
  name: z.string().min(1, 'repo name must not be empty'),
});

const contributorSchema = z.object({
  github: z
    .string()
    .regex(GITHUB_HANDLE_RE, 'not a valid GitHub handle (1-39 chars, alphanumeric or hyphen, no leading/trailing hyphen)'),
  stellar: publicKeyStrkey('contributors[].stellar'),
});

export const splitstreamConfigSchema = z
  .object({
    version: z.literal(1, { error: 'version must be 1' }),
    repos: z
      .array(repoSchema)
      .min(1, 'repos must not be empty — at least one repo must contribute points')
      .superRefine((repos, ctx) => {
        const seen = new Set<string>();
        repos.forEach((repo, i) => {
          const key = `${repo.owner.toLowerCase()}/${repo.name.toLowerCase()}`;
          if (seen.has(key)) {
            ctx.addIssue({
              code: 'custom',
              path: [i],
              message: `duplicate repo entry: ${repo.owner}/${repo.name}`,
            });
          }
          seen.add(key);
        });
      }),
    contributors: z
      .array(contributorSchema)
      .min(1, 'contributors must not be empty — nobody would be payable this cycle')
      .superRefine((contributors, ctx) => {
        const seen = new Map<string, number>();
        contributors.forEach((c, i) => {
          const key = c.github.toLowerCase();
          if (seen.has(key)) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'github'],
              message: `duplicate github handle: '${c.github}' (handles are matched case-insensitively; already used at index ${seen.get(key)})`,
            });
          }
          seen.set(key, i);
        });
      }),
    oracleAccount: publicKeyStrkey('oracleAccount'),
    tokenContract: contractStrkey('tokenContract'),
    vaultContract: contractStrkey('vaultContract'),
    network: z.enum(['testnet', 'mainnet'], { error: "network must be 'testnet' or 'mainnet'" }),
  })
  .strict();

export type SplitstreamConfig = z.infer<typeof splitstreamConfigSchema>;
export type RepoRef = z.infer<typeof repoSchema>;
export type ContributorRef = z.infer<typeof contributorSchema>;
export type SplitstreamNetwork = SplitstreamConfig['network'];