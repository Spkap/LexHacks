"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CompileTrigger({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/compile-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Compile failed to start");

      const poll = async (): Promise<void> => {
        const r = await fetch(`/api/runs/${data.runId}`);
        const run = await r.json();
        if (run.status === "succeeded" || run.status === "failed") {
          setRunning(false);
          router.refresh();
          return;
        }
        setTimeout(poll, 1500);
      };
      void poll();
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={running} className="bg-repair text-white hover:bg-repair/90">
        {running ? "AI drafting rules from source…" : "Draft rules from source (AI)"}
      </Button>
      {error && <p className="text-sm text-attack">{error}</p>}
    </div>
  );
}
