import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sourceSpans, sources } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; sourceId: string }> }) {
  try {
    const { projectId, sourceId } = await params;
    parseUuidParam('sourceId', sourceId);
    const { project } = await requireProjectAccess(projectId, 'read');

    const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
    if (!source || source.projectId !== project.id) throw new NotFoundError(`source '${sourceId}' not found in this project`);

    const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });

    return NextResponse.json({
      id: source.id,
      title: source.title,
      jurisdiction: source.jurisdiction,
      canonicalUrl: source.canonicalUrl,
      officialVersionId: source.officialVersionId,
      retrievedAt: source.retrievedAt,
      sha256: source.sha256,
      text: source.text,
      metadata: source.metadata,
      spans,
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
