import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { sha256Hex } from '@/core/canonical';
import { db } from '@/db/client';
import { auditEvents, formalizations, projects, purposeContracts, sources, sourceSpans, testFixtures } from '@/db/schema';
import { logAudit } from './audit';
import { splitIntoSpans } from './paste-split';

const GOLDEN_SLUG = 'ccpa-2018-benchmark';
const MAX_PASTE_CHARS = 60000;

function uniqueSlug(base: string): string {
  return `${base}-${randomBytes(4).toString('hex')}`;
}

export async function getProjectBySlug(slug: string) {
  return db.query.projects.findFirst({ where: eq(projects.slug, slug) });
}

export const GOLDEN_PROJECT_SLUG = GOLDEN_SLUG;

export async function forkGoldenProject(workspaceId: string): Promise<{ projectId: string; slug: string }> {
  const [sourceRows, spanRows, purposeRows, formalizationRows, fixtureRows] = await db.batch([
    db.select({ goldenId: projects.id, source: sources })
      .from(sources)
      .innerJoin(projects, eq(sources.projectId, projects.id))
      .where(eq(projects.slug, GOLDEN_SLUG))
      .limit(1),
    db.select({ span: sourceSpans })
      .from(sourceSpans)
      .innerJoin(sources, eq(sourceSpans.sourceId, sources.id))
      .innerJoin(projects, eq(sources.projectId, projects.id))
      .where(eq(projects.slug, GOLDEN_SLUG)),
    db.select({ purpose: purposeContracts })
      .from(purposeContracts)
      .innerJoin(projects, eq(purposeContracts.projectId, projects.id))
      .where(eq(projects.slug, GOLDEN_SLUG))
      .limit(1),
    db.select({ formalization: formalizations })
      .from(formalizations)
      .innerJoin(projects, eq(formalizations.projectId, projects.id))
      .where(eq(projects.slug, GOLDEN_SLUG))
      .limit(1),
    db.select({ fixture: testFixtures })
      .from(testFixtures)
      .innerJoin(projects, eq(testFixtures.projectId, projects.id))
      .where(eq(projects.slug, GOLDEN_SLUG)),
  ]);
  const goldenSourceRow = sourceRows[0];
  if (!goldenSourceRow) throw new Error(`golden benchmark project '${GOLDEN_SLUG}' is not seeded`);

  const { goldenId, source: goldenSource } = goldenSourceRow;
  const goldenSpans = spanRows.map(({ span }) => span);
  const goldenPurpose = purposeRows[0]?.purpose;
  const goldenFormalization = formalizationRows[0]?.formalization;
  const goldenFixtures = fixtureRows.map(({ fixture }) => fixture);

  const projectId = randomUUID();
  const sourceId = randomUUID();
  const slug = uniqueSlug('ccpa-2018-fork');
  await db.batch([
    db.insert(projects).values({
      id: projectId,
      workspaceId,
      slug,
      name: 'CCPA 2018 (fork)',
      isPublic: false,
      demoTemplate: 'ccpa-2018',
      forkedFrom: goldenId,
    }),
    db.insert(sources).values({
      id: sourceId,
      projectId,
      title: goldenSource.title,
      jurisdiction: goldenSource.jurisdiction,
      canonicalUrl: goldenSource.canonicalUrl,
      officialVersionId: goldenSource.officialVersionId,
      retrievedAt: goldenSource.retrievedAt,
      sha256: goldenSource.sha256,
      text: goldenSource.text,
      metadata: goldenSource.metadata,
    }),
    ...(goldenSpans.length > 0
      ? [db.insert(sourceSpans).values(goldenSpans.map((s) => ({
        sourceId,
        id: s.id,
        sectionPath: s.sectionPath,
        label: s.label,
        text: s.text,
        startOffset: s.startOffset,
        endOffset: s.endOffset,
      })))]
      : []),
    ...(goldenPurpose
      ? [db.insert(purposeContracts).values({
        projectId,
        version: goldenPurpose.version,
        status: goldenPurpose.status,
        contract: goldenPurpose.contract,
        hash: goldenPurpose.hash,
      })]
      : []),
    ...(goldenFormalization
      ? [db.insert(formalizations).values({
        projectId,
        sourceId,
        version: goldenFormalization.version,
        status: goldenFormalization.status,
        ir: goldenFormalization.ir,
        irHash: goldenFormalization.irHash,
        schemaVersion: goldenFormalization.schemaVersion,
      })]
      : []),
    ...(goldenFixtures.length > 0
      ? [db.insert(testFixtures).values(goldenFixtures.map((f) => ({
        projectId,
        kind: f.kind,
        label: f.label,
        pins: f.pins,
        expect: f.expect,
      })))]
      : []),
    db.insert(auditEvents).values({
      projectId,
      actor: workspaceId,
      action: 'fork',
      entityType: 'project',
      entityId: projectId,
      metadata: { forkedFrom: goldenId },
    }),
  ]);

  return { projectId, slug };
}

export interface PasteInput {
  title: string;
  text: string;
  url?: string;
}

export async function createPasteProject(workspaceId: string, paste: PasteInput): Promise<{ projectId: string; slug: string }> {
  if (paste.text.length > MAX_PASTE_CHARS) {
    throw new Error(`pasted text exceeds ${MAX_PASTE_CHARS} characters`);
  }

  const slug = uniqueSlug('draft');
  const [project] = await db
    .insert(projects)
    .values({ workspaceId, slug, name: paste.title, isPublic: false, demoTemplate: null })
    .returning();

  const spans = splitIntoSpans(paste.text, paste.title);

  const [sourceRow] = await db
    .insert(sources)
    .values({
      projectId: project.id,
      title: paste.title,
      jurisdiction: 'unspecified',
      canonicalUrl: paste.url ?? '',
      officialVersionId: 'pasted-draft',
      retrievedAt: new Date().toISOString().slice(0, 10),
      sha256: sha256Hex(paste.text),
      text: paste.text,
      metadata: { sourceType: 'paste' },
    })
    .returning();

  await db.insert(sourceSpans).values(
    spans.map((s) => ({
      sourceId: sourceRow.id,
      id: s.id,
      sectionPath: s.sectionPath,
      label: s.label,
      text: s.text,
    })),
  );

  await logAudit({ projectId: project.id, actor: workspaceId, action: 'create', entityType: 'project', entityId: project.id, metadata: { via: 'paste' } });

  return { projectId: project.id, slug };
}
