"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, type StatusKind } from "@/components/brand/status-badge";
import { useRunEvents } from "@/components/run/use-run-events";
import { Button } from "@/components/ui/button";
import type { Tactic } from "@/core/ir";

const ALL_TACTICS: Tactic[] = [
  "threshold_split",
  "relabel",
  "affiliate",
  "timing",
  "exception_abuse",
  "no_consideration",
  "redefine_consideration",
  "procedure_without_outcome",
];

interface LaneCandidate {
  id: string;
  tactic: string;
  status: StatusKind;
  certificateId?: string;
  reasons?: string[];
}

export function AttackArena({ projectId, slug, isDemoTemplate }: { projectId: string; slug: string; isDemoTemplate: boolean }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [tactics, setTactics] = useState<Tactic[]>(["no_consideration", "relabel", "affiliate"]);
  const [mode, setMode] = useState<"demo" | "live">(isDemoTemplate ? "demo" : "live");
  const [solverSearch, setSolverSearch] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { events, connected } = useRunEvents(runId);

  const candidates = useMemo(() => {
    const map = new Map<string, LaneCandidate>();
    for (const event of events) {
      const payload = event.payload as { candidate?: { id: string; tactic: string }; candidateId?: string; certificateId?: string; reasons?: string[] };
      const id = payload.candidate?.id ?? payload.candidateId;
      if (!id) continue;
      const existing = map.get(id) ?? { id, tactic: payload.candidate?.tactic ?? "?", status: "proposed" as StatusKind };
      if (event.stage === "generated") existing.tactic = payload.candidate?.tactic ?? existing.tactic;
      if (["invalid", "rejected", "inconclusive", "certified"].includes(event.stage)) {
        existing.status = event.stage as StatusKind;
        existing.certificateId = payload.certificateId;
        existing.reasons = payload.reasons;
      }
      map.set(id, existing);
    }
    return [...map.values()];
  }, [events]);

  const counts = {
    generated: candidates.length,
    invalid: candidates.filter((c) => c.status === "invalid" || c.status === "rejected").length,
    certified: candidates.filter((c) => c.status === "certified").length,
  };

  const lastEvent = events[events.length - 1];
  const announcement = useMemo(() => {
    if (!lastEvent) return "";
    const payload = lastEvent.payload as { candidate?: { id: string; tactic: string }; candidateId?: string };
    const id = payload.candidate?.id ?? payload.candidateId ?? "";
    switch (lastEvent.stage) {
      case "generated":
        return `${id} ${payload.candidate?.tactic ?? ""} proposed`;
      case "certified":
        return `${id} certified: exploit confirmed by the solver`;
      case "rejected":
        return `${id} rejected by the solver`;
      case "invalid":
        return `${id} invalid: failed validation`;
      case "inconclusive":
        return `${id} inconclusive`;
      default:
        return "";
    }
  }, [lastEvent]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/attack-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, tactics, budgetPerTactic: 2, solverSearch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.reasons) ?? data.error ?? "Attack failed to start");
      setRunId(data.runId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function toggleTactic(t: Tactic) {
    setTactics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="flex flex-col gap-6">
      {!runId && (
        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {ALL_TACTICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTactic(t)}
                className={`rounded-full border px-3 py-1 text-xs font-mono ${
                  tactics.includes(t) ? "border-repair bg-repair/10 text-repair" : "border-border text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={solverSearch} onChange={(e) => setSolverSearch(e.target.checked)} />
            Solver-native search (Z3 searches directly, no AI)
          </label>
          {isDemoTemplate && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mode === "demo"} onChange={(e) => setMode(e.target.checked ? "demo" : "live")} />
              Demo mode (replay recorded AI output, solver runs live)
            </label>
          )}
          <Button onClick={start} disabled={starting || tactics.length === 0} className="bg-attack text-white hover:bg-attack/90">
            {starting ? "Starting…" : "Attack"}
          </Button>
          {error && <p className="text-sm text-attack">{error}</p>}
        </div>
      )}

      {runId && (
        <>
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm">
            <span>{counts.generated} generated</span>
            <span>·</span>
            <span>{counts.invalid} rejected</span>
            <span>·</span>
            <span className="font-medium text-attack">{counts.certified} certified</span>
            <span className="ml-auto text-xs text-muted-foreground">{connected ? "live" : "reconnecting…"}</span>
          </div>

          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <div key={c.id} className="chip-travel-in flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{c.id}</span> <span className="text-sm">{c.tactic}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={c.status} />
                  {c.status === "certified" && c.certificateId && (
                    <Link href={`/p/${slug}/findings/${c.certificateId}`} className="text-sm text-repair underline">
                      View finding
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
