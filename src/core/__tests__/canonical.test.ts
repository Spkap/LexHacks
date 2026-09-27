import { describe, it, expect } from 'vitest';
import { canonicalJson, sha256Hex } from '../canonical';

describe('canonicalJson', () => {
  it('sorts keys recursively and is order-independent', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('keeps array order', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });
  it('rejects undefined and non-finite numbers', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });
});

describe('sha256Hex', () => {
  it('hashes deterministically', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
