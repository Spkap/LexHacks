"use client";

import Link from "next/link";
import { ArrowLeft, PencilLine, Swords, Zap } from "lucide-react";
import type { PurposeContract } from "@/core/contracts";
import { Button } from "@/components/ui/button";
import { Scoreboard } from "./scoreboard";
import type { WarRoomState } from "./reducer";

interface Props {
  title: string;
  sha: string;
  purpose: PurposeContract | undefined;
  step: WarRoomState["step"];
  counts: WarRoomState["counts"];
  demoMode: boolean;
  attackRunning: boolean;
  canAttack: boolean;
  onAttack: () => void;
  onEditPurpose: () => void;
}

const STEPS: WarRoomState["step"][] = ["attack", "patch", "reattack"];
const STEP_LABEL: Record<WarRoomState["step"], string> = {
  attack: "Attack",
  patch: "Patch",
  reattack: "Re-attack",
};

export function MissionBar({
  title,
  sha,
  purpose,
  step,
  counts,
  demoMode,
  attackRunning,
  canAttack,
  onAttack,
  onEditPurpose,
}: Props) {
  const purposeText = purpose
    ? `For ${purpose.sentence.protectedClass}, prevent ${purpose.sentence.preventOutcome}, even when ${purpose.sentence.evenWhen}.`
    : "No approved purpose yet. Draft one to unlock the attack.";

  return (
    <header className="z-20 border-b border-ink/12 bg-paper/98 backdrop-blur-sm shadow-[0_1px_0_0_rgba(23,32,31,0.06),0_4px_12px_0_rgba(23,32,31,0.04)]">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
        {/* Top row */}
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 transition-all hover:bg-ink/6 hover:text-ink"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="truncate font-heading text-[17px] font-semibold tracking-tight text-ink">
                {title}
              </h1>
              {sha && (
                <span className="hidden shrink-0 rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] text-ink/40 sm:inline">
                  {sha.slice(0, 8)}
                </span>
              )}
            </div>
          </div>

          {/* Phase breadcrumb */}
          <nav
            aria-label="Workflow phase"
            className="hidden items-center font-mono text-[10px] uppercase tracking-[0.15em] sm:flex"
          >
            {STEPS.map((s, i) => (
              <span key={s} className="flex items-center">
                {i > 0 && (
                  <span className="mx-2 text-ink/20" aria-hidden>
                    ›
                  </span>
                )}
                <span
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    s === step
                      ? "bg-ink text-paper shadow-sm"
                      : "text-ink/35"
                  }`}
                >
                  {STEP_LABEL[s]}
                </span>
              </span>
            ))}
          </nav>
          {demoMode && (
            <span className="shrink-0 rounded-md border border-verified/15 bg-verified/[0.06] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-verified">
              CCPA demo
            </span>
          )}
        </div>

        {/* Purpose + Action row */}
        <div className="flex items-start gap-4 border-t border-ink/6 py-2.5 sm:items-center sm:gap-6">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
            <span className="mt-0.5 shrink-0 rounded bg-ink/6 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink/40 sm:mt-0">
              Purpose
            </span>
            <p
              className="line-clamp-2 min-w-0 text-[13px] leading-5 text-ink/65 sm:line-clamp-1"
              title={purposeText}
            >
              {purposeText}
            </p>
            <button
              type="button"
              onClick={onEditPurpose}
              className="mt-0.5 shrink-0 rounded-md p-1 text-ink/35 transition-all hover:bg-ink/6 hover:text-ink sm:mt-0"
              aria-label={purpose ? "Edit purpose" : "Draft purpose"}
            >
              <PencilLine size={13} />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Scoreboard counts={counts} />
            <Button
              size="sm"
              className={`h-8 gap-1.5 px-3.5 text-[13px] font-semibold shadow-sm transition-all ${
                attackRunning
                  ? "bg-attack/90 text-white"
                  : "bg-attack text-white hover:bg-attack/90 hover:shadow-md"
              } disabled:animate-none disabled:opacity-40`}
              onClick={onAttack}
              disabled={!canAttack || attackRunning}
            >
              {attackRunning ? (
                <Zap size={13} className="animate-pulse" />
              ) : (
                <Swords size={13} />
              )}
              {attackRunning ? (demoMode ? "Running demo…" : "Attacking…") : demoMode ? "Start demo" : "Attack"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
