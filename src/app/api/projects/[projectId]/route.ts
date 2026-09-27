import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { Formalization } from '@/core/ir';
import { db } from '@/db/client';
import { attackCandidates, certificates, formalizations, purposeContracts, runs, sources } from '@/db/schema';
import { toHttpError } from '@/server/errors';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, 'read');

    const source = await db.query.sources.findFirst({
      where: eq(sources.projectId, project.id),
      orderBy: desc(sources.createdAt),
    });

    const purpose = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });

    const formalization = await db.query.formalizations.findFirst({
      where: eq(formalizations.projectId, project.id),
      orderBy: desc(formalizations.version),
    });

    const ruleCounts = { approved: 0, disputed: 0, proposed: 0, total: 0 };
    const definitionCounts = { approved: 0, disputed: 0, proposed: 0, total: 0 };
    if (formalization) {
      const ir = formalization.ir as Formalization;
      for (const r of ir.rules) {
        ruleCounts[r.status] += 1;
        ruleCounts.total += 1;
      }
      for (const d of ir.definitions) {
        definitionCounts[d.status] += 1;
        definitionCounts.total += 1;
      }
    }

    const certificateRows = await db
      .select({ id: certificates.id, result: certificates.result, hash: certificates.hash })
      .from(certificates)
      .innerJoin(attackCandidates, eq(certificates.candidateId, attackCandidates.id))
      .innerJoin(runs, eq(attackCandidates.runId, runs.id))
      .where(eq(runs.projectId, project.id));

    const lastRuns = await db.query.runs.findMany({
      where: eq(runs.projectId, project.id),
      orderBy: desc(runs.startedAt),
      limit: 5,
    });

    return NextResponse.json({
      project: { id: project.id, slug: project.slug, name: project.name, isPublic: project.isPublic },
      source: source ? { id: source.id, sha256: source.sha256, title: source.title, canonicalUrl: source.canonicalUrl } : null,
      purpose: purpose ? { id: purpose.id, version: purpose.version, status: purpose.status } : null,
      formalization: formalization
        ? { id: formalization.id, version: formalization.version, status: formalization.status, ruleCounts, definitionCounts }
        : null,
      certificates: certificateRows,
      lastRuns,
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
