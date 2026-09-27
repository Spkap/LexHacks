import { desc, eq } from 'drizzle-orm';
import type { Formalization, PurposeContract } from '@/core/ir';
import { db } from '@/db/client';
import { formalizations, purposeContracts, sources, testFixtures } from '@/db/schema';
import { getProjectBySlug } from './projects';
import { NotFoundError } from './errors';
import { requireProjectAccess } from './workspace';

export async function loadProjectPageData(slug: string) {
  const found = await getProjectBySlug(slug);
  if (!found) throw new NotFoundError(`project '${slug}' not found`);

  const { project } = await requireProjectAccess(found.id, 'read');

  const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
  const purposeRow = await db.query.purposeContracts.findFirst({
    where: eq(purposeContracts.projectId, project.id),
    orderBy: desc(purposeContracts.version),
  });
  const formalizationRow = await db.query.formalizations.findFirst({
    where: eq(formalizations.projectId, project.id),
    orderBy: desc(formalizations.version),
  });
  const fixtures = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, project.id) });

  return {
    project,
    source,
    purposeRow,
    purpose: purposeRow?.contract as PurposeContract | undefined,
    formalizationRow,
    formalization: formalizationRow?.ir as Formalization | undefined,
    fixtures,
  };
}

export function completedStages(data: Awaited<ReturnType<typeof loadProjectPageData>>): string[] {
  const stages: string[] = [];
  if (data.source) stages.push('source');
  if (data.purposeRow?.status === 'approved') stages.push('purpose');
  if (data.formalizationRow?.status === 'locked') stages.push('compile');
  return stages;
}
