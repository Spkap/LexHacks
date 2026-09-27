import { eq } from 'drizzle-orm';
import { generateAttack } from '@/ai/attack';
import { judgeScheme } from '@/ai/defense';
import { LANES, type AttackProposal, type CandidateStatus, type DefenseVote, type Lane, type PurposeContract, type Span } from '@/core/contracts';
import { findingHash } from '@/core/finding';
import { groundProposal, groundVote } from '@/core/grounding';
import { decideVerdict } from '@/core/verdict';
import { db } from '@/db/client';
import { attackCandidates, findings } from '@/db/schema';
import type { Emit } from './runs';

export interface DemoCandidate {
  label: string;
  proposal: AttackProposal;
}

export interface AttackRunInput {
  sourceId: string;
  sourceSha: string;
  purposeHash: string;
  spans: Span[];
  purpose: PurposeContract;
  k: number;
  mode: 'demo' | 'live';
  demoCandidates?: DemoCandidate[];
  demoVotes?: Record<string, DefenseVote[]>;
  runId?: string;
}

export interface AttackRunSummary {
  schemes: number;
  ungrounded: number;
  blocked: number;
  harmless: number;
  contested: number;
  confirmed: number;
}

const DEMO_VOTE_DELAY_MS = 250;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function spansById(spans: Span[]): Map<string, Span> {
  return new Map(spans.map((s) => [s.id, s]));
}

export async function runAttackPipeline(input: AttackRunInput, emit: Emit): Promise<AttackRunSummary> {
  const summary: AttackRunSummary = { schemes: 0, ungrounded: 0, blocked: 0, harmless: 0, contested: 0, confirmed: 0 };
  const byId = spansById(input.spans);

  async function processProposal(proposal: AttackProposal, label: string | undefined, recordedVotes?: DefenseVote[]): Promise<void> {
    summary.schemes += 1;
    const candidateId = crypto.randomUUID();
    if (input.runId) {
      await db.insert(attackCandidates).values({
        id: candidateId,
        runId: input.runId,
        tactic: proposal.tactic,
        candidate: proposal,
        status: 'generated',
        label,
        sourceId: input.sourceId,
      });
    }
    await emit('candidate.proposed', { stage: 'candidate.proposed', candidateId, label, proposal });

    const grounding = groundProposal(proposal, input.spans);
    if (!grounding.ok) {
      summary.ungrounded += 1;
      if (input.runId) {
        await db.update(attackCandidates).set({ status: 'ungrounded', reasons: grounding.reasons }).where(eq(attackCandidates.id, candidateId));
      }
      await emit('candidate.ungrounded', { stage: 'candidate.ungrounded', candidateId, reasons: grounding.reasons });
      return;
    }

    const spanIds = [...new Set(proposal.quotes.map((q) => q.spanId))];
    await emit('candidate.grounded', { stage: 'candidate.grounded', candidateId, spanIds });

    const citedSpans = spanIds.map((id) => byId.get(id)).filter((s): s is Span => Boolean(s));

    let votes: DefenseVote[];
    if (recordedVotes) {
      votes = recordedVotes.map((v) => groundVote(v, citedSpans));
      for (const vote of votes) {
        await emit('jury.vote', { stage: 'jury.vote', candidateId, vote });
        await sleep(DEMO_VOTE_DELAY_MS);
      }
    } else {
      const rawVotes = await judgeScheme({
        runId: input.runId,
        mode: input.mode,
        scenario: proposal.scenario,
        spans: citedSpans,
        purpose: input.purpose,
      });
      votes = rawVotes.map((v) => groundVote(v, citedSpans));
      for (const vote of votes) {
        await emit('jury.vote', { stage: 'jury.vote', candidateId, vote });
      }
    }

    const verdict = decideVerdict(votes);
    summary[verdict] += 1;

    let findingId: string | undefined;
    if (input.runId) {
      const hash = findingHash({ sourceSha: input.sourceSha, purposeHash: input.purposeHash, proposal, votes });
      const [row] = await db
        .insert(findings)
        .values({ candidateId, sourceId: input.sourceId, proposal, votes, verdict, hash })
        .returning();
      findingId = row.id;
      await db.update(attackCandidates).set({ status: verdict }).where(eq(attackCandidates.id, candidateId));
    }

    const status: CandidateStatus = verdict;
    await emit('candidate.verdict', { stage: 'candidate.verdict', candidateId, findingId: findingId ?? '', status });
  }

  if (input.demoCandidates) {
    for (const { label, proposal } of input.demoCandidates) {
      await processProposal(proposal, label, input.demoVotes?.[label]);
    }
  } else {
    await Promise.all(
      LANES.map(async (lane: Lane) => {
        const proposals = await generateAttack({ runId: input.runId, mode: input.mode, spans: input.spans, purpose: input.purpose, lane, k: input.k });
        for (const proposal of proposals) await processProposal(proposal, undefined);
      }),
    );
  }

  await emit('run.summary', { stage: 'run.summary', counts: summary as unknown as Record<string, number> });
  return summary;
}
