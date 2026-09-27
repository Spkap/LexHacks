import { eq } from "drizzle-orm";
import Link from "next/link";
import { GalleryActions } from "@/components/gallery-actions";
import { HeroBattle } from "@/components/landing/hero-battle";
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
      const confirmedCount = relevant.filter((c) => c.status === "confirmed").length;
      return { project, ruleCount: relevant.length, confirmedCount };
    }),
  );
}

export default async function Home() {
  const publicProjects = await getPublicProjects();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-14 px-6 py-16">
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Paste a law. Watch AI look for the loophole.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            An Attack agent proposes loopholes grounded in the rule&apos;s own words. A jury of 3 AI judges rules on
            each, blind to the attacker&apos;s arguments. A human breaks ties. Nothing is called a loophole until the
            jury or a human says so.
          </p>
          <GalleryActions />
        </div>
        <HeroBattle />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {["Attack", "Jury", "Repair", "Re-attack"].map((step, i) => (
          <div key={step} className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
            <div className="font-medium">{step}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="text-sm font-semibold">AI argues</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Nine adversarial tactics propose concrete scenarios that might defeat the law&apos;s purpose, each one
            grounded in a verbatim quote from the source text.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="text-sm font-semibold">Code checks the quotes</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every quoted span must exist verbatim in the hashed source. No LLM decides a verdict on its own.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="text-sm font-semibold">Humans decide</div>
          <p className="mt-1 text-sm text-muted-foreground">
            A split jury goes to a human ruling. Humans also approve the purpose and sign every patch.
          </p>
        </div>
      </section>

      {publicProjects.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Public benchmarks</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {publicProjects.map(({ project, ruleCount, confirmedCount }) => (
              <Link key={project.id} href={`/a/${project.slug}`}>
                <Card className="transition-colors hover:border-ink/40">
                  <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {ruleCount} candidates tried · {confirmedCount} confirmed by adversarial review
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
