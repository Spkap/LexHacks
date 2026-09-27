import { z } from 'zod';
import { buildProofTrace, type TraceStep } from '@/core/explain-plain';
import type { Formalization, PurposeInvariant } from '@/core/ir';
import { callStructured } from './call';
import { buildExplainPrompt, SYSTEM_EXPLAIN } from './prompts/explain';

const ExplanationOutput = z.object({
  complies: z.string().max(600),
  harms: z.string().max(600),
  citations: z.array(z.string()),
});

export interface Explanation {
  complies: string;
  harms: string;
  citations: string[];
  trace: TraceStep[];
}

function deterministicFallback(trace: TraceStep[]): Explanation {
  const ruleSteps = trace.filter((s) => /^R\d/.test(s.text.split(' ')[0]) || s.text.includes('SATISFIED') || s.text.includes('applies'));
  const invariantStep = trace[trace.length - 1];
  const citations = [...new Set(trace.flatMap((s) => s.spanIds))];
  return {
    complies: ruleSteps.map((s) => s.text).join(' ') || 'The compliance rules are satisfied under this scenario.',
    harms: invariantStep?.text ?? 'The purpose invariant is violated under this scenario.',
    citations,
    trace,
  };
}

export async function explainCertificate(
  f: Formalization,
  model: Record<string, boolean | number | string>,
  invariant: PurposeInvariant,
  opts: { runId?: string; mode?: 'demo' | 'live' } = {},
): Promise<Explanation> {
  const trace = buildProofTrace(f, model, invariant);
  const traceSpanIds = new Set(trace.flatMap((s) => s.spanIds));

  const result = await callStructured('explain', {
    runId: opts.runId,
    mode: opts.mode,
    model: 'fast',
    schema: ExplanationOutput,
    system: SYSTEM_EXPLAIN,
    prompt: buildExplainPrompt(trace, invariant),
  });

  if (result.ok && result.data.citations.every((c) => traceSpanIds.has(c))) {
    return { ...result.data, trace };
  }

  return deterministicFallback(trace);
}
