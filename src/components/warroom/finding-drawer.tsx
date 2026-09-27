"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VerdictStamp } from "@/components/shared/verdict-stamp";
import type { EffectiveStatus } from "@/core/contracts";
import type { Chip } from "./reducer";

interface Props {
  chip: Chip | null;
  onClose: () => void;
  onPatch: (chip: Chip) => void;
  onRuled: (findingId: string, status: EffectiveStatus) => void;
}

const JUDGE_NAME: Record<string, string> = { textualist: "Textualist", purposivist: "Purposivist", enforcer: "Enforcer" };

export function FindingDrawer({ chip, onClose, onPatch, onRuled }: Props) {
  const [ruling, setRuling] = useState<null | "loophole" | "no_loophole">(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  async function submitRuling(value: "loophole" | "no_loophole") {
    if (!chip?.findingId) return;
    setRuling(value);
    const res = await fetch(`/api/findings/${chip.findingId}/ruling`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruling: value }),
    });
    const data = await res.json();
    if (res.ok) onRuled(chip.findingId, data.effectiveStatus);
    setRuling(null);
  }

  async function verify() {
    if (!chip?.findingId) return;
    const res = await fetch(`/api/findings/${chip.findingId}`);
    const data = await res.json();
    setVerifyResult(`Hash verified ${data.verified ? "✓" : "✕"} · quotes verified ${data.grounded ? "✓" : "✕"}`);
  }

  const isContested = chip?.status === "contested";
  const isLoophole = chip?.status === "confirmed" || chip?.status === "ruled_loophole";

  return (
    <Sheet open={chip !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto p-5">
        {chip && (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="flex items-center gap-2">
                <VerdictStamp status={chip.status} />
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {chip.status === "confirmed"
                  ? `Confirmed by adversarial review (3/3 judges${chip.findingId ? `, finding ${chip.findingId.slice(0, 8)}` : ""})`
                  : chip.status === "ruled_loophole"
                    ? "Ruled a loophole by reviewer (jury split)"
                    : chip.status === "ruled_not_loophole"
                      ? "Ruled not a loophole by reviewer (jury split)"
                      : "Not a loophole in this run's search budget."}
              </p>
            </SheetHeader>

            {isLoophole && (
              <div className="flex gap-2 text-xs">
                <span className="rounded bg-verified/10 px-2 py-1 text-verified">Law satisfied ✓</span>
                <span className="rounded bg-attack/10 px-2 py-1 text-attack">Purpose defeated ✕</span>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold">{chip.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{chip.scenario}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Quotes</h4>
              <ul className="mt-1 flex flex-col gap-1">
                {chip.quotes.map((q, i) => (
                  <li key={i} className="rounded border border-border/60 px-2 py-1 font-mono text-xs">
                    [{q.spanId}] “{q.text}”
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Jury (blind to the attacker&apos;s argument)</h4>
              <ul className="mt-1 flex flex-col gap-2">
                {chip.votes.map((v, i) => (
                  <li key={i} className="rounded border border-border/60 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{JUDGE_NAME[v.judge] ?? v.judge}</span>
                      <span className="text-xs uppercase">{v.verdict}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{v.reasoning}</p>
                  </li>
                ))}
                {chip.votes.length === 0 && <p className="text-xs text-muted-foreground">No jury votes yet.</p>}
              </ul>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {isLoophole && (
                <Button size="sm" onClick={() => onPatch(chip)}>
                  Patch this loophole
                </Button>
              )}
              {isContested && chip.findingId && (
                <>
                  <Button size="sm" variant="outline" disabled={ruling !== null} onClick={() => submitRuling("loophole")}>
                    Gavel: Loophole
                  </Button>
                  <Button size="sm" variant="outline" disabled={ruling !== null} onClick={() => submitRuling("no_loophole")}>
                    Gavel: Not a loophole
                  </Button>
                </>
              )}
              {chip.findingId && (
                <Button size="sm" variant="ghost" onClick={verify}>
                  Verify
                </Button>
              )}
            </div>
            {verifyResult && <p className="text-xs text-muted-foreground">{verifyResult}</p>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
