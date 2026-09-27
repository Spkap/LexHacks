"use client";

import { useEffect, useMemo, useState } from "react";
import { VerdictStamp } from "@/components/shared/verdict-stamp";
import type { AttackProposal, DefenseVote, JuryStatus } from "@/core/contracts";
import { decideVerdict } from "@/core/verdict";
import candidatesFixture from "../../../fixtures/golden/ccpa-2018/candidates.original.json";
import juryFixture from "../../../fixtures/golden/ccpa-2018/jury.recorded.json";

const JUDGES = ["textualist", "purposivist", "enforcer"] as const;
const SEAT_DELAYS = ["delay-0", "delay-150", "delay-300"] as const;
const TICK_MS = 2600;

interface Round {
  label: string;
  proposal: AttackProposal;
  votes: DefenseVote[];
  status: JuryStatus;
}

function buildRounds(): Round[] {
  const votesByLabel = juryFixture.votes as Record<string, DefenseVote[]>;
  return (candidatesFixture.candidates as { label: string; proposal: AttackProposal }[])
    .filter((c) => votesByLabel[c.label]?.length)
    .map((c) => {
      const votes = votesByLabel[c.label];
      return { label: c.label, proposal: c.proposal, votes, status: decideVerdict(votes) };
    });
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function HeroBattle() {
  const rounds = useMemo(() => buildRounds(), []);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion || paused || rounds.length === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % rounds.length), TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion, paused, rounds.length]);

  if (rounds.length === 0) return null;
  const round = rounds[index];
  const animate = !reducedMotion;
  const groundedQuote = round.proposal.quotes[0]?.text;

  return (
    <div
      className="relative overflow-hidden border border-ink/20 bg-ink text-paper shadow-[0_18px_55px_-38px_rgba(23,32,31,0.55)]"
      data-testid="hero-battle"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60 sm:text-xs">
          <span className="size-1.5 rounded-full bg-attack" /> CCPA 2018 walkthrough
        </span>
        <span className="font-mono text-[10px] tabular-nums text-paper/45 sm:text-xs">
          CCPA · {String(index + 1).padStart(2, "0")} / {String(rounds.length).padStart(2, "0")}
        </span>
      </div>

      <div key={round.label} className={`flex min-h-[340px] flex-col justify-between gap-7 px-4 py-5 sm:min-h-[400px] sm:px-6 sm:py-7 ${animate ? "animate-in fade-in-0 duration-300" : ""}`}>
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/55 sm:text-xs">
            <span className="text-attack">{round.label}</span>
            <span aria-hidden="true">/</span>
            <span>{round.proposal.tactic.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-4 max-w-[25ch] font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {round.proposal.title}
          </p>
          <p className="mt-3 max-w-[62ch] text-sm leading-6 text-paper/70 sm:text-base">
            {round.proposal.scenario}
          </p>
        </div>

        <div className="grid gap-5 border-t border-white/10 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          {groundedQuote && (
            <blockquote className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/45">Source text cited</p>
              <p className="mt-2 line-clamp-2 max-w-[65ch] text-sm leading-5 text-paper/85">“{groundedQuote}”</p>
            </blockquote>
          )}
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-end">
            <div className="flex items-center gap-2" aria-label="Jury votes">
              {JUDGES.map((judge, i) => {
                const vote = round.votes.find((v) => v.judge === judge);
                return (
                  <span key={judge} title={vote ? `${judge}: ${vote.verdict}` : judge} className={`flex size-7 items-center justify-center rounded-sm bg-paper font-mono text-xs font-semibold text-ink ${animate ? `animate-in fade-in-0 zoom-in-75 duration-300 ${SEAT_DELAYS[i]}` : ""}`}>
                    {judge[0].toUpperCase()}
                  </span>
                );
              })}
            </div>
            <div className={animate ? "animate-in fade-in-0 duration-300 delay-500" : ""}>
              <VerdictStamp status={round.status} dark />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
