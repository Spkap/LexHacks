import { describe, expect, it } from 'vitest';
import { buildDefensePrompt } from '../prompts/defense';
import type { PurposeContract, Span } from '@/core/contracts';

const spans: Span[] = [{ id: 'S2', sectionPath: '1798.140(t)(1)', label: 'Sell', text: 'for monetary or other valuable consideration' }];
const purpose: PurposeContract = {
  sentence: { protectedClass: 'consumers', preventOutcome: 'covert data sale', without: 'consent', evenWhen: 'no money changes hands' },
  legitimateUses: [{ id: 'G1', scenario: 'A consumer directs her data to a company she chose.' }],
};

describe('defense prompt', () => {
  it('never includes the attacker\'s legal arguments', () => {
    const attackerArgWordsPermit = 'SELL REQUIRES CONSIDERATION SO A FREE TRANSFER IS NOT A SALE';
    const attackerArgPurposeDefeated = 'THE DATA STILL REACHES A THIRD PARTY FOR ADVERTISING';
    const prompt = buildDefensePrompt('A business gives data to an ad network for free.', spans, purpose);
    expect(prompt).not.toContain(attackerArgWordsPermit);
    expect(prompt).not.toContain(attackerArgPurposeDefeated);
    expect(prompt).toContain('S2');
    expect(prompt).toContain('consumers');
  });
});
