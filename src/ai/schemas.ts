import { z } from 'zod';
import { Ident, type VarDecl } from '@/core/ir';

/**
 * A flat, non-discriminated-union shape for LLM structured output. Some providers'
 * JSON-schema-based structured output (Groq included) choke on Zod's
 * discriminatedUnion when multiple branches share field names, so the model sees
 * this flat shape and the server converts it into the real `VarDecl` union.
 */
// Every property must be listed in `required` for Groq's strict structured-output mode,
// which a zod .optional() silently drops from `required` (it becomes optional in the JSON
// schema) -- Groq's schema validator then rejects the whole call before generation starts.
// min/max/values are therefore always required; the model fills them with 0/0/[] when not
// applicable to a var's sort (flatVarsToVarDecls below only reads the field for its own sort).
export const VarDeclFlat = z.object({
  name: Ident,
  label: z.string().max(160),
  spanIds: z.array(z.string()),
  sort: z.enum(['bool', 'int', 'enum']),
  min: z.number().int(),
  max: z.number().int(),
  values: z.array(Ident).max(12),
});
export type VarDeclFlatT = z.infer<typeof VarDeclFlat>;

export interface FlatVarConversionResult {
  vars: VarDecl[];
  dropped: Array<{ flat: VarDeclFlatT; reason: string }>;
}

export function flatVarsToVarDecls(flats: VarDeclFlatT[], origin: 'source' | 'purpose' = 'source'): FlatVarConversionResult {
  const vars: VarDecl[] = [];
  const dropped: FlatVarConversionResult['dropped'] = [];

  for (const flat of flats) {
    if (flat.sort === 'bool') {
      vars.push({ name: flat.name, label: flat.label, spanIds: flat.spanIds, origin, sort: 'bool' });
    } else if (flat.sort === 'int') {
      if (flat.min >= flat.max) {
        dropped.push({ flat, reason: `int variable '${flat.name}' has invalid or missing min/max (min=${flat.min}, max=${flat.max})` });
      } else {
        vars.push({ name: flat.name, label: flat.label, spanIds: flat.spanIds, origin, sort: 'int', min: flat.min, max: flat.max });
      }
    } else {
      if (flat.values.length < 2) {
        dropped.push({ flat, reason: `enum variable '${flat.name}' needs at least 2 values` });
      } else {
        vars.push({ name: flat.name, label: flat.label, spanIds: flat.spanIds, origin, sort: 'enum', values: flat.values });
      }
    }
  }

  return { vars, dropped };
}
