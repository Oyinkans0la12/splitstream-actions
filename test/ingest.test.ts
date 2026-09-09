import { describe, expect, it } from 'vitest';
import { extractClosingIssueRefs } from '../src/ingest.js';

describe('extractClosingIssueRefs', () => {
  it('matches the canonical closing keywords', () => {
    expect(extractClosingIssueRefs('Closes #42')).toEqual([42]);
    expect(extractClosingIssueRefs('This fixes #7')).toEqual([7]);
    expect(extractClosingIssueRefs('Resolves #9')).toEqual([9]);
    expect(extractClosingIssueRefs('closed #1\nfixed #2\nresolved #3')).toEqual([1, 2, 3]);
  });

  it('matches multiple references in one body', () => {
    expect(extractClosingIssueRefs('Closes #42 and also fixes #7')).toEqual([42, 7]);
  });

  it('deduplicates repeated references', () => {
    expect(extractClosingIssueRefs('Closes #42, fixes #42')).toEqual([42]);
  });

  it('does not match plain issue mentions without a keyword', () => {
    expect(extractClosingIssueRefs('see issue #5 for context')).toEqual([]);
    expect(extractClosingIssueRefs('#42 alone is not a closing reference')).toEqual([]);
  });

  it('does not match partial words or partial numbers', () => {
    expect(extractClosingIssueRefs('this resolves #12abc')).toEqual([]);
    expect(extractClosingIssueRefs('uncloses #3')).toEqual([]);
    expect(extractClosingIssueRefs('refix #3')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    expect(extractClosingIssueRefs('CLOSES #42')).toEqual([42]);
    expect(extractClosingIssueRefs('FiXeS #42')).toEqual([42]);
  });

  it('does not match issue references in other repos', () => {
    // GitHub only auto-closes same-repo issues; owner/repo#N is not a closing ref.
    expect(extractClosingIssueRefs('closes your-org/other#42')).toEqual([]);
  });

  it('handles null and empty bodies', () => {
    expect(extractClosingIssueRefs(null)).toEqual([]);
    expect(extractClosingIssueRefs('')).toEqual([]);
  });
});