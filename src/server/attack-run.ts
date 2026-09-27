import { hashOf } from '@/core/canonical';
import { buildCertificate } from '@/core/certificate';
import { certify, enumerateCounterexamples, pick, type SolveStatus } from '@/core/engine';
import { validateCandidate, type Candidate, type Formalization, type PurposeContract, type Tactic } from '@/core/ir';
import { getSolverVersion } from '@/core/z3';
import { generateAttackBatch } from '@/ai/attack';
import { explainCertificate } from '@/ai/explain';
import { db } from '@/db/client';
import { attackCandidates, certificates } from '@/db/schema';
import type { Emit } from './runs';

export interface AttackRunInput {
  formalizationId: string;
  formalization: Formalization;
  purpose: PurposeContract;
  tactics: Tactic[];
  budgetPerTactic: number;
  solverSearch: boolean;
  mode: 'demo' | 'live';
  demoRecordedCandidates?: Candidate[];
  runId?: string;
}

export interface AttackRunSummary {
  generated: number;
  invalid: number;
  rejected: number;
  inconclusive: number;
  certified: number;
}

const DEMO_STAGE_DELAY_MS = 250;
const SOLVER_SEARCH_LIMIT = 5;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAttackPipeline(input: AttackRunInput, emit: Emit): Promise<AttackRunSummary> {
  const seenFamilies = new Set<string>();
  const summary: AttackRunSummary = { generated: 0, invalid: 0, rejected: 0, inconclusive: 0, certified: 0 };
  const solverVersion = getSolverVersion();

  async function processCandidate(candidate: Candidate): Promise<void> {
    summary.generated += 1;
    await emit('generated', { candidate });

    const validation = validateCandidate(input.formalization, candidate);
    if (!validation.ok) {
      summary.invalid += 1;
      await emit('invalid', { candidateId: candidate.id, reasons: validation.reasons });
      if (input.runId) {
        await db.insert(attackCandidates).values({ runId: input.runId, tactic: candidate.tactic, candidate, status: 'invalid', reasons: validation.reasons });
      }
      return;
    }

    const familyKey = hashOf(pick(candidate.pins, candidate.familyKeys));
    if (seenFamilies.has(familyKey)) {
      await emit('deduped', { candidateId: candidate.id });
      return;
    }
    seenFamilies.add(familyKey);

    await emit('solving', { candidateId: candidate.id });
    const result = await certify(input.formalization, input.purpose, candidate);

    const statusCounts: Record<'certified' | 'rejected' | 'inconclusive', keyof AttackRunSummary> = {
      certified: 'certified',
      rejected: 'rejected',
      inconclusive: 'inconclusive',
    };
    summary[statusCounts[result.status]] += 1;

    let candidateRowId: string | undefined;
    if (input.runId) {
      const [row] = await db
        .insert(attackCandidates)
        .values({ runId: input.runId, tactic: candidate.tactic, candidate, status: result.status })
        .returning();
      candidateRowId = row.id;
    }

    if (result.status === 'certified' && candidateRowId && result.model) {
      const invariant = input.purpose.invariants.find((i) => i.id === candidate.targetInvariantId);
      if (!invariant) throw new Error(`certified candidate '${candidate.id}' cites unknown invariant '${candidate.targetInvariantId}'`);

      const certificate = buildCertificate({
        candidateId: candidateRowId,
        formalizationHash: hashOf(input.formalization),
        invariantHash: hashOf(invariant),
        candidateHash: hashOf(candidate),
        result: result.result as SolveStatus,
        model: result.model,
        smtlib: result.smtlib,
        solverVersion,
        elapsedMs: result.elapsedMs,
      });

      const explanation = await explainCertificate(input.formalization, result.model, invariant, { runId: input.runId, mode: input.mode });

      const [certRow] = await db
        .insert(certificates)
        .values({
          candidateId: candidateRowId,
          formalizationId: input.formalizationId,
          result: certificate.result,
          model: certificate.model,
          smtlib: certificate.smtlib,
          elapsedMs: Math.round(certificate.elapsedMs),
          solverVersion: certificate.solverVersion,
          formalizationHash: certificate.formalizationHash,
          invariantHash: certificate.invariantHash,
          candidateHash: certificate.candidateHash,
          inputHash: certificate.inputHash,
          hash: certificate.hash,
          explanation,
        })
        .returning();
      await emit('certified', { candidateId: candidate.id, certificateId: certRow.id, model: result.model, explanation });
    } else {
      await emit(result.status, { candidateId: candidate.id, reasons: [] });
    }
  }

  if (input.mode === 'demo' && input.demoRecordedCandidates) {
    for (const candidate of input.demoRecordedCandidates) {
      await processCandidate(candidate);
      await sleep(DEMO_STAGE_DELAY_MS);
    }
  } else {
    for (const tactic of input.tactics) {
      const batch = await generateAttackBatch({
        formalization: input.formalization,
        purpose: input.purpose,
        tactic,
        budget: input.budgetPerTactic,
        runId: input.runId,
        mode: input.mode,
      });
      for (const candidate of batch) await processCandidate(candidate);
    }
  }

  if (input.solverSearch) {
    const allVarNames = input.formalization.vars.map((v) => v.name);
    for (const invariant of input.purpose.invariants) {
      const models = await enumerateCounterexamples(input.formalization, input.purpose, invariant.id, allVarNames, SOLVER_SEARCH_LIMIT);
      for (let i = 0; i < models.length; i += 1) {
        const model = models[i];
        const tactic: Tactic = model.consideration === 'none' ? 'no_consideration' : 'solver_found';
        const candidate: Candidate = {
          id: `solver-${invariant.id}-${i + 1}`,
          tactic,
          narrative: 'Found directly by the solver, without any AI narrative.',
          pins: model,
          familyKeys: allVarNames,
          citedRuleIds: [],
          targetInvariantId: invariant.id,
        };
        await processCandidate(candidate);
      }
    }
  }

  return summary;
}
