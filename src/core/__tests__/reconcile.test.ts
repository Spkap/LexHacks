import { describe, it, expect } from 'vitest';
import { reconcileDefinitions, reconcileExtraction, reconcileVars } from '../reconcile';
import type { Definition, VarDecl } from '../ir';

const VARS: VarDecl[] = [
  { name: 'discloses_pi', label: 'Discloses', spanIds: ['S1'], origin: 'source', sort: 'bool' },
  { name: 'consideration', label: 'Consideration', spanIds: ['S2'], origin: 'source', sort: 'enum', values: ['money', 'none'] },
];

function makeDef(formula: string): Definition {
  return { name: 'sell', label: 'Sell', formula, spanIds: ['S2'], status: 'proposed', plain: 'test' };
}

describe('reconcileDefinitions', () => {
  it('has no disputes for identical outputs', async () => {
    const formula = 'and(discloses_pi, not(is(consideration, none)))';
    const { definitions, disputes } = await reconcileDefinitions([makeDef(formula)], [makeDef(formula)], VARS);
    expect(disputes).toHaveLength(0);
    expect(definitions).toHaveLength(1);
  });

  it('has no dispute when formulas differ only by argument order', async () => {
    const left = makeDef('and(discloses_pi, not(is(consideration, none)))');
    const right = makeDef('and(not(is(consideration, none)), discloses_pi)');
    const { disputes } = await reconcileDefinitions([left], [right], VARS);
    expect(disputes).toHaveLength(0);
  });

  it('disputes when one extractor is missing a clause', async () => {
    const left = makeDef('and(discloses_pi, not(is(consideration, none)))');
    const right = makeDef('discloses_pi');
    const { definitions, disputes } = await reconcileDefinitions([left], [right], VARS);
    expect(disputes).toHaveLength(1);
    expect(disputes[0].kind).toBe('definition_conflict');
    expect(definitions.find((d) => d.name === 'sell')?.status).toBe('disputed');
  });
});

describe('reconcileVars', () => {
  it('merges identical variable declarations without dispute', () => {
    const { vars, disputes } = reconcileVars(VARS, VARS);
    expect(disputes).toHaveLength(0);
    expect(vars).toHaveLength(2);
  });

  it('disputes conflicting sorts for the same variable name', () => {
    const a: VarDecl[] = [{ name: 'x', label: 'x', spanIds: ['S1'], origin: 'source', sort: 'bool' }];
    const b: VarDecl[] = [{ name: 'x', label: 'x', spanIds: ['S2'], origin: 'source', sort: 'int', min: 0, max: 10 }];
    const { disputes } = reconcileVars(a, b);
    expect(disputes).toHaveLength(1);
    expect(disputes[0].kind).toBe('var_conflict');
  });
});

describe('reconcileExtraction', () => {
  it('merges extractor A rules with extractor B definitions', async () => {
    const rule = {
      id: 'R1',
      kind: 'prohibition' as const,
      label: 'test rule',
      when: 'discloses_pi',
      require: 'not(is(consideration, none))',
      spanIds: ['S1'],
      status: 'proposed' as const,
      plain: 'test',
    };
    const result = await reconcileExtraction(
      { vars: VARS, rules: [rule] },
      { vars: VARS, definitions: [makeDef('and(discloses_pi, not(is(consideration, none)))')] },
    );
    expect(result.disputes).toHaveLength(0);
    expect(result.rules).toEqual([rule]);
    expect(result.definitions).toHaveLength(1);
    expect(result.vars).toHaveLength(2);
  });
});
