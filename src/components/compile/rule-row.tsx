"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge, type StatusKind } from "@/components/brand/status-badge";
import { Button } from "@/components/ui/button";
import type { Rule } from "@/core/ir";

export function RuleRow({ projectId, rule }: { projectId: string; rule: Rule }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "approved" | "disputed") {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 rounded-lg border border-border/60 bg-card p-4">
      <div className="text-sm">
        <div className="font-mono text-xs text-muted-foreground">{rule.id}</div>
        <div className="mt-1">{rule.plain}</div>
      </div>
      <div className="font-mono text-xs">
        <div className="text-muted-foreground">when</div>
        {rule.when}
        <div className="mt-1 text-muted-foreground">require</div>
        {rule.require}
      </div>
      <div>
        <StatusBadge status={rule.status as StatusKind} />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy || rule.status === "approved"} onClick={() => setStatus("approved")}>
          Approve
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || rule.status === "disputed"} onClick={() => setStatus("disputed")}>
          Dispute
        </Button>
      </div>
    </div>
  );
}
