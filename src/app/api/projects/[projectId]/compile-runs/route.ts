import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import type { Formalization } from '@/core/ir';
import { runDualExtraction } from '@/ai/extract';
import { db } from '@/db/client';
import { formalizations, sourceSpans, sources } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { runExecutor, type Emit } from '@/server/runs';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({
  spanIds: z.array(z.string()).max(20).optional(),
  mode: z.enum(['demo', 'live']).default('live'),
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, 'write');

    const json = await request.json().catch(() => ({}));
    const body = Body.parse(json);

    const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
    if (!source) throw new NotFoundError('project has no source to compile');

    const allSpans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });
    const spans = body.spanIds ? allSpans.filter((s) => body.spanIds!.includes(s.id)) : allSpans;
    if (spans.length === 0) throw new NotFoundError('no matching spans to compile');

    const latest = await db.query.formalizations.findFirst({
      where: eq(formalizations.projectId, project.id),
      orderBy: desc(formalizations.version),
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const inputHash = hashOf({ sourceId: source.id, spanIds: spans.map((s) => s.id).sort(), version: nextVersion });

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'compile', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        await emit('extracting', { spanCount: spans.length });
        const extraction = await runDualExtraction(spans, { runId, mode: body.mode });
        await emit('reconciled', { disputeCount: extraction.disputes.length });

        const ir: Formalization = {
          id: latest?.ir ? (latest.ir as Formalization).id : `LHP-${project.slug}`,
          version: nextVersion,
          sourceId: source.id,
          vars: extraction.vars,
          definitions: extraction.definitions,
          rules: extraction.rules,
        };

        const [row] = await db
          .insert(formalizations)
          .values({
            projectId: project.id,
            sourceId: source.id,
            version: nextVersion,
            parentId: latest?.id,
            status: 'draft',
            ir,
            irHash: hashOf(ir),
          })
          .returning();

        await logAudit({ projectId: project.id, actor: 'ai-pipeline', action: 'compile', entityType: 'formalization', entityId: row.id });
        await emit('done', { formalizationId: row.id, disputes: extraction.disputes });
        return { formalizationId: row.id, disputes: extraction.disputes };
      },
    );

    return NextResponse.json({ runId, reused }, { status: 202 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
