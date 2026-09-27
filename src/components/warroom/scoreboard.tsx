import type { WarRoomState } from "./reducer";

export function Scoreboard({ counts }: { counts: WarRoomState["counts"] }) {
  return (
    <p className="font-mono text-sm tabular-nums text-ink/80">
      {counts.schemes} schemes · {counts.blocked} blocked · {counts.harmless} harmless
      {counts.contested > 0 ? ` · ${counts.contested} split` : ""} ·{" "}
      <span className="font-semibold text-attack">{counts.confirmed} LOOPHOLE{counts.confirmed === 1 ? "" : "S"}</span>
    </p>
  );
}
