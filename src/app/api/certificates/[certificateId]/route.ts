import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { verifyCertificate, type Certificate } from '@/core/certificate';
import type { SolveStatus } from '@/core/engine';
import { db } from '@/db/client';
import { attackCandidates, certificates, runs } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ certificateId: string }> }) {
  try {
    const { certificateId } = await params;

    const row = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
    if (!row) throw new NotFoundError(`certificate '${certificateId}' not found`);

    const candidate = await db.query.attackCandidates.findFirst({ where: eq(attackCandidates.id, row.candidateId) });
    if (!candidate) throw new NotFoundError('certificate references a missing candidate');
    const run = await db.query.runs.findFirst({ where: eq(runs.id, candidate.runId) });
    if (!run) throw new NotFoundError('certificate references a missing run');

    await requireProjectAccess(run.projectId, 'read');

    const certificate: Certificate = {
      candidateId: row.candidateId,
      formalizationHash: row.formalizationHash,
      invariantHash: row.invariantHash,
      candidateHash: row.candidateHash,
      result: row.result as SolveStatus,
      model: row.model as Certificate['model'],
      smtlib: row.smtlib,
      solverVersion: row.solverVersion,
      elapsedMs: row.elapsedMs,
      inputHash: row.inputHash,
      hash: row.hash,
    };

    const verified = verifyCertificate(certificate);

    return NextResponse.json({
      id: row.id,
      candidate: candidate.candidate,
      verified,
      certificate,
      explanation: row.explanation,
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
