import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { Formula, ReviewStatus, validateFormalization, type Formalization } from '@/core/ir';
import { db } from '@/db/client';
import { formalizations } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    status: ReviewStatus.optional(),
    when: Formula.optional(),
    require: Formula.optional(),
    label: z.string().max(200).optional(),
  })
  .refine((b) => b.status !== undefined || b.when !== undefined || b.require !== undefined || b.label !== undefined, {
    message: 'at least one of status, when, require, label must be provided',
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; ruleId: string }> }) {
  try {
    const { projectId, ruleId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const json = await request.json();
    const patch = Body.parse(json);

    const latest = await db.query.formalizations.findFirst({
      where: eq(formalizations.projectId, project.id),
      orderBy: desc(formalizations.version),
    });
    if (!latest) throw new NotFoundError('no formalization exists for this project yet');

    const ir = latest.ir as Formalization;
    const ruleIndex = ir.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) throw new NotFoundError(`rule '${ruleId}' not found`);

    const nextIr: Formalization = {
      ...ir,
      rules: ir.rules.map((r, i) =>
        i === ruleIndex
          ? {
              ...r,
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.when !== undefined ? { when: patch.when } : {}),
              ...(patch.require !== undefined ? { require: patch.require } : {}),
              ...(patch.label !== undefined ? { label: patch.label } : {}),
            }
          : r,
      ),
    };

    const validation = validateFormalization(nextIr);
    if (!validation.ok) {
      return NextResponse.json({ error: 'invalid_formalization', reasons: validation.reasons }, { status: 400 });
    }

    const [row] = await db
      .insert(formalizations)
      .values({
        projectId: project.id,
        sourceId: latest.sourceId,
        version: latest.version + 1,
        parentId: latest.id,
        status: 'draft',
        ir: nextIr,
        irHash: hashOf(nextIr),
        schemaVersion: latest.schemaVersion,
      })
      .returning();

    await logAudit({
      projectId: project.id,
      actor: workspaceId ?? 'public',
      action: 'edit_rule',
      entityType: 'formalization',
      entityId: row.id,
      metadata: { ruleId, patch },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
