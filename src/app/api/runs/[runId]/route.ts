import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { runs } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    parseUuidParam('runId', runId);
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (!run) throw new NotFoundError(`run '${runId}' not found`);
    await requireProjectAccess(run.projectId, 'read');
    return NextResponse.json(run);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
