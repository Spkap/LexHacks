import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import type { PurposeContract, Span } from '@/core/contracts';
import { db } from '@/db/client';
import { purposeContracts, repairs, sourceSpans, sources } from '@/db/schema';
import { runRetestPipeline, type RetestSummary } from '@/server/retest-run';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { runExecutor, type Emit } from '@/server/runs';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ mode: z.enum(['demo', 'live']).default('live') });

const RetestFile = z.object({
  placeholder: z.boolean().default(false),
  result: z.object({
    pass: z.boolean(),
    loopholesBefore: z.number(),
    loopholesAfter: z.number(),
    legitKept: z.number(),
    legitTotal: z.number(),
  }),
});

function loadDemoRetest(): RetestSummary {
  const path = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018', 'reattack.recorded.json');
  return RetestFile.parse(JSON.parse(readFileSync(path, 'utf8'))).result;
}

export async function POST(request: Request, { params }: { params: Promise<{ repairId: string }> }) {
  try {
    const { repairId } = await params;
    parseUuidParam('repairId', repairId);

    const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, repairId) });
    if (!repairRow) throw new NotFoundError(`repair '${repairId}' not found`);
    if (repairRow.status !== 'approved' || !repairRow.repairedSourceId) {
      return NextResponse.json({ error: 'invalid_state', message: 'repair must be approved before retesting' }, { status: 409 });
    }

    const patchedSource = await db.query.sources.findFirst({ where: eq(sources.id, repairRow.repairedSourceId) });
    if (!patchedSource) throw new NotFoundError('repair references a missing repaired source');

    const { project, workspaceId } = await requireProjectAccess(patchedSource.projectId, 'write');

    const limit = rateLimit(`retest-run:${workspaceId ?? project.id}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many retest runs this hour');

    const json = await request.json().catch(() => ({}));
    const body = Body.parse(json);

    const purposeRow = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    if (!purposeRow) throw new NotFoundError('project has no purpose contract');

    const patchedSpans: Span[] = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, patchedSource.id) });

    const inputHash = hashOf({ repairId, mode: body.mode });

    const useDemoFixtures = body.mode === 'demo' && project.demoTemplate === 'ccpa-2018';
    const demoResult = useDemoFixtures ? loadDemoRetest() : undefined;

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'retest', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        return runRetestPipeline(
          {
            baseSourceId: repairRow.baseSourceId,
            patchedSourceId: patchedSource.id,
            patchedSpans,
            purpose: purposeRow.contract as PurposeContract,
            purposeHash: purposeRow.hash,
            patchedSourceSha: patchedSource.sha256,
            mode: body.mode,
            runId,
            demoResult,
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
