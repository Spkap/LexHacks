import { z } from 'zod';
import { Definition, Rule, validateFormalization, type Formalization, type VarDecl } from '@/core/ir';
import { reconcileExtraction, type ReviewItem } from '@/core/reconcile';
import { callStructured } from './call';
import { buildExtractAPrompt, SYSTEM_EXTRACT_A, type SpanInput } from './prompts/extract-a';
import { buildExtractBPrompt, SYSTEM_EXTRACT_B } from './prompts/extract-b';
import { flatVarsToVarDecls, VarDeclFlat } from './schemas';

const RuleInput = Rule.omit({ status: true });
const DefinitionInput = Definition.omit({ status: true });

const ExtractorAOutput = z.object({ vars: z.array(VarDeclFlat), rules: z.array(RuleInput) });
const ExtractorBOutput = z.object({ vars: z.array(VarDeclFlat), definitions: z.array(DefinitionInput) });

export interface ExtractionResult {
  vars: VarDecl[];
  definitions: Definition[];
  rules: Rule[];
  disputes: ReviewItem[];
}

/**
 * Localizes formalization-level validation failures to the specific rule or
 * definition that caused them, marking that item disputed rather than discarding
 * the whole extraction. Stops once no more reasons can be attributed to a
 * specific item (remaining failures, if any, are structural and surfaced as-is).
 */
function isolateInvalidItems(vars: VarDecl[], definitions: Definition[], rules: Rule[], disputes: ReviewItem[]): void {
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const draft: Formalization = { id: 'draft', version: 1, sourceId: 'draft', vars, definitions, rules };
    const result = validateFormalization(draft);
    if (result.ok) return;

    let mutated = false;
    for (const reason of result.reasons) {
      const ruleMatch = reason.match(/rule '([^']+)'/);
      const defMatch = reason.match(/definition '([^']+)'/);
      if (ruleMatch) {
        const idx = rules.findIndex((r) => r.id === ruleMatch[1] && r.status !== 'disputed');
        if (idx >= 0) {
          disputes.push({ kind: 'definition_conflict', message: reason, spanIds: rules[idx].spanIds, left: rules[idx], right: null });
          rules[idx] = { ...rules[idx], status: 'disputed' };
          mutated = true;
        }
      } else if (defMatch) {
        const idx = definitions.findIndex((d) => d.name === defMatch[1] && d.status !== 'disputed');
        if (idx >= 0) {
          disputes.push({ kind: 'definition_conflict', message: reason, spanIds: definitions[idx].spanIds, left: definitions[idx], right: null });
          definitions[idx] = { ...definitions[idx], status: 'disputed' };
          mutated = true;
        }
      }
    }
    if (!mutated) return;
  }
}

export async function runDualExtraction(
  spans: SpanInput[],
  opts: { runId?: string; mode?: 'demo' | 'live' } = {},
): Promise<ExtractionResult> {
  const [resultA, resultB] = await Promise.all([
    callStructured('extract-a', {
      runId: opts.runId,
      mode: opts.mode,
      model: 'reasoning',
      schema: ExtractorAOutput,
      system: SYSTEM_EXTRACT_A,
      prompt: buildExtractAPrompt(spans),
    }),
    callStructured('extract-b', {
      runId: opts.runId,
      mode: opts.mode,
      model: 'reasoning',
      schema: ExtractorBOutput,
      system: SYSTEM_EXTRACT_B,
      prompt: buildExtractBPrompt(spans),
    }),
  ]);

  if (!resultA.ok) throw new Error(`extractor A failed: ${resultA.error}`);
  if (!resultB.ok) throw new Error(`extractor B failed: ${resultB.error}`);

  const rules: Rule[] = resultA.data.rules.map((r) => ({ ...r, status: 'proposed' as const }));
  const definitions: Definition[] = resultB.data.definitions.map((d) => ({ ...d, status: 'proposed' as const }));

  const varsA = flatVarsToVarDecls(resultA.data.vars);
  const varsB = flatVarsToVarDecls(resultB.data.vars);
  const disputes: ReviewItem[] = [
    ...varsA.dropped.map((d) => ({ kind: 'var_conflict' as const, message: d.reason, spanIds: d.flat.spanIds, left: d.flat, right: null })),
    ...varsB.dropped.map((d) => ({ kind: 'var_conflict' as const, message: d.reason, spanIds: d.flat.spanIds, left: d.flat, right: null })),
  ];

  const reconciled = await reconcileExtraction({ vars: varsA.vars, rules }, { vars: varsB.vars, definitions });
  reconciled.disputes = [...disputes, ...reconciled.disputes];

  isolateInvalidItems(reconciled.vars, reconciled.definitions, reconciled.rules, reconciled.disputes);

  return reconciled;
}
