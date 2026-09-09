import type { Contribution } from './ingest.js';
import { findContributor, type SplitstreamConfig } from './registry.js';

/**
 * Points attribution.
 *
 * Label convention: a closed issue carries exactly one of `points:100`,
 * `points:150`, `points:200` (exact names). The lookup normalizes each label
 * once, here — trim + lowercase — so if a repo historically created
 * `Points:150` or `points: 150`, it is reconciled in this single place rather
 * than patched per repo. Points are attributed to the PR author (the PR closes
 * the issue, the PR author did the work), not the issue author, and are summed
 * across every repo in the org before shares are computed.
 */

export const POINTS_BY_LABEL = {
  'points:100': 100,
  'points:150': 150,
  'points:200': 200,
} as const;

export type PointsLabel = keyof typeof POINTS_BY_LABEL;

export function parsePointsLabel(label: string): number | null {
  return POINTS_BY_LABEL[label as PointsLabel] ?? null;
}

export function extractPointsLabel(
  labels: string[],
): { label: string; points: number } | null {
  for (const raw of labels) {
    const normalized = raw.trim().toLowerCase();
    const points = parsePointsLabel(normalized);
    if (points !== null) return { label: normalized, points };
  }
  return null;
}

export interface PointsAttribution {
  /** Contributor handle -> total points, keyed by the registry's canonical casing. */
  pointsByGithub: Map<string, number>;
  /** PR authors with points who are NOT in the registry — they are never paid. */
  unregistered: Array<{ github: string; points: number; repos: string[] }>;
  /** Human-readable warnings for issues carrying more than one points label. */
  labelConflicts: string[];
}

export function attributePoints(
  contributions: Contribution[],
  registry: SplitstreamConfig,
): PointsAttribution {
  const totals = new Map<string, { points: number; repos: Set<string> }>();
  const labelConflicts: string[] = [];

  for (const contribution of contributions) {
    const matched = extractPointsLabel(contribution.labels);
    if (matched === null) continue; // no points label — nothing to attribute

    const distinctPointsLabels = new Set(
      contribution.labels
        .map((label) => label.trim().toLowerCase())
        .filter((label) => parsePointsLabel(label) !== null),
    );
    if (distinctPointsLabels.size > 1) {
      labelConflicts.push(
        `issue #${contribution.issueNumber} in ${contribution.owner}/${contribution.repo} ` +
          `carries multiple points labels (${[...distinctPointsLabels].join(', ')}); ` +
          `using '${matched.label}' — fix the issue's labels before the next cycle`,
      );
    }

    const entry = totals.get(contribution.prAuthor) ?? {
      points: 0,
      repos: new Set<string>(),
    };
    entry.points += matched.points;
    entry.repos.add(`${contribution.owner}/${contribution.repo}`);
    totals.set(contribution.prAuthor, entry);
  }

  const pointsByGithub = new Map<string, number>();
  const unregistered: PointsAttribution['unregistered'] = [];

  for (const [handle, { points, repos }] of totals) {
    const contributor = findContributor(registry, handle);
    if (contributor === undefined) {
      unregistered.push({ github: handle, points, repos: [...repos] });
      continue;
    }
    const current = pointsByGithub.get(contributor.github) ?? 0;
    pointsByGithub.set(contributor.github, current + points);
  }

  return { pointsByGithub, unregistered, labelConflicts };
}