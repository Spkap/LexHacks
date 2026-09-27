import Link from "next/link";
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
  attackRunning: boolean;
  canAttack: boolean;
  onAttack: () => void;
  onEditPurpose: () => void;
}

const STEPS: WarRoomState["step"][] = ["attack", "patch", "reattack"];
const STEP_LABEL: Record<WarRoomState["step"], string> = { attack: "ATTACK", patch: "PATCH", reattack: "RE-ATTACK" };

export function MissionBar({ title, sha, purpose, step, counts, attackRunning, canAttack, onAttack, onEditPurpose }: Props) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-paper px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← back
          </Link>
          <h1 className="font-heading text-lg font-semibold">{title}</h1>
          <span className="font-mono text-xs text-muted-foreground">sha {sha.slice(0, 8)}…</span>
        </div>
        <nav aria-label="Phase" className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
          {STEPS.map((s, i) => (
            <span key={s} className={s === step ? "font-semibold text-ink" : ""}>
              {i > 0 && <span className="mr-2">▸</span>}
              {STEP_LABEL[s]}
            </span>
          ))}
        </nav>
      </div>

      {purpose ? (
        <p className="text-sm text-muted-foreground">
          Purpose: for {purpose.sentence.protectedClass}, prevent {purpose.sentence.preventOutcome}, even when {purpose.sentence.evenWhen}.{" "}
          <button type="button" onClick={onEditPurpose} className="underline hover:text-ink" aria-label="Edit purpose">
            ✎
          </button>
        </p>
      ) : (
        <p className="text-sm text-uncertain">No approved purpose yet. <button type="button" onClick={onEditPurpose} className="underline">Draft one</button> to unlock ATTACK.</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" className="animate-pulse bg-attack text-white hover:bg-attack/90 disabled:animate-none" onClick={onAttack} disabled={!canAttack || attackRunning}>
          {attackRunning ? "Attacking…" : "⚔ ATTACK"}
        </Button>
        <Scoreboard counts={counts} />
      </div>
    </div>
  );
}
