import { describe, expect, it } from 'vitest';
import { groundProposal, groundRepair, groundVote, normalize } from '../grounding';
import type { AttackProposal, DefenseVote, Span } from '../contracts';

const spans: Span[] = [
  { id: 'S2', sectionPath: '1798.140(t)(1)', label: 'Sell',
    text: '“Sell,” means ... a consumer’s personal information by the business to another business or a third party for monetary or other valuable consideration.' },
];
const base: AttackProposal = {
  tactic: 'no_consideration', title: 'Free hand-off', scenario: 'A business gives data to an ad network for free.',
  quotes: [{ spanId: 'S2', text: 'for monetary or other valuable consideration' }],
  whyWordsPermit: 'w', whyPurposeDefeated: 'p',
};

describe('grounding', () => {
  it('normalizes curly quotes and whitespace', () => {
    expect(normalize('“Sell,”  a consumer’s\n data')).toBe('"Sell," a consumer\'s data');
  });
  it('accepts a verbatim quote', () => {
    expect(groundProposal(base, spans)).toEqual({ ok: true });
  });
  it('accepts straight quotes against curly source', () => {
    const p = { ...base, quotes: [{ spanId: 'S2', text: "a consumer's personal information" }] };
    expect(groundProposal(p, spans).ok).toBe(true);
  });
  it('rejects a one-word paraphrase', () => {
    const p = { ...base, quotes: [{ spanId: 'S2', text: 'for monetary or other valuable payment' }] };
    expect(groundProposal(p, spans)).toEqual({ ok: false, reasons: ['quote not found in S2: "for monetary or other valuable payment"'] });
  });
  it('rejects an unknown span', () => {
    const p = { ...base, quotes: [{ spanId: 'S9', text: 'anything here' }] };
    expect(groundProposal(p, spans)).toEqual({ ok: false, reasons: ['unknown span S9'] });
  });
  it('downgrades an unquoted blocked vote to unclear', () => {
    const v: DefenseVote = { judge: 'textualist', verdict: 'blocked', quotes: [], reasoning: 'r' };
    expect(groundVote(v, spans).verdict).toBe('unclear');
  });
  it('keeps a properly quoted blocked vote', () => {
    const v: DefenseVote = { judge: 'enforcer', verdict: 'blocked', quotes: [{ spanId: 'S2', text: 'or other valuable consideration' }], reasoning: 'r' };
    expect(groundVote(v, spans).verdict).toBe('blocked');
  });
  it('drops a repair whose before-text is not in the span', () => {
    expect(groundRepair({ title: 't', rationale: 'r', redline: [{ spanId: 'S2', before: 'no such words', after: 'x' }] }, spans).ok).toBe(false);
  });
});
