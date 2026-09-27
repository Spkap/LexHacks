import { z } from 'zod';
import { AttackProposal, type Lane, type PurposeContract, type Span } from '@/core/contracts';
import { callStructured } from './call';
import { buildAttackPrompt, SYSTEM_ATTACK } from './prompts/attack';

const AttackBatchOutput = z.object({ proposals: z.array(AttackProposal) });

export interface GenerateAttackArgs {
  runId?: string;
  mode?: 'demo' | 'live';
  spans: Span[];
  purpose: PurposeContract;
  lane: Lane;
  k: number;
}

export async function generateAttack(args: GenerateAttackArgs): Promise<AttackProposal[]> {
  const prompt = buildAttackPrompt(args.spans, args.purpose, args.lane, args.k);
  const result = await callStructured(`attack-${args.lane}`, {
    runId: args.runId,
    mode: args.mode,
    model: 'reasoning',
    schema: AttackBatchOutput,
    system: SYSTEM_ATTACK,
    prompt,
  });

  if (!result.ok) return [];

  return result.data.proposals.slice(0, args.k).map((p) => ({ ...p, tactic: args.lane }));
}
