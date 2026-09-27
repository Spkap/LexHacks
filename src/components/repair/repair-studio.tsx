"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RetestReport {
  exploits: { candidateId: string; after: string; closed: boolean }[];
  positives: { fixtureId: string; after: string; pass: boolean }[];
  allClosed: boolean;
  allPreserved: boolean;
}

interface RepairSummary {
  repairId: string;
  title: string;
  valid: boolean;
  reasons: string[];
  score: RetestReport | null;
}

export function RepairStudio({ projectId, certificateId, slug }: { projectId: string; certificateId: string; slug: string }) {
  const [proposals, setProposals] = useState<RepairSummary[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [retestResult, setRetestResult] = useState<{ retestReport: RetestReport } | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/repair-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Repair generation failed");

      const poll = async (): Promise<void> => {
        const r = await fetch(`/api/runs/${data.runId}`);
        const run = await r.json();
        if (run.status === "succeeded") {
          setProposals(run.result as RepairSummary[]);
          setGenerating(false);
          return;
        }
        if (run.status === "failed") {
          setError(run.error ?? "Repair generation failed");
          setGenerating(false);
          return;
        }
        setTimeout(poll, 2000);
      };
      void poll();
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  async function approveAndRetest(repairId: string) {
    setError(null);
    const res = await fetch(`/api/repairs/${repairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Approval failed");
      return;
    }
    setApprovedId(repairId);

    const retestRes = await fetch(`/api/repairs/${repairId}/retest-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const retestData = await retestRes.json();
    if (!retestRes.ok) {
      setError(retestData.message ?? retestData.error ?? "Retest failed to start");
      return;
    }

    const poll = async (): Promise<void> => {
      const r = await fetch(`/api/runs/${retestData.runId}`);
      const run = await r.json();
      if (run.status === "succeeded") {
        setRetestResult(run.result);
        return;
      }
      if (run.status === "failed") {
        setError(run.error ?? "Retest failed");
        return;
      }
      setTimeout(poll, 1500);
    };
    void poll();
  }

  if (!proposals) {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={generate} disabled={generating} className="bg-repair text-white hover:bg-repair/90">
          {generating ? "AI drafting minimal repairs…" : "Draft repairs (AI)"}
        </Button>
        {error && <p className="text-sm text-attack">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue={proposals[0]?.repairId}>
        <TabsList>
          {proposals.map((p, i) => (
            <TabsTrigger key={p.repairId} value={p.repairId}>
              Proposal {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {proposals.map((p) => (
          <TabsContent key={p.repairId} value={p.repairId} className="flex flex-col gap-3">
            <h3 className="font-heading text-lg font-semibold">{p.title}</h3>
            {!p.valid && <p className="text-sm text-attack">Invalid: {p.reasons.join("; ")}</p>}
            {p.score && (
              <div className="rounded-md border border-border/60 bg-card p-3 text-sm">
                <div className={p.score.allClosed ? "text-verified" : "text-attack"}>
                  Closes {p.score.exploits.filter((e) => e.closed).length}/{p.score.exploits.length}
                </div>
                <div className={p.score.allPreserved ? "text-verified" : "text-attack"}>
                  Preserves {p.score.positives.filter((f) => f.pass).length}/{p.score.positives.length} legitimate uses
                </div>
              </div>
            )}
            <Button
              onClick={() => approveAndRetest(p.repairId)}
              disabled={!p.valid || approvedId !== null}
              className="w-fit bg-verified text-white hover:bg-verified/90"
            >
              Approve and re-attack
            </Button>
          </TabsContent>
        ))}
      </Tabs>

      {error && <p className="text-sm text-attack">{error}</p>}

      {retestResult && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="font-heading text-lg font-semibold">Re-attack report</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Exploit</th>
                <th>After repair</th>
              </tr>
            </thead>
            <tbody>
              {retestResult.retestReport.exploits.map((e) => (
                <tr key={e.candidateId}>
                  <td>{e.candidateId}</td>
                  <td className={e.closed ? "text-verified" : "text-attack"}>{e.after.toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Legitimate uses preserved: {retestResult.retestReport.positives.filter((f) => f.pass).length}/{retestResult.retestReport.positives.length}
          </p>
          <a href={`/p/${slug}/report`} className="mt-3 inline-block text-sm text-repair underline">
            View full report
          </a>
        </div>
      )}
    </div>
  );
}
