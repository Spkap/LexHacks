import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { effectiveStatus } from '@/core/verdict';
import { db } from '@/db/client';
import { findingRulings, findings, sources } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ ruling: z.enum(['loophole', 'no_loophole']), note: z.string().max(280).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ findingId: string }> }) {
  try {
    const { findingId } = await params;
    parseUuidParam('findingId', findingId);

    const finding = await db.query.findings.findFirst({ where: eq(findings.id, findingId) });
    if (!finding) throw new NotFoundError(`finding '${findingId}' not found`);

    const source = await db.query.sources.findFirst({ where: eq(sources.id, finding.sourceId) });
    if (!source) throw new NotFoundError('finding references a missing source');

    const { workspaceId } = await requireProjectAccess(source.projectId, 'write');
    if (!workspaceId) throw new NotFoundError('workspace required to rule on a finding');

    const json = await request.json();
    const { ruling, note } = Body.parse(json);

    await db.insert(findingRulings).values({ findingId, workspaceId, ruling, note });

    await logAudit({ projectId: source.projectId, actor: workspaceId, action: 'finding.ruled', entityType: 'finding', entityId: findingId, metadata: { ruling } });

    const rulingRows = await db.query.findingRulings.findMany({ where: eq(findingRulings.findingId, findingId) });
    const status = effectiveStatus(finding.verdict, rulingRows.map((r) => ({ ruling: r.ruling, createdAt: r.createdAt })));

    return NextResponse.json({ effectiveStatus: status });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
