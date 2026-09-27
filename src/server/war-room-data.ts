import { and, desc, eq, inArray } from 'drizzle-orm';
import type { EffectiveStatus, PurposeContract, Span } from '@/core/contracts';
import { effectiveStatus } from '@/core/verdict';
import { db } from '@/db/client';
import { attackCandidates, findingRulings, findings, purposeContracts, repairs, runs, sourceSpans, sources } from '@/db/schema';
import { getProjectBySlug } from './projects';
import { NotFoundError } from './errors';
import { requireProjectAccess } from './workspace';

export async function loadWarRoomData(slug: string) {
  const found = await getProjectBySlug(slug);
  if (!found) throw new NotFoundError(`project '${slug}' not found`);

  const { project } = await requireProjectAccess(found.id, 'read');

  const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
  const spans: Span[] = source ? await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) }) : [];

  const purposeRow = await db.query.purposeContracts.findFirst({
    where: eq(purposeContracts.projectId, project.id),
    orderBy: desc(purposeContracts.version),
  });
  const purpose = purposeRow?.contract as PurposeContract | undefined;

  let latestAttack: { runId: string; candidates: (typeof attackCandidates.$inferSelect)[]; findings: Array<typeof findings.$inferSelect & { effectiveStatus: EffectiveStatus }> } | null = null;
  if (source) {
    const attackRun = await db.query.runs.findFirst({
      where: and(eq(runs.projectId, project.id), eq(runs.type, 'attack')),
      orderBy: desc(runs.startedAt),
    });
    if (attackRun) {
      const candidates = await db.query.attackCandidates.findMany({ where: eq(attackCandidates.runId, attackRun.id) });
      const candidateIds = candidates.map((c) => c.id);
      const findingRows = candidateIds.length > 0 ? await db.query.findings.findMany({ where: inArray(findings.candidateId, candidateIds) }) : [];
      const findingsWithStatus = await Promise.all(
        findingRows.map(async (f) => {
          const rulingRows = await db.query.findingRulings.findMany({ where: eq(findingRulings.findingId, f.id) });
          return { ...f, effectiveStatus: effectiveStatus(f.verdict, rulingRows.map((r) => ({ ruling: r.ruling, createdAt: r.createdAt }))) };
        }),
      );
      latestAttack = { runId: attackRun.id, candidates, findings: findingsWithStatus };
    }
  }

  const latestRepair = source
    ? await db.query.repairs.findFirst({ where: eq(repairs.baseSourceId, source.id), orderBy: desc(repairs.createdAt) })
    : null;

  const latestRetest = latestRepair
    ? await db.query.runs.findFirst({ where: and(eq(runs.projectId, project.id), eq(runs.type, 'retest')), orderBy: desc(runs.startedAt) })
    : null;

  return { project, source, spans, purpose, latestAttack, latestRepair, latestRetest };
}
