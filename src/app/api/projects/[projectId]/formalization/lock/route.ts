import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { checkFixture } from '@/core/engine';
import { validateFormalization, type Fixture, type Formalization } from '@/core/ir';
import { db } from '@/db/client';
import { formalizations, testFixtures } from '@/db/schema';
import { logAudit } from '@/server/audit';
import { NotFoundError, toHttpError } from '@/server/errors';
import { requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { project, workspaceId } = await requireProjectAccess(projectId, 'write');

    const latest = await db.query.formalizations.findFirst({
      where: eq(formalizations.projectId, project.id),
      orderBy: desc(formalizations.version),
    });
    if (!latest) throw new NotFoundError('no formalization exists for this project yet');
    if (latest.status === 'locked') {
      return NextResponse.json(latest);
    }

    const ir = latest.ir as Formalization;

    const validation = validateFormalization(ir);
    if (!validation.ok) {
      return NextResponse.json({ error: 'invalid_formalization', reasons: validation.reasons }, { status: 400 });
    }

    const unreviewed = [
      ...ir.rules.filter((r) => r.status !== 'approved').map((r) => `rule '${r.id}' is ${r.status}`),
      ...ir.definitions.filter((d) => d.status !== 'approved').map((d) => `definition '${d.name}' is ${d.status}`),
    ];
    if (unreviewed.length > 0) {
      return NextResponse.json({ error: 'not_fully_reviewed', reasons: unreviewed }, { status: 409 });
    }

    const fixtures = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, project.id) });
    const failures: string[] = [];
    for (const row of fixtures) {
      const fixture: Fixture = { id: row.id, kind: row.kind, label: row.label, pins: row.pins as Fixture['pins'], expect: row.expect };
      const result = await checkFixture(ir, fixture);
      if (!result.pass) failures.push(`fixture '${fixture.id}' (${fixture.label}) expected ${fixture.expect}, got ${result.result}`);
    }
    if (failures.length > 0) {
      return NextResponse.json({ error: 'fixtures_failed', reasons: failures }, { status: 409 });
    }

    const [row] = await db.update(formalizations).set({ status: 'locked' }).where(eq(formalizations.id, latest.id)).returning();

    await logAudit({
      projectId: project.id,
      actor: workspaceId ?? 'public',
      action: 'lock',
      entityType: 'formalization',
      entityId: row.id,
      metadata: { version: row.version },
    });

    return NextResponse.json(row);
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
