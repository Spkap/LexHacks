import { and, asc, eq, gt } from 'drizzle-orm';
import { db } from '@/db/client';
import { runEvents, runs } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_MS = 400;
const HEARTBEAT_MS = 15000;

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const lastEventIdHeader = request.headers.get('last-event-id');
  const parsedLastSeq = lastEventIdHeader ? Number.parseInt(lastEventIdHeader, 10) : 0;
  let lastSeq = Number.isFinite(parsedLastSeq) ? parsedLastSeq : 0;

  const encoder = new TextEncoder();
  let closed = false;
  let lastFlush = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      while (!closed) {
        const events = await db.query.runEvents.findMany({
          where: and(eq(runEvents.runId, runId), gt(runEvents.seq, lastSeq)),
          orderBy: asc(runEvents.seq),
        });

        for (const event of events) {
          lastSeq = event.seq;
          const data = JSON.stringify({ stage: event.stage, payload: event.payload });
          controller.enqueue(encoder.encode(`id: ${event.seq}\ndata: ${data}\n\n`));
          lastFlush = Date.now();
        }

        const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
        const terminal = run?.status === 'succeeded' || run?.status === 'failed';
        if (terminal && events.length === 0) {
          controller.close();
          closed = true;
          break;
        }

        if (Date.now() - lastFlush > HEARTBEAT_MS) {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          lastFlush = Date.now();
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
