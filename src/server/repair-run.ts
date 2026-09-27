import { generateRepairProposals } from '@/ai/repair';
import { retest, type RetestReport } from '@/core/engine';
import { applyIrPatch, validateFormalization, type Candidate, type Fixture, type Formalization, type PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { repairs } from '@/db/schema';
import type { Emit } from './runs';

export interface RepairRunInput {
  certificateId: string;
  baseFormalizationId: string;
  baseFormalization: Formalization;
  exploitCandidate: Candidate;
  purpose: PurposeContract;
  fixtures: Fixture[];
  certifiedCandidates: Candidate[];
  runId?: string;
  mode: 'demo' | 'live';
}

export interface ProposedRepair {
  repairId: string;
  title: string;
  valid: boolean;
  reasons: string[];
  score: RetestReport | null;
}

export async function runRepairPipeline(input: RepairRunInput, emit: Emit): Promise<ProposedRepair[]> {
  await emit('generating', { certificateId: input.certificateId });

  const proposals = await generateRepairProposals({
    baseFormalization: input.baseFormalization,
    candidate: input.exploitCandidate,
    purpose: input.purpose,
    fixtures: input.fixtures,
    runId: input.runId,
    mode: input.mode,
  });

  const results: ProposedRepair[] = [];

  for (const proposal of proposals) {
    const nextIr = applyIrPatch(input.baseFormalization, proposal.irPatch);
    const validation = validateFormalization(nextIr);

    let score: RetestReport | null = null;
    if (validation.ok) {
      score = await retest(nextIr, input.purpose, input.certifiedCandidates, input.fixtures);
    }

    const [row] = await db
      .insert(repairs)
      .values({
        certificateId: input.certificateId,
        baseFormalizationId: input.baseFormalizationId,
        redline: { ...proposal, score, validationReasons: validation.ok ? null : validation.reasons },
        status: 'proposed',
      })
      .returning();

    const summary: ProposedRepair = { repairId: row.id, title: proposal.title, valid: validation.ok, reasons: validation.ok ? [] : validation.reasons, score };
    results.push(summary);
    await emit('proposed', summary);
  }

  return results;
}
