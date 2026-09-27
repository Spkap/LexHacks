"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { PurposeContract } from "@/core/contracts";

interface Props {
  projectId: string;
  open: boolean;
  initial?: PurposeContract;
  onApproved: (contract: PurposeContract) => void;
  onClose: () => void;
}

const emptySentence = { protectedClass: "", preventOutcome: "", without: "", evenWhen: "" };

export function PurposeSheet({ projectId, open, initial, onApproved, onClose }: Props) {
  const [sentence, setSentence] = useState(initial?.sentence ?? emptySentence);
  const [legitimateUses, setLegitimateUses] = useState(initial?.legitimateUses ?? [{ id: "G1", scenario: "" }]);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draftForMe() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/purpose-suggestion`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not draft a purpose");
      setSentence(data.sentence);
      setLegitimateUses(data.legitimateUses.map((scenario: string, i: number) => ({ id: `G${i + 1}`, scenario })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function approve() {
    setSaving(true);
    setError(null);
    try {
      const contract: PurposeContract = { sentence, legitimateUses: legitimateUses.filter((u) => u.scenario.trim().length > 0) };
      const res = await fetch(`/api/projects/${projectId}/purpose-contract`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract, approved: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.fields) ?? data.error ?? "Failed to save purpose");
      onApproved(data.contract as PurposeContract);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="flex flex-col gap-4 overflow-y-auto p-5">
        <SheetHeader className="p-0">
          <SheetTitle>What is this bill for?</SheetTitle>
        </SheetHeader>

        <Button size="sm" variant="outline" onClick={draftForMe} disabled={drafting}>
          {drafting ? "Drafting…" : "✨ Draft it for me"}
        </Button>

        <div className="rounded-lg border border-border/60 bg-card p-4 text-sm leading-relaxed">
          For{" "}
          <input
            aria-label="Protected class"
            className="inline-block w-full rounded border-b border-repair bg-transparent px-1"
            value={sentence.protectedClass}
            onChange={(e) => setSentence({ ...sentence, protectedClass: e.target.value })}
            placeholder="consumers who opt out of the sale of their data"
          />
          , prevent{" "}
          <input
            aria-label="Prevent outcome"
            className="inline-block w-full rounded border-b border-repair bg-transparent px-1"
            value={sentence.preventOutcome}
            onChange={(e) => setSentence({ ...sentence, preventOutcome: e.target.value })}
            placeholder="their data reaching a third party for ads"
          />{" "}
          without{" "}
          <input
            aria-label="Without"
            className="inline-block w-full rounded border-b border-repair bg-transparent px-1"
            value={sentence.without}
            onChange={(e) => setSentence({ ...sentence, without: e.target.value })}
            placeholder="the consumer's consent"
          />
          , even when{" "}
          <input
            aria-label="Even when"
            className="inline-block w-full rounded border-b border-repair bg-transparent px-1"
            value={sentence.evenWhen}
            onChange={(e) => setSentence({ ...sentence, evenWhen: e.target.value })}
            placeholder="no money changes hands"
          />
          .
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Must stay legal</h4>
          <div className="mt-2 flex flex-col gap-2">
            {legitimateUses.map((use, i) => (
              <Textarea
                key={use.id}
                rows={2}
                value={use.scenario}
                onChange={(e) => setLegitimateUses(legitimateUses.map((u, j) => (j === i ? { ...u, scenario: e.target.value } : u)))}
                placeholder={`Legitimate use ${i + 1}…`}
              />
            ))}
            {legitimateUses.length < 5 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setLegitimateUses([...legitimateUses, { id: `G${legitimateUses.length + 1}`, scenario: "" }])}
              >
                + add another
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-attack">{error}</p>}

        <Button className="mt-auto" onClick={approve} disabled={saving}>
          {saving ? "Approving…" : "Approve"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
