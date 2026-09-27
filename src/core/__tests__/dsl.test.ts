import { describe, it, expect } from 'vitest';
import { parseExpr, printExpr, refsOf, typecheck, DslError, type Scope } from '../dsl';

const GOLDEN_FORMULAS = [
  'or(gt(annual_revenue_musd, 25), ge(consumers_k, 50), ge(pi_revenue_pct, 50))',
  'and(is(recipient, service_provider), sp_contract, is(disclosure_purpose, business_purpose))',
  'and(discloses_pi, or(is(recipient, third_party), and(is(recipient, service_provider), not(sp_exception))))',
  'and(third_party_disclosure, not(is(consideration, none)))',
  'and(covered_business, sell)',
  'and(covered_business, consumer_opted_out)',
  'not(and(covered_business, consumer_opted_out, third_party_disclosure, is(disclosure_purpose, cross_context_ads)))',
  'and(third_party_disclosure, is(disclosure_purpose, cross_context_ads))',
  'and(covered_business, or(sell, share))',
  'and(covered_business, consumer_opted_out)',
  'and(not(sell), not(share))',
];

describe('parseExpr', () => {
  it('parses and(a, not(b))', () => {
    expect(parseExpr('and(a, not(b))')).toEqual({
      op: 'and',
      args: [{ op: 'ref', name: 'a' }, { op: 'not', arg: { op: 'ref', name: 'b' } }],
    });
  });

  it('round-trips every golden formula', () => {
    for (const s of GOLDEN_FORMULAS) {
      expect(printExpr(parseExpr(s))).toBe(s);
    }
  });

  it('parses is(recipient, third_party)', () => {
    expect(parseExpr('is(recipient, third_party)')).toEqual({ op: 'is', name: 'recipient', value: 'third_party' });
  });

  it('throws DslError on arity errors', () => {
    expect(() => parseExpr('and(a)')).toThrow(DslError);
  });
  it('throws DslError on unknown function', () => {
    expect(() => parseExpr('foo(a,b)')).toThrow(DslError);
  });
  it('throws DslError on unexpected EOF', () => {
    expect(() => parseExpr('and(a,')).toThrow(DslError);
  });
  it('throws DslError on trailing input', () => {
    expect(() => parseExpr('a b')).toThrow(DslError);
  });
  it('throws DslError on source too long', () => {
    expect(() => parseExpr('a'.repeat(2001))).toThrow(DslError);
  });
  it('throws DslError on excessive depth', () => {
    let src = 'a';
    for (let i = 0; i < 33; i += 1) src = `not(${src})`;
    expect(() => parseExpr(src)).toThrow(DslError);
  });
  it('throws DslError on unknown fn eval', () => {
    expect(() => parseExpr('eval(x)')).toThrow(DslError);
  });
});

describe('refsOf', () => {
  it('collects ref and is names', () => {
    const e = parseExpr('and(discloses_pi, is(recipient, third_party))');
    expect(refsOf(e)).toEqual(new Set(['discloses_pi', 'recipient']));
  });
});

describe('typecheck', () => {
  const scope: Scope = {
    sortOf(name) {
      const table: Record<string, 'bool' | 'int' | 'enum'> = {
        annual_revenue_musd: 'int',
        discloses_pi: 'bool',
        recipient: 'enum',
      };
      return table[name];
    },
    enumValues(name) {
      if (name === 'recipient') return ['third_party', 'service_provider', 'consumer_directed'];
      return undefined;
    },
  };

  it('gt(annual_revenue_musd, 25) is bool', () => {
    expect(typecheck(parseExpr('gt(annual_revenue_musd, 25)'), scope)).toBe('bool');
  });
  it('and(annual_revenue_musd, x) throws expected bool', () => {
    expect(() => typecheck(parseExpr('and(annual_revenue_musd, discloses_pi)'), scope)).toThrow(/expected bool/);
  });
  it('is(recipient, pizza) throws unknown enum value', () => {
    expect(() => typecheck(parseExpr('is(recipient, pizza)'), scope)).toThrow(/unknown enum value/);
  });
  it('is(discloses_pi, x) throws not an enum', () => {
    expect(() => typecheck(parseExpr('is(discloses_pi, x)'), scope)).toThrow(/not an enum/);
  });
});
