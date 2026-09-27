import { describe, expect, it } from 'vitest';
import { applyRedline, findingHash, verifyFinding } from '../finding';
import type { Span } from '../contracts';

const input = { sourceSha: 'a'.repeat(64), purposeHash: 'b'.repeat(64), proposal: { title: 'x' }, votes: [{ verdict: 'loophole' }] };

describe('finding', () => {
  it('hash is stable and verifiable', () => {
    const hash = findingHash(input);
    expect(verifyFinding({ ...input, hash })).toBe(true);
  });
  it('tampered finding fails verification', () => {
    const hash = findingHash(input);
    expect(verifyFinding({ ...input, votes: [{ verdict: 'blocked' }], hash })).toBe(false);
  });
  it('applies a redline to a copy and leaves the original spans alone', () => {
    const spans: Span[] = [{ id: 'S7', sectionPath: '1798.120(c)', label: 'Opt-out', text: 'prohibited from selling the consumer’s personal information' }];
    const out = applyRedline(spans, [{ spanId: 'S7', before: 'from selling', after: 'from selling or sharing' }]);
    expect(out[0].text).toBe("prohibited from selling or sharing the consumer's personal information");
    expect(spans[0].text).toContain('consumer’s');
  });
  it('throws when before-text is ambiguous', () => {
    const spans: Span[] = [{ id: 'S1', sectionPath: 'x', label: 'x', text: 'sell and sell' }];
    expect(() => applyRedline(spans, [{ spanId: 'S1', before: 'sell', after: 'share' }])).toThrow();
  });
});
