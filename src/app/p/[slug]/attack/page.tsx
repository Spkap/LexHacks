import { notFound } from "next/navigation";
import { AttackArena } from "@/components/attack/attack-arena";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ProvenanceStrip } from "@/components/brand/provenance-strip";
import { StageRail } from "@/components/brand/stage-rail";
import { NotFoundError } from "@/server/errors";
import { completedStages, loadProjectPageData } from "@/server/page-data";

export const dynamic = "force-dynamic";

export default async function AttackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadProjectPageData(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { project, source, purposeRow, formalizationRow } = data;

  if (formalizationRow?.status !== "locked" || purposeRow?.status !== "approved") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1">
          <StageRail slug={project.slug} completed={completedStages(data)} />
          <main className="flex-1 px-8 py-8">
            <h1 className="font-heading text-2xl font-semibold">Attack Arena</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Lock the formalization and approve the purpose contract before attacking this law.
            </p>
          </main>
        </div>
        <FooterDisclaimer />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ProvenanceStrip
        sourceHash={source?.sha256}
        purposeVersion={purposeRow?.version}
        formalizationId={formalizationRow?.id}
        formalizationVersion={formalizationRow?.version}
        reviewed
      />
      <div className="flex flex-1">
        <StageRail slug={project.slug} completed={completedStages(data)} />
        <main className="flex-1 px-8 py-8">
          <h1 className="font-heading text-2xl font-semibold">Attack Arena</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI proposes exploit scenarios. Only Z3 certifies a finding.</p>
          <div className="mt-6">
            <AttackArena projectId={project.id} slug={project.slug} isDemoTemplate={project.demoTemplate === "ccpa-2018"} />
          </div>
        </main>
      </div>
      <FooterDisclaimer />
    </div>
  );
}
