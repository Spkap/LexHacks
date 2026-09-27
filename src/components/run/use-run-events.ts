'use client';

import { useEffect, useState } from 'react';

export interface RunEvent {
  seq: number;
  stage: string;
  payload: unknown;
}

export interface UseRunEventsResult {
  events: RunEvent[];
  connected: boolean;
}

/**
 * Subscribes to a run's SSE stream. The browser's EventSource auto-reconnects with
 * Last-Event-ID on a dropped connection; if the connection is closed outright (e.g.
 * blocked by a proxy), falls back to polling /api/runs/[runId] for terminal status.
 */
export function useRunEvents(runId: string | null): UseRunEventsResult {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!runId) {
      // Resetting state when runId changes to null; a hook has no `key` prop to remount with.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvents([]);
      setConnected(false);
      return;
    }

    setEvents([]);
    const source = new EventSource(`/api/runs/${runId}/events`);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    source.onopen = () => setConnected(true);

    source.onmessage = (e) => {
      const seq = e.lastEventId ? Number.parseInt(e.lastEventId, 10) : 0;
      const parsed = JSON.parse(e.data) as { stage: string; payload: unknown };
      setEvents((prev) => [...prev, { seq, stage: parsed.stage, payload: parsed.payload }]);
    };

    source.onerror = () => {
      setConnected(false);
      if (source.readyState === EventSource.CLOSED && !pollTimer) {
        pollTimer = setInterval(async () => {
          const res = await fetch(`/api/runs/${runId}`);
          if (!res.ok) return;
          const run = (await res.json()) as { status: string };
          if (run.status === 'succeeded' || run.status === 'failed') {
            if (pollTimer) clearInterval(pollTimer);
          }
        }, 1000);
      }
    };

    return () => {
      source.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [runId]);

  return { events, connected };
}
