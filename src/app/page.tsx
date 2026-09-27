import { eq } from "drizzle-orm";
import Link from "next/link";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { GalleryActions } from "@/components/gallery-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { projects, runs } from "@/db/schema";

export const dynamic = "force-dynamic";

async function getPublicProjects() {
  const publicProjects = await db.query.projects.findMany({ where: eq(projects.isPublic, true) });
  return Promise.all(
    publicProjects.map(async (project) => {
      const projectRuns = await db.query.runs.findMany({ where: eq(runs.projectId, project.id) });
      const runIds = projectRuns.map((r) => r.id);
      const candidates = runIds.length > 0 ? await db.query.attackCandidates.findMany() : [];
      const relevant = candidates.filter((c) => runIds.includes(c.runId));
      const certifiedCount = relevant.filter((c) => c.status === "certified").length;
      return { project, ruleCount: relevant.length, certifiedCount };
    }),
  );
}

export default async function Home() {
  const publicProjects = await getPublicProjects();

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-6 py-16">
        <section className="flex flex-col gap-4">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Fuzz your law before AI agents do.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Loophole compiles a rule and its purpose into a checkable model, lets AI attack it, and only counts exploits a
            solver can prove.
          </p>
          <GalleryActions />
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {["Attack", "Certify", "Repair", "Re-attack"].map((step, i) => (
            <div key={step} className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
              <div className="font-medium">{step}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-sm font-semibold">AI explores</div>
            <p className="mt-1 text-sm text-muted-foreground">Adversarial tactics propose concrete scenarios that might defeat the law&apos;s purpose.</p>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-sm font-semibold">Humans approve meaning</div>
            <p className="mt-1 text-sm text-muted-foreground">Every variable and rule traces to hashed source text, reviewed before it can be attacked.</p>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-sm font-semibold">Z3 certifies</div>
            <p className="mt-1 text-sm text-muted-foreground">The AI cannot award itself a finding. Only the solver can.</p>
          </div>
        </section>

        {publicProjects.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-xl font-semibold">Public benchmarks</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {publicProjects.map(({ project, ruleCount, certifiedCount }) => (
                <Link key={project.id} href={`/p/${project.slug}/source`}>
                  <Card className="transition-colors hover:border-ink/40">
                    <CardHeader>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {ruleCount} candidates tried · {certifiedCount} certified findings
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <FooterDisclaimer />
    </div>
  );
}
