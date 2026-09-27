import { and, eq } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/db/client';
import { runEvents, runs } from '@/db/schema';

export type RunType = 'compile' | 'attack' | 'repair' | 'retest';
export type RunMode = 'demo' | 'live';
export type Emit = (stage: string, payload: unknown) => Promise<void>;

export interface StartRunInput {
  projectId: string;
  type: RunType;
  mode: RunMode;
  inputHash: string;
}

export type Work = (emit: Emit, runId: string) => Promise<unknown>;

export interface RunExecutor {
  start(input: StartRunInput, work: Work): Promise<{ runId: string; reused: boolean }>;
}

function makeEmit(runId: string): Emit {
  let seq = 0;
  return async (stage, payload) => {
    seq += 1;
    await db.insert(runEvents).values({ runId, seq, stage, payload: payload as object });
  };
}

async function findRun(projectId: string, type: RunType, inputHash: string) {
  return db.query.runs.findFirst({
    where: and(eq(runs.projectId, projectId), eq(runs.type, type), eq(runs.inputHash, inputHash)),
  });
}

// Every LLM call inside a run's work is timeout-guarded (ai/call.ts), so a healthy run
// always reaches 'succeeded' or 'failed' well within this budget. A run still 'running'
// past it was orphaned by a killed process (serverless maxDuration, a dev-server restart)
// and would otherwise occupy its (project, type, inputHash) key forever.
const STALE_RUN_MS = 5 * 60_000;

function isOrphaned(run: { status: string; startedAt: Date | null }): boolean {
  if (run.status !== 'running') return false;
  if (!run.startedAt) return false;
  return Date.now() - run.startedAt.getTime() > STALE_RUN_MS;
}

function scheduleWork(runId: string, work: Work): void {
  after(async () => {
    const emit = makeEmit(runId);
    try {
      await db.update(runs).set({ status: 'running', startedAt: new Date() }).where(eq(runs.id, runId));
      const result = await work(emit, runId);
      await db
        .update(runs)
        .set({ status: 'succeeded', result: result as object, finishedAt: new Date() })
        .where(eq(runs.id, runId));
    } catch (error) {
      await db
        .update(runs)
        .set({ status: 'failed', error: (error as Error).message, finishedAt: new Date() })
        .where(eq(runs.id, runId));
    }
  });
}

export const runExecutor: RunExecutor = {
  async start(input, work) {
    const existing = await findRun(input.projectId, input.type, input.inputHash);
    if (existing) {
      if (existing.status !== 'failed' && !isOrphaned(existing)) {
        return { runId: existing.id, reused: true };
      }
      // A previously failed (or orphaned-running) run occupies this (project, type, inputHash) key permanently
      // (unique constraint), so retrying the same run identity means resetting it in place
      // rather than inserting a new row.
      await db.delete(runEvents).where(eq(runEvents.runId, existing.id));
      await db
        .update(runs)
        .set({ status: 'queued', error: null, result: null, startedAt: null, finishedAt: null })
        .where(eq(runs.id, existing.id));
      scheduleWork(existing.id, work);
      return { runId: existing.id, reused: false };
    }

    const [inserted] = await db
      .insert(runs)
      .values({
        projectId: input.projectId,
        type: input.type,
        mode: input.mode,
        status: 'queued',
        inputHash: input.inputHash,
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      // Another request won the race between our findRun and our insert.
      const raced = await findRun(input.projectId, input.type, input.inputHash);
      if (!raced) throw new Error('run insert raced and no row could be recovered');
      return { runId: raced.id, reused: true };
    }

    scheduleWork(inserted.id, work);
    return { runId: inserted.id, reused: false };
  },
};
