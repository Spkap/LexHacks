import { describe, expect, it } from 'vitest';
import { flatVarsToVarDecls } from '../schemas';

const base = { name: 'x', label: 'X', spanIds: ['S1'] };

describe('flatVarsToVarDecls', () => {
  it('keeps a bool var regardless of the (unused) min/max/values placeholders', () => {
    const { vars, dropped } = flatVarsToVarDecls([{ ...base, sort: 'bool', min: 0, max: 0, values: [] }]);
    expect(dropped).toHaveLength(0);
    expect(vars).toEqual([{ name: 'x', label: 'X', spanIds: ['S1'], origin: 'source', sort: 'bool' }]);
  });

  it('keeps an int var with valid min < max', () => {
    const { vars, dropped } = flatVarsToVarDecls([{ ...base, sort: 'int', min: 0, max: 100, values: [] }]);
    expect(dropped).toHaveLength(0);
    expect(vars[0]).toMatchObject({ sort: 'int', min: 0, max: 100 });
  });

  it('drops an int var whose min is not less than max (the model filled placeholders instead of real bounds)', () => {
    const { vars, dropped } = flatVarsToVarDecls([{ ...base, sort: 'int', min: 0, max: 0, values: [] }]);
    expect(vars).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/invalid or missing min\/max/);
  });

  it('keeps an enum var with >=2 values', () => {
    const { vars, dropped } = flatVarsToVarDecls([{ ...base, sort: 'enum', min: 0, max: 0, values: ['a', 'b'] }]);
    expect(dropped).toHaveLength(0);
    expect(vars[0]).toMatchObject({ sort: 'enum', values: ['a', 'b'] });
  });

  it('drops an enum var with the placeholder empty values array', () => {
    const { vars, dropped } = flatVarsToVarDecls([{ ...base, sort: 'enum', min: 0, max: 0, values: [] }]);
    expect(vars).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/needs at least 2 values/);
  });
});
