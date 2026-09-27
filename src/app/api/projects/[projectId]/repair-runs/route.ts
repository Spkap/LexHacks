import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { Candidate, type Formalization, type PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { attackCandidates, certificates, formalizations, purposeContracts, testFixtures } from '@/db/schema';
import { runRepairPipeline } from '@/server/repair-run';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { runExecutor, type Emit } from '@/server/runs';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ certificateId: z.string().uuid(), mode: z.enum(['demo', 'live']).default('live') });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const limit = rateLimit(`repair-run:${workspaceId ?? projectId}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many repair runs this hour');

    const json = await request.json();
    const body = Body.parse(json);

    const certificateRow = await db.query.certificates.findFirst({ where: eq(certificates.id, body.certificateId) });
    if (!certificateRow) throw new NotFoundError(`certificate '${body.certificateId}' not found`);

    const candidateRow = await db.query.attackCandidates.findFirst({ where: eq(attackCandidates.id, certificateRow.candidateId) });
    if (!candidateRow) throw new NotFoundError('certificate references a missing candidate');
    const exploitCandidate = Candidate.parse(candidateRow.candidate);

    const baseFormalizationRow = await db.query.formalizations.findFirst({ where: eq(formalizations.id, certificateRow.formalizationId) });
    if (!baseFormalizationRow) throw new NotFoundError('certificate references a missing formalization');
    if (baseFormalizationRow.projectId !== project.id) throw new NotFoundError('certificate does not belong to this project');

    const purposeRow = await db.query.purposeContracts.findFirst({ where: eq(purposeContracts.projectId, project.id) });
    if (!purposeRow) throw new NotFoundError('project has no purpose contract');

    const fixtureRows = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, project.id) });
    const fixtures = fixtureRows.map((f) => ({ id: f.id, kind: f.kind, label: f.label, pins: f.pins as Record<string, boolean | number | string>, expect: f.expect }));

    const sameBaseCerts = await db.query.certificates.findMany({ where: eq(certificates.formalizationId, baseFormalizationRow.id) });
    const certifiedCandidateRows = await Promise.all(
      sameBaseCerts.map((c) => db.query.attackCandidates.findFirst({ where: eq(attackCandidates.id, c.candidateId) })),
    );
    const certifiedCandidates = certifiedCandidateRows.filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => Candidate.parse(c.candidate));

    const inputHash = hashOf({ certificateId: body.certificateId });

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'repair', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        return runRepairPipeline(
          {
            certificateId: certificateRow.id,
            baseFormalizationId: baseFormalizationRow.id,
            baseFormalization: baseFormalizationRow.ir as Formalization,
            exploitCandidate,
            purpose: purposeRow.contract as PurposeContract,
            fixtures,
            certifiedCandidates,
            runId,
            mode: body.mode,
          },
          emit,
        );
      },
    );

    return NextResponse.json({ runId, reused }, { status: 202 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
