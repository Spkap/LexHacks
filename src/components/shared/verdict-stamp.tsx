import type { CandidateStatus, EffectiveStatus } from "@/core/contracts";
import {
  Circle,
  CircleCheck,
  Clock3,
  Scale,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

const STAMP = {
  generated: {
    icon: Clock3,
    label: "Proposed",
    className: "text-muted-foreground",
  },
  ungrounded: {
    icon: X,
    label: "Thrown out",
    className: "text-muted-foreground",
  },
  blocked: {
    icon: ShieldCheck,
    label: "Blocked",
    className: "text-verified font-medium",
  },
  harmless: {
    icon: Circle,
    label: "Harmless",
    className: "text-muted-foreground",
  },
  contested: {
    icon: Scale,
    label: "Jury split",
    className: "text-uncertain font-medium",
  },
  confirmed: {
    icon: Star,
    label: "Loophole 3/3",
    className: "text-attack font-semibold",
  },
  ruled_loophole: {
    icon: Star,
    label: "Ruled loophole",
    className: "text-attack font-semibold",
  },
  ruled_not_loophole: {
    icon: CircleCheck,
    label: "Ruled safe",
    className: "text-verified font-medium",
  },
};

const DARK_CLASS: Partial<Record<keyof typeof STAMP, string>> = {
  generated: "text-white/35",
  ungrounded: "text-white/30",
  blocked: "text-teal-300 font-medium",
  harmless: "text-white/40",
  contested: "text-amber-300 font-medium",
  confirmed: "text-red-300 font-semibold",
  ruled_loophole: "text-red-300 font-semibold",
  ruled_not_loophole: "text-teal-300 font-medium",
};

export function VerdictStamp({
  status,
  dark = false,
}: {
  status: CandidateStatus | EffectiveStatus;
  dark?: boolean;
}) {
  const s = STAMP[status as keyof typeof STAMP] ?? STAMP.generated;
  const Icon = s.icon;
  const className = dark
    ? (DARK_CLASS[status as keyof typeof STAMP] ?? "text-white/35")
    : s.className;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] ${className}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {s.label}
    </span>
  );
}
