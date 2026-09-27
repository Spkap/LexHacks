import { VerdictStamp } from "@/components/shared/verdict-stamp";
import type { Chip } from "./reducer";

interface Props {
  chips: Chip[];
  onOpen: (chip: Chip) => void;
}

const JUDGES = ["textualist", "purposivist", "enforcer"] as const;

function JurySeats({ chip }: { chip: Chip }) {
  return (
    <span className="inline-flex gap-1 font-mono text-[10px] uppercase text-muted-foreground">
      {JUDGES.map((judge) => {
        const vote = chip.votes.find((v) => v.judge === judge);
        return (
          <span
            key={judge}
            className={`flex h-4 w-4 items-center justify-center rounded-full border ${vote ? "border-ink bg-ink text-paper" : "border-border"}`}
            title={vote ? `${judge}: ${vote.verdict}` : judge}
          >
            {judge[0].toUpperCase()}
          </span>
        );
      })}
    </span>
  );
}

export function Arena({ chips, onOpen }: Props) {
  if (chips.length === 0) {
    return <p className="p-6 text-sm text-ink/60">Press ATTACK to send nine tactics at the bill at once.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 p-4">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            onClick={() => onOpen(chip)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-paper hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{chip.label ? `${chip.label} · ` : ""}{chip.title}</span>
              <span className="shrink-0 font-mono text-[10px] uppercase text-paper/50">{chip.lane.replaceAll("_", " ")}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {chip.phase === "judging" || chip.phase === "done" ? <JurySeats chip={chip} /> : null}
              <VerdictStamp status={chip.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
