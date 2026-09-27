export type Expr =
  | { op: 'bool'; value: boolean }
  | { op: 'int'; value: number }
  | { op: 'ref'; name: string }
  | { op: 'is'; name: string; value: string }
  | { op: 'not'; arg: Expr }
  | { op: 'and' | 'or' | 'add'; args: Expr[] }
  | { op: 'implies' | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; args: [Expr, Expr] };

export class DslError extends Error {}

export type Sort = 'bool' | 'int';

export interface Scope {
  sortOf(name: string): Sort | 'enum' | undefined;
  enumValues(name: string): string[] | undefined;
}

const MAX_SOURCE_LEN = 2000;
const MAX_DEPTH = 32;

const IDENT_RE = /^[a-z][a-z0-9_]{0,47}$/;

type Token = { type: 'ident' | 'int' | 'lparen' | 'rparen' | 'comma'; value: string; pos: number };

function tokenize(src: string): Token[] {
  if (src.length > MAX_SOURCE_LEN) throw new DslError(`source too long: ${src.length} chars`);
  const re = /\s*([a-z][a-z0-9_]{0,47}|-?\d+|[(),])/y;
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new DslError(`unexpected character at ${pos}`);
    }
    const tok = m[1];
    const tokStart = re.lastIndex - tok.length;
    pos = re.lastIndex;
    if (tok === '(') tokens.push({ type: 'lparen', value: tok, pos: tokStart });
    else if (tok === ')') tokens.push({ type: 'rparen', value: tok, pos: tokStart });
    else if (tok === ',') tokens.push({ type: 'comma', value: tok, pos: tokStart });
    else if (/^-?\d+$/.test(tok)) tokens.push({ type: 'int', value: tok, pos: tokStart });
    else tokens.push({ type: 'ident', value: tok, pos: tokStart });
  }
  return tokens;
}

const VARIADIC_MIN2: ReadonlySet<string> = new Set(['and', 'or', 'add']);
const UNARY: ReadonlySet<string> = new Set(['not']);
const BINARY: ReadonlySet<string> = new Set(['implies', 'eq', 'ne', 'lt', 'le', 'gt', 'ge']);
const KNOWN_FNS = new Set<string>([...VARIADIC_MIN2, ...UNARY, ...BINARY, 'is']);

class Parser {
  private i = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }

  private next(): Token {
    const t = this.tokens[this.i];
    if (!t) throw new DslError('unexpected end of input');
    this.i += 1;
    return t;
  }

  private expect(type: Token['type']): Token {
    const t = this.next();
    if (t.type !== type) throw new DslError(`expected ${type} but got '${t.value}' at ${t.pos}`);
    return t;
  }

  parseTop(): Expr {
    const e = this.parseExpr(1);
    if (this.i < this.tokens.length) {
      const t = this.tokens[this.i];
      throw new DslError(`trailing input at ${t.pos}: '${t.value}'`);
    }
    return e;
  }

  parseExpr(depth: number): Expr {
    if (depth > MAX_DEPTH) throw new DslError(`max depth ${MAX_DEPTH} exceeded`);
    const t = this.peek();
    if (!t) throw new DslError('unexpected end of input');

    if (t.type === 'int') {
      this.next();
      return { op: 'int', value: Number.parseInt(t.value, 10) };
    }

    if (t.type === 'ident') {
      this.next();
      if (t.value === 'true') return { op: 'bool', value: true };
      if (t.value === 'false') return { op: 'bool', value: false };

      const name = t.value;
      const nextTok = this.peek();
      if (!nextTok || nextTok.type !== 'lparen') {
        if (!IDENT_RE.test(name)) throw new DslError(`invalid identifier '${name}'`);
        return { op: 'ref', name };
      }

      this.next(); // consume '('

      if (name === 'is') {
        const varTok = this.expect('ident');
        this.expect('comma');
        const valTok = this.expect('ident');
        this.expect('rparen');
        return { op: 'is', name: varTok.value, value: valTok.value };
      }

      if (!KNOWN_FNS.has(name)) throw new DslError(`unknown function '${name}'`);

      const args: Expr[] = [];
      if (this.peek()?.type !== 'rparen') {
        args.push(this.parseExpr(depth + 1));
        while (this.peek()?.type === 'comma') {
          this.next();
          args.push(this.parseExpr(depth + 1));
        }
      }
      this.expect('rparen');

      if (UNARY.has(name)) {
        if (args.length !== 1) throw new DslError(`'${name}' expects 1 argument, got ${args.length}`);
        return { op: 'not', arg: args[0] };
      }
      if (BINARY.has(name)) {
        if (args.length !== 2) throw new DslError(`'${name}' expects 2 arguments, got ${args.length}`);
        return { op: name as 'implies' | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge', args: [args[0], args[1]] };
      }
      if (VARIADIC_MIN2.has(name)) {
        if (args.length < 2) throw new DslError(`'${name}' expects at least 2 arguments, got ${args.length}`);
        return { op: name as 'and' | 'or' | 'add', args };
      }
      throw new DslError(`unknown function '${name}'`);
    }

    throw new DslError(`unexpected token '${t.value}' at ${t.pos}`);
  }
}

export function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new DslError('empty expression');
  return new Parser(tokens).parseTop();
}

export function printExpr(e: Expr): string {
  switch (e.op) {
    case 'bool':
      return e.value ? 'true' : 'false';
    case 'int':
      return String(e.value);
    case 'ref':
      return e.name;
    case 'is':
      return `is(${e.name}, ${e.value})`;
    case 'not':
      return `not(${printExpr(e.arg)})`;
    case 'and':
    case 'or':
    case 'add':
      return `${e.op}(${e.args.map(printExpr).join(', ')})`;
    case 'implies':
    case 'eq':
    case 'ne':
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
      return `${e.op}(${printExpr(e.args[0])}, ${printExpr(e.args[1])})`;
  }
}

export function refsOf(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.op) {
    case 'bool':
    case 'int':
      break;
    case 'ref':
      out.add(e.name);
      break;
    case 'is':
      out.add(e.name);
      break;
    case 'not':
      refsOf(e.arg, out);
      break;
    case 'and':
    case 'or':
    case 'add':
      for (const a of e.args) refsOf(a, out);
      break;
    case 'implies':
    case 'eq':
    case 'ne':
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
      refsOf(e.args[0], out);
      refsOf(e.args[1], out);
      break;
  }
  return out;
}

export function typecheck(e: Expr, scope: Scope): Sort {
  switch (e.op) {
    case 'bool':
      return 'bool';
    case 'int':
      return 'int';
    case 'ref': {
      const sort = scope.sortOf(e.name);
      if (sort === undefined) throw new DslError(`unknown identifier '${e.name}'`);
      if (sort === 'enum') throw new DslError(`'${e.name}' is an enum, use is(${e.name}, value)`);
      return sort;
    }
    case 'is': {
      const sort = scope.sortOf(e.name);
      if (sort === undefined) throw new DslError(`unknown identifier '${e.name}'`);
      if (sort !== 'enum') throw new DslError(`'${e.name}' is not an enum`);
      const values = scope.enumValues(e.name) ?? [];
      if (!values.includes(e.value)) throw new DslError(`unknown enum value '${e.value}' for '${e.name}'`);
      return 'bool';
    }
    case 'not': {
      const t = typecheck(e.arg, scope);
      if (t !== 'bool') throw new DslError(`'not' expected bool, got ${t}`);
      return 'bool';
    }
    case 'and':
    case 'or': {
      for (const a of e.args) {
        const t = typecheck(a, scope);
        if (t !== 'bool') throw new DslError(`'${e.op}' expected bool, got ${t}`);
      }
      return 'bool';
    }
    case 'add': {
      for (const a of e.args) {
        const t = typecheck(a, scope);
        if (t !== 'int') throw new DslError(`'add' expected int, got ${t}`);
      }
      return 'int';
    }
    case 'implies': {
      const t0 = typecheck(e.args[0], scope);
      const t1 = typecheck(e.args[1], scope);
      if (t0 !== 'bool' || t1 !== 'bool') throw new DslError(`'implies' expected bool, bool`);
      return 'bool';
    }
    case 'eq':
    case 'ne': {
      const t0 = typecheck(e.args[0], scope);
      const t1 = typecheck(e.args[1], scope);
      if (t0 !== t1) throw new DslError(`'${e.op}' type mismatch: ${t0} vs ${t1}`);
      return 'bool';
    }
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge': {
      const t0 = typecheck(e.args[0], scope);
      const t1 = typecheck(e.args[1], scope);
      if (t0 !== 'int' || t1 !== 'int') throw new DslError(`'${e.op}' expected int, int`);
      return 'bool';
    }
  }
}
