import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { AttackProposal, RepairProposal, type PurposeContract } from '@/core/contracts';
import { isLoophole } from '@/core/verdict';
import { db } from '@/db/client';
import { findings, purposeContracts, sourceSpans } from '@/db/schema';
import { runRepairPipeline } from '@/server/repair-run';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { runExecutor, type Emit } from '@/server/runs';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ findingId: z.string().uuid(), mode: z.enum(['demo', 'live']).default('live') });

const RepairFile = z.object({ proposals: z.array(RepairProposal) });

function loadDemoRepairProposals(): RepairProposal[] {
  const path = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018', 'repair.recorded.json');
  return RepairFile.parse(JSON.parse(readFileSync(path, 'utf8'))).proposals;
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const limit = rateLimit(`repair-run:${workspaceId ?? projectId}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many repair runs this hour');

    const json = await request.json();
    const body = Body.parse(json);

    const findingRow = await db.query.findings.findFirst({ where: eq(findings.id, body.findingId) });
    if (!findingRow) throw new NotFoundError(`finding '${body.findingId}' not found`);

    const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, findingRow.sourceId) });

    const purposeRow = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    if (!purposeRow) throw new NotFoundError('project has no purpose contract');

    const siblingFindings = await db.query.findings.findMany({ where: eq(findings.sourceId, findingRow.sourceId) });
    const otherLoopholes = siblingFindings
      .filter((f) => f.id !== findingRow.id && isLoophole(f.verdict))
      .map((f) => ({ proposal: f.proposal as AttackProposal }));

    const inputHash = hashOf({ findingId: body.findingId, mode: body.mode });

    const useDemoFixtures = body.mode === 'demo' && project.demoTemplate === 'ccpa-2018';
    const demoProposals = useDemoFixtures ? loadDemoRepairProposals() : undefined;

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'repair', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        return runRepairPipeline(
          {
            findingId: findingRow.id,
            finding: { proposal: findingRow.proposal as AttackProposal },
            otherLoopholes,
            spans,
            purpose: purposeRow.contract as PurposeContract,
            baseSourceId: findingRow.sourceId,
            mode: body.mode,
            demoProposals,
            runId,
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
