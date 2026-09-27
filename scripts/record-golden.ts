import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

config({ path: '.env.local' });

const WRITE = process.argv.includes('--write');
const DIR = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

async function main() {
  const { sha256Hex } = await import('../src/core/canonical');
  const { isForbidden } = await import('../src/ai/defense');
  const { applyRedline } = await import('../src/core/finding');
  const { groundLegit } = await import('../src/core/grounding');
  const { effectiveStatus, isLoophole } = await import('../src/core/verdict');
  const { db } = await import('../src/db/client');
  const { purposeContracts, repairs, runs, sourceSpans, sources, workspaces } = await import('../src/db/schema');
  const { forkGoldenProject } = await import('../src/server/projects');
  const { runAttackPipeline } = await import('../src/server/attack-run');
  const { runRepairPipeline } = await import('../src/server/repair-run');
  const { runRetestPipeline } = await import('../src/server/retest-run');

  type Span = { id: string; sectionPath: string; label: string; text: string };
  type PurposeContract = { sentence: Record<string, string>; legitimateUses: { id: string; scenario: string }[] };
  type AttackProposal = { tactic: string; quotes: { spanId: string; text: string }[]; scenario: string };
  type DefenseVote = { judge: string; verdict: string };

  function log(line: string): void {
    process.stdout.write(`${line}\n`);
  }

  function makeEmit(runId: string) {
    let seq = 0;
    return async (stage: string, payload: unknown) => {
      seq += 1;
      const { runEvents } = await import('../src/db/schema');
      await db.insert(runEvents).values({ runId, seq, stage, payload: payload as object });
    };
  }

  log(`\n=== record-golden run started ${new Date().toISOString()} ===`);

  const [workspace] = await db.insert(workspaces).values({ tokenHash: sha256Hex(`record-golden-${randomUUID()}`) }).returning();
  const { projectId, slug } = await forkGoldenProject(workspace.id);
  log(`forked golden project: ${slug} (${projectId})`);

  const source = await db.query.sources.findFirst({ where: eq(sources.projectId, projectId) });
  if (!source) throw new Error('forked project has no source');
  const spans: Span[] = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });

  const purposeRow = await db.query.purposeContracts.findFirst({ where: eq(purposeContracts.projectId, projectId) });
  if (!purposeRow) throw new Error('forked project has no purpose contract');
  const purpose = purposeRow.contract as PurposeContract;

  // -- Attack --
  const candidatesFile = readJson('candidates.original.json') as { candidates: { label: string; proposal: AttackProposal }[] };
  const demoCandidates = candidatesFile.candidates.map((c) => ({ label: c.label, proposal: c.proposal as never }));

  const [attackRun] = await db
    .insert(runs)
    .values({ projectId, type: 'attack', mode: 'live', status: 'running', inputHash: randomUUID(), startedAt: new Date() })
    .returning();

  log('running attack (live) on the 8 golden candidates...');
  const attackEmit = makeEmit(attackRun.id);
  const summary = await runAttackPipeline(
    {
      sourceId: source.id,
      sourceSha: source.sha256,
      purposeHash: purposeRow.hash,
      spans,
      purpose: purpose as never,
      k: 2,
      mode: 'live',
      demoCandidates: demoCandidates as never,
      runId: attackRun.id,
    },
    attackEmit,
  );
  await db.update(runs).set({ status: 'succeeded', result: summary as unknown as object, finishedAt: new Date() }).where(eq(runs.id, attackRun.id));
  log(`attack summary: ${JSON.stringify(summary)}`);

  const attackFindings = await db.query.findings.findMany();
  const { attackCandidates } = await import('../src/db/schema');
  const runCandidates = await db.query.attackCandidates.findMany({ where: eq(attackCandidates.runId, attackRun.id) });
  const byLabel = new Map(runCandidates.map((c) => [c.label as string, c]));
  const findingByCandidateId = new Map(attackFindings.map((f) => [f.candidateId, f]));

  log('\n| Label | Tactic | Verdict |');
  log('|---|---|---|');
  const votesByLabel: Record<string, DefenseVote[]> = {};
  for (const { label } of candidatesFile.candidates) {
    const candidate = byLabel.get(label);
    const finding = candidate ? findingByCandidateId.get(candidate.id) : undefined;
    log(`| ${label} | ${candidate?.tactic ?? '?'} | ${finding?.verdict ?? candidate?.status ?? '?'} |`);
    if (finding) votesByLabel[label] = finding.votes as DefenseVote[];
  }

  // -- Repair (target C1, closing C8 too if confirmed) --
  const c1Candidate = byLabel.get('C1');
  const c1Finding = c1Candidate ? findingByCandidateId.get(c1Candidate.id) : undefined;
  const c8Candidate = byLabel.get('C8');
  const c8Finding = c8Candidate ? findingByCandidateId.get(c8Candidate.id) : undefined;

  let repairRecorded: unknown = null;
  let retestSummary: { pass: boolean; loopholesBefore: number; loopholesAfter: number; legitKept: number; legitTotal: number } | null = null;
  let lazyResults: { id: string; status: string }[] = [];

  if (c1Finding) {
    const otherLoopholes = c8Finding && isLoophole(c8Finding.verdict) ? [{ proposal: c8Finding.proposal as AttackProposal }] : [];

    const [repairRun] = await db
      .insert(runs)
      .values({ projectId, type: 'repair', mode: 'live', status: 'running', inputHash: randomUUID(), startedAt: new Date() })
      .returning();

    log('\nrunning repair (live)...');
    const repairEmit = makeEmit(repairRun.id);
    const proposed = await runRepairPipeline(
      {
        findingId: c1Finding.id,
        finding: { proposal: c1Finding.proposal as AttackProposal } as never,
        otherLoopholes: otherLoopholes as never,
        spans,
        purpose: purpose as never,
        baseSourceId: source.id,
        mode: 'live',
        runId: repairRun.id,
      },
      repairEmit,
    );
    await db.update(runs).set({ status: 'succeeded', result: proposed as unknown as object, finishedAt: new Date() }).where(eq(runs.id, repairRun.id));
    log(`repair proposals: ${proposed.map((p) => p.title).join(' | ') || '(none)'}`);

    const firstRepair = proposed[0];
    if (firstRepair) {
      const repairRow = await db.query.repairs.findFirst({ where: eq(repairs.id, firstRepair.repairId) });
      const proposal = repairRow!.redline as { title: string; redline: { spanId: string; before: string; after: string }[]; rationale: string };
      repairRecorded = proposal;

      const patchedSpans = applyRedline(spans as never, proposal.redline as never) as unknown as Span[];
      const newSourceId = randomUUID();
      const newSha = sha256Hex(patchedSpans.map((s) => `${s.id}:${s.text}`).join('\n'));
      await db.insert(sources).values({
        id: newSourceId,
        projectId,
        parentSourceId: source.id,
        title: source.title,
        jurisdiction: source.jurisdiction,
        canonicalUrl: source.canonicalUrl,
        officialVersionId: source.officialVersionId,
        retrievedAt: source.retrievedAt,
        sha256: newSha,
        text: patchedSpans.map((s) => s.text).join('\n\n'),
        metadata: { patched: true },
      });
      await db.insert(sourceSpans).values(patchedSpans.map((s) => ({ sourceId: newSourceId, id: s.id, sectionPath: s.sectionPath, label: s.label, text: s.text })));
      await db.update(repairs).set({ status: 'approved', repairedSourceId: newSourceId }).where(eq(repairs.id, firstRepair.repairId));
      log(`approved repair -> patched source ${newSourceId}`);

      // -- Re-attack --
      const [retestRun] = await db
        .insert(runs)
        .values({ projectId, type: 'retest', mode: 'live', status: 'running', inputHash: randomUUID(), startedAt: new Date() })
        .returning();
      log('running re-attack checks (live)...');
      const retestEmit = makeEmit(retestRun.id);
      retestSummary = await runRetestPipeline(
        {
          baseSourceId: source.id,
          patchedSourceId: newSourceId,
          patchedSpans: patchedSpans as never,
          purpose: purpose as never,
          purposeHash: purposeRow.hash,
          patchedSourceSha: newSha,
          mode: 'live',
          runId: retestRun.id,
        },
        retestEmit,
      );
      await db.update(runs).set({ status: 'succeeded', result: retestSummary as unknown as object, finishedAt: new Date() }).where(eq(runs.id, retestRun.id));
      log(`re-attack: ${JSON.stringify(retestSummary)}`);

      // -- Lazy fix dry run (in-memory, nothing stored) --
      const repairFile = readJson('repair.recorded.json') as { lazy: { redline: { spanId: string; before: string; after: string }[] } };
      const lazyPatchedSpans = applyRedline(spans as never, repairFile.lazy.redline as never) as unknown as Span[];
      log('\nrunning lazy-fix dry-run (in-memory, not stored)...');
      lazyResults = await Promise.all(
        purpose.legitimateUses.map(async (use) => {
          const verdict = await isForbidden({ mode: 'live', scenario: use.scenario, spans: lazyPatchedSpans as never });
          const grounded = verdict ? groundLegit(verdict, lazyPatchedSpans as never) : null;
          const status = grounded === null ? 'unclear' : grounded.forbidden ? 'forbidden' : 'allowed';
          return { id: use.id, status };
        }),
      );
      log(`lazy fix legit-use results: ${JSON.stringify(lazyResults)}`);
    }
  } else {
    log('\nC1 was not confirmed this run; skipping repair and re-attack.');
  }

  log('\n=== pivot-gate summary ===');
  const c1Status = c1Finding ? effectiveStatus(c1Finding.verdict, []) : 'missing';
  const c8Status = c8Finding ? effectiveStatus(c8Finding.verdict, []) : 'missing';
  log(`C1: ${c1Status}  C8: ${c8Status}`);
  log(`re-attack pass: ${retestSummary?.pass ?? 'n/a'}`);
  const lazyForbidsGolden = lazyResults.filter((r) => r.id === 'G1' || r.id === 'G2').every((r) => r.status === 'forbidden');
  log(`lazy fix forbids G1 & G2: ${lazyResults.length > 0 ? lazyForbidsGolden : 'n/a'}`);

  if (WRITE) {
    const recordedFrom = { model: process.env.REASONING_MODEL, date: new Date().toISOString(), promptHashes: 'see model_calls table' };

    writeFileSync(
      join(DIR, 'jury.recorded.json'),
      `${JSON.stringify({ placeholder: false, recordedFrom, votes: votesByLabel }, null, 2)}\n`,
    );
    log('\nwrote jury.recorded.json');

    if (retestSummary) {
      writeFileSync(
        join(DIR, 'reattack.recorded.json'),
        `${JSON.stringify({ placeholder: false, recordedFrom, result: retestSummary }, null, 2)}\n`,
      );
      log('wrote reattack.recorded.json');
    }

    if (repairRecorded) {
      const repairFile = readJson('repair.recorded.json') as { lazy: unknown };
      writeFileSync(
        join(DIR, 'repair.recorded.json'),
        `${JSON.stringify({ recordedFrom, proposals: [repairRecorded], lazy: repairFile.lazy }, null, 2)}\n`,
      );
      log('wrote repair.recorded.json (proposals replaced with the live run; lazy fix kept hand-authored)');
    }
  }

  log('\n=== record-golden run finished ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
