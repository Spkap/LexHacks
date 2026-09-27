import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ProvenanceStrip } from "@/components/brand/provenance-strip";
import { StageRail } from "@/components/brand/stage-rail";
import { CopyHashButton } from "@/components/source/copy-hash-button";
import { db } from "@/db/client";
import { sourceSpans } from "@/db/schema";
import { NotFoundError } from "@/server/errors";
import { completedStages, loadProjectPageData } from "@/server/page-data";

export const dynamic = "force-dynamic";

export default async function SourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadProjectPageData(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { project, source, purposeRow, formalizationRow } = data;
  if (!source) notFound();

  const spans = await db.query.sourceSpans.findMany({ where: eq(sourceSpans.sourceId, source.id) });

  return (
    <div className="flex flex-1 flex-col">
      <ProvenanceStrip
        sourceHash={source.sha256}
        purposeVersion={purposeRow?.version}
        formalizationId={formalizationRow?.id}
        formalizationVersion={formalizationRow?.version}
        reviewed={formalizationRow?.status === "locked"}
      />
      <div className="flex flex-1">
        <StageRail slug={project.slug} completed={completedStages(data)} />
        <main className="flex-1 px-8 py-8">
          <h1 className="font-heading text-2xl font-semibold">{source.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Jurisdiction</dt>
              <dd>{source.jurisdiction}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Version</dt>
              <dd>{source.officialVersionId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Retrieved</dt>
              <dd>{source.retrievedAt}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SHA-256</dt>
              <dd className="flex items-center gap-1 font-mono text-xs">
                {source.sha256.slice(0, 12)}…
                <CopyHashButton hash={source.sha256} />
              </dd>
            </div>
          </dl>
          {source.canonicalUrl && (
            <a href={source.canonicalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-repair underline">
              {source.canonicalUrl}
            </a>
          )}

          {project.demoTemplate === "ccpa-2018" && (
            <p className="mt-4 rounded-md border border-uncertain/40 bg-uncertain/10 px-3 py-2 text-sm text-uncertain">
              Later version hidden from the attack pipeline until reveal.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            {spans.map((span) => (
              <div key={span.id} className="rounded-lg border border-border/60 bg-card p-4">
                <div className="mb-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{span.id}</span>
                  {span.sectionPath}
                </div>
                <div className="mb-1 text-sm font-medium">{span.label}</div>
                <p className="whitespace-pre-line text-sm leading-relaxed">{span.text}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
      <FooterDisclaimer />
    </div>
  );
}
