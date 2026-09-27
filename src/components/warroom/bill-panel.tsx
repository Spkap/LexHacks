import type { RepairProposal, Span } from "@/core/contracts";

interface Props {
  spans: Span[];
  activeSpanIds: string[];
  heatSpanIds: string[];
  redline?: RepairProposal["redline"];
}

function renderRedlinedText(
  text: string,
  edits: RepairProposal["redline"],
  spanId: string
) {
  const edit = edits.find((e) => e.spanId === spanId);
  if (!edit) return text;
  const idx = text.indexOf(edit.before);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-attack/10 text-attack line-through decoration-2">
        {edit.before}
      </mark>
      <mark className="rounded bg-repair/10 text-repair">{edit.after}</mark>
      {text.slice(idx + edit.before.length)}
    </>
  );
}

export function BillPanel({ spans, activeSpanIds, heatSpanIds, redline }: Props) {
  return (
    <div
      className="min-h-full bg-paper text-ink"
      tabIndex={0}
      aria-label="Bill text"
    >
      {/* Sticky panel header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/[0.08] bg-paper/95 px-5 py-3 backdrop-blur-sm sm:px-6">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/35">
            Source text
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink/85">
            The bill under review
          </p>
        </div>
        <span className="rounded-full border border-ink/10 bg-ink/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink/35">
          {spans.length} sections
        </span>
      </div>

      {/* Spans */}
      <div className="flex flex-col gap-1.5 px-3 py-3 sm:px-5 sm:py-4">
        {spans.map((span) => {
          const isActive = activeSpanIds.includes(span.id);
          const hasHeat = heatSpanIds.includes(span.id);

          return (
            <section
              key={span.id}
              id={`span-${span.id}`}
              className={`scroll-mt-4 rounded-xl px-4 py-3.5 transition-all duration-200 ${
                isActive
                  ? "bg-attack/10 ring-2 ring-attack/30 shadow-[0_0_0_4px_rgba(185,28,28,0.04)]"
                  : hasHeat
                    ? "bg-attack/[0.04] ring-1 ring-attack/15"
                    : "hover:bg-ink/[0.025]"
              }`}
            >
              <p
                className={`font-mono text-[10px] uppercase tracking-wide sm:text-[10px] ${
                  isActive ? "text-attack/70" : "text-ink/35"
                }`}
              >
                {span.sectionPath}
                {span.label && (
                  <>
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="normal-case">{span.label}</span>
                  </>
                )}
              </p>
              <p
                className={`mt-2 font-heading text-[14.5px] leading-[1.8] whitespace-pre-line sm:text-[15px] ${
                  isActive ? "text-ink" : "text-ink/80"
                }`}
              >
                {redline
                  ? renderRedlinedText(span.text, redline, span.id)
                  : span.text}
              </p>
            </section>
          );
        })}
        {spans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-ink/30">No source text yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
