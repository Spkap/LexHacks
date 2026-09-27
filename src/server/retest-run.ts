import { eq } from 'drizzle-orm';
import { isForbidden, judgeScheme } from '@/ai/defense';
import type { AttackProposal, PurposeContract, Span } from '@/core/contracts';
import type { CheckName } from '@/core/events';
import { groundLegit } from '@/core/grounding';
import { decideVerdict, effectiveStatus, isLoophole } from '@/core/verdict';
import { db } from '@/db/client';
import { findingRulings, findings } from '@/db/schema';
import { runAttackPipeline } from './attack-run';
import type { Emit } from './runs';

export interface RetestInput {
  baseSourceId: string;
  patchedSourceId: string;
  patchedSpans: Span[];
  purpose: PurposeContract;
  purposeHash: string;
  patchedSourceSha: string;
  mode: 'demo' | 'live';
  runId?: string;
  demoResult?: RetestSummary;
}

export interface CheckResult {
  pass: boolean;
  pending: number;
  detail: string;
}

export interface RetestSummary {
  pass: boolean;
  loopholesBefore: number;
  loopholesAfter: number;
  legitKept: number;
  legitTotal: number;
}

function spansFor(ids: string[], all: Span[]): Span[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Span => Boolean(s));
}

async function checkOldLoopholes(input: RetestInput, emit: Emit): Promise<{ check: CheckResult; loopholesBefore: number; loopholesAfter: number }> {
  const baseFindings = await db.query.findings.findMany({ where: eq(findings.sourceId, input.baseSourceId) });
  const rulingsByFinding = new Map<string, { ruling: 'loophole' | 'no_loophole'; createdAt: Date }[]>();
  for (const f of baseFindings) {
    const rows = await db.query.findingRulings.findMany({ where: eq(findingRulings.findingId, f.id) });
    rulingsByFinding.set(
      f.id,
      rows.map((r) => ({ ruling: r.ruling, createdAt: r.createdAt })),
    );
  }

  const loopholeFindings = baseFindings.filter((f) => isLoophole(effectiveStatus(f.verdict, rulingsByFinding.get(f.id) ?? [])));

  let stillLoophole = 0;
  let pending = 0;
  for (const f of loopholeFindings) {
    const proposal = f.proposal as AttackProposal;
    const spanIds = [...new Set(proposal.quotes.map((q) => q.spanId))];
    const patchedCited = spansFor(spanIds, input.patchedSpans);
    const votes = await judgeScheme({ runId: input.runId, mode: input.mode, scenario: proposal.scenario, spans: patchedCited, purpose: input.purpose });
    const verdict = decideVerdict(votes);
    const stillFound = isLoophole(verdict) || verdict === 'contested';
    if (isLoophole(verdict)) stillLoophole += 1;
    if (verdict === 'contested') pending += 1;
    await emit('check.item', { stage: 'check.item', check: 'old_loopholes' as CheckName, id: f.id, status: verdict, detail: stillFound ? 'still open' : 'blocked' });
  }

  const pass = stillLoophole === 0;
  const detail = `${loopholeFindings.length - stillLoophole}/${loopholeFindings.length} old loopholes closed`;
  await emit('check.done', { stage: 'check.done', check: 'old_loopholes', pass, pending, detail });
  return { check: { pass, pending, detail }, loopholesBefore: loopholeFindings.length, loopholesAfter: stillLoophole };
}

async function checkFreshAttack(input: RetestInput, emit: Emit): Promise<CheckResult> {
  const summary = await runAttackPipeline(
    {
      sourceId: input.patchedSourceId,
      sourceSha: input.patchedSourceSha,
      purposeHash: input.purposeHash,
      spans: input.patchedSpans,
      purpose: input.purpose,
      k: 1,
      mode: input.mode,
      runId: input.runId,
    },
    emit,
  );

  const pass = summary.confirmed === 0;
  const pending = summary.contested;
  const detail = `${summary.confirmed} confirmed, ${summary.contested} contested on the patched text`;
  await emit('check.done', { stage: 'check.done', check: 'fresh_attack', pass, pending, detail });
  return { pass, pending, detail };
}

async function checkLegitUses(input: RetestInput, emit: Emit): Promise<CheckResult & { kept: number; total: number }> {
  let forbidden = 0;
  let unclear = 0;
  const total = input.purpose.legitimateUses.length;
  for (const use of input.purpose.legitimateUses) {
    const verdict = await isForbidden({ runId: input.runId, mode: input.mode, scenario: use.scenario, spans: input.patchedSpans });
    const grounded = verdict ? groundLegit(verdict, input.patchedSpans) : null;
    const status: 'allowed' | 'forbidden' | 'unclear' = grounded === null ? 'unclear' : grounded.forbidden ? 'forbidden' : 'allowed';
    if (status === 'forbidden') forbidden += 1;
    if (status === 'unclear') unclear += 1;
    await emit('check.item', { stage: 'check.item', check: 'legit_uses', id: use.id, status, detail: grounded?.reasoning });
  }

  const kept = total - forbidden - unclear;
  const pass = forbidden === 0 && unclear === 0;
  const detail = `${kept}/${total} legitimate uses kept`;
  await emit('check.done', { stage: 'check.done', check: 'legit_uses', pass, pending: unclear, detail });
  return { pass, pending: unclear, detail, kept, total };
}

export async function runRetestPipeline(input: RetestInput, emit: Emit): Promise<RetestSummary> {
  if (input.mode === 'demo' && input.demoResult) {
    const { loopholesBefore, loopholesAfter, legitKept, legitTotal } = input.demoResult;
    await emit('check.done', {
      stage: 'check.done',
      check: 'old_loopholes',
      pass: loopholesAfter === 0,
      pending: 0,
      detail: `${loopholesBefore - loopholesAfter}/${loopholesBefore} old loopholes closed`,
    });
    await emit('check.done', {
      stage: 'check.done',
      check: 'fresh_attack',
      pass: input.demoResult.pass,
      pending: 0,
      detail: input.demoResult.pass ? '0 confirmed, 0 contested on the patched text' : 'recorded re-attack did not pass',
    });
    await emit('check.done', {
      stage: 'check.done',
      check: 'legit_uses',
      pass: legitKept === legitTotal,
      pending: 0,
      detail: `${legitKept}/${legitTotal} legitimate uses kept`,
    });
    await emit('run.summary', { stage: 'run.summary', counts: input.demoResult as unknown as Record<string, number> });
    return input.demoResult;
  }

  const [old, fresh, legit] = await Promise.all([checkOldLoopholes(input, emit), checkFreshAttack(input, emit), checkLegitUses(input, emit)]);

  const summary: RetestSummary = {
    pass: old.check.pass && fresh.pass && legit.pass,
    loopholesBefore: old.loopholesBefore,
    loopholesAfter: old.loopholesAfter,
    legitKept: legit.kept,
    legitTotal: legit.total,
  };

  await emit('run.summary', { stage: 'run.summary', counts: summary as unknown as Record<string, number> });
  return summary;
}
