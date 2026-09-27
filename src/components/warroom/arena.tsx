import { Check, CircleDot, Sparkles, AlertTriangle } from "lucide-react";
import { LANES } from "@/core/contracts";
import { VerdictStamp } from "@/components/shared/verdict-stamp";
import type { Chip } from "./reducer";

interface Props {
  chips: Chip[];
  attackRunning: boolean;
  onOpen: (chip: Chip) => void;
}

const JUDGES = ["textualist", "purposivist", "enforcer"] as const;
const JUDGE_INITIALS: Record<(typeof JUDGES)[number], string> = {
  textualist: "T",
  purposivist: "P",
  enforcer: "E",
};

const LANE_LABELS: Record<(typeof LANES)[number], string> = {
  threshold_split: "Threshold split",
  relabel: "Relabeling",
  affiliate: "Affiliate routing",
  timing: "Timing gap",
  exception_abuse: "Exception abuse",
  nominal_review: "Nominal review",
  redefine_consideration: "Redefine consideration",
  no_consideration: "No consideration",
  procedure_without_outcome: "Procedure without outcome",
};

function JurySeats({ chip }: { chip: Chip }) {
  return (
    <span
      className="inline-flex gap-0.5"
      aria-label="Jury votes"
    >
      {JUDGES.map((judge) => {
        const vote = chip.votes.find((v) => v.judge === judge);
        const voted = Boolean(vote);
        const isLoophole = vote?.verdict === "loophole";
        const isBlocked = vote?.verdict === "blocked" || vote?.verdict === "harmless";
        return (
          <span
            key={judge}
            title={vote ? `${judge}: ${vote.verdict}` : judge}
            className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] font-bold transition-all ${
              isLoophole
                ? "bg-attack/20 text-attack ring-1 ring-attack/40"
                : isBlocked
                  ? "bg-verified/15 text-verified ring-1 ring-verified/30"
                  : voted
                    ? "bg-uncertain/15 text-uncertain ring-1 ring-uncertain/30"
                    : "border border-white/15 text-white/25"
            }`}
          >
            {JUDGE_INITIALS[judge]}
          </span>
        );
      })}
    </span>
  );
}

function StatusGlow({ status }: { status: Chip["status"] }) {
  if (status === "confirmed" || status === "ruled_loophole") {
    return (
      <span className="absolute inset-0 rounded-xl bg-attack/[0.06] ring-1 ring-attack/25 transition-all group-hover:bg-attack/[0.09] group-hover:ring-attack/40" />
    );
  }
  if (status === "blocked" || status === "ruled_not_loophole") {
    return (
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/[0.06] transition-all group-hover:ring-white/12" />
    );
  }
  if (status === "contested") {
    return (
      <span className="absolute inset-0 rounded-xl ring-1 ring-uncertain/30 transition-all group-hover:ring-uncertain/50" />
    );
  }
  return (
    <span className="absolute inset-0 rounded-xl ring-1 ring-white/[0.05] transition-all group-hover:ring-white/10" />
  );
}

function ArenaEmptyState({ attackRunning }: { attackRunning: boolean }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-xl">
        {/* Icon cluster */}
        <div className="mb-8 flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            {attackRunning ? (
              <CircleDot
                className="animate-pulse text-red-400"
                size={28}
                strokeWidth={1.5}
              />
            ) : (
              <Sparkles size={28} className="text-white/40" strokeWidth={1.5} />
            )}
            {attackRunning && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-attack/60 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-attack" />
              </span>
            )}
          </div>
        </div>

        <div className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          {attackRunning ? "Agents entering the arena" : "Nine attack lanes"}
        </div>
        <h2 className="text-center font-heading text-2xl font-medium leading-tight tracking-tight text-white/90 sm:text-3xl">
          {attackRunning
            ? "The jury is examining the bill."
            : "Ready to stress-test the text."}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-white/40">
          {attackRunning
            ? "Each claim must quote the source exactly. Three independent judges review every grounded scheme."
            : "One attack explores nine ways the wording could miss its stated purpose. Grounded claims go to three independent judges."}
        </p>

        {/* Lane grid */}
        <div className="mt-8 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {LANES.map((lane, index) => (
            <div
              key={lane}
              className={`flex items-center gap-2.5 rounded-lg border border-white/[0.07] px-3 py-2 transition-all ${
                attackRunning ? "bg-white/[0.03]" : "bg-white/[0.02]"
              }`}
            >
              <span className="font-mono text-[10px] tabular-nums text-white/20">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[11px] font-medium text-white/55">
                {LANE_LABELS[lane]}
              </span>
              {attackRunning && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-attack/70" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-4 text-xs text-white/30">
          <Check size={12} className="text-teal-400/70" strokeWidth={2.5} />
          <span>Human judgment breaks a split jury. Nothing is auto-labelled a loophole.</span>
        </div>
      </div>
    </div>
  );
}

export function Arena({ chips, attackRunning, onOpen }: Props) {
  const loopholeCount = chips.filter(
    (c) => c.status === "confirmed" || c.status === "ruled_loophole"
  ).length;

  return (
    <section
      className="flex min-h-full flex-col text-paper"
      aria-label="Attack arena"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-ink/96 px-5 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">
              Live review
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-white/85">
              {chips.length ? "Attack findings" : "Jury arena"}
            </p>
          </div>
          {loopholeCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-attack/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300 ring-1 ring-attack/30">
              <AlertTriangle size={9} strokeWidth={2.5} />
              {loopholeCount} loophole{loopholeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
            attackRunning
              ? "border-attack/40 bg-attack/10 text-red-300 animate-pulse"
              : "border-white/10 text-white/35"
          }`}
        >
          {attackRunning
            ? "In progress"
            : `${chips.length} ${chips.length === 1 ? "scheme" : "schemes"}`}
        </span>
      </div>

      {chips.length === 0 ? (
        <ArenaEmptyState attackRunning={attackRunning} />
      ) : (
        <ul className="flex flex-col gap-2 p-3 sm:p-4">
          {chips.map((chip) => {
            const isLoophole =
              chip.status === "confirmed" || chip.status === "ruled_loophole";
            const isContested = chip.status === "contested";

            return (
              <li key={chip.id} className="chip-travel-in">
                <button
                  type="button"
                  onClick={() => onOpen(chip)}
                  className={`group relative flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-repair/70 ${
                    isLoophole
                      ? "bg-attack/[0.07] hover:bg-attack/[0.11]"
                      : isContested
                        ? "bg-uncertain/[0.06] hover:bg-uncertain/[0.1]"
                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <StatusGlow status={chip.status} />

                  {/* Left: title + lane */}
                  <span className="relative flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      {chip.label && (
                        <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/40">
                          {chip.label}
                        </span>
                      )}
                      <span
                        className={`truncate text-[13px] font-medium ${
                          isLoophole ? "text-red-200" : "text-white/85 group-hover:text-white"
                        }`}
                      >
                        {chip.title}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-white/30">
                      {LANE_LABELS[chip.lane]}
                    </span>
                  </span>

                  {/* Right: jury + verdict */}
                  <span className="relative flex shrink-0 items-center gap-2.5">
                    {(chip.phase === "judging" || chip.phase === "done") && (
                      <JurySeats chip={chip} />
                    )}
                    <VerdictStamp status={chip.status} dark />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
