import { z } from 'zod';
import { parseExpr, refsOf, typecheck, type Scope } from './dsl';

export const Ident = z.string().regex(/^[a-z][a-z0-9_]{0,47}$/);
export const ReviewStatus = z.enum(['proposed', 'approved', 'disputed']);
export const Formula = z.string().max(2000).refine((s) => {
  try {
    parseExpr(s);
    return true;
  } catch {
    return false;
  }
}, 'invalid formula');

const VarBase = z.object({
  name: Ident,
  label: z.string().max(160),
  spanIds: z.array(z.string()),
  origin: z.enum(['source', 'purpose']),
});
export const VarDecl = z.discriminatedUnion('sort', [
  VarBase.extend({ sort: z.literal('bool') }),
  VarBase.extend({ sort: z.literal('int'), min: z.number().int(), max: z.number().int() }),
  VarBase.extend({ sort: z.literal('enum'), values: z.array(Ident).min(2).max(12) }),
]);

export const Definition = z.object({
  name: Ident,
  label: z.string().max(200),
  formula: Formula,
  spanIds: z.array(z.string()).min(1),
  status: ReviewStatus,
  plain: z.string().max(400),
});
export const Rule = z.object({
  id: z.string().regex(/^R\d+[a-z']*$/),
  kind: z.enum(['duty', 'prohibition']),
  label: z.string().max(200),
  when: Formula,
  require: Formula,
  spanIds: z.array(z.string()).min(1),
  status: ReviewStatus,
  plain: z.string().max(400),
});
export const Formalization = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  sourceId: z.string(),
  vars: z.array(VarDecl).min(1).max(40),
  definitions: z.array(Definition).max(40),
  rules: z.array(Rule).min(1).max(40),
});

export const PurposeInvariant = z.object({
  id: z.string(),
  statement: z.string().max(400),
  holds: Formula,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  approved: z.boolean(),
});
export const PurposeContract = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  sentence: z.object({
    protectedClass: z.string(),
    preventOutcome: z.string(),
    without: z.string(),
    evenWhen: z.string(),
  }),
  invariants: z.array(PurposeInvariant).min(1),
});

export const Scalar = z.union([z.boolean(), z.number().int(), Ident]);
export const Pins = z.record(Ident, Scalar);
export const Fixture = z.object({
  id: z.string(),
  kind: z.enum(['legitimate', 'exploit']),
  label: z.string(),
  pins: Pins,
  expect: z.enum(['sat', 'unsat']),
});

export const Tactic = z.enum([
  'threshold_split',
  'relabel',
  'affiliate',
  'timing',
  'exception_abuse',
  'nominal_review',
  'redefine_consideration',
  'no_consideration',
  'procedure_without_outcome',
  'solver_found',
]);
export const Candidate = z.object({
  id: z.string(),
  tactic: Tactic,
  narrative: z.string().max(600),
  pins: Pins,
  familyKeys: z.array(Ident).min(1),
  citedRuleIds: z.array(z.string()),
  targetInvariantId: z.string(),
});

export const RedlineEdit = z.object({
  sectionPath: z.string(),
  before: z.string(),
  after: z.string(),
});
export const IrPatch = z.object({
  addDefinitions: z.array(Definition).default([]),
  replaceRules: z.array(Rule).default([]),
});
export const RepairProposal = z.object({
  title: z.string().max(200),
  redline: z.array(RedlineEdit).min(1),
  irPatch: IrPatch,
  rationale: z.string().max(1000),
});

/**
 * Applies a repair proposal's IR patch to a formalization: definitions are merged by
 * name (replaced if already present, appended otherwise), rules are merged by id the
 * same way. Everything else (vars, id, sourceId) is carried over unchanged.
 */
export function applyIrPatch(base: Formalization, patch: z.infer<typeof IrPatch>): Formalization {
  const definitions = [...base.definitions];
  for (const def of patch.addDefinitions) {
    const i = definitions.findIndex((d) => d.name === def.name);
    if (i >= 0) definitions[i] = def;
    else definitions.push(def);
  }

  const rules = [...base.rules];
  for (const rule of patch.replaceRules) {
    const i = rules.findIndex((r) => r.id === rule.id);
    if (i >= 0) rules[i] = rule;
    else rules.push(rule);
  }

  return { ...base, definitions, rules };
}

export type VarDecl = z.infer<typeof VarDecl>;
export type Definition = z.infer<typeof Definition>;
export type Rule = z.infer<typeof Rule>;
export type Formalization = z.infer<typeof Formalization>;
export type PurposeInvariant = z.infer<typeof PurposeInvariant>;
export type PurposeContract = z.infer<typeof PurposeContract>;
export type Fixture = z.infer<typeof Fixture>;
export type Candidate = z.infer<typeof Candidate>;
export type Pins = z.infer<typeof Pins>;
export type Tactic = z.infer<typeof Tactic>;
export type RedlineEdit = z.infer<typeof RedlineEdit>;
export type IrPatch = z.infer<typeof IrPatch>;
export type RepairProposal = z.infer<typeof RepairProposal>;

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

function scalarSortMatches(sort: 'bool' | 'int' | 'enum', v: boolean | number | string): boolean {
  if (sort === 'bool') return typeof v === 'boolean';
  if (sort === 'int') return typeof v === 'number';
  return typeof v === 'string';
}

export function validateCandidate(f: Formalization, c: Candidate): ValidationResult {
  const reasons: string[] = [];
  const varByName = new Map(f.vars.map((v) => [v.name, v]));
  const ruleIds = new Set(f.rules.map((r) => r.id));

  for (const [key, value] of Object.entries(c.pins)) {
    const decl = varByName.get(key);
    if (!decl) {
      reasons.push(`pin '${key}' is not a declared variable`);
      continue;
    }
    if (!scalarSortMatches(decl.sort, value)) {
      reasons.push(`pin '${key}' has wrong type for sort '${decl.sort}'`);
      continue;
    }
    if (decl.sort === 'int' && typeof value === 'number') {
      if (value < decl.min || value > decl.max) {
        reasons.push(`pin '${key}' value ${value} out of range [${decl.min}, ${decl.max}]`);
      }
    }
    if (decl.sort === 'enum' && typeof value === 'string') {
      if (!decl.values.includes(value)) {
        reasons.push(`pin '${key}' value '${value}' is not a declared enum value`);
      }
    }
  }

  for (const key of c.familyKeys) {
    if (!(key in c.pins)) reasons.push(`familyKey '${key}' is not pinned`);
  }

  for (const id of c.citedRuleIds) {
    if (!ruleIds.has(id)) reasons.push(`citedRuleId '${id}' does not exist`);
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function validateFormalization(f: Formalization, knownSpanIds?: Set<string>): ValidationResult {
  const reasons: string[] = [];
  const names = new Set<string>();

  for (const v of f.vars) {
    if (names.has(v.name)) reasons.push(`duplicate name '${v.name}'`);
    names.add(v.name);
  }
  for (const d of f.definitions) {
    if (names.has(d.name)) reasons.push(`duplicate name '${d.name}'`);
    names.add(d.name);
  }

  const scope: Scope = {
    sortOf(name: string) {
      const v = f.vars.find((x) => x.name === name);
      if (v) return v.sort;
      if (f.definitions.some((d) => d.name === name)) return 'bool';
      return undefined;
    },
    enumValues(name: string) {
      const v = f.vars.find((x) => x.name === name && x.sort === 'enum');
      return v && v.sort === 'enum' ? v.values : undefined;
    },
  };

  for (const d of f.definitions) {
    try {
      parseExpr(d.formula);
    } catch (e) {
      reasons.push(`definition '${d.name}' formula error: ${(e as Error).message}`);
    }
    if (d.spanIds.length === 0) reasons.push(`definition '${d.name}' has no spanIds`);
    if (knownSpanIds) {
      for (const sid of d.spanIds) if (!knownSpanIds.has(sid)) reasons.push(`definition '${d.name}' references unknown span '${sid}'`);
    }
  }

  for (const r of f.rules) {
    if (r.spanIds.length === 0) reasons.push(`rule '${r.id}' has no spanIds`);
    if (knownSpanIds) {
      for (const sid of r.spanIds) if (!knownSpanIds.has(sid)) reasons.push(`rule '${r.id}' references unknown span '${sid}'`);
    }
    try {
      parseExpr(r.when);
      parseExpr(r.require);
    } catch (e) {
      reasons.push(`rule '${r.id}' formula error: ${(e as Error).message}`);
    }
  }

  // Acyclic definition references.
  const defByName = new Map(f.definitions.map((d) => [d.name, d]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(name: string, chain: string[]): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      reasons.push(`cyclic definition: ${[...chain, name].join(' -> ')}`);
      return;
    }
    const def = defByName.get(name);
    if (!def) return;
    visiting.add(name);
    let refs: Set<string>;
    try {
      refs = refsOf(parseExpr(def.formula));
    } catch {
      refs = new Set();
    }
    for (const r of refs) {
      if (defByName.has(r)) visit(r, [...chain, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }
  for (const d of f.definitions) visit(d.name, []);

  // Typecheck all formulas against the scope.
  for (const d of f.definitions) {
    try {
      const t = typecheck(parseExpr(d.formula), scope);
      if (t !== 'bool') reasons.push(`definition '${d.name}' must be bool, got ${t}`);
    } catch {
      // formula parse/typecheck errors already recorded above
    }
  }
  for (const r of f.rules) {
    try {
      const t1 = typecheck(parseExpr(r.when), scope);
      const t2 = typecheck(parseExpr(r.require), scope);
      if (t1 !== 'bool') reasons.push(`rule '${r.id}' when must be bool, got ${t1}`);
      if (t2 !== 'bool') reasons.push(`rule '${r.id}' require must be bool, got ${t2}`);
    } catch (e) {
      reasons.push(`rule '${r.id}' typecheck error: ${(e as Error).message}`);
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons: [...new Set(reasons)] };
}
