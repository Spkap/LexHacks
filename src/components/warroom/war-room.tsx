"use client";

import { useCallback, useReducer, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EffectiveStatus, PurposeContract, Span } from "@/core/contracts";
import type { RunEventPayload } from "@/core/events";
import { useRunEvents } from "@/hooks/use-run-events";
import { MissionBar } from "./mission-bar";
import { BillPanel } from "./bill-panel";
import { Arena } from "./arena";
import { FindingDrawer } from "./finding-drawer";
import { PurposeSheet } from "./purpose-sheet";
import { PatchPanel } from "./patch-panel";
import { initialState, reducer, type Chip, type HydrateCandidate, type WarRoomState } from "./reducer";

export interface WarRoomInitial {
  project: { id: string; slug: string; name: string; demoTemplate: string | null };
  source: { id: string; sha256: string } | null;
  spans: Span[];
  purpose: PurposeContract | undefined;
  latestAttack: { runId: string; candidates: HydrateCandidate[] } | null;
  patched: boolean;
}

function hydrate(initial: WarRoomInitial): WarRoomState {
  if (!initial.latestAttack) return initialState;
  const state = reducer(initialState, { type: "hydrate-attack", candidates: initial.latestAttack.candidates });
  return initial.patched ? { ...state, patched: true, step: "reattack" } : state;
}

export function WarRoom({ initial }: { initial: WarRoomInitial }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initial, hydrate);
  const [runId, setRunId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [purposeSheetOpen, setPurposeSheetOpen] = useState(false);
  const mode = searchParams.get("live") === "1"
    ? "live"
    : searchParams.get("demo") === "1" || initial.project.demoTemplate === "ccpa-2018"
      ? "demo"
      : "live";

  const onEvent = useCallback((event: RunEventPayload) => dispatch({ type: "event", event }), []);
  useRunEvents(runId, onEvent);

  const findingId = searchParams.get("f");
  const openChip = findingId ? (Object.values(state.chips).find((c) => c.findingId === findingId) ?? null) : null;

  function openDrawer(chip: Chip) {
    const params = new URLSearchParams(searchParams.toString());
    if (chip.findingId) params.set("f", chip.findingId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    dispatch({ type: "select", spanIds: chip.quotes.map((q) => q.spanId) });
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("f");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  async function startAttack() {
    if (!initial.source) return;
    dispatch({ type: "reset-attack" });
    const res = await fetch(`/api/projects/${initial.project.id}/attack-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (res.ok) setRunId(data.runId);
  }

  function onRuled(id: string, status: EffectiveStatus) {
    dispatch({ type: "ruled", findingId: id, status });
  }

  const loopholeChip = openChip && (openChip.status === "confirmed" || openChip.status === "ruled_loophole") ? openChip : null;
  const [patchChip, setPatchChip] = useState<Chip | null>(null);

  function patch(chip: Chip) {
    setPatchChip(chip);
    dispatch({ type: "step", step: "patch" });
    closeDrawer();
  }

  const heatSpanIds = Object.values(state.chips)
    .filter((c) => c.status === "confirmed" || c.status === "ruled_loophole")
    .flatMap((c) => c.quotes.map((q) => q.spanId));

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-paper">
      <MissionBar
        title={initial.project.name}
        sha={initial.source?.sha256 ?? ""}
        purpose={purpose}
        step={state.step}
        counts={state.counts}
        attackRunning={state.attackRunning}
        canAttack={Boolean(purpose)}
        demoMode={mode === "demo"}
        onAttack={startAttack}
        onEditPurpose={() => setPurposeSheetOpen(true)}
      />

      <main className="grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-2 overflow-hidden lg:grid-cols-2 lg:grid-rows-1">
        <div className="min-h-0 overflow-y-auto border-b border-ink/[0.08] lg:border-b-0 lg:border-r">
          <BillPanel spans={initial.spans} activeSpanIds={state.activeSpanIds} heatSpanIds={heatSpanIds} />
        </div>
        <div className="min-h-0 overflow-y-auto bg-[#16201f]">
          <Arena chips={state.order.map((id) => state.chips[id])} attackRunning={state.attackRunning} onOpen={openDrawer} />
        </div>
      </main>

      {patchChip && (
        <PatchPanel
          projectId={initial.project.id}
          chip={patchChip}
          checks={state.checks}
          patched={state.patched}
          mode={mode}
          onEvent={onEvent}
          onPatched={() => dispatch({ type: "patched" })}
        />
      )}

      <FindingDrawer chip={openChip} onClose={closeDrawer} onPatch={patch} onRuled={onRuled} />

      <PurposeSheet
        projectId={initial.project.id}
        open={purposeSheetOpen || !purpose}
        initial={purpose}
        onApproved={(c) => {
          setPurpose(c);
          setPurposeSheetOpen(false);
        }}
        onClose={() => setPurposeSheetOpen(false)}
      />

      {loopholeChip === null && state.patched && state.checks.old_loopholes.done && state.checks.fresh_attack.done && state.checks.legit_uses.done && (
        <div className="flex items-center justify-center gap-3 border-t border-verified/20 bg-verified/8 px-4 py-2.5 text-sm font-medium text-verified">
          <span className="text-base">✓</span>
          <span>
            {state.counts.confirmed} loopholes patched. {state.checks.legit_uses.done.detail}.
          </span>
          <a href={`/r/${initial.project.slug}`} className="ml-1 underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
            Share results
          </a>
        </div>
      )}
    </div>
  );
}
