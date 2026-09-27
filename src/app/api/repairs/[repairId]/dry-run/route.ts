import { desc, eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isForbidden } from '@/ai/defense';
import { RedlineEdit, RepairProposal, type PurposeContract, type Span } from '@/core/contracts';
import { applyRedline } from '@/core/finding';
import { groundLegit, groundRepair } from '@/core/grounding';
import { db } from '@/db/client';
import { purposeContracts, repairs, sourceSpans, sources } from '@/db/schema';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RedlineArray = z.array(RedlineEdit).min(1).max(4);
const Body = z.object({ redline: RedlineArray.optional(), mode: z.enum(['demo', 'live']).default('live'), lazy: z.boolean().default(false) });

function loadRecordedLazyRedline() {
  const path = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018', 'repair.recorded.json');
  const fixture = z.object({ lazy: RepairProposal }).parse(JSON.parse(readFileSync(path, 'utf8')));
  return fixture.lazy.redline;
}

export async function POST(request: Request, { params }: { params: Promise<{ repairId: string }> }) {
  try {
    const { repairId } = await params;

    const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, repairId) });
    if (!repairRow) throw new NotFoundError(`repair '${repairId}' not found`);

    const baseSource = await db.query.sources.findFirst({ where: eq(sources.id, repairRow.baseSourceId) });
    if (!baseSource) throw new NotFoundError('repair references a missing base source');

    const { project, workspaceId } = await requireProjectAccess(baseSource.projectId, 'write');

    const limit = rateLimit(`dry-run:${workspaceId ?? project.id}`, 30, 3600);
    if (!limit.ok) throw new RateLimitError('too many dry runs this hour');

    const json = await request.json().catch(() => ({}));
    const body = Body.parse(json);

    const baseSpans: Span[] = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, baseSource.id) });
    const proposal = repairRow.redline as { title: string; redline: unknown; rationale: string };
    const redline = body.lazy && body.mode === 'demo' && project.demoTemplate === 'ccpa-2018'
      ? loadRecordedLazyRedline()
      : body.redline ?? RedlineArray.parse(proposal.redline);

    const check = groundRepair({ title: proposal.title, redline, rationale: proposal.rationale }, baseSpans);
    if (!check.ok) return NextResponse.json({ error: 'invalid_redline', reasons: check.reasons }, { status: 400 });

    const patchedSpans = applyRedline(baseSpans, redline);

    const purposeRow = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    if (!purposeRow) throw new NotFoundError('project has no purpose contract');
    const purpose = purposeRow.contract as PurposeContract;

    const results = await Promise.all(
      purpose.legitimateUses.map(async (use) => {
        const verdict = await isForbidden({ mode: body.mode, scenario: use.scenario, spans: patchedSpans });
        const grounded = verdict ? groundLegit(verdict, patchedSpans) : null;
        const status = grounded === null ? 'unclear' : grounded.forbidden ? 'forbidden' : 'allowed';
        return { id: use.id, status };
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
