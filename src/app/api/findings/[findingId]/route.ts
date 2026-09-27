import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { AttackProposal, DefenseVote } from '@/core/contracts';
import { verifyFinding } from '@/core/finding';
import { groundProposal } from '@/core/grounding';
import { effectiveStatus } from '@/core/verdict';
import { db } from '@/db/client';
import { findingRulings, findings, purposeContracts, sourceSpans, sources } from '@/db/schema';
import { NotFoundError, toHttpError } from '@/server/errors';
import { parseUuidParam, requireProjectAccess } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ findingId: string }> }) {
  try {
    const { findingId } = await params;
    parseUuidParam('findingId', findingId);

    const finding = await db.query.findings.findFirst({ where: eq(findings.id, findingId) });
    if (!finding) throw new NotFoundError(`finding '${findingId}' not found`);

    const source = await db.query.sources.findFirst({ where: eq(sources.id, finding.sourceId) });
    if (!source) throw new NotFoundError('finding references a missing source');

    await requireProjectAccess(source.projectId, 'read');

    const purpose = await db.query.purposeContracts.findFirst({
      where: eq(purposeContracts.projectId, source.projectId),
      orderBy: desc(purposeContracts.version),
    });

    const verified = purpose ? verifyFinding({ sourceSha: source.sha256, purposeHash: purpose.hash, proposal: finding.proposal, votes: finding.votes, hash: finding.hash }) : false;

    const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });
    const grounded = groundProposal(finding.proposal as AttackProposal, spans);

    const rulingRows = await db.query.findingRulings.findMany({ where: eq(findingRulings.findingId, findingId), orderBy: desc(findingRulings.createdAt) });

    return NextResponse.json({
      finding: {
        id: finding.id,
        proposal: finding.proposal as AttackProposal,
        votes: finding.votes as DefenseVote[],
        verdict: finding.verdict,
        hash: finding.hash,
      },
      rulings: rulingRows,
      effectiveStatus: effectiveStatus(finding.verdict, rulingRows.map((r) => ({ ruling: r.ruling, createdAt: r.createdAt }))),
      verified,
      grounded: grounded.ok,
    });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
