import { describe, it, expect } from 'vitest';
import { buildCertificate, verifyCertificate } from '../certificate';
import { certify, checkFixture, GateError } from '../engine';
import type { Candidate, Fixture, Formalization, PurposeContract } from '../ir';

function makeFormalization(ruleStatus: 'approved' | 'disputed' = 'approved'): Formalization {
  return {
    id: 'LHP-TEST',
    version: 1,
    sourceId: 'test-source',
    vars: [
      { name: 'annual_revenue_musd', label: 'Revenue', spanIds: ['S1'], origin: 'source', sort: 'int', min: 0, max: 1000 },
      { name: 'consumer_opted_out', label: 'Opted out', spanIds: ['S2'], origin: 'source', sort: 'bool' },
      { name: 'discloses_pi', label: 'Discloses', spanIds: ['S2'], origin: 'source', sort: 'bool' },
      { name: 'recipient', label: 'Recipient', spanIds: ['S2'], origin: 'source', sort: 'enum', values: ['third_party', 'service_provider'] },
      { name: 'consideration', label: 'Consideration', spanIds: ['S2'], origin: 'source', sort: 'enum', values: ['money', 'none'] },
    ],
    definitions: [
      {
        name: 'covered_business',
        label: 'Covered business',
        formula: 'gt(annual_revenue_musd, 25)',
        spanIds: ['S1'],
        status: 'approved',
        plain: 'Revenue over 25M.',
      },
      {
        name: 'sell',
        label: 'Sell',
        formula: 'and(discloses_pi, is(recipient, third_party), not(is(consideration, none)))',
        spanIds: ['S2'],
        status: 'approved',
        plain: 'Disclosure to a third party for consideration.',
      },
    ],
    rules: [
      {
        id: 'R1',
        kind: 'prohibition',
        label: 'No sale after opt-out',
        when: 'and(covered_business, consumer_opted_out)',
        require: 'not(sell)',
        spanIds: ['S2'],
        status: ruleStatus,
        plain: 'Covered businesses must not sell after a consumer opts out.',
      },
    ],
  };
}

function makePurpose(): PurposeContract {
  return {
    id: 'PC-TEST',
    version: 1,
    sentence: { protectedClass: 'consumers', preventOutcome: 'third-party disclosure', without: 'consideration', evenWhen: 'no money changes hands' },
    invariants: [
      {
        id: 'P1',
        statement: "An opted-out consumer's data must never reach a third party.",
        holds: 'not(and(covered_business, consumer_opted_out, discloses_pi, is(recipient, third_party)))',
        severity: 'high',
        approved: true,
      },
    ],
  };
}

const certifiedCandidate: Candidate = {
  id: 'C1',
  tactic: 'no_consideration',
  narrative: 'Give the data away for free to a nominal third party after opt-out.',
  pins: { annual_revenue_musd: 30, consumer_opted_out: true, discloses_pi: true, recipient: 'third_party', consideration: 'none' },
  familyKeys: ['consideration'],
  citedRuleIds: ['R1'],
  targetInvariantId: 'P1',
};

describe('engine.certify', () => {
  it('certifies a candidate that satisfies the law but violates the purpose', async () => {
    const result = await certify(makeFormalization(), makePurpose(), certifiedCandidate);
    expect(result.status).toBe('certified');
    expect(result.result).toBe('sat');
    expect(result.model?.consideration).toBe('none');
  });

  it('rejects a candidate the law already forbids (paid sale after opt-out)', async () => {
    const c: Candidate = { ...certifiedCandidate, id: 'C2', pins: { ...certifiedCandidate.pins, consideration: 'money' } };
    const result = await certify(makeFormalization(), makePurpose(), c);
    expect(result.status).toBe('rejected');
    expect(result.result).toBe('unsat');
  });

  it('blocks certification when a rule is disputed', async () => {
    await expect(certify(makeFormalization('disputed'), makePurpose(), certifiedCandidate)).rejects.toBeInstanceOf(GateError);
  });

  it('produces reproducible certificate hashes for identical inputs', async () => {
    const f = makeFormalization();
    const p = makePurpose();
    const r1 = await certify(f, p, certifiedCandidate);
    const r2 = await certify(f, p, certifiedCandidate);
    const build = (r: typeof r1) =>
      buildCertificate({
        candidateId: certifiedCandidate.id,
        formalizationHash: 'fh',
        invariantHash: 'ih',
        candidateHash: 'ch',
        result: r.result,
        model: r.model ?? null,
        smtlib: r.smtlib,
        solverVersion: 'test',
        elapsedMs: r.elapsedMs,
      });
    const cert1 = build(r1);
    const cert2 = build(r2);
    expect(cert1.hash).toBe(cert2.hash);
    expect(verifyCertificate(cert1)).toBe(true);
  });

  it('fails verification when a certificate is tampered with', async () => {
    const r = await certify(makeFormalization(), makePurpose(), certifiedCandidate);
    const cert = buildCertificate({
      candidateId: certifiedCandidate.id,
      formalizationHash: 'fh',
      invariantHash: 'ih',
      candidateHash: 'ch',
      result: r.result,
      model: r.model ?? null,
      smtlib: r.smtlib,
      solverVersion: 'test',
      elapsedMs: r.elapsedMs,
    });
    const tampered = { ...cert, model: { ...cert.model, recipient: 'service_provider' } };
    expect(verifyCertificate(tampered)).toBe(false);
  });
});

describe('engine.checkFixture', () => {
  it('passes a legitimate use fixture (business below the coverage threshold)', async () => {
    const fx: Fixture = {
      id: 'G1',
      kind: 'legitimate',
      label: 'Small business, any disclosure behavior',
      pins: { annual_revenue_musd: 10 },
      expect: 'sat',
    };
    const result = await checkFixture(makeFormalization(), fx);
    expect(result.pass).toBe(true);
  });
});
