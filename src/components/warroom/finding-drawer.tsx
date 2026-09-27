"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VerdictStamp } from "@/components/shared/verdict-stamp";
import type { EffectiveStatus } from "@/core/contracts";
import type { Chip } from "./reducer";
import { Gavel, Wrench, ShieldCheck, Hash } from "lucide-react";

interface Props {
  chip: Chip | null;
  onClose: () => void;
  onPatch: (chip: Chip) => void;
  onRuled: (findingId: string, status: EffectiveStatus) => void;
}

const JUDGE_NAME: Record<string, string> = {
  textualist: "Textualist",
  purposivist: "Purposivist",
  enforcer: "Enforcer",
};

const JUDGE_DESC: Record<string, string> = {
  textualist: "Reads the exact words",
  purposivist: "Considers the policy goal",
  enforcer: "Weighs real-world effect",
};

const VERDICT_PILL: Record<string, string> = {
  loophole: "bg-attack/15 text-attack ring-1 ring-attack/30",
  blocked: "bg-verified/15 text-verified ring-1 ring-verified/25",
  harmless: "bg-ink/8 text-ink/50 ring-1 ring-ink/10",
  unclear: "bg-uncertain/15 text-uncertain ring-1 ring-uncertain/30",
};

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
    setVerifyResult(
      `Hash verified ${data.verified ? "✓" : "✕"} · Quotes grounded ${data.grounded ? "✓" : "✕"}`
    );
  }

  const isContested = chip?.status === "contested";
  const isLoophole =
    chip?.status === "confirmed" || chip?.status === "ruled_loophole";

  return (
    <Sheet open={chip !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-l border-border/60 p-0 sm:max-w-md">
        {chip && (
          <>
            {/* Header band */}
            <div
              className={`border-b px-5 py-5 ${
                isLoophole
                  ? "border-attack/20 bg-attack/5"
                  : isContested
                    ? "border-uncertain/20 bg-uncertain/5"
                    : "border-border/50 bg-muted/30"
              }`}
            >
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2.5">
                  <VerdictStamp status={chip.status} />
                </SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
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
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-verified/12 px-2.5 py-1 text-[11px] font-medium text-verified ring-1 ring-verified/20">
                    <ShieldCheck size={10} strokeWidth={2.5} />
                    Law satisfied
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-attack/12 px-2.5 py-1 text-[11px] font-medium text-attack ring-1 ring-attack/20">
                    ✕ Purpose defeated
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              {/* Title + scenario */}
              <div>
                <h3 className="font-heading text-[15px] font-semibold leading-snug text-ink">
                  {chip.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {chip.scenario}
                </p>
              </div>

              {/* Quoted spans */}
              <div>
                <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
                  Verbatim quotes
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {chip.quotes.map((q, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-ink/8 bg-ink/[0.025] px-3 py-2.5"
                    >
                      <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink/30 mb-1">
                        <Hash size={8} />
                        {q.spanId}
                      </span>
                      <p className="font-mono text-[12px] leading-relaxed text-ink/75">
                        &ldquo;{q.text}&rdquo;
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Jury panel */}
              <div>
                <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
                  Jury (blind to the attacker&apos;s argument)
                </h4>
                <ul className="flex flex-col gap-2">
                  {chip.votes.map((v, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-border/60 bg-white/60 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[13px] font-semibold text-ink">
                            {JUDGE_NAME[v.judge] ?? v.judge}
                          </span>
                          <span className="ml-1.5 text-[11px] text-ink/35">
                            {JUDGE_DESC[v.judge]}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wide ${
                            VERDICT_PILL[v.verdict] ?? "bg-ink/8 text-ink/50"
                          }`}
                        >
                          {v.verdict}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {v.reasoning}
                      </p>
                    </li>
                  ))}
                  {chip.votes.length === 0 && (
                    <p className="py-2 text-xs text-muted-foreground">
                      No jury votes yet.
                    </p>
                  )}
                </ul>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-border/50 bg-muted/20 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {isLoophole && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-ink text-paper hover:bg-ink/85"
                    onClick={() => onPatch(chip)}
                  >
                    <Wrench size={13} />
                    Patch this loophole
                  </Button>
                )}
                {isContested && chip.findingId && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-attack/30 text-attack hover:bg-attack/5 hover:border-attack/50"
                      disabled={ruling !== null}
                      onClick={() => submitRuling("loophole")}
                    >
                      <Gavel size={13} />
                      {ruling === "loophole" ? "Ruling…" : "Rule: Loophole"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-verified/30 text-verified hover:bg-verified/5 hover:border-verified/50"
                      disabled={ruling !== null}
                      onClick={() => submitRuling("no_loophole")}
                    >
                      <Gavel size={13} />
                      {ruling === "no_loophole" ? "Ruling…" : "Rule: Not a loophole"}
                    </Button>
                  </>
                )}
                {chip.findingId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-ink"
                    onClick={verify}
                  >
                    Verify integrity
                  </Button>
                )}
              </div>
              {verifyResult && (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {verifyResult}
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
