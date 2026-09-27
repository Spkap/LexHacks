"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PurposeContract } from "@/core/ir";

interface Props {
  projectId: string;
  initial?: PurposeContract;
  fixtureCount: { legitimate: number; exploit: number };
}

export function PurposeEditor({ projectId, initial, fixtureCount }: Props) {
  const router = useRouter();
  const [protectedClass, setProtectedClass] = useState(initial?.sentence.protectedClass ?? "");
  const [preventOutcome, setPreventOutcome] = useState(initial?.sentence.preventOutcome ?? "");
  const [without, setWithout] = useState(initial?.sentence.without ?? "");
  const [evenWhen, setEvenWhen] = useState(initial?.sentence.evenWhen ?? "");
  const [statement, setStatement] = useState(initial?.invariants[0]?.statement ?? "");
  const [holds, setHolds] = useState(initial?.invariants[0]?.holds ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLock = fixtureCount.legitimate >= 1 && fixtureCount.exploit >= 0;

  async function submit(approve: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/purpose-contract`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: {
            sentence: { protectedClass, preventOutcome, without, evenWhen },
            invariants: [{ id: initial?.invariants[0]?.id ?? "P1", statement, holds, severity: "high", approved: true }],
          },
          approved: approve,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.reasons) ?? data.error ?? "Failed to save");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border/60 bg-card p-4 text-lg leading-relaxed">
        For{" "}
        <input
          aria-label="Protected class"
          className="inline-block w-40 rounded border-b border-repair bg-transparent px-1 font-medium"
          value={protectedClass}
          onChange={(e) => setProtectedClass(e.target.value)}
        />
        , prevent{" "}
        <input
          aria-label="Outcome to prevent"
          className="inline-block w-64 rounded border-b border-repair bg-transparent px-1 font-medium"
          value={preventOutcome}
          onChange={(e) => setPreventOutcome(e.target.value)}
        />{" "}
        without{" "}
        <input
          aria-label="Required condition (without)"
          className="inline-block w-40 rounded border-b border-repair bg-transparent px-1 font-medium"
          value={without}
          onChange={(e) => setWithout(e.target.value)}
        />
        , even when{" "}
        <input
          aria-label="Applies even when"
          className="inline-block w-48 rounded border-b border-repair bg-transparent px-1 font-medium"
          value={evenWhen}
          onChange={(e) => setEvenWhen(e.target.value)}
        />
        .
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="invariant-statement" className="text-sm font-medium">
          Invariant statement (plain English)
        </label>
        <textarea
          id="invariant-statement"
          className="rounded-md border border-border p-2 text-sm"
          rows={2}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
        <label htmlFor="invariant-formula" className="text-sm font-medium">
          Invariant formula (DSL)
        </label>
        <textarea
          id="invariant-formula"
          className="rounded-md border border-border p-2 font-mono text-sm"
          rows={2}
          value={holds}
          onChange={(e) => setHolds(e.target.value)}
        />
      </div>

      {fixtureCount.legitimate === 0 && (
        <p className="rounded-md border border-uncertain/40 bg-uncertain/10 px-3 py-2 text-sm text-uncertain">
          Add at least one legitimate-use fixture before locking (0 on file).
        </p>
      )}

      {error && <p className="text-sm text-attack">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => submit(false)} disabled={saving}>
          Save draft
        </Button>
        <Button className="bg-verified text-white hover:bg-verified/90" onClick={() => submit(true)} disabled={saving || !canLock}>
          Approve contract
        </Button>
      </div>
    </div>
  );
}
