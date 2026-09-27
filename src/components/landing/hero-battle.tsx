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

  return (
    <div
      className="overflow-hidden rounded-lg border border-border/60 bg-ink text-paper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase text-paper/50">
        <span>Live jury replay · CCPA §1798.140</span>
        <span>
          {index + 1} / {rounds.length}
        </span>
      </div>

      <div key={round.label} className={`flex flex-col gap-3 px-4 py-5 ${animate ? "animate-in fade-in-0 duration-300" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-paper/50">{round.label}</span>
          <span className="font-mono text-[10px] uppercase text-paper/50">{round.proposal.tactic.replaceAll("_", " ")}</span>
        </div>
        <p className="font-heading text-lg font-semibold leading-snug">{round.proposal.title}</p>
        <p className="text-sm text-paper/70">{round.proposal.scenario}</p>

        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex gap-1.5 font-mono text-[10px] uppercase text-paper/50">
            {JUDGES.map((judge, i) => {
              const vote = round.votes.find((v) => v.judge === judge);
              return (
                <span
                  key={judge}
                  title={vote ? `${judge}: ${vote.verdict}` : judge}
                  className={`flex h-5 w-5 items-center justify-center rounded-full border border-paper bg-paper text-ink ${
                    animate ? `animate-in fade-in-0 zoom-in-75 duration-300 ${SEAT_DELAYS[i]}` : ""
                  }`}
                >
                  {judge[0].toUpperCase()}
                </span>
              );
            })}
          </span>
          <div className={animate ? "animate-in fade-in-0 duration-300 delay-500" : ""}>
            <VerdictStamp status={round.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
