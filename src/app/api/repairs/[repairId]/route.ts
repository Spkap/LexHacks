import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { RedlineEdit, applyIrPatch, validateFormalization, type Formalization } from '@/core/ir';
import { db } from '@/db/client';
import { formalizations, repairs } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.union([
  z.object({ approve: z.literal(true) }),
  z.object({
    title: z.string().max(200).optional(),
    redline: z.array(RedlineEdit).min(1).optional(),
    rationale: z.string().max(1000).optional(),
  }),
]);

async function resolveProjectId(repairRow: typeof repairs.$inferSelect): Promise<string> {
  const baseFormalization = await db.query.formalizations.findFirst({ where: eq(formalizations.id, repairRow.baseFormalizationId) });
  if (!baseFormalization) throw new NotFoundError('repair references a missing base formalization');
  return baseFormalization.projectId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ repairId: string }> }) {
  try {
    const { repairId } = await params;
    parseUuidParam('repairId', repairId);
    const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, repairId) });
    if (!repairRow) throw new NotFoundError(`repair '${repairId}' not found`);

    const projectId = await resolveProjectId(repairRow);
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const json = await request.json();
    const body = Body.parse(json);

    if ('approve' in body) {
      if (repairRow.status !== 'proposed') {
        return NextResponse.json({ error: 'invalid_state', message: `repair is already ${repairRow.status}` }, { status: 409 });
      }

      const base = await db.query.formalizations.findFirst({ where: eq(formalizations.id, repairRow.baseFormalizationId) });
      if (!base) throw new NotFoundError('repair references a missing base formalization');

      const proposal = repairRow.redline as { irPatch: Parameters<typeof applyIrPatch>[1] };
      const nextIr = applyIrPatch(base.ir as Formalization, proposal.irPatch);

      const validation = validateFormalization(nextIr);
      if (!validation.ok) {
        return NextResponse.json({ error: 'invalid_formalization', reasons: validation.reasons }, { status: 400 });
      }

      const [newFormalization] = await db
        .insert(formalizations)
        .values({
          projectId: project.id,
          sourceId: base.sourceId,
          version: base.version + 1,
          parentId: base.id,
          status: 'draft',
          ir: nextIr,
          irHash: hashOf(nextIr),
          schemaVersion: base.schemaVersion,
        })
        .returning();

      const [updatedRepair] = await db
        .update(repairs)
        .set({ status: 'approved', repairedFormalizationId: newFormalization.id })
        .where(eq(repairs.id, repairId))
        .returning();

      await logAudit({
        projectId: project.id,
        actor: workspaceId ?? 'public',
        action: 'approve',
        entityType: 'repair',
        entityId: repairId,
        metadata: { repairedFormalizationId: newFormalization.id },
      });

      return NextResponse.json({ repair: updatedRepair, formalization: newFormalization });
    }

    if (repairRow.status !== 'proposed') {
      return NextResponse.json({ error: 'invalid_state', message: `cannot edit a repair that is already ${repairRow.status}` }, { status: 409 });
    }

    const current = repairRow.redline as { title: string; redline: unknown; irPatch: unknown; rationale: string };
    const merged = {
      title: body.title ?? current.title,
      redline: body.redline ?? current.redline,
      irPatch: current.irPatch,
      rationale: body.rationale ?? current.rationale,
    };

    const [updated] = await db.update(repairs).set({ redline: merged }).where(eq(repairs.id, repairId)).returning();

    await logAudit({ projectId: project.id, actor: workspaceId ?? 'public', action: 'edit', entityType: 'repair', entityId: repairId });

    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
