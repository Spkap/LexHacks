import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { VerifyAgainButton } from "@/components/findings/verify-again-button";
import { Button } from "@/components/ui/button";
import { verifyCertificate, type Certificate } from "@/core/certificate";
import type { SolveStatus } from "@/core/engine";
import { db } from "@/db/client";
import { attackCandidates, certificates, formalizations } from "@/db/schema";
import { getProjectBySlug } from "@/server/projects";

export const dynamic = "force-dynamic";

export default async function FindingPage({ params }: { params: Promise<{ slug: string; certId: string }> }) {
  const { slug, certId } = await params;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const certRow = await db.query.certificates.findFirst({ where: eq(certificates.id, certId) });
  if (!certRow) notFound();

  const candidateRow = await db.query.attackCandidates.findFirst({ where: eq(attackCandidates.id, certRow.candidateId) });
  const formalizationRow = await db.query.formalizations.findFirst({ where: eq(formalizations.id, certRow.formalizationId) });

  const certificate: Certificate = {
    candidateId: certRow.candidateId,
    formalizationHash: certRow.formalizationHash,
    invariantHash: certRow.invariantHash,
    candidateHash: certRow.candidateHash,
    result: certRow.result as SolveStatus,
    model: certRow.model as Certificate["model"],
    smtlib: certRow.smtlib,
    solverVersion: certRow.solverVersion,
    elapsedMs: certRow.elapsedMs,
    inputHash: certRow.inputHash,
    hash: certRow.hash,
  };
  const verified = verifyCertificate(certificate);
  const explanation = certRow.explanation as { complies: string; harms: string; trace: { text: string; spanIds: string[] }[] } | null;
  const candidate = candidateRow?.candidate as { narrative: string; tactic: string } | undefined;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Certified within model {formalizationRow?.id.slice(0, 8)} v{formalizationRow?.version}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            hash {certRow.hash.slice(0, 16)}… · {verified ? "verified ✓" : "VERIFICATION FAILED"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-verified/40 bg-verified/10 p-4">
            <div className="text-sm font-semibold text-verified">Law satisfied ✓</div>
          </div>
          <div className="rounded-lg border border-attack/40 bg-attack/10 p-4">
            <div className="text-sm font-semibold text-attack">Purpose violated ✕</div>
          </div>
        </div>

        {candidate && (
          <div>
            <h2 className="font-heading text-lg font-semibold">Scenario</h2>
            <p className="mt-1 text-sm">{candidate.narrative}</p>
            <div className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">{JSON.stringify(certificate.model, null, 2)}</div>
          </div>
        )}

        {explanation && (
          <>
            <div>
              <h2 className="font-heading text-lg font-semibold">Why this complies</h2>
              <p className="mt-1 text-sm">{explanation.complies}</p>
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold">Why this defeats the purpose</h2>
              <p className="mt-1 text-sm">{explanation.harms}</p>
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold">Proof trace</h2>
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {explanation.trace.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                    <span>
                      {step.text}
                      {step.spanIds.length > 0 && (
                        <span className="ml-1 font-mono text-xs text-repair">[{step.spanIds.join(", ")}]</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <Link href={`/p/${slug}/repair/${certId}`}>
            <Button className="bg-repair text-white hover:bg-repair/90">Repair this</Button>
          </Link>
          <VerifyAgainButton certificateId={certId} />
        </div>
      </main>
      <FooterDisclaimer />
    </div>
  );
}
