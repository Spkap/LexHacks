import { PurposeSuggestion, type Span } from '@/core/contracts';
import { callStructured } from './call';
import { buildPurposePrompt, SYSTEM_PURPOSE } from './prompts/purpose';

export interface SuggestPurposeArgs {
  runId?: string;
  mode?: 'demo' | 'live';
  spans: Span[];
}

export async function suggestPurpose(args: SuggestPurposeArgs): Promise<PurposeSuggestion | null> {
  const result = await callStructured('purpose-suggestion', {
    runId: args.runId,
    mode: args.mode,
    model: 'fast',
    schema: PurposeSuggestion,
    system: SYSTEM_PURPOSE,
    prompt: buildPurposePrompt(args.spans),
  });
  return result.ok ? result.data : null;
}
