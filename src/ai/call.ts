import { generateText, Output } from 'ai';
import type { z } from 'zod';
import { sha256Hex } from '@/core/canonical';
import { db } from '@/db/client';
import { modelCalls } from '@/db/schema';
import { FALLBACK_MODEL, FAST_MODEL, groq, openrouter, REASONING_MODEL } from './models';

export type CallStructuredResult<T> = { ok: true; data: T } | { ok: false; error: string };

const ATTEMPT_TIMEOUT_MS = 30_000;

export interface CallStructuredArgs<T> {
  runId?: string;
  model: 'reasoning' | 'fast';
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  mode?: 'demo' | 'live';
}

async function logModelCall(args: {
  runId?: string;
  stage: string;
  model: string;
  promptHash: string;
  usage: unknown;
  mode: 'demo' | 'live';
  ok: boolean;
}): Promise<void> {
  if (!args.runId) return;
  await db.insert(modelCalls).values({
    runId: args.runId,
    stage: args.stage,
    model: args.model,
    promptHash: args.promptHash,
    usage: args.usage as object,
    mode: args.mode,
    ok: args.ok,
  });
}

/**
 * Calls the reasoning/fast Groq model first. On failure, retries the same Groq model
 * once with the error appended to the system prompt (handles schema-validation
 * misses); if that also fails, falls through once to OpenRouter's fallback model
 * (E-11a: plain try/catch, no gateway). Never logs raw prompt text, only its hash.
 */
export async function callStructured<T>(stage: string, args: CallStructuredArgs<T>): Promise<CallStructuredResult<T>> {
  const modelId = args.model === 'reasoning' ? REASONING_MODEL : FAST_MODEL;
  const promptHash = sha256Hex(args.prompt);
  const mode = args.mode ?? 'live';

  async function attempt(provider: 'groq' | 'openrouter', extraSystem?: string) {
    const modelInstance = provider === 'groq' ? groq(modelId) : openrouter(FALLBACK_MODEL);
    const { output, usage } = await generateText({
      model: modelInstance,
      output: Output.object({ schema: args.schema }),
      system: extraSystem ? `${args.system}\n\n${extraSystem}` : args.system,
      prompt: args.prompt,
      abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    return { output, usage, model: provider === 'groq' ? modelId : FALLBACK_MODEL };
  }

  try {
    const first = await attempt('groq');
    await logModelCall({ runId: args.runId, stage, model: first.model, promptHash, usage: first.usage, mode, ok: true });
    return { ok: true, data: first.output };
  } catch (firstError) {
    await logModelCall({ runId: args.runId, stage, model: modelId, promptHash, usage: null, mode, ok: false });
    try {
      const zodMessage = firstError instanceof Error ? firstError.message : String(firstError);
      const retry = await attempt('groq', `Your previous output failed validation: ${zodMessage}\nFix it and return valid output.`);
      await logModelCall({ runId: args.runId, stage, model: retry.model, promptHash, usage: retry.usage, mode, ok: true });
      return { ok: true, data: retry.output };
    } catch {
      await logModelCall({ runId: args.runId, stage, model: modelId, promptHash, usage: null, mode, ok: false });
      try {
        const fallback = await attempt('openrouter');
        await logModelCall({ runId: args.runId, stage, model: fallback.model, promptHash, usage: fallback.usage, mode, ok: true });
        return { ok: true, data: fallback.output };
      } catch (finalError) {
        await logModelCall({ runId: args.runId, stage, model: FALLBACK_MODEL, promptHash, usage: null, mode, ok: false });
        return { ok: false, error: finalError instanceof Error ? finalError.message : String(finalError) };
      }
    }
  }
}
