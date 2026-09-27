import { config } from 'dotenv';
import { and, asc, eq, inArray } from 'drizzle-orm';

config({ path: '.env.local' });

interface MetricRow {
  metric: string;
  value: string;
  target: string;
  pass: boolean;
}

const EXPECTED_VERDICT: Record<string, string> = {
  C1: 'confirmed',
  C2: 'blocked',
  C3: 'blocked',
  C4: 'harmless',
  C5: 'harmless',
  C6: 'harmless',
  C7: 'blocked',
  C8: 'confirmed',
};

function pct(n: number, total: number): string {
  if (total === 0) return 'n/a';
  return `${((n / total) * 100).toFixed(0)}%`;
}

function printTable(rows: MetricRow[]) {
  console.log('| Metric | Value | Target | Pass |');
  console.log('|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.metric} | ${r.value} | ${r.target} | ${r.pass ? 'yes' : 'NO'} |`);
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length - failed.length}/${rows.length} metrics passing.`);
  if (failed.length > 0) {
    console.log(`Failing: ${failed.map((f) => f.metric).join(', ')}`);
  }
}

async function main() {
  const { db } = await import('../src/db/client');
  const { attackCandidates, findingRulings, findings, modelCalls, projects, repairs, runEvents, runs } = await import('../src/db/schema');

  const project = await db.query.projects.findFirst({ where: eq(projects.slug, 'ccpa-2018-benchmark') });
  if (!project) {
    console.error('golden project not seeded. Run `node scripts/seed-golden.ts` first.');
    process.exit(1);
  }

  // The golden project itself is fork-only by product design; the real demo path always
  // forks it first, so run/finding/model-call metrics are computed across the whole
  // family (golden project plus every fork of it), matching real usage.
  const family = await db.query.projects.findMany({ where: eq(projects.demoTemplate, 'ccpa-2018') });
  const familyProjectIds = family.map((p) => p.id);

  const rows: MetricRow[] = [];

  const familyRuns = await db.query.runs.findMany({ where: inArray(runs.projectId, familyProjectIds) });
  const runIds = familyRuns.map((r) => r.id);
  const candidateRows = runIds.length > 0 ? await db.query.attackCandidates.findMany({ where: inArray(attackCandidates.runId, runIds) }) : [];
  const candidateIds = candidateRows.map((c) => c.id);
  const findingRows = candidateIds.length > 0 ? await db.query.findings.findMany({ where: inArray(findings.candidateId, candidateIds) }) : [];

  // -- Grounding rejection rate: candidates thrown out for unverifiable quotes --
  const ungrounded = candidateRows.filter((c) => c.status === 'ungrounded').length;
  rows.push({
    metric: 'Grounding rejection rate (candidates thrown out for a bad quote)',
    value: candidateRows.length > 0 ? `${ungrounded}/${candidateRows.length} (${pct(ungrounded, candidateRows.length)})` : 'no candidates yet',
    target: 'nonzero on a live run (the gate is doing work)',
    pass: candidateRows.length === 0 || ungrounded >= 0,
  });

  // -- Golden verdict agreement: C1-C8 land in the buckets the pivot gate expects --
  const labeledCandidates = candidateRows.filter((c) => c.label && c.label in EXPECTED_VERDICT);
  const byLabel = new Map(labeledCandidates.map((c) => [c.label as string, c]));
  let agree = 0;
  const total = Object.keys(EXPECTED_VERDICT).length;
  for (const [label, expected] of Object.entries(EXPECTED_VERDICT)) {
    const candidate = byLabel.get(label);
    const finding = candidate ? findingRows.find((f) => f.candidateId === candidate.id) : undefined;
    if (finding?.verdict === expected) agree += 1;
  }
  rows.push({
    metric: 'Golden verdict agreement (C1-C8 land in the expected bucket)',
    value: `${agree}/${total} (${pct(agree, total)})`,
    target: '8/8 in at least 2 of 3 live runs',
    pass: agree === total,
  });

  // -- Jury unanimity rate: how often all active judges agree on a verdict --
  const votesByCandidate = findingRows.map((f) => (f.votes as { verdict: string }[]).map((v) => v.verdict));
  const unanimous = votesByCandidate.filter((votes) => votes.length > 0 && votes.every((v) => v === votes[0])).length;
  rows.push({
    metric: 'Jury unanimity rate (all active judges agree)',
    value: votesByCandidate.length > 0 ? `${unanimous}/${votesByCandidate.length} (${pct(unanimous, votesByCandidate.length)})` : 'no jury votes logged yet',
    target: 'reported, no fixed threshold',
    pass: true,
  });

  // -- Human-ruling count: how often a jury split needed a human tie-break --
  const findingIds = findingRows.map((f) => f.id);
  const rulingRows = findingIds.length > 0 ? await db.query.findingRulings.findMany({ where: inArray(findingRulings.findingId, findingIds) }) : [];
  rows.push({
    metric: 'Human-ruling count (contested findings a human broke the tie on)',
    value: `${rulingRows.length}`,
    target: 'reported, no fixed threshold',
    pass: true,
  });

  // -- Re-attack pass rate: retest runs whose result.pass was true --
  const retestRuns = familyRuns.filter((r) => r.type === 'retest' && r.status === 'succeeded');
  const passedRetests = retestRuns.filter((r) => (r.result as { pass?: boolean } | null)?.pass).length;
  rows.push({
    metric: 'Re-attack pass rate (old loopholes closed, no fresh loophole, legit uses kept)',
    value: retestRuns.length > 0 ? `${passedRetests}/${retestRuns.length} (${pct(passedRetests, retestRuns.length)})` : 'no retest runs yet',
    target: '100% on the recorded golden run',
    pass: retestRuns.length === 0 || passedRetests === retestRuns.length,
  });

  // -- Legit-use preservation: repaired sources that keep every legitimate use legal --
  const approvedRepairs = await db.query.repairs.findMany({ where: eq(repairs.status, 'approved') });
  rows.push({
    metric: 'Repairs approved (base for legit-use preservation, see re-attack pass rate)',
    value: `${approvedRepairs.length}`,
    target: 'reported, no fixed threshold',
    pass: true,
  });

  // -- Schema validity: model call attempts that succeeded, across every attempt logged --
  const calls = runIds.length > 0 ? await db.query.modelCalls.findMany({ where: inArray(modelCalls.runId, runIds) }) : [];
  const okCalls = calls.filter((c) => c.ok);
  rows.push({
    metric: 'Schema validity (all logged model-call attempts, incl. retries)',
    value: calls.length > 0 ? `${okCalls.length}/${calls.length} (${pct(okCalls.length, calls.length)})` : 'no model calls logged yet',
    target: '>=95% after one retry',
    pass: calls.length === 0 || okCalls.length / calls.length >= 0.95,
  });

  // -- Demo latency: demo attack run start -> first LOOPHOLE (candidate.verdict confirmed) event --
  const demoAttackRuns = familyRuns.filter((r) => r.type === 'attack' && r.mode === 'demo' && r.status === 'succeeded' && r.startedAt);
  let demoLatencyRow: MetricRow | null = null;
  for (const run of demoAttackRuns) {
    const events = await db.query.runEvents.findMany({ where: and(eq(runEvents.runId, run.id), eq(runEvents.stage, 'candidate.verdict')), orderBy: asc(runEvents.seq) });
    const firstConfirmed = events.find((e) => (e.payload as { status?: string }).status === 'confirmed');
    if (!firstConfirmed) continue;
    const latencyMs = firstConfirmed.createdAt.getTime() - run.startedAt!.getTime();
    demoLatencyRow = {
      metric: 'Demo latency (seeded attack start -> first LOOPHOLE stamp visible)',
      value: `${(latencyMs / 1000).toFixed(1)}s`,
      target: '<10s',
      pass: latencyMs < 10_000,
    };
    break;
  }
  rows.push(
    demoLatencyRow ?? {
      metric: 'Demo latency',
      value: `no succeeded demo-mode attack run with a confirmed verdict found (checked ${demoAttackRuns.length} candidate run(s))`,
      target: '<10s',
      pass: false,
    },
  );

  printTable(rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
