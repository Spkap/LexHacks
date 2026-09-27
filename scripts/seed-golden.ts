import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { hashOf } from '../src/core/canonical';
import { certify } from '../src/core/engine';
import { Candidate, Fixture, Formalization, PurposeContract, validateFormalization } from '../src/core/ir';
import { getSolverVersion } from '../src/core/z3';
import { buildCertificate } from '../src/core/certificate';
import {
  attackCandidates,
  certificates,
  formalizations,
  projects,
  purposeContracts,
  runs,
  sources,
  sourceSpans,
  testFixtures,
} from '../src/db/schema';

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

async function main() {
  const { db } = await import('../src/db/client');
  const sourceFile = readJson('source.json') as SourceFile;
  const computedHash = hashOf(sourceFile.spans);
  if (computedHash !== sourceFile.sha256) {
    throw new Error(`source.json sha256 mismatch: file says ${sourceFile.sha256}, recomputed ${computedHash}`);
  }

  const original = Formalization.parse(readJson('formalization.original.json'));
  const purpose = PurposeContract.parse(readJson('purpose.json'));
  const fixturesFile = (readJson('fixtures.json') as unknown[]).map((f) => Fixture.parse(f));
  const candidatesFile = readJson('candidates.original.json') as { candidates: unknown[] };
  const candidates = candidatesFile.candidates.map((c) => Candidate.parse(c));

  const validation = validateFormalization(original);
  if (!validation.ok) throw new Error(`golden formalization invalid: ${validation.reasons.join('; ')}`);

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
    version: purpose.version,
    status: 'approved',
    contract: purpose,
    hash: hashOf(purpose),
  });

  const [formalizationRow] = await db
    .insert(formalizations)
    .values({
      projectId: project.id,
      sourceId: sourceRow.id,
      version: original.version,
      status: 'locked',
      ir: original,
      irHash: hashOf(original),
    })
    .returning();

  await db.insert(testFixtures).values(
    fixturesFile.map((f) => ({
      projectId: project.id,
      kind: f.kind,
      label: f.label,
      pins: f.pins,
      expect: f.expect,
    })),
  );

  const inputHash = hashOf({ formalizationId: formalizationRow.id, candidates });
  const [runRow] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      type: 'attack',
      mode: 'demo',
      status: 'succeeded',
      inputHash,
      startedAt: new Date(),
      finishedAt: new Date(),
    })
    .returning();

  const solverVersion = getSolverVersion();
  let certifiedCount = 0;
  for (const candidate of candidates) {
    const result = await certify(original, purpose, candidate);
    const [candidateRow] = await db
      .insert(attackCandidates)
      .values({
        runId: runRow.id,
        tactic: candidate.tactic,
        candidate,
        status: result.status,
      })
      .returning();

    if (result.status === 'certified') {
      certifiedCount += 1;
      const certificate = buildCertificate({
        candidateId: candidateRow.id,
        formalizationHash: hashOf(original),
        invariantHash: hashOf(purpose.invariants.find((i) => i.id === candidate.targetInvariantId)),
        candidateHash: hashOf(candidate),
        result: result.result,
        model: result.model ?? null,
        smtlib: result.smtlib,
        solverVersion,
        elapsedMs: result.elapsedMs,
      });
      await db.insert(certificates).values({
        candidateId: candidateRow.id,
        formalizationId: formalizationRow.id,
        result: certificate.result,
        model: certificate.model,
        smtlib: certificate.smtlib,
        elapsedMs: Math.round(certificate.elapsedMs),
        solverVersion: certificate.solverVersion,
        formalizationHash: certificate.formalizationHash,
        invariantHash: certificate.invariantHash,
        candidateHash: certificate.candidateHash,
        inputHash: certificate.inputHash,
        hash: certificate.hash,
      });
    }
  }

  console.log(`seeded project '${SLUG}' (${project.id}): ${candidates.length} candidates, ${certifiedCount} certified`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
