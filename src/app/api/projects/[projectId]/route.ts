import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attackCandidates, findings, purposeContracts, runs, sources } from '@/db/schema';
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

    const lastRuns = await db.query.runs.findMany({
      where: eq(runs.projectId, project.id),
      orderBy: desc(runs.startedAt),
      limit: 5,
    });

    const runIds = lastRuns.map((r) => r.id);
    const findingCounts = { confirmed: 0, blocked: 0, harmless: 0, contested: 0 };
    if (runIds.length > 0) {
      const rows = await db.query.attackCandidates.findMany({ where: inArray(attackCandidates.runId, runIds) });
      const candidateIds = rows.map((r) => r.id);
      const findingRows = candidateIds.length > 0 ? await db.query.findings.findMany({ where: inArray(findings.candidateId, candidateIds) }) : [];
      for (const f of findingRows) findingCounts[f.verdict] += 1;
    }

    return NextResponse.json({
      project: { id: project.id, slug: project.slug, name: project.name, isPublic: project.isPublic },
      source: source ? { id: source.id, sha256: source.sha256, title: source.title, canonicalUrl: source.canonicalUrl } : null,
      purpose: purpose ? { id: purpose.id, version: purpose.version, status: purpose.status, contract: purpose.contract } : null,
      findingCounts,
      lastRuns,
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
