import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { runs } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (!run) throw new NotFoundError(`run '${runId}' not found`);
    return NextResponse.json(run);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
