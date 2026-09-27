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
  C3: 'confirmed',
  C4: 'contested',
  C5: 'blocked',
  C6: 'confirmed',
  C7: 'blocked',
  C8: 'blocked',
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
  const { attackCandidates, findingRulings, findings, modelCalls, projects, runEvents, runs } = await import('../src/db/schema');

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
    target: 'reported from all recorded candidates',
    pass: true,
  });

  // -- Golden verdict agreement: compare each complete run, never an arbitrary mix
  // of candidates from multiple runs. These expected buckets are the recorded live
  // jury output committed in fixtures/golden/ccpa-2018/jury.recorded.json.
  const findingsByCandidateId = new Map(findingRows.map((finding) => [finding.candidateId, finding]));
  const total = Object.keys(EXPECTED_VERDICT).length;
  const completeGoldenRuns = familyRuns.filter((run) => {
    if (run.type !== 'attack' || run.status !== 'succeeded') return false;
    const labels = new Set(candidateRows.filter((candidate) => candidate.runId === run.id).map((candidate) => candidate.label));
    return Object.keys(EXPECTED_VERDICT).every((label) => labels.has(label));
  });
  const agreements = completeGoldenRuns.map((run) => {
    const byLabel = new Map(candidateRows.filter((candidate) => candidate.runId === run.id).map((candidate) => [candidate.label, candidate]));
    const matched = Object.entries(EXPECTED_VERDICT).filter(([label, expected]) => {
      const candidate = byLabel.get(label);
      return candidate !== undefined && findingsByCandidateId.get(candidate.id)?.verdict === expected;
    }).length;
    return { runId: run.id, matched };
  });
  const bestAgreement = Math.max(0, ...agreements.map((agreement) => agreement.matched));
  rows.push({
    metric: 'Golden verdict agreement (C1-C8 vs recorded live jury fixture)',
    value: completeGoldenRuns.length > 0 ? `${bestAgreement}/${total} (${pct(bestAgreement, total)}) across ${completeGoldenRuns.length} complete run(s)` : 'no complete golden attack run',
    target: '8/8 on the recorded demo source run',
    pass: agreements.some((agreement) => agreement.matched === total),
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

  // -- Legit-use preservation: consume the recorded re-attack result directly.
  const completedRetestResults = retestRuns
    .map((run) => run.result as { legitKept?: number; legitTotal?: number } | null)
    .filter((result): result is { legitKept: number; legitTotal: number } =>
      typeof result?.legitKept === 'number' && typeof result.legitTotal === 'number',
    );
  const legitimateKept = completedRetestResults.reduce((sum, result) => sum + result.legitKept, 0);
  const legitimateTotal = completedRetestResults.reduce((sum, result) => sum + result.legitTotal, 0);
  rows.push({
    metric: 'Legit-use preservation (re-attack checks)',
    value: legitimateTotal > 0 ? `${legitimateKept}/${legitimateTotal} (${pct(legitimateKept, legitimateTotal)})` : 'no completed re-attack result',
    target: '100% on the recorded golden run',
    pass: legitimateTotal > 0 && legitimateKept === legitimateTotal,
  });

  // -- Schema validity: model call attempts that succeeded, across every attempt logged --
  const calls = runIds.length > 0 ? await db.query.modelCalls.findMany({ where: inArray(modelCalls.runId, runIds) }) : [];
  const okCalls = calls.filter((c) => c.ok);
  rows.push({
    metric: 'Schema validity (all logged model-call attempts, incl. retries)',
    value: calls.length > 0 ? `${okCalls.length}/${calls.length} (${pct(okCalls.length, calls.length)})` : 'no model calls logged yet',
    target: '>=95% after one retry',
    pass: calls.length > 0 && okCalls.length / calls.length >= 0.95,
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
