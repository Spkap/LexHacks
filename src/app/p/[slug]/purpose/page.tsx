import { notFound } from "next/navigation";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ProvenanceStrip } from "@/components/brand/provenance-strip";
import { StageRail } from "@/components/brand/stage-rail";
import { PurposeEditor } from "@/components/purpose/purpose-editor";
import { NotFoundError } from "@/server/errors";
import { completedStages, loadProjectPageData } from "@/server/page-data";

export const dynamic = "force-dynamic";

export default async function PurposePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadProjectPageData(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { project, source, purposeRow, purpose, formalizationRow, fixtures } = data;
  const legitimateCount = fixtures.filter((f) => f.kind === "legitimate").length;
  const exploitCount = fixtures.filter((f) => f.kind === "exploit").length;

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
          <h1 className="font-heading text-2xl font-semibold">Purpose Contract</h1>
          <p className="mt-1 text-sm text-muted-foreground">What this law is for, not just what it says.</p>

          <div className="mt-6 max-w-2xl">
            <PurposeEditor projectId={project.id} initial={purpose} fixtureCount={{ legitimate: legitimateCount, exploit: exploitCount }} />
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold">Must remain allowed</h2>
            <div className="mt-3 flex flex-col gap-2">
              {fixtures
                .filter((f) => f.kind === "legitimate")
                .map((f) => (
                  <div key={f.id} className="rounded-md border border-verified/40 bg-verified/5 px-3 py-2 text-sm">
                    <span className="font-medium">{f.label}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(f.pins)}</span>
                  </div>
                ))}
              {legitimateCount === 0 && <p className="text-sm text-muted-foreground">None on file yet.</p>}
            </div>
          </div>
        </main>
      </div>
      <FooterDisclaimer />
    </div>
  );
}
