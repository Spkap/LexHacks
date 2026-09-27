import { notFound } from "next/navigation";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ProvenanceStrip } from "@/components/brand/provenance-strip";
import { StageRail } from "@/components/brand/stage-rail";
import { CompileTrigger } from "@/components/compile/compile-trigger";
import { LockButton } from "@/components/compile/lock-button";
import { RuleRow } from "@/components/compile/rule-row";
import { StatusBadge } from "@/components/brand/status-badge";
import { NotFoundError } from "@/server/errors";
import { completedStages, loadProjectPageData } from "@/server/page-data";

export const dynamic = "force-dynamic";

export default async function CompilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadProjectPageData(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { project, source, purposeRow, formalizationRow, formalization } = data;

  const totalItems = formalization ? formalization.rules.length + formalization.definitions.length : 0;
  const reviewedItems = formalization
    ? formalization.rules.filter((r) => r.status === "approved").length + formalization.definitions.filter((d) => d.status === "approved").length
    : 0;
  const fullyReviewed = totalItems > 0 && reviewedItems === totalItems;

  return (
    <div className="flex flex-1 flex-col">
      <ProvenanceStrip
        sourceHash={source?.sha256}
        purposeVersion={purposeRow?.version}
        formalizationId={formalizationRow?.id}
        formalizationVersion={formalizationRow?.version}
        reviewed={formalizationRow?.status === "locked"}
      />
      <div className="flex flex-1">
        <StageRail slug={project.slug} completed={completedStages(data)} />
        <main className="flex-1 px-8 py-8">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-semibold">Clause Compiler</h1>
            {formalizationRow?.status === "locked" && <StatusBadge status="locked" />}
          </div>

          {!formalization && (
            <div className="mt-6 max-w-md">
              <CompileTrigger projectId={project.id} />
            </div>
          )}

          {formalization && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                {reviewedItems}/{totalItems} rules and definitions reviewed
              </p>

              <div className="mt-6">
                <h2 className="font-heading text-lg font-semibold">Definitions</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {formalization.definitions.map((d) => (
                    <div key={d.name} className="grid grid-cols-[1fr_1fr_auto] gap-4 rounded-lg border border-border/60 bg-card p-4 text-sm">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{d.name}</div>
                        <div className="mt-1">{d.plain}</div>
                      </div>
                      <div className="font-mono text-xs">{d.formula}</div>
                      <StatusBadge status={d.status} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h2 className="font-heading text-lg font-semibold">Rules</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {formalization.rules.map((r) => (
                    <RuleRow key={r.id} projectId={project.id} rule={r} />
                  ))}
                </div>
              </div>

              {formalizationRow?.status !== "locked" && (
                <div className="mt-8">
                  <LockButton projectId={project.id} disabled={!fullyReviewed} />
                  {!fullyReviewed && <p className="mt-2 text-sm text-muted-foreground">All rules and definitions must be approved first.</p>}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <FooterDisclaimer />
    </div>
  );
}
