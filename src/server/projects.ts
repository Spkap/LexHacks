import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { sha256Hex } from '@/core/canonical';
import { db } from '@/db/client';
import { projects, sources, sourceSpans } from '@/db/schema';
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
  const projectId = randomUUID();
  const sourceId = randomUUID();
  const slug = uniqueSlug('ccpa-2018-fork');
  const result = await db.execute<{ projectId: string; slug: string }>(sql`
    with golden as (
      select projects.id as golden_id, sources.*
      from projects
      inner join sources on sources.project_id = projects.id
      where projects.slug = ${GOLDEN_SLUG}
      limit 1
    ),
    new_project as (
      insert into projects (id, workspace_id, slug, name, is_public, demo_template, forked_from)
      select ${projectId}::uuid, ${workspaceId}::uuid, ${slug}, 'CCPA 2018 (fork)', false, 'ccpa-2018', golden_id
      from golden
      returning id, slug
    ),
    new_source as (
      insert into sources (id, project_id, title, jurisdiction, canonical_url, official_version_id, retrieved_at, sha256, text, metadata)
      select ${sourceId}::uuid, new_project.id, golden.title, golden.jurisdiction, golden.canonical_url,
        golden.official_version_id, golden.retrieved_at, golden.sha256, golden.text, golden.metadata
      from golden
      cross join new_project
      returning id
    ),
    copied_spans as (
      insert into source_spans (source_id, id, section_path, label, text, start_offset, end_offset)
      select new_source.id, source_spans.id, source_spans.section_path, source_spans.label, source_spans.text,
        source_spans.start_offset, source_spans.end_offset
      from source_spans
      inner join golden on source_spans.source_id = golden.id
      cross join new_source
    ),
    copied_purpose as (
      insert into purpose_contracts (project_id, version, status, contract, hash)
      select new_project.id, purpose_contracts.version, purpose_contracts.status, purpose_contracts.contract, purpose_contracts.hash
      from purpose_contracts
      inner join golden on purpose_contracts.project_id = golden.golden_id
      cross join new_project
    ),
    copied_fixtures as (
      insert into test_fixtures (project_id, label, scenario)
      select new_project.id, test_fixtures.label, test_fixtures.scenario
      from test_fixtures
      inner join golden on test_fixtures.project_id = golden.golden_id
      cross join new_project
    ),
    audit as (
      insert into audit_events (project_id, actor, action, entity_type, entity_id, metadata)
      select new_project.id, ${workspaceId}, 'fork', 'project', ${projectId}, jsonb_build_object('forkedFrom', golden.golden_id)
      from golden
      cross join new_project
    )
    select id as "projectId", slug from new_project
  `);
  const fork = result.rows[0];
  if (!fork) throw new Error(`golden benchmark project '${GOLDEN_SLUG}' is not seeded`);
  return fork;
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
