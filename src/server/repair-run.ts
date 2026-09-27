import { proposeRepairs } from '@/ai/repair';
import type { AttackProposal, PurposeContract, RepairProposal, Span } from '@/core/contracts';
import { groundRepair } from '@/core/grounding';
import { db } from '@/db/client';
import { repairs } from '@/db/schema';
import type { Emit } from './runs';

export interface RepairRunInput {
  findingId: string;
  finding: { proposal: AttackProposal };
  otherLoopholes: { proposal: AttackProposal }[];
  spans: Span[];
  purpose: PurposeContract;
  baseSourceId: string;
  mode: 'demo' | 'live';
  demoProposals?: RepairProposal[];
  runId?: string;
}

export interface ProposedRepair {
  repairId: string;
  title: string;
  valid: boolean;
  reasons: string[];
}

export async function runRepairPipeline(input: RepairRunInput, emit: Emit): Promise<ProposedRepair[]> {
  const proposals =
    input.mode === 'demo' && input.demoProposals
      ? input.demoProposals
      : await proposeRepairs({
          runId: input.runId,
          mode: input.mode,
          finding: input.finding,
          otherLoopholes: input.otherLoopholes,
          spans: input.spans,
          purpose: input.purpose,
        });

  const results: ProposedRepair[] = [];

  for (const [index, proposal] of proposals.entries()) {
    const grounding = groundRepair(proposal, input.spans);
    const [row] = await db
      .insert(repairs)
      .values({ findingId: input.findingId, baseSourceId: input.baseSourceId, redline: proposal, status: 'proposed' })
      .returning();

    results.push({ repairId: row.id, title: proposal.title, valid: grounding.ok, reasons: grounding.ok ? [] : grounding.reasons });
    await emit('repair.proposal', { stage: 'repair.proposal', index, proposal });
  }

  return results;
}
