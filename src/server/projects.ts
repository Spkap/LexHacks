import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { sha256Hex } from '@/core/canonical';
import { db } from '@/db/client';
import { formalizations, projects, purposeContracts, sources, sourceSpans, testFixtures } from '@/db/schema';
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
  const golden = await db.query.projects.findFirst({ where: eq(projects.slug, GOLDEN_SLUG) });
  if (!golden) throw new Error(`golden benchmark project '${GOLDEN_SLUG}' is not seeded`);

  const goldenSource = await db.query.sources.findFirst({ where: eq(sources.projectId, golden.id) });
  if (!goldenSource) throw new Error('golden benchmark project has no source');
  const goldenSpans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, goldenSource.id) });

  const goldenPurpose = await db.query.purposeContracts.findFirst({ where: eq(purposeContracts.projectId, golden.id) });
  const goldenFormalization = await db.query.formalizations.findFirst({ where: eq(formalizations.projectId, golden.id) });
  const goldenFixtures = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, golden.id) });

  const slug = uniqueSlug('ccpa-2018-fork');
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId,
      slug,
      name: 'CCPA 2018 (fork)',
      isPublic: false,
      demoTemplate: 'ccpa-2018',
      forkedFrom: golden.id,
    })
    .returning();

  const [source] = await db
    .insert(sources)
    .values({
      projectId: project.id,
      title: goldenSource.title,
      jurisdiction: goldenSource.jurisdiction,
      canonicalUrl: goldenSource.canonicalUrl,
      officialVersionId: goldenSource.officialVersionId,
      retrievedAt: goldenSource.retrievedAt,
      sha256: goldenSource.sha256,
      text: goldenSource.text,
      metadata: goldenSource.metadata,
    })
    .returning();

  if (goldenSpans.length > 0) {
    await db.insert(sourceSpans).values(
      goldenSpans.map((s) => ({
        sourceId: source.id,
        id: s.id,
        sectionPath: s.sectionPath,
        label: s.label,
        text: s.text,
        startOffset: s.startOffset,
        endOffset: s.endOffset,
      })),
    );
  }

  if (goldenPurpose) {
    await db.insert(purposeContracts).values({
      projectId: project.id,
      version: goldenPurpose.version,
      status: goldenPurpose.status,
      contract: goldenPurpose.contract,
      hash: goldenPurpose.hash,
    });
  }

  if (goldenFormalization) {
    await db.insert(formalizations).values({
      projectId: project.id,
      sourceId: source.id,
      version: goldenFormalization.version,
      status: goldenFormalization.status,
      ir: goldenFormalization.ir,
      irHash: goldenFormalization.irHash,
      schemaVersion: goldenFormalization.schemaVersion,
    });
  }

  if (goldenFixtures.length > 0) {
    await db.insert(testFixtures).values(
      goldenFixtures.map((f) => ({
        projectId: project.id,
        kind: f.kind,
        label: f.label,
        pins: f.pins,
        expect: f.expect,
      })),
    );
  }

  await logAudit({ projectId: project.id, actor: workspaceId, action: 'fork', entityType: 'project', entityId: project.id, metadata: { forkedFrom: golden.id } });

  return { projectId: project.id, slug };
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
