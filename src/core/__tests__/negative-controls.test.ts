import { describe, it, expect } from 'vitest';
import { buildCertificate, verifyCertificate } from '../certificate';
import { certify, checkFixture, GateError } from '../engine';
import { validateCandidate, type Candidate, type Formalization, type PurposeContract } from '../ir';
import { findCandidate, loadGolden } from './golden';

describe('negative controls (blueprint section 16)', () => {
  const golden = loadGolden();

  it('rejects an impossible candidate (out of bounds) before solving', () => {
    const c: Candidate = {
      id: 'BAD',
      tactic: 'threshold_split',
      narrative: 'out of bounds',
      pins: { consumers_k: 20000 },
      familyKeys: ['consumers_k'],
      citedRuleIds: [],
      targetInvariantId: 'P1',
    };
    const result = validateCandidate(golden.original, c);
    expect(result.ok).toBe(false);
  });

  it('purpose identical to the legal duty yields no certificate', async () => {
    const purposeMirrorsLaw: PurposeContract = {
      ...golden.purpose,
      invariants: [
        {
          id: 'P0',
          statement: 'Mirrors R2 exactly: no legal gap to exploit.',
          holds: 'not(and(covered_business, consumer_opted_out, sell))',
          severity: 'high',
          approved: true,
        },
      ],
    };
    const c1 = findCandidate(golden.candidates, 'C1');
    const mirrored: Candidate = { ...c1, targetInvariantId: 'P0' };
    const result = await certify(golden.original, purposeMirrorsLaw, mirrored);
    expect(result.status).not.toBe('certified');
  });

  it('overbroad repair fails at least one legitimate fixture', async () => {
    const g2 = golden.fixtures.find((f) => f.id === 'G2');
    if (!g2) throw new Error('G2 fixture missing');
    const result = await checkFixture(golden.overbroad, g2);
    expect(result.pass).toBe(false);
  });

  it('disputed rule blocks certification', async () => {
    const disputedOriginal: Formalization = {
      ...golden.original,
      rules: golden.original.rules.map((r) => (r.id === 'R2' ? { ...r, status: 'disputed' } : r)),
    };
    const c1 = findCandidate(golden.candidates, 'C1');
    await expect(certify(disputedOriginal, golden.purpose, c1)).rejects.toBeInstanceOf(GateError);
  });

  it('tampered certificate fails verification', async () => {
    const c1 = findCandidate(golden.candidates, 'C1');
    const r = await certify(golden.original, golden.purpose, c1);
    const cert = buildCertificate({
      candidateId: c1.id,
      formalizationHash: golden.original.id,
      invariantHash: 'P1',
      candidateHash: c1.id,
      result: r.result,
      model: r.model ?? null,
      smtlib: r.smtlib,
      solverVersion: 'test',
      elapsedMs: r.elapsedMs,
    });
    const tampered = { ...cert, model: { ...cert.model, consideration: 'money' } };
    expect(verifyCertificate(tampered)).toBe(false);
  });
});
