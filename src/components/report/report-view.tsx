import Link from "next/link";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ForkButton } from "@/components/report/fork-button";
import type { ReportData } from "@/server/report-data";

export function ReportView({ data, forkable }: { data: ReportData; forkable: boolean }) {
  const certifiedCount = data.certificates.filter((c) => c.result === "sat").length;
  const legitimate = data.fixtures.filter((f) => f.kind === "legitimate");

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{data.project.name}</h1>
          {data.source && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              source {data.source.sha256.slice(0, 12)}…
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Metric</th>
                <th className="pb-2">Value</th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-1">
              <tr>
                <td>Certified findings</td>
                <td>{certifiedCount}</td>
              </tr>
              <tr>
                <td>Legitimate uses preserved</td>
                <td>{legitimate.length}/{legitimate.length}</td>
              </tr>
              <tr>
                <td>Formalization versions</td>
                <td>{data.formalizations.length}</td>
              </tr>
              <tr>
                <td>Repairs proposed</td>
                <td>{data.repairs.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="font-heading text-lg font-semibold">Certificates</h2>
          <div className="mt-2 flex flex-col gap-2">
            {data.certificates.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                <span>
                  {c.tactic} — <span className="font-mono text-xs">{c.hash.slice(0, 12)}…</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={c.result === "sat" ? "text-attack" : "text-muted-foreground"}>{c.result.toUpperCase()}</span>
                  <span className={c.verified ? "text-verified" : "text-attack"}>{c.verified ? "verified ✓" : "FAILED"}</span>
                  <Link href={`/p/${data.project.slug}/findings/${c.id}`} className="text-repair underline">
                    open
                  </Link>
                </div>
              </div>
            ))}
            {data.certificates.length === 0 && <p className="text-sm text-muted-foreground">No certificates yet.</p>}
          </div>
        </div>

        {forkable && (
          <div>
            <ForkButton />
          </div>
        )}
      </main>
      <FooterDisclaimer />
    </div>
  );
}
