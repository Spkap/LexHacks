"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "source", label: "Source", path: "source" },
  { key: "purpose", label: "Purpose", path: "purpose" },
  { key: "compile", label: "Compile", path: "compile" },
  { key: "attack", label: "Attack", path: "attack" },
  { key: "findings", label: "Findings", path: "findings" },
  { key: "repair", label: "Repair", path: "repair" },
  { key: "report", label: "Report", path: "report" },
] as const;

export function StageRail({ slug, completed = [] }: { slug: string; completed?: string[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project stages" className="flex w-44 shrink-0 flex-col gap-1 border-r border-border/60 px-3 py-6">
      {STAGES.map((stage) => {
        const href = `/p/${slug}/${stage.path}`;
        const active = pathname?.startsWith(href);
        const done = completed.includes(stage.key);
        return (
          <Link
            key={stage.key}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-ink text-paper" : "text-foreground/80 hover:bg-muted",
            )}
          >
            {done ? <Check className="size-3.5 text-verified" aria-hidden="true" /> : <span className="size-3.5" />}
            {stage.label}
          </Link>
        );
      })}
    </nav>
  );
}
