import { z } from 'zod';
import { RepairProposal, type PurposeContract, type Span } from '@/core/contracts';
import { groundRepair } from '@/core/grounding';
import { callStructured } from './call';
import { buildRepairPrompt, SYSTEM_REPAIR, type RepairFindingContext } from './prompts/repair';

const RepairBatchOutput = z.object({ proposals: z.array(RepairProposal).max(3) });

export interface GenerateRepairProposalsArgs {
  runId?: string;
  mode?: 'demo' | 'live';
  finding: RepairFindingContext;
  otherLoopholes: RepairFindingContext[];
  spans: Span[];
  purpose: PurposeContract;
}

export async function proposeRepairs(args: GenerateRepairProposalsArgs): Promise<RepairProposal[]> {
  const prompt = buildRepairPrompt(args.finding, args.otherLoopholes, args.spans, args.purpose);
  const result = await callStructured('repair', {
    runId: args.runId,
    mode: args.mode,
    model: 'reasoning',
    schema: RepairBatchOutput,
    system: SYSTEM_REPAIR,
    prompt,
  });

  if (!result.ok) return [];

  return result.data.proposals.filter((p) => groundRepair(p, args.spans).ok);
}
