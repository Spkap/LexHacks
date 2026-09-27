import { describe, expect, it } from 'vitest';
import { AttackProposal, DefenseVote, LANES, RepairProposal } from '../contracts';

describe('contracts', () => {
  it('has 9 attack lanes and no solver lane', () => {
    expect(LANES).toHaveLength(9);
    expect(LANES).not.toContain('solver_found');
  });
  it('requires at least one quote on an attack proposal', () => {
    const bad = { tactic: 'no_consideration', title: 't', scenario: 's', quotes: [], whyWordsPermit: 'w', whyPurposeDefeated: 'p' };
    expect(AttackProposal.safeParse(bad).success).toBe(false);
  });
  it('accepts a harmless vote', () => {
    const v = { judge: 'textualist', verdict: 'harmless', quotes: [], reasoning: 'r' };
    expect(DefenseVote.safeParse(v).success).toBe(true);
  });
  it('rejects an empty redline', () => {
    expect(RepairProposal.safeParse({ title: 't', redline: [], rationale: 'r' }).success).toBe(false);
  });
});
