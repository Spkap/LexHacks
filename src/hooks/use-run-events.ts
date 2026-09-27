"use client";

import { useEffect, useRef } from "react";
import type { RunEventPayload } from "@/core/events";

export function useRunEvents(runId: string | null, onEvent: (event: RunEventPayload) => void) {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as RunEventPayload;
      handlerRef.current(data);
    };
    return () => source.close();
  }, [runId]);
}
