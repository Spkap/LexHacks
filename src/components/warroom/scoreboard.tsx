import type { WarRoomState } from "./reducer";

const STAT_CONFIG = [
  { key: "schemes" as const, label: "Schemes", tone: "text-ink/70" },
  { key: "blocked" as const, label: "Blocked", tone: "text-verified" },
  { key: "harmless" as const, label: "Harmless", tone: "text-ink/45" },
  { key: "contested" as const, label: "Split", tone: "text-uncertain", hideIfZero: true },
  { key: "confirmed" as const, label: "Loopholes", tone: "text-attack" },
];

export function Scoreboard({ counts }: { counts: WarRoomState["counts"] }) {
  return (
    <dl aria-label="Attack results" className="flex items-center gap-3 sm:gap-4">
      {STAT_CONFIG.map((cfg) => {
        const value = counts[cfg.key];
        if (cfg.hideIfZero && value === 0) return null;
        return (
          <div key={cfg.key} className="flex items-baseline gap-1 tabular-nums">
            <dt className="sr-only">{cfg.label}</dt>
            <dd className={`font-mono text-sm font-bold leading-none ${cfg.tone}`}>{value}</dd>
            <span
              aria-hidden
              className="hidden font-mono text-[9px] uppercase tracking-widest text-ink/30 sm:inline"
            >
              {cfg.label}
            </span>
          </div>
        );
      })}
    </dl>
  );
}
