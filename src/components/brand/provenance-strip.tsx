export function ProvenanceStrip({
  sourceHash,
  purposeVersion,
  formalizationId,
  formalizationVersion,
  reviewed,
}: {
  sourceHash?: string | null;
  purposeVersion?: number | null;
  formalizationId?: string | null;
  formalizationVersion?: number | null;
  reviewed?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-6 py-2 font-mono text-xs text-muted-foreground">
      <span>Source {sourceHash ? sourceHash.slice(0, 8) : "—"}…</span>
      <span aria-hidden="true">·</span>
      <span>Purpose v{purposeVersion ?? "—"}</span>
      <span aria-hidden="true">·</span>
      <span>
        Model {formalizationId ? formalizationId.slice(0, 8) : "—"} v{formalizationVersion ?? "—"}
      </span>
      <span aria-hidden="true">·</span>
      <span className={reviewed ? "text-verified" : "text-uncertain"}>{reviewed ? "Reviewed ✓" : "Review pending"}</span>
    </div>
  );
}
