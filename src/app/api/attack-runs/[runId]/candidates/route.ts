import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attackCandidates, certificates, runs } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    parseUuidParam('runId', runId);

    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (!run) throw new NotFoundError(`run '${runId}' not found`);

    await requireProjectAccess(run.projectId, 'read');

    const candidates = await db.query.attackCandidates.findMany({ where: eq(attackCandidates.runId, runId) });
    const candidateIds = candidates.map((c) => c.id);
    const certRows =
      candidateIds.length > 0 ? await db.query.certificates.findMany({ where: inArray(certificates.candidateId, candidateIds) }) : [];
    const certByCandidateId = new Map(certRows.map((c) => [c.candidateId, c]));

    return NextResponse.json({
      runId,
      status: run.status,
      candidates: candidates.map((c) => ({
        id: c.id,
        tactic: c.tactic,
        candidate: c.candidate,
        status: c.status,
        reasons: c.reasons,
        certificateId: certByCandidateId.get(c.id)?.id ?? null,
      })),
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
