import { parseExpr, type Expr } from './dsl';
import type { Definition, Formalization, PurposeInvariant } from './ir';

export interface TraceStep {
  text: string;
  spanIds: string[];
}

type Model = Record<string, boolean | number | string>;

function evalExpr(e: Expr, env: Model, defs: Map<string, Definition>): boolean | number | string {
  switch (e.op) {
    case 'bool':
      return e.value;
    case 'int':
      return e.value;
    case 'ref': {
      if (e.name in env) return env[e.name];
      const def = defs.get(e.name);
      if (!def) throw new Error(`explain: unknown reference '${e.name}'`);
      return evalExpr(parseExpr(def.formula), env, defs);
    }
    case 'is':
      return env[e.name] === e.value;
    case 'not':
      return !evalExpr(e.arg, env, defs);
    case 'and':
      return e.args.every((a) => evalExpr(a, env, defs));
    case 'or':
      return e.args.some((a) => evalExpr(a, env, defs));
    case 'add':
      return e.args.reduce((sum: number, a) => sum + (evalExpr(a, env, defs) as number), 0);
    case 'implies':
      return !evalExpr(e.args[0], env, defs) || Boolean(evalExpr(e.args[1], env, defs));
    case 'eq':
      return evalExpr(e.args[0], env, defs) === evalExpr(e.args[1], env, defs);
    case 'ne':
      return evalExpr(e.args[0], env, defs) !== evalExpr(e.args[1], env, defs);
    case 'lt':
      return (evalExpr(e.args[0], env, defs) as number) < (evalExpr(e.args[1], env, defs) as number);
    case 'le':
      return (evalExpr(e.args[0], env, defs) as number) <= (evalExpr(e.args[1], env, defs) as number);
    case 'gt':
      return (evalExpr(e.args[0], env, defs) as number) > (evalExpr(e.args[1], env, defs) as number);
    case 'ge':
      return (evalExpr(e.args[0], env, defs) as number) >= (evalExpr(e.args[1], env, defs) as number);
  }
}

/**
 * Builds a deterministic, cite-carrying proof trace from a certified model: what each
 * definition and rule evaluates to, and whether the purpose invariant holds — no LLM
 * involved, so this is always available even if the polish layer (Task 3.3's AI half)
 * fails or is rejected.
 */
export function buildProofTrace(f: Formalization, model: Model, invariant: PurposeInvariant): TraceStep[] {
  const defsByName = new Map(f.definitions.map((d) => [d.name, d]));
  const steps: TraceStep[] = [];

  for (const def of f.definitions) {
    const value = evalExpr(parseExpr(def.formula), model, defsByName);
    steps.push({ text: `${def.name} is ${value ? 'TRUE' : 'FALSE'}: ${def.plain}`, spanIds: def.spanIds });
  }

  for (const rule of f.rules) {
    const whenValue = evalExpr(parseExpr(rule.when), model, defsByName) as boolean;
    if (!whenValue) {
      steps.push({ text: `${rule.id} does not apply here (its "when" condition is false).`, spanIds: rule.spanIds });
      continue;
    }
    const requireValue = evalExpr(parseExpr(rule.require), model, defsByName) as boolean;
    steps.push({
      text: `${rule.id} applies, and its requirement is ${requireValue ? 'SATISFIED' : 'VIOLATED'}: ${rule.plain}`,
      spanIds: rule.spanIds,
    });
  }

  const invariantValue = evalExpr(parseExpr(invariant.holds), model, defsByName) as boolean;
  steps.push({
    text: invariantValue
      ? `Purpose invariant ${invariant.id} holds: ${invariant.statement}`
      : `Purpose invariant ${invariant.id} is VIOLATED: ${invariant.statement}`,
    spanIds: [],
  });

  return steps;
}
