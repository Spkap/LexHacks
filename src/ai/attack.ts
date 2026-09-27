import { z } from 'zod';
import { Candidate, type Formalization, type PurposeContract, type Tactic } from '@/core/ir';
import { callStructured } from './call';
import { buildAttackPrompt, SYSTEM_ATTACK } from './prompts/attack';

const CandidateInput = Candidate.omit({ id: true, tactic: true });
const AttackBatchOutput = z.object({ candidates: z.array(CandidateInput).max(8) });

export interface GenerateAttackBatchArgs {
  formalization: Formalization;
  purpose: PurposeContract;
  tactic: Tactic;
  budget: number;
  runId?: string;
  mode?: 'demo' | 'live';
}

export async function generateAttackBatch(args: GenerateAttackBatchArgs): Promise<Candidate[]> {
  const prompt = buildAttackPrompt(args.formalization, args.purpose, args.tactic, args.budget);
  const result = await callStructured(`attack-${args.tactic}`, {
    runId: args.runId,
    mode: args.mode,
    model: 'fast',
    schema: AttackBatchOutput,
    system: SYSTEM_ATTACK,
    prompt,
  });

  if (!result.ok) throw new Error(`attack generation failed for tactic '${args.tactic}': ${result.error}`);

  return result.data.candidates.slice(0, args.budget).map((c, i) => ({
    ...c,
    id: `${args.tactic}-${i + 1}`,
    tactic: args.tactic,
  }));
}
