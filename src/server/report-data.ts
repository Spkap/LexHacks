import { desc, eq, inArray } from 'drizzle-orm';
import type { AttackProposal, PurposeContract } from '@/core/contracts';
import { isLoophole } from '@/core/verdict';
import { db } from '@/db/client';
import { attackCandidates, findings, purposeContracts, repairs, runs, sources } from '@/db/schema';
import { getProjectBySlug } from './projects';
import { NotFoundError } from './errors';
import { requireProjectAccess } from './workspace';

export interface ReportData {
  project: { id: string; slug: string; name: string; isPublic: boolean };
  source: { id: string; sha256: string; title: string; canonicalUrl: string } | null;
  purpose: { id: string; version: number; status: string; contract: PurposeContract } | null;
  findings: { id: string; candidateId: string; tactic: string | null; verdict: string; hash: string }[];
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

  const projectRuns = await db.query.runs.findMany({ where: eq(runs.projectId, project.id) });
  const runIds = projectRuns.map((r) => r.id);

  const relevantCandidates = runIds.length > 0 ? await db.query.attackCandidates.findMany({ where: inArray(attackCandidates.runId, runIds) }) : [];
  const candidateIds = relevantCandidates.map((c) => c.id);

  const relevantFindings = candidateIds.length > 0 ? await db.query.findings.findMany({ where: inArray(findings.candidateId, candidateIds) }) : [];

  const findingSummaries = relevantFindings.map((row) => {
    const candidate = relevantCandidates.find((c) => c.id === row.candidateId);
    const proposal = row.proposal as AttackProposal;
    return { id: row.id, candidateId: row.candidateId, tactic: candidate?.tactic ?? proposal.tactic ?? null, verdict: row.verdict, hash: row.hash };
  });

  const findingIds = relevantFindings.filter((f) => isLoophole(f.verdict)).map((f) => f.id);
  const repairRows = findingIds.length > 0 ? await db.query.repairs.findMany({ where: inArray(repairs.findingId, findingIds) }) : [];

  return {
    project: { id: project.id, slug: project.slug, name: project.name, isPublic: project.isPublic },
    source: source ? { id: source.id, sha256: source.sha256, title: source.title, canonicalUrl: source.canonicalUrl } : null,
    purpose: purposeRow ? { id: purposeRow.id, version: purposeRow.version, status: purposeRow.status, contract: purposeRow.contract as PurposeContract } : null,
    findings: findingSummaries,
    repairs: repairRows,
    disclaimer: 'Research and drafting support. Not legal advice. Findings are AI-reviewed, grounded in quoted text, and require human judgment.',
  };
}
