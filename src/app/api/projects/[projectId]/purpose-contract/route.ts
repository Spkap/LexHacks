import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashOf } from '@/core/canonical';
import { PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { purposeContracts } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { toHttpError } from '@/server/errors';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  contract: PurposeContract.omit({ id: true, version: true }),
  approved: z.boolean(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const json = await request.json();
    const { contract, approved } = Body.parse(json);

    const latest = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, project.id),
      orderBy: desc(purposeContracts.version),
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const fullContract = PurposeContract.parse({ id: randomUUID(), version: nextVersion, ...contract });

    const [row] = await db
      .insert(purposeContracts)
      .values({
        projectId: project.id,
        version: nextVersion,
        status: approved ? 'approved' : 'proposed',
        contract: fullContract,
        hash: hashOf(fullContract),
      })
      .returning();

    await logAudit({
      projectId: project.id,
      actor: workspaceId ?? 'public',
      action: approved ? 'approve' : 'propose',
      entityType: 'purpose_contract',
      entityId: row.id,
      metadata: { version: nextVersion },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
