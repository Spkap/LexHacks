"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRunEvents } from "@/hooks/use-run-events";
import type { RunEventPayload } from "@/core/events";
import type { WarRoomState, Chip } from "./reducer";

interface RepairResult {
  repairId: string;
  title: string;
  valid: boolean;
}

interface Props {
  projectId: string;
  chip: Chip;
  checks: WarRoomState["checks"];
  patched: boolean;
  onEvent: (event: RunEventPayload) => void;
  onPatched: () => void;
}

async function pollRun(runId: string): Promise<{ status: string; result: unknown }> {
  for (;;) {
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    if (data.status === "succeeded" || data.status === "failed") return data;
    await new Promise((r) => setTimeout(r, 500));
  }
}

export function PatchPanel({ projectId, chip, checks, patched, onEvent, onPatched }: Props) {
  const [repairRunId, setRepairRunId] = useState<string | null>(null);
  const [retestRunId, setRetestRunId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<RepairResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [lazyResult, setLazyResult] = useState<{ id: string; status: string }[] | null>(null);

  useRunEvents(repairRunId, onEvent);
  useRunEvents(retestRunId, onEvent);

  async function startRepair() {
    if (!chip.findingId) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId: chip.findingId, mode: "live" }),
    });
    const data = await res.json();
    if (res.ok) {
      setRepairRunId(data.runId);
      const run = await pollRun(data.runId);
      setProposals((run.result as RepairResult[]) ?? []);
    }
    setLoading(false);
  }

  async function approve(repairId: string) {
    setApprovingId(repairId);
    const res = await fetch(`/api/repairs/${repairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (res.ok) {
      onPatched();
      const retest = await fetch(`/api/repairs/${repairId}/retest-runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "live" }) });
      const retestData = await retest.json();
      if (retest.ok) setRetestRunId(retestData.runId);
    }
    setApprovingId(null);
  }

  async function tryLazyFix(repairId: string) {
    const res = await fetch(`/api/repairs/${repairId}/dry-run`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setLazyResult(data.results);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 bg-paper p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Patch: {chip.title}</h3>
        {proposals.length === 0 && (
          <Button size="sm" onClick={startRepair} disabled={loading}>
            {loading ? "Drafting…" : "Draft a repair"}
          </Button>
        )}
      </div>

      {proposals.length > 0 && !patched && (
        <div className="flex flex-col gap-2">
          {proposals.map((p) => (
            <div key={p.repairId} className="rounded-md border border-border/60 p-3 text-sm">
              <p className="font-medium">{p.title}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={!p.valid || approvingId !== null} onClick={() => approve(p.repairId)}>
                  {approvingId === p.repairId ? "Approving…" : "Approve patch"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => tryLazyFix(p.repairId)}>
                  Try the lazy fix
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lazyResult && (
        <div className="flex gap-2 text-xs">
          {lazyResult.map((r) => (
            <span key={r.id} className={r.status === "forbidden" ? "text-attack" : "text-muted-foreground"}>
              {r.id}: {r.status === "forbidden" ? "✕ banned by the lazy fix" : r.status}
            </span>
          ))}
        </div>
      )}

      {patched && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          {(["old_loopholes", "fresh_attack", "legit_uses"] as const).map((name) => (
            <div key={name} className="rounded-md border border-border/60 p-3">
              <p className="font-mono text-xs uppercase text-muted-foreground">{name.replaceAll("_", " ")}</p>
              <p className={checks[name].done ? (checks[name].done!.pass ? "text-verified" : "text-attack") : "text-muted-foreground"}>
                {checks[name].done ? (checks[name].done!.pass ? "✓" : "✕") + " " + checks[name].done!.detail : "running…"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
