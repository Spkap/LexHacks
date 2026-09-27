import Link from "next/link";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { ForkButton } from "@/components/report/fork-button";
import type { ReportData } from "@/server/report-data";

export function ReportView({ data, forkable }: { data: ReportData; forkable: boolean }) {
  const confirmedCount = data.findings.filter((f) => f.verdict === "confirmed").length;
  const legitimateTotal = data.purpose?.contract.legitimateUses.length ?? 0;

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
                <td>Loopholes confirmed by adversarial review</td>
                <td>{confirmedCount}</td>
              </tr>
              <tr>
                <td>Legitimate uses on file</td>
                <td>{legitimateTotal}</td>
              </tr>
              <tr>
                <td>Repairs proposed</td>
                <td>{data.repairs.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="font-heading text-lg font-semibold">Findings</h2>
          <div className="mt-2 flex flex-col gap-2">
            {data.findings.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                <span>
                  {f.tactic} — <span className="font-mono text-xs">{f.hash.slice(0, 12)}…</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={f.verdict === "confirmed" ? "text-attack" : "text-muted-foreground"}>{f.verdict.toUpperCase()}</span>
                  <Link href={`/a/${data.project.slug}?f=${f.id}`} className="text-repair underline">
                    open
                  </Link>
                </div>
              </div>
            ))}
            {data.findings.length === 0 && <p className="text-sm text-muted-foreground">No findings yet.</p>}
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
