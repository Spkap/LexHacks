import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { Candidate, Tactic, type Formalization, type PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { formalizations, purposeContracts } from '@/db/schema';
import { runAttackPipeline } from '@/server/attack-run';
import { GateError } from '@/core/engine';
import { NotFoundError, toHttpError } from '@/server/errors';
import { runExecutor, type Emit } from '@/server/runs';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({
  mode: z.enum(['demo', 'live']).default('live'),
  tactics: z.array(Tactic).min(1).max(9),
  budgetPerTactic: z.number().int().min(1).max(4),
  solverSearch: z.boolean().default(false),
});

function loadDemoCandidates(): Candidate[] {
  const path = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018', 'candidates.original.json');
  const file = JSON.parse(readFileSync(path, 'utf8')) as { candidates: unknown[] };
  return file.candidates.map((c) => Candidate.parse(c));
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, 'write');

    const json = await request.json();
    const body = Body.parse(json);

    const formalizationRow = await db.query.formalizations.findFirst({
      where: eq(formalizations.projectId, project.id),
      orderBy: desc(formalizations.version),
    });
    if (!formalizationRow) throw new NotFoundError('project has no formalization to attack');
    if (formalizationRow.status !== 'locked') {
      throw new GateError('FORMALIZATION_NOT_APPROVED', ['formalization must be locked before attacking it']);
    }

    const purposeRow = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    if (!purposeRow || purposeRow.status !== 'approved') {
      throw new GateError('PURPOSE_NOT_APPROVED', ['purpose contract must be approved before attacking']);
    }

    const formalization = formalizationRow.ir as Formalization;
    const purpose = purposeRow.contract as PurposeContract;

    const inputHash = hashOf({
      formalizationId: formalizationRow.id,
      purposeId: purposeRow.id,
      tactics: [...body.tactics].sort(),
      budgetPerTactic: body.budgetPerTactic,
      solverSearch: body.solverSearch,
      mode: body.mode,
    });

    const demoRecordedCandidates = body.mode === 'demo' && project.demoTemplate === 'ccpa-2018' ? loadDemoCandidates() : undefined;

    const { runId, reused } = await runExecutor.start(
      { projectId: project.id, type: 'attack', mode: body.mode, inputHash },
      async (emit: Emit, runId: string) => {
        const summary = await runAttackPipeline(
          {
            formalizationId: formalizationRow.id,
            formalization,
            purpose,
            tactics: body.tactics,
            budgetPerTactic: body.budgetPerTactic,
            solverSearch: body.solverSearch,
            mode: body.mode,
            demoRecordedCandidates,
            runId,
          },
          emit,
        );
        return summary;
      },
    );

    return NextResponse.json({ runId, reused }, { status: 202 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
