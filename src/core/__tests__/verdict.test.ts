import { describe, expect, it } from 'vitest';
import { decideVerdict, effectiveStatus, isLoophole } from '../verdict';
import type { DefenseVote, Judge } from '../contracts';

const v = (judge: Judge, verdict: DefenseVote['verdict']): DefenseVote => ({ judge, verdict, quotes: [], reasoning: 'r' });
const jury = (a: DefenseVote['verdict'], b: DefenseVote['verdict'], c: DefenseVote['verdict']) =>
  [v('textualist', a), v('purposivist', b), v('enforcer', c)];

describe('decideVerdict', () => {
  it('3/3 loophole is confirmed', () => expect(decideVerdict(jury('loophole', 'loophole', 'loophole'))).toBe('confirmed'));
  it('2 blocked is blocked', () => expect(decideVerdict(jury('blocked', 'blocked', 'loophole'))).toBe('blocked'));
  it('2 harmless is harmless', () => expect(decideVerdict(jury('harmless', 'loophole', 'harmless'))).toBe('harmless'));
  it('2 loophole + 1 unclear is contested', () => expect(decideVerdict(jury('loophole', 'loophole', 'unclear'))).toBe('contested'));
  it('one of each is contested', () => expect(decideVerdict(jury('blocked', 'harmless', 'loophole'))).toBe('contested'));
  it('textualist-only jury maps directly', () => {
    expect(decideVerdict([v('textualist', 'loophole')])).toBe('confirmed');
    expect(decideVerdict([v('textualist', 'blocked')])).toBe('blocked');
    expect(decideVerdict([v('textualist', 'unclear')])).toBe('contested');
  });
  it('throws on an empty jury', () => expect(() => decideVerdict([])).toThrow());
});

describe('effectiveStatus', () => {
  it('uses the jury status without rulings', () => expect(effectiveStatus('contested', [])).toBe('contested'));
  it('latest ruling wins and never mutates the jury status', () => {
    const rulings = [
      { ruling: 'no_loophole' as const, createdAt: new Date('2026-09-27T10:00:00Z') },
      { ruling: 'loophole' as const, createdAt: new Date('2026-09-27T11:00:00Z') },
    ];
    expect(effectiveStatus('contested', rulings)).toBe('ruled_loophole');
  });
  it('isLoophole covers confirmed and ruled_loophole only', () => {
    expect(isLoophole('confirmed')).toBe(true);
    expect(isLoophole('ruled_loophole')).toBe(true);
    expect(isLoophole('contested')).toBe(false);
  });
});
