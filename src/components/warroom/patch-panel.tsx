"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRunEvents } from "@/hooks/use-run-events";
import type { RunEventPayload } from "@/core/events";
import type { WarRoomState, Chip } from "./reducer";
import { Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";

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
  mode: "demo" | "live";
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

const CHECK_LABELS = {
  old_loopholes: "Old loopholes",
  fresh_attack: "Fresh attack",
  legit_uses: "Legitimate uses",
};

export function PatchPanel({
  projectId,
  chip,
  checks,
  patched,
  mode,
  onEvent,
  onPatched,
}: Props) {
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
      body: JSON.stringify({ findingId: chip.findingId, mode }),
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
      const retest = await fetch(`/api/repairs/${repairId}/retest-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const retestData = await retest.json();
      if (retest.ok) setRetestRunId(retestData.runId);
    }
    setApprovingId(null);
  }

  async function tryLazyFix(repairId: string) {
    const res = await fetch(`/api/repairs/${repairId}/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, lazy: mode === "demo" }),
    });
    const data = await res.json();
    if (res.ok) setLazyResult(data.results);
  }

  return (
    <div className="border-t border-border/60 bg-paper shadow-[0_-2px_12px_rgba(23,32,31,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="shrink-0 text-ink/40" />
          <h3 className="text-sm font-semibold text-ink">
            Patch:{" "}
            <span className="font-medium text-ink/70">{chip.title}</span>
          </h3>
        </div>
        {proposals.length === 0 && (
          <Button
            size="sm"
            onClick={startRepair}
            disabled={loading}
            className="gap-1.5 bg-ink text-paper hover:bg-ink/85 disabled:opacity-50"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? "Drafting…" : "Draft a repair"}
          </Button>
        )}
      </div>

      <div className="px-5 py-4">
        {/* Proposals */}
        {proposals.length > 0 && !patched && (
          <div className="flex flex-col gap-2">
            {proposals.map((p) => (
              <div
                key={p.repairId}
                className="rounded-xl border border-border/60 bg-muted/30 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <p className="text-[13px] font-semibold text-ink">{p.title}</p>
                {!p.valid && (
                  <p className="mt-2 text-xs text-attack">
                    This repair does not match the cited source text and cannot be applied.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!p.valid || approvingId !== null}
                    onClick={() => approve(p.repairId)}
                    className="gap-1.5 bg-ink text-paper hover:bg-ink/85"
                  >
                    {approvingId === p.repairId && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    {approvingId === p.repairId ? "Approving…" : "Approve patch"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => tryLazyFix(p.repairId)}
                    className="border-ink/15 text-ink/70 hover:bg-ink/4 hover:text-ink"
                  >
                    {mode === "demo" ? "Try the lazy fix" : "Check legitimate uses"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lazy fix result */}
        {lazyResult && (
          <div className="mt-3 flex flex-wrap gap-2">
            {lazyResult.map((r) => (
              <span
                key={r.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] ${
                  r.status === "forbidden"
                    ? "bg-attack/10 text-attack ring-1 ring-attack/25"
                    : "bg-ink/6 text-ink/50"
                }`}
              >
                {r.id}:{" "}
                {r.status === "forbidden" ? "✕ banned by lazy fix" : r.status}
              </span>
            ))}
          </div>
        )}

        {/* Re-attack checks */}
        {patched && (
          <div className="grid grid-cols-3 gap-2.5">
            {(["old_loopholes", "fresh_attack", "legit_uses"] as const).map(
              (name) => {
                const check = checks[name];
                const done = check.done;
                const pass = done?.pass;
                return (
                  <div
                    key={name}
                    className={`rounded-xl border p-3 transition-colors ${
                      done
                        ? pass
                          ? "border-verified/25 bg-verified/5"
                          : "border-attack/25 bg-attack/5"
                        : "border-border/50 bg-muted/20"
                    }`}
                  >
                    <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-ink/35">
                      {CHECK_LABELS[name]}
                    </p>
                    {done ? (
                      <div className="flex items-center gap-1.5">
                        {pass ? (
                          <CheckCircle2 size={13} className="shrink-0 text-verified" />
                        ) : (
                          <XCircle size={13} className="shrink-0 text-attack" />
                        )}
                        <p
                          className={`text-[12px] font-medium leading-snug ${
                            pass ? "text-verified" : "text-attack"
                          }`}
                        >
                          {done.detail}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={11} className="animate-spin text-ink/30" />
                        <p className="text-[12px] text-ink/35">running…</p>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
