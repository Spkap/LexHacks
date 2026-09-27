import { AlertTriangle, Check, HelpCircle, Lock, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind =
  | "approved"
  | "proposed"
  | "disputed"
  | "certified"
  | "rejected"
  | "invalid"
  | "inconclusive"
  | "locked"
  | "sat"
  | "unsat";

const CONFIG: Record<StatusKind, { label: string; icon: typeof Check; className: string }> = {
  approved: { label: "Human approved", icon: Check, className: "text-verified border-verified/40 bg-verified/10" },
  proposed: { label: "AI proposed", icon: HelpCircle, className: "text-uncertain border-uncertain/40 bg-uncertain/10" },
  disputed: { label: "Disputed", icon: AlertTriangle, className: "text-uncertain border-uncertain/40 bg-uncertain/10" },
  certified: { label: "Certified", icon: ShieldAlert, className: "text-attack border-attack/40 bg-attack/10" },
  rejected: { label: "Rejected by solver", icon: X, className: "text-muted-foreground border-border bg-muted" },
  invalid: { label: "Invalid", icon: X, className: "text-muted-foreground border-border bg-muted" },
  inconclusive: { label: "Inconclusive", icon: HelpCircle, className: "text-uncertain border-uncertain/40 bg-uncertain/10" },
  locked: { label: "Locked", icon: Lock, className: "text-verified border-verified/40 bg-verified/10" },
  sat: { label: "SAT", icon: Check, className: "text-verified border-verified/40 bg-verified/10" },
  unsat: { label: "UNSAT", icon: X, className: "text-muted-foreground border-border bg-muted" },
};

export function StatusBadge({ status, className }: { status: StatusKind; className?: string }) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cfg.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
