import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { suggestPurpose } from '@/ai/purpose';
import { db } from '@/db/client';
import { sourceSpans, sources } from '@/db/schema';
import { NotFoundError, RateLimitError, toHttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const limit = rateLimit(`purpose-suggestion:${workspaceId ?? projectId}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many purpose suggestions this hour');

    const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
    if (!source) throw new NotFoundError('project has no source to draft a purpose for');

    const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });

    const suggestion = await suggestPurpose({ mode: 'live', spans });
    if (!suggestion) return NextResponse.json({ error: 'suggestion_failed', message: 'could not draft a purpose from this source' }, { status: 502 });

    return NextResponse.json(suggestion);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
