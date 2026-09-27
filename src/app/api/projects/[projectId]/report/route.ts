import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { projects } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { loadReportData } from '@/server/report-data';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, 'read');

    const row = await db.query.projects.findFirst({ where: eq(projects.id, project.id) });
    if (!row) throw new NotFoundError(`project '${projectId}' not found`);

    const data = await loadReportData(row.slug);
    return NextResponse.json(data);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
