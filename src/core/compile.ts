import type { Arith, Bool, Context, Expr as Z3Expr, Model } from 'z3-solver';
import { parseExpr, type Expr } from './dsl';
import type { Formalization, Pins } from './ir';
import { getZ3 } from './z3';

type Ctx = Context<'loophole'>;
type ZBool = Bool<'loophole'>;
type ZArith = Arith<'loophole'>;
type ZValue = ZBool | ZArith;

export interface CompiledModel {
  ctx: Ctx;
  compile(e: Expr): ZValue;
  compileBool(formula: string): ZBool;
  bounds: ZBool[];
  compliance: ZBool;
  pins(p: Pins): ZBool[];
  decode(model: Model<'loophole'>): Record<string, boolean | number | string>;
}

export async function buildModel(f: Formalization): Promise<CompiledModel> {
  const api = await getZ3();
  const ctx = new api.Context('loophole') as Ctx;

  const varByName = new Map(f.vars.map((v) => [v.name, v]));
  const defByName = new Map(f.definitions.map((d) => [d.name, d]));

  const symbols = new Map<string, ZValue>();
  for (const v of f.vars) {
    const symName = `v_${v.name}`;
    symbols.set(v.name, v.sort === 'bool' ? ctx.Bool.const(symName) : ctx.Int.const(symName));
  }

  const defMemo = new Map<string, ZValue>();

  function compile(e: Expr): ZValue {
    switch (e.op) {
      case 'bool':
        return ctx.Bool.val(e.value);
      case 'int':
        return ctx.Int.val(e.value);
      case 'ref': {
        const sym = symbols.get(e.name);
        if (sym) return sym;
        const memoized = defMemo.get(e.name);
        if (memoized) return memoized;
        const def = defByName.get(e.name);
        if (!def) throw new Error(`compile: unknown reference '${e.name}'`);
        const compiled = compile(parseExpr(def.formula));
        defMemo.set(e.name, compiled);
        return compiled;
      }
      case 'is': {
        const decl = varByName.get(e.name);
        if (!decl || decl.sort !== 'enum') throw new Error(`compile: '${e.name}' is not an enum`);
        const idx = decl.values.indexOf(e.value);
        if (idx < 0) throw new Error(`compile: unknown enum value '${e.value}' for '${e.name}'`);
        return (symbols.get(e.name) as ZArith).eq(idx);
      }
      case 'not':
        return ctx.Not(compile(e.arg) as ZBool);
      case 'and':
        return ctx.And(...e.args.map((a) => compile(a) as ZBool));
      case 'or':
        return ctx.Or(...e.args.map((a) => compile(a) as ZBool));
      case 'add':
        return e.args.map((a) => compile(a) as ZArith).reduce((acc, x) => acc.add(x));
      case 'implies':
        return ctx.Implies(compile(e.args[0]) as ZBool, compile(e.args[1]) as ZBool);
      case 'eq':
        return (compile(e.args[0]) as Z3Expr<'loophole'>).eq(compile(e.args[1]) as Z3Expr<'loophole'>);
      case 'ne':
        return (compile(e.args[0]) as Z3Expr<'loophole'>).neq(compile(e.args[1]) as Z3Expr<'loophole'>);
      case 'lt':
        return (compile(e.args[0]) as ZArith).lt(compile(e.args[1]) as ZArith);
      case 'le':
        return (compile(e.args[0]) as ZArith).le(compile(e.args[1]) as ZArith);
      case 'gt':
        return (compile(e.args[0]) as ZArith).gt(compile(e.args[1]) as ZArith);
      case 'ge':
        return (compile(e.args[0]) as ZArith).ge(compile(e.args[1]) as ZArith);
    }
  }

  function compileBool(formula: string): ZBool {
    return compile(parseExpr(formula)) as ZBool;
  }

  const bounds: ZBool[] = [];
  for (const v of f.vars) {
    const sym = symbols.get(v.name) as ZArith;
    if (v.sort === 'int') {
      bounds.push(sym.ge(v.min));
      bounds.push(sym.le(v.max));
    } else if (v.sort === 'enum') {
      bounds.push(sym.ge(0));
      bounds.push(sym.le(v.values.length - 1));
    }
  }

  const compliance = ctx.And(...f.rules.map((r) => ctx.Implies(compileBool(r.when), compileBool(r.require))));

  function pins(p: Pins): ZBool[] {
    const out: ZBool[] = [];
    for (const [key, value] of Object.entries(p)) {
      const decl = varByName.get(key);
      if (!decl) throw new Error(`pins: unknown variable '${key}'`);
      const sym = symbols.get(key);
      if (!sym) throw new Error(`pins: no symbol for '${key}'`);
      if (decl.sort === 'bool') {
        out.push((sym as ZBool).eq(Boolean(value)));
      } else if (decl.sort === 'int') {
        out.push((sym as ZArith).eq(Number(value)));
      } else {
        const idx = decl.values.indexOf(String(value));
        if (idx < 0) throw new Error(`pins: unknown enum value '${String(value)}' for '${key}'`);
        out.push((sym as ZArith).eq(idx));
      }
    }
    return out;
  }

  function decode(model: Model<'loophole'>): Record<string, boolean | number | string> {
    const result: Record<string, boolean | number | string> = {};
    for (const v of f.vars) {
      const sym = symbols.get(v.name);
      if (!sym) continue;
      if (v.sort === 'bool') {
        const val = model.eval(sym as ZBool, true);
        result[v.name] = val.toString() === 'true';
      } else if (v.sort === 'int') {
        const val = model.eval(sym as ZArith, true);
        result[v.name] = Number(val.toString());
      } else {
        const val = model.eval(sym as ZArith, true);
        const idx = Number(val.toString());
        result[v.name] = v.values[idx];
      }
    }
    return result;
  }

  return { ctx, compile, compileBool, bounds, compliance, pins, decode };
}
