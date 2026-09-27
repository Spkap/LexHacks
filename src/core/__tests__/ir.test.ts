import { describe, it, expect } from 'vitest';
import { Formalization, validateCandidate, validateFormalization, type Candidate } from '../ir';

function baseFormalization() {
  return {
    id: 'LHP-001',
    version: 1,
    sourceId: 'ccpa-2018-ab375',
    vars: [
      { name: 'annual_revenue_musd', label: 'Annual revenue (M USD)', spanIds: ['S1'], origin: 'source' as const, sort: 'int' as const, min: 0, max: 1000 },
      { name: 'consumers_k', label: 'Consumers (thousands)', spanIds: ['S1'], origin: 'source' as const, sort: 'int' as const, min: 0, max: 10000 },
      { name: 'discloses_pi', label: 'Discloses PI', spanIds: ['S2'], origin: 'source' as const, sort: 'bool' as const },
      {
        name: 'recipient',
        label: 'Recipient',
        spanIds: ['S2'],
        origin: 'source' as const,
        sort: 'enum' as const,
        values: ['third_party', 'service_provider', 'consumer_directed'],
      },
    ],
    definitions: [
      {
        name: 'covered_business',
        label: 'Covered business',
        formula: 'or(gt(annual_revenue_musd, 25), ge(consumers_k, 50))',
        spanIds: ['S1'],
        status: 'approved' as const,
        plain: 'A business meeting revenue or consumer thresholds.',
      },
    ],
    rules: [
      {
        id: 'R1',
        kind: 'duty' as const,
        label: 'Disclosure duty',
        when: 'and(covered_business, discloses_pi)',
        require: 'is(recipient, service_provider)',
        spanIds: ['S2'],
        status: 'approved' as const,
        plain: 'Covered businesses that disclose must use a service provider.',
      },
    ],
  };
}

describe('Formalization schema', () => {
  it('parses a valid formalization', () => {
    expect(() => Formalization.parse(baseFormalization())).not.toThrow();
  });
});

describe('validateFormalization', () => {
  it('passes on a well-formed formalization', () => {
    expect(validateFormalization(baseFormalization())).toEqual({ ok: true });
  });

  it('fails on cyclic definitions', () => {
    const f = baseFormalization();
    f.definitions = [
      { name: 'a', label: 'a', formula: 'b', spanIds: ['S1'], status: 'approved', plain: 'a' },
      { name: 'b', label: 'b', formula: 'a', spanIds: ['S1'], status: 'approved', plain: 'b' },
    ];
    const result = validateFormalization(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.some((r) => r.includes('cyclic'))).toBe(true);
  });

  it('fails on a rule with zero spanIds', () => {
    const f = baseFormalization();
    f.rules[0].spanIds = [];
    const result = validateFormalization(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.some((r) => r.includes('no spanIds'))).toBe(true);
  });

  it('fails when a formula references an unknown identifier', () => {
    const f = baseFormalization();
    f.rules[0].when = 'and(covered_business, nonexistent_var)';
    const result = validateFormalization(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.some((r) => r.includes('unknown identifier'))).toBe(true);
  });
});

describe('validateCandidate', () => {
  const f = baseFormalization();

  it('accepts a valid candidate', () => {
    const c: Candidate = {
      id: 'C1',
      tactic: 'threshold_split',
      narrative: 'test',
      pins: { annual_revenue_musd: 30, recipient: 'third_party' },
      familyKeys: ['recipient'],
      citedRuleIds: ['R1'],
      targetInvariantId: 'P1',
    };
    expect(validateCandidate(f, c)).toEqual({ ok: true });
  });

  it('rejects an out-of-range int pin', () => {
    const c: Candidate = {
      id: 'C2',
      tactic: 'threshold_split',
      narrative: 'test',
      pins: { consumers_k: 20000 },
      familyKeys: ['consumers_k'],
      citedRuleIds: [],
      targetInvariantId: 'P1',
    };
    const result = validateCandidate(f, c);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.some((r) => r.includes('out of range'))).toBe(true);
  });

  it('rejects a pin for an undeclared variable', () => {
    const c: Candidate = {
      id: 'C3',
      tactic: 'relabel',
      narrative: 'test',
      pins: { made_up_var: true },
      familyKeys: ['made_up_var'],
      citedRuleIds: [],
      targetInvariantId: 'P1',
    };
    const result = validateCandidate(f, c);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.some((r) => r.includes('not a declared variable'))).toBe(true);
  });
});
