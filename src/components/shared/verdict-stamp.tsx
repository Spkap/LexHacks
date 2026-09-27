import type { CandidateStatus, EffectiveStatus } from "@/core/contracts";

const STAMP: Record<string, { icon: string; label: string; className: string }> = {
  generated: { icon: "…", label: "proposed", className: "text-muted-foreground" },
  ungrounded: { icon: "✕", label: "thrown out: not in bill", className: "text-muted-foreground" },
  blocked: { icon: "🛡", label: "Blocked", className: "text-verified" },
  harmless: { icon: "○", label: "Harmless", className: "text-muted-foreground" },
  contested: { icon: "⚖", label: "Jury split", className: "text-uncertain" },
  confirmed: { icon: "★", label: "LOOPHOLE 3/3", className: "text-attack font-semibold" },
  ruled_loophole: { icon: "★", label: "Ruled a loophole", className: "text-attack font-semibold" },
  ruled_not_loophole: { icon: "🛡", label: "Ruled not a loophole", className: "text-verified" },
};

export function VerdictStamp({ status }: { status: CandidateStatus | EffectiveStatus }) {
  const s = STAMP[status] ?? STAMP.generated;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${s.className}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
