import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sha256Hex } from '@/core/canonical';
import { RedlineEdit, type Span } from '@/core/contracts';
import { applyRedline } from '@/core/finding';
import { groundRepair } from '@/core/grounding';
import { db } from '@/db/client';
import { repairs, sourceSpans, sources } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RedlineArray = z.array(RedlineEdit).min(1).max(4);
const Body = z.object({ action: z.literal('approve'), redline: RedlineArray.optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ repairId: string }> }) {
  try {
    const { repairId } = await params;
    parseUuidParam('repairId', repairId);

    const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, repairId) });
    if (!repairRow) throw new NotFoundError(`repair '${repairId}' not found`);

    const baseSource = await db.query.sources.findFirst({ where: eq(sources.id, repairRow.baseSourceId) });
    if (!baseSource) throw new NotFoundError('repair references a missing base source');

    const { project, workspaceId } = await requireProjectAccess(baseSource.projectId, 'write');

    const json = await request.json();
    const body = Body.parse(json);

    if (repairRow.status !== 'proposed') {
      return NextResponse.json({ error: 'invalid_state', message: `repair is already ${repairRow.status}` }, { status: 409 });
    }

    const baseSpans: Span[] = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, baseSource.id) });
    const proposal = repairRow.redline as { title: string; redline: unknown; rationale: string };
    const redline = body.redline ?? RedlineArray.parse(proposal.redline);

    const check = groundRepair({ title: proposal.title, redline, rationale: proposal.rationale }, baseSpans);
    if (!check.ok) {
      return NextResponse.json({ error: 'invalid_redline', reasons: check.reasons }, { status: 400 });
    }

    const patchedSpans = applyRedline(baseSpans, redline);
    const newSourceId = randomUUID();
    const newSha = sha256Hex(patchedSpans.map((s) => `${s.id}:${s.text}`).join('\n'));

    const [newSource] = await db
      .insert(sources)
      .values({
        id: newSourceId,
        projectId: project.id,
        parentSourceId: baseSource.id,
        title: baseSource.title,
        jurisdiction: baseSource.jurisdiction,
        canonicalUrl: baseSource.canonicalUrl,
        officialVersionId: baseSource.officialVersionId,
        retrievedAt: baseSource.retrievedAt,
        sha256: newSha,
        text: patchedSpans.map((s) => s.text).join('\n\n'),
        metadata: { patched: true },
      })
      .returning();

    await db.insert(sourceSpans).values(
      patchedSpans.map((s) => ({ sourceId: newSourceId, id: s.id, sectionPath: s.sectionPath, label: s.label, text: s.text })),
    );

    const [updatedRepair] = await db
      .update(repairs)
      .set({ status: 'approved', repairedSourceId: newSourceId, redline: { ...proposal, redline } })
      .where(eq(repairs.id, repairId))
      .returning();

    await logAudit({
      projectId: project.id,
      actor: workspaceId ?? 'public',
      action: 'approve',
      entityType: 'repair',
      entityId: repairId,
      metadata: { repairedSourceId: newSourceId },
    });

    return NextResponse.json({ repair: updatedRepair, source: newSource });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
