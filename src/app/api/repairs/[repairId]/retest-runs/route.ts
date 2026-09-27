import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { retest } from '@/core/engine';
import { Candidate, Tactic, type Formalization, type PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { attackCandidates, certificates, formalizations, purposeContracts, repairs, testFixtures } from '@/db/schema';
import { runAttackPipeline } from '@/server/attack-run';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { runExecutor, type Emit } from '@/server/runs';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ freshAttackTactics: z.array(Tactic).max(9).default([]) });

export async function POST(request: Request, { params }: { params: Promise<{ repairId: string }> }) {
  try {
    const { repairId } = await params;
    parseUuidParam('repairId', repairId);

    const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, repairId) });
    if (!repairRow) throw new NotFoundError(`repair '${repairId}' not found`);
    if (repairRow.status !== 'approved' || !repairRow.repairedFormalizationId) {
      return NextResponse.json({ error: 'invalid_state', message: 'repair must be approved before retesting' }, { status: 409 });
    }

    const repairedFormalizationRow = await db.query.formalizations.findFirst({ where: eq(formalizations.id, repairRow.repairedFormalizationId) });
    if (!repairedFormalizationRow) throw new NotFoundError('repair references a missing repaired formalization');

    const { project, workspaceId } = await requireProjectAccess(repairedFormalizationRow.projectId, 'write');

    const limit = rateLimit(`retest-run:${workspaceId ?? project.id}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many retest runs this hour');

    const json = await request.json().catch(() => ({}));
    const body = Body.parse(json);

    const baseFormalizationRow = await db.query.formalizations.findFirst({ where: eq(formalizations.id, repairRow.baseFormalizationId) });
    if (!baseFormalizationRow) throw new NotFoundError('repair references a missing base formalization');

    const purposeRow = await db.query.purposeContracts.findFirst({ where: eq(purposeContracts.projectId, project.id) });
    if (!purposeRow) throw new NotFoundError('project has no purpose contract');
    const purpose = purposeRow.contract as PurposeContract;

    const fixtureRows = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, project.id) });
    const fixtures = fixtureRows.map((f) => ({ id: f.id, kind: f.kind, label: f.label, pins: f.pins as Record<string, boolean | number | string>, expect: f.expect }));

    const baseCerts = await db.query.certificates.findMany({ where: eq(certificates.formalizationId, baseFormalizationRow.id) });
    const certifiedCandidateRows = await Promise.all(
      baseCerts.map((c) => db.query.attackCandidates.findFirst({ where: eq(attackCandidates.id, c.candidateId) })),
    );
    const certifiedCandidates = certifiedCandidateRows.filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => Candidate.parse(c.candidate));

    const inputHash = hashOf({ repairId, freshAttackTactics: [...body.freshAttackTactics].sort() });

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'retest', mode: 'live', inputHash },
      async (emit: Emit, runId: string) => {
        const repairedIr = repairedFormalizationRow.ir as Formalization;
        const retestReport = await retest(repairedIr, purpose, certifiedCandidates, fixtures);
        await emit('retested', retestReport);

        let freshAttackSummary = null;
        if (body.freshAttackTactics.length > 0) {
          freshAttackSummary = await runAttackPipeline(
            {
              formalizationId: repairedFormalizationRow.id,
              formalization: repairedIr,
              purpose,
              tactics: body.freshAttackTactics,
              budgetPerTactic: 2,
              solverSearch: true,
              mode: 'live',
              runId,
            },
            emit,
          );
        }

        return { retestReport, freshAttackSummary };
      },
    );

    return NextResponse.json({ runId, reused }, { status: 202 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
