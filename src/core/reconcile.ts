import { buildModel } from './compile';
import type { Definition, Formalization, Rule, VarDecl } from './ir';
import { SOLVER_TIMEOUT_MS, withSolver } from './z3';

export interface ReviewItem {
  kind: 'var_conflict' | 'definition_conflict';
  message: string;
  spanIds: string[];
  left: unknown;
  right: unknown;
}

export interface ExtractorAOutput {
  vars: VarDecl[];
  rules: Rule[];
}
export interface ExtractorBOutput {
  vars: VarDecl[];
  definitions: Definition[];
}

function varDeclEqual(a: VarDecl, b: VarDecl): boolean {
  if (a.sort !== b.sort) return false;
  if (a.sort === 'int' && b.sort === 'int') return a.min === b.min && a.max === b.max;
  if (a.sort === 'enum' && b.sort === 'enum') {
    return a.values.length === b.values.length && a.values.every((v, i) => v === b.values[i]);
  }
  return true;
}

/**
 * Checks whether two formula strings are logically equivalent under the given
 * variable universe, using Z3 rather than string comparison. Both must typecheck
 * as bool (definitions always do). Used to tell "same rule, different phrasing"
 * apart from an actual disagreement between extractors.
 */
export async function formulasEquivalent(vars: VarDecl[], left: string, right: string): Promise<boolean> {
  const scaffold: Formalization = {
    id: 'reconcile-scaffold',
    version: 1,
    sourceId: 'scaffold',
    vars,
    definitions: [],
    rules: [{ id: 'R0', kind: 'duty', label: 'scaffold', when: 'true', require: 'true', spanIds: ['scaffold'], status: 'approved', plain: 'scaffold' }],
  };

  return withSolver(async () => {
    const cm = await buildModel(scaffold);
    const solver = new cm.ctx.Solver();
    solver.set('timeout', SOLVER_TIMEOUT_MS);
    const leftExpr = cm.compileBool(left);
    const rightExpr = cm.compileBool(right);
    solver.add(...cm.bounds, cm.ctx.Not(leftExpr.eq(rightExpr)));
    const result = await solver.check();
    return result === 'unsat';
  });
}

export function reconcileVars(a: VarDecl[], b: VarDecl[]): { vars: VarDecl[]; disputes: ReviewItem[] } {
  const disputes: ReviewItem[] = [];
  const byName = new Map<string, VarDecl>();

  for (const v of a) byName.set(v.name, v);
  for (const v of b) {
    const existing = byName.get(v.name);
    if (!existing) {
      byName.set(v.name, v);
      continue;
    }
    if (!varDeclEqual(existing, v)) {
      disputes.push({
        kind: 'var_conflict',
        message: `variable '${v.name}' declared differently by the two extractors`,
        spanIds: [...new Set([...existing.spanIds, ...v.spanIds])],
        left: existing,
        right: v,
      });
      continue;
    }
    // Equal declarations: merge spanIds so traceability covers both extractors' evidence.
    byName.set(v.name, { ...existing, spanIds: [...new Set([...existing.spanIds, ...v.spanIds])] });
  }

  return { vars: [...byName.values()], disputes };
}

export async function reconcileDefinitions(
  a: Definition[],
  b: Definition[],
  vars: VarDecl[],
): Promise<{ definitions: Definition[]; disputes: ReviewItem[] }> {
  const disputes: ReviewItem[] = [];
  const byName = new Map<string, Definition>();

  for (const d of a) byName.set(d.name, d);
  for (const d of b) {
    const existing = byName.get(d.name);
    if (!existing) {
      byName.set(d.name, d);
      continue;
    }
    const equivalent = await formulasEquivalent(vars, existing.formula, d.formula);
    if (!equivalent) {
      disputes.push({
        kind: 'definition_conflict',
        message: `definition '${d.name}' is not logically equivalent between the two extractors`,
        spanIds: [...new Set([...existing.spanIds, ...d.spanIds])],
        left: existing,
        right: d,
      });
      byName.set(d.name, { ...existing, status: 'disputed' });
      continue;
    }
    byName.set(d.name, { ...existing, spanIds: [...new Set([...existing.spanIds, ...d.spanIds])] });
  }

  return { definitions: [...byName.values()], disputes };
}

export interface ReconcileResult {
  vars: VarDecl[];
  definitions: Definition[];
  rules: Rule[];
  disputes: ReviewItem[];
}

export async function reconcileExtraction(a: ExtractorAOutput, b: ExtractorBOutput): Promise<ReconcileResult> {
  const { vars, disputes: varDisputes } = reconcileVars(a.vars, b.vars);
  const { definitions, disputes: defDisputes } = await reconcileDefinitions([], b.definitions, vars);
  return { vars, definitions, rules: a.rules, disputes: [...varDisputes, ...defDisputes] };
}
