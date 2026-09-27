import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { hashOf } from '../src/core/canonical';
import { PurposeContract } from '../src/core/contracts';
import { projects, purposeContracts, sources, sourceSpans, testFixtures } from '../src/db/schema';

config({ path: '.env.local' });

const SLUG = 'ccpa-2018-benchmark';
const DIR = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

interface SourceSpan {
  id: string;
  sectionPath: string;
  label: string;
  text: string;
}
interface SourceFile {
  id: string;
  title: string;
  jurisdiction: string;
  canonicalUrl: string;
  officialVersionId: string;
  retrievedAt: string;
  spans: SourceSpan[];
  sha256: string;
}

function assertNotPlaceholder(name: string): void {
  const file = readJson(name) as { placeholder?: boolean };
  if (file.placeholder && process.env.ALLOW_PLACEHOLDER !== '1') {
    throw new Error(`${name} is still a placeholder (no real Live run recorded yet). Set ALLOW_PLACEHOLDER=1 to seed anyway for local UI work.`);
  }
}

async function main() {
  assertNotPlaceholder('jury.recorded.json');
  assertNotPlaceholder('reattack.recorded.json');

  const { db } = await import('../src/db/client');
  const sourceFile = readJson('source.json') as SourceFile;
  const computedHash = hashOf(sourceFile.spans);
  if (computedHash !== sourceFile.sha256) {
    throw new Error(`source.json sha256 mismatch: file says ${sourceFile.sha256}, recomputed ${computedHash}`);
  }

  const purpose = PurposeContract.parse(readJson('purpose.json'));

  const existing = await db.query.projects.findFirst({ where: eq(projects.slug, SLUG) });
  if (existing) {
    const existingSource = await db.query.sources.findFirst({ where: eq(sources.projectId, existing.id) });
    if (existingSource && existingSource.sha256 === sourceFile.sha256) {
      console.log('already seeded (hash match)');
      process.exit(0);
    }
  }

  const [project] = existing
    ? [existing]
    : await db
        .insert(projects)
        .values({ workspaceId: null, slug: SLUG, name: 'CCPA 2018 Benchmark', isPublic: true, demoTemplate: 'ccpa-2018' })
        .returning();

  const [sourceRow] = await db
    .insert(sources)
    .values({
      projectId: project.id,
      title: sourceFile.title,
      jurisdiction: sourceFile.jurisdiction,
      canonicalUrl: sourceFile.canonicalUrl,
      officialVersionId: sourceFile.officialVersionId,
      retrievedAt: sourceFile.retrievedAt,
      sha256: sourceFile.sha256,
      text: sourceFile.spans.map((s) => s.text).join('\n\n'),
      metadata: {},
    })
    .returning();

  await db.insert(sourceSpans).values(
    sourceFile.spans.map((s) => ({
      sourceId: sourceRow.id,
      id: s.id,
      sectionPath: s.sectionPath,
      label: s.label,
      text: s.text,
    })),
  );

  await db.insert(purposeContracts).values({
    projectId: project.id,
    version: 1,
    status: 'approved',
    contract: purpose,
    hash: hashOf(purpose),
  });

  await db.insert(testFixtures).values(
    purpose.legitimateUses.map((u) => ({
      projectId: project.id,
      label: u.id,
      scenario: u.scenario,
    })),
  );

  console.log(`seeded project '${SLUG}' (${project.id}): ${sourceFile.spans.length} spans, ${purpose.legitimateUses.length} legitimate uses`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
