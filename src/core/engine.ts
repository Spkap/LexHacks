import { buildModel } from './compile';
import { SOLVER_TIMEOUT_MS, withSolver } from './z3';
import { validateCandidate, type Candidate, type Fixture, type Formalization, type Pins, type PurposeContract } from './ir';

export class GateError extends Error {
  constructor(
    public code: 'FORMALIZATION_NOT_APPROVED' | 'PURPOSE_NOT_APPROVED' | 'INVALID_CANDIDATE',
    public detail: string[],
  ) {
    super(code);
  }
}

export type SolveStatus = 'sat' | 'unsat' | 'unknown';
export interface SolveResult {
  result: SolveStatus;
  model?: Record<string, boolean | number | string>;
  smtlib: string;
  elapsedMs: number;
}

export function assertCertifiable(f: Formalization, p: PurposeContract): void {
  const badDefs = f.definitions.filter((d) => d.status !== 'approved').map((d) => `definition '${d.name}' not approved`);
  const badRules = f.rules.filter((r) => r.status !== 'approved').map((r) => `rule '${r.id}' not approved`);
  if (badDefs.length > 0 || badRules.length > 0) {
    throw new GateError('FORMALIZATION_NOT_APPROVED', [...badDefs, ...badRules]);
  }
  const unapproved = p.invariants.filter((i) => !i.approved).map((i) => `invariant '${i.id}' not approved`);
  if (unapproved.length > 0) {
    throw new GateError('PURPOSE_NOT_APPROVED', unapproved);
  }
}

function findInvariant(p: PurposeContract, invariantId: string) {
  const invariant = p.invariants.find((i) => i.id === invariantId);
  if (!invariant) throw new GateError('INVALID_CANDIDATE', [`unknown invariant '${invariantId}'`]);
  return invariant;
}

export function pick(obj: Record<string, boolean | number | string>, keys: string[]): Pins {
  const out: Record<string, boolean | number | string> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export async function certify(
  f: Formalization,
  p: PurposeContract,
  c: Candidate,
): Promise<SolveResult & { status: 'certified' | 'rejected' | 'inconclusive' }> {
  assertCertifiable(f, p);
  const validation = validateCandidate(f, c);
  if (!validation.ok) throw new GateError('INVALID_CANDIDATE', validation.reasons);
  const invariant = findInvariant(p, c.targetInvariantId);

  return withSolver(async () => {
    const start = performance.now();
    const cm = await buildModel(f);
    const solver = new cm.ctx.Solver();
    solver.set('timeout', SOLVER_TIMEOUT_MS);
    solver.add(cm.compliance, ...cm.bounds, ...cm.pins(c.pins), cm.ctx.Not(cm.compileBool(invariant.holds)));
    const result = await solver.check();
    const smtlib = solver.toString();
    const elapsedMs = performance.now() - start;

    let status: 'certified' | 'rejected' | 'inconclusive';
    let model: Record<string, boolean | number | string> | undefined;
    if (result === 'sat') {
      status = 'certified';
      model = cm.decode(solver.model());
    } else if (result === 'unsat') {
      status = 'rejected';
    } else {
      status = 'inconclusive';
    }
    return { result, model, smtlib, elapsedMs, status };
  });
}

export async function checkFixture(f: Formalization, fx: Fixture): Promise<SolveResult & { pass: boolean }> {
  return withSolver(async () => {
    const start = performance.now();
    const cm = await buildModel(f);
    const solver = new cm.ctx.Solver();
    solver.set('timeout', SOLVER_TIMEOUT_MS);
    solver.add(cm.compliance, ...cm.bounds, ...cm.pins(fx.pins));
    const result = await solver.check();
    const smtlib = solver.toString();
    const elapsedMs = performance.now() - start;
    const model = result === 'sat' ? cm.decode(solver.model()) : undefined;
    const pass = result === fx.expect;
    return { result, model, smtlib, elapsedMs, pass };
  });
}

export async function checkFamilyClosed(
  fRepaired: Formalization,
  p: PurposeContract,
  c: Candidate,
): Promise<SolveResult & { closed: boolean }> {
  const invariant = findInvariant(p, c.targetInvariantId);
  const familyPins = pick(c.pins, c.familyKeys);

  return withSolver(async () => {
    const start = performance.now();
    const cm = await buildModel(fRepaired);
    const solver = new cm.ctx.Solver();
    solver.set('timeout', SOLVER_TIMEOUT_MS);
    solver.add(cm.compliance, ...cm.bounds, ...cm.pins(familyPins), cm.ctx.Not(cm.compileBool(invariant.holds)));
    const result = await solver.check();
    const smtlib = solver.toString();
    const elapsedMs = performance.now() - start;
    const model = result === 'sat' ? cm.decode(solver.model()) : undefined;
    const closed = result === 'unsat';
    return { result, model, smtlib, elapsedMs, closed };
  });
}

export interface RetestReport {
  exploits: Array<{ candidateId: string; after: SolveStatus; closed: boolean }>;
  positives: Array<{ fixtureId: string; after: SolveStatus; pass: boolean }>;
  allClosed: boolean;
  allPreserved: boolean;
}

export async function retest(
  fRepaired: Formalization,
  p: PurposeContract,
  certified: Candidate[],
  fixtures: Fixture[],
): Promise<RetestReport> {
  const exploits: RetestReport['exploits'] = [];
  for (const c of certified) {
    const r = await checkFamilyClosed(fRepaired, p, c);
    exploits.push({ candidateId: c.id, after: r.result, closed: r.closed });
  }
  const positives: RetestReport['positives'] = [];
  for (const fx of fixtures) {
    const r = await checkFixture(fRepaired, fx);
    positives.push({ fixtureId: fx.id, after: r.result, pass: r.pass });
  }
  return {
    exploits,
    positives,
    allClosed: exploits.every((e) => e.closed),
    allPreserved: positives.every((p2) => p2.pass),
  };
}

export async function enumerateCounterexamples(
  f: Formalization,
  p: PurposeContract,
  invariantId: string,
  familyKeys: string[],
  limit: number,
): Promise<Array<Record<string, boolean | number | string>>> {
  const invariant = findInvariant(p, invariantId);

  return withSolver(async () => {
    const cm = await buildModel(f);
    const solver = new cm.ctx.Solver();
    solver.set('timeout', SOLVER_TIMEOUT_MS);
    solver.add(cm.compliance, ...cm.bounds, cm.ctx.Not(cm.compileBool(invariant.holds)));

    const results: Array<Record<string, boolean | number | string>> = [];
    for (let i = 0; i < limit; i += 1) {
      const status = await solver.check();
      if (status !== 'sat') break;
      const model = cm.decode(solver.model());
      results.push(model);
      const blockingPins = cm.pins(pick(model, familyKeys));
      solver.add(cm.ctx.Not(cm.ctx.And(...blockingPins)));
    }
    return results;
  });
}
