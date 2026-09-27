import { describe, it, expect } from 'vitest';
import { certify } from '../engine';
import { buildProofTrace } from '../explain-plain';
import { findCandidate, loadGolden } from './golden';

describe('buildProofTrace on the golden C1 certificate', () => {
  it('produces an ordered, cited trace ending in the invariant violation', async () => {
    const golden = loadGolden();
    const c1 = findCandidate(golden.candidates, 'C1');
    const result = await certify(golden.original, golden.purpose, c1);
    expect(result.status).toBe('certified');
    if (!result.model) throw new Error('expected a model');

    const invariant = golden.purpose.invariants.find((i) => i.id === c1.targetInvariantId);
    if (!invariant) throw new Error('missing invariant');

    const trace = buildProofTrace(golden.original, result.model, invariant);

    expect(trace.length).toBe(golden.original.definitions.length + golden.original.rules.length + 1);
    expect(trace.every((step) => typeof step.text === 'string' && step.text.length > 0)).toBe(true);
    expect(trace.every((step) => Array.isArray(step.spanIds))).toBe(true);

    const sellStep = trace.find((s) => s.text.startsWith('sell '));
    expect(sellStep?.text).toContain('FALSE');

    const lastStep = trace[trace.length - 1];
    expect(lastStep.text).toContain('VIOLATED');
    expect(lastStep.text).toContain('P1');
  });
});
