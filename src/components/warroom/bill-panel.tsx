import type { RepairProposal, Span } from "@/core/contracts";

interface Props {
  spans: Span[];
  activeSpanIds: string[];
  heatSpanIds: string[];
  redline?: RepairProposal["redline"];
}

function renderRedlinedText(text: string, edits: RepairProposal["redline"], spanId: string) {
  const edit = edits.find((e) => e.spanId === spanId);
  if (!edit) return text;
  const idx = text.indexOf(edit.before);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="rounded bg-attack/10 text-attack line-through decoration-2">{edit.before}</span>
      <span className="rounded bg-repair/10 text-repair">{edit.after}</span>
      {text.slice(idx + edit.before.length)}
    </>
  );
}

export function BillPanel({ spans, activeSpanIds, heatSpanIds, redline }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-paper p-5 text-ink">
      {spans.map((span) => {
        const isActive = activeSpanIds.includes(span.id);
        const hasHeat = heatSpanIds.includes(span.id);
        return (
          <section
            key={span.id}
            id={`span-${span.id}`}
            className={`scroll-mt-4 rounded-md p-2 transition-colors ${isActive ? "bg-attack/15 ring-1 ring-attack" : hasHeat ? "bg-attack/5" : ""}`}
          >
            <p className="font-mono text-xs text-muted-foreground">
              {span.sectionPath} · {span.label}
            </p>
            <p className="mt-1 font-heading text-sm leading-relaxed whitespace-pre-line">
              {redline ? renderRedlinedText(span.text, redline, span.id) : span.text}
            </p>
          </section>
        );
      })}
      {spans.length === 0 && <p className="text-sm text-muted-foreground">No source text yet.</p>}
    </div>
  );
}
