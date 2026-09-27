import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

config({ path: '.env.local' });

// `after()` only works inside a live Next.js request scope. For this integration test we
// substitute it with an immediate async invocation so the deferred work still runs.
vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    void fn();
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDb ? describe : describe.skip;

async function waitForTerminal(runId: string, timeoutMs = 10000): Promise<{ status: string }> {
  const { db } = await import('@/db/client');
  const { runs } = await import('@/db/schema');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (run && (run.status === 'succeeded' || run.status === 'failed')) return run;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`run '${runId}' did not reach a terminal status within ${timeoutMs}ms`);
}

describeIfDb('runExecutor (integration, real Neon DB)', () => {
  let projectId: string;

  beforeAll(async () => {
    const { db } = await import('@/db/client');
    const { projects } = await import('@/db/schema');
    const [project] = await db
      .insert(projects)
      .values({ workspaceId: null, slug: `test-run-executor-${Date.now()}`, name: 'Run executor test', isPublic: true })
      .returning();
    projectId = project.id;
  }, 30000);

  afterAll(async () => {
    const { db } = await import('@/db/client');
    const { projects, runs, runEvents } = await import('@/db/schema');
    const projectRuns = await db.query.runs.findMany({ where: eq(runs.projectId, projectId) });
    for (const run of projectRuns) {
      await db.delete(runEvents).where(eq(runEvents.runId, run.id));
    }
    await db.delete(runs).where(eq(runs.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
  }, 30000);

  it(
    'is idempotent: starting the same run twice returns the same runId',
    async () => {
      const { runExecutor } = await import('../runs');
      const inputHash = `hash-${Date.now()}`;

      const first = await runExecutor.start({ projectId, type: 'attack', mode: 'demo', inputHash }, async (emit) => {
        await emit('generated', { n: 1 });
        return { ok: true };
      });
      expect(first.reused).toBe(false);
      await waitForTerminal(first.runId);

      const second = await runExecutor.start({ projectId, type: 'attack', mode: 'demo', inputHash }, async (emit) => {
        await emit('generated', { n: 2 });
        return { ok: true };
      });

      expect(second.runId).toBe(first.runId);
      expect(second.reused).toBe(true);
    },
    15000,
  );

  it(
    'records events in order and marks the run succeeded',
    async () => {
      const { runExecutor } = await import('../runs');
      const { db } = await import('@/db/client');
      const { runEvents } = await import('@/db/schema');
      const inputHash = `hash-order-${Date.now()}`;

      const { runId } = await runExecutor.start({ projectId, type: 'attack', mode: 'demo', inputHash }, async (emit) => {
        await emit('stage-a', { step: 1 });
        await emit('stage-b', { step: 2 });
        await emit('stage-c', { step: 3 });
        return { done: true };
      });

      const finished = await waitForTerminal(runId);
      expect(finished.status).toBe('succeeded');

      const events = await db.query.runEvents.findMany({ where: eq(runEvents.runId, runId) });
      const stages = events.sort((a, b) => a.seq - b.seq).map((e) => e.stage);
      expect(stages).toEqual(['stage-a', 'stage-b', 'stage-c']);
    },
    15000,
  );
});
