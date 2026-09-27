import { desc, eq, inArray } from 'drizzle-orm';
import { verifyCertificate, type Certificate } from '@/core/certificate';
import type { SolveStatus } from '@/core/engine';
import { db } from '@/db/client';
import { attackCandidates, certificates, formalizations, purposeContracts, repairs, runs, sources, testFixtures } from '@/db/schema';
import { getProjectBySlug } from './projects';
import { NotFoundError } from './errors';
import { requireProjectAccess } from './workspace';

export interface ReportData {
  project: { id: string; slug: string; name: string; isPublic: boolean };
  source: { id: string; sha256: string; title: string; canonicalUrl: string } | null;
  purpose: { id: string; version: number; status: string; contract: unknown } | null;
  formalizations: { id: string; version: number; status: string; irHash: string }[];
  fixtures: { id: string; kind: string; label: string; expect: string }[];
  certificates: { id: string; candidateId: string; tactic: string | null; result: string; hash: string; verified: boolean }[];
  repairs: (typeof repairs.$inferSelect)[];
  disclaimer: string;
}

export async function loadReportData(slug: string): Promise<ReportData> {
  const found = await getProjectBySlug(slug);
  if (!found) throw new NotFoundError(`project '${slug}' not found`);

  const { project } = await requireProjectAccess(found.id, 'read');

  const source = await db.query.sources.findFirst({ where: eq(sources.projectId, project.id), orderBy: desc(sources.createdAt) });
  const purposeRow = await db.query.purposeContracts.findFirst({
    where: eq(purposeContracts.projectId, project.id),
    orderBy: desc(purposeContracts.version),
  });
  const formalizationVersions = await db.query.formalizations.findMany({
    where: eq(formalizations.projectId, project.id),
    orderBy: desc(formalizations.version),
  });
  const fixtures = await db.query.testFixtures.findMany({ where: eq(testFixtures.projectId, project.id) });

  const projectRuns = await db.query.runs.findMany({ where: eq(runs.projectId, project.id) });
  const runIds = projectRuns.map((r) => r.id);

  const relevantCandidates = runIds.length > 0 ? await db.query.attackCandidates.findMany({ where: inArray(attackCandidates.runId, runIds) }) : [];
  const candidateIds = relevantCandidates.map((c) => c.id);

  const relevantCerts = candidateIds.length > 0 ? await db.query.certificates.findMany({ where: inArray(certificates.candidateId, candidateIds) }) : [];

  const certificateSummaries = relevantCerts.map((row) => {
    const certificate: Certificate = {
      candidateId: row.candidateId,
      formalizationHash: row.formalizationHash,
      invariantHash: row.invariantHash,
      candidateHash: row.candidateHash,
      result: row.result as SolveStatus,
      model: row.model as Certificate['model'],
      smtlib: row.smtlib,
      solverVersion: row.solverVersion,
      elapsedMs: row.elapsedMs,
      inputHash: row.inputHash,
      hash: row.hash,
    };
    const candidate = relevantCandidates.find((c) => c.id === row.candidateId);
    return {
      id: row.id,
      candidateId: row.candidateId,
      tactic: candidate?.tactic ?? null,
      result: row.result,
      hash: row.hash,
      verified: verifyCertificate(certificate),
    };
  });

  const certificateIds = certificateSummaries.map((c) => c.id);
  const repairRows = certificateIds.length > 0 ? await db.query.repairs.findMany({ where: inArray(repairs.certificateId, certificateIds) }) : [];

  return {
    project: { id: project.id, slug: project.slug, name: project.name, isPublic: project.isPublic },
    source: source ? { id: source.id, sha256: source.sha256, title: source.title, canonicalUrl: source.canonicalUrl } : null,
    purpose: purposeRow ? { id: purposeRow.id, version: purposeRow.version, status: purposeRow.status, contract: purposeRow.contract } : null,
    formalizations: formalizationVersions.map((f) => ({ id: f.id, version: f.version, status: f.status, irHash: f.irHash })),
    fixtures: fixtures.map((f) => ({ id: f.id, kind: f.kind, label: f.label, expect: f.expect })),
    certificates: certificateSummaries,
    repairs: repairRows,
    disclaimer: 'Research and drafting support. Not legal advice. Certificates apply only to the displayed formal model.',
  };
}
