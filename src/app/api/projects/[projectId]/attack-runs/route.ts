import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAttackPipeline, type DemoCandidate } from '@/server/attack-run';
import { AttackProposal, DefenseVote, type PurposeContract } from '@/core/contracts';
import { hashOf } from '@/core/canonical';
import { GateError } from '@/core/engine';
import { db } from '@/db/client';
import { purposeContracts, sourceSpans, sources } from '@/db/schema';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { runExecutor, type Emit } from '@/server/runs';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const K_PER_LANE = 2;

const Body = z.object({ mode: z.enum(['demo', 'live']).default('live') });

const GoldenCandidate = z.object({ label: z.string(), proposal: AttackProposal });
const GoldenCandidates = z.object({ candidates: z.array(GoldenCandidate) });
const GoldenJury = z.record(z.string(), z.array(DefenseVote));

function loadDemoFixtures(): { demoCandidates: DemoCandidate[]; demoVotes: Record<string, DefenseVote[]> } {
  const dir = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018');
  const candidatesFile = JSON.parse(readFileSync(join(dir, 'candidates.original.json'), 'utf8'));
  const juryFile = JSON.parse(readFileSync(join(dir, 'jury.recorded.json'), 'utf8'));
  const demoCandidates = GoldenCandidates.parse(candidatesFile).candidates;
  const demoVotes = GoldenJury.parse(juryFile.votes ?? {});
  return { demoCandidates, demoVotes };
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const limit = rateLimit(`attack-run:${workspaceId ?? projectId}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many attack runs this hour');

    const json = await request.json().catch(() => ({}));
    const body = Body.parse(json);

    const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
    if (!source) throw new NotFoundError('project has no source to attack');

    const purposeRow = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    if (!purposeRow || purposeRow.status !== 'approved') {
      throw new GateError('PURPOSE_NOT_APPROVED', ['purpose contract must be approved before attacking']);
    }
    const purpose = purposeRow.contract as PurposeContract;

    const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });

    const inputHash = hashOf({ sourceId: source.id, purposeId: purposeRow.id, mode: body.mode });

    const useDemoFixtures = body.mode === 'demo' && project.demoTemplate === 'ccpa-2018';
    const { demoCandidates, demoVotes } = useDemoFixtures ? loadDemoFixtures() : { demoCandidates: undefined, demoVotes: undefined };

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'attack', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        return runAttackPipeline(
          {
            sourceId: source.id,
            sourceSha: source.sha256,
            purposeHash: purposeRow.hash,
            spans,
            purpose,
            k: K_PER_LANE,
            mode: body.mode,
            demoCandidates,
            demoVotes,
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
