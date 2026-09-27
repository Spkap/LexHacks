import { eq } from "drizzle-orm";
import Link from "next/link";
import { GalleryActions } from "@/components/gallery-actions";
import { HeroBattle } from "@/components/landing/hero-battle";
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
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
      <section className="grid flex-1 grid-cols-1 items-center gap-8 py-10 sm:py-14 lg:min-h-[min(700px,calc(100dvh-9rem))] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12 lg:py-12">
        <div className="flex flex-col items-start gap-5 lg:pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-attack" />
            For bills and public rules
          </div>
          <h1 className="max-w-[11ch] font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl xl:text-7xl">
            Find the loophole before reality does.
          </h1>
          <p className="max-w-[52ch] text-base leading-7 text-muted-foreground sm:text-lg">
            Rules can follow their wording and still fail their purpose. Nine AI tactics probe the gap; three judges test quote-grounded claims. You make the call.
          </p>
          <GalleryActions />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Demo case: California Consumer Privacy Act (2018)
          </p>
        </div>
        <div className="min-w-0 lg:py-6">
          <HeroBattle />
        </div>
      </section>

      <section aria-label="How Loophole works" className="grid grid-cols-1 border-y border-border/70 sm:grid-cols-3">
        {[
          { n: "01", title: "Attack", detail: "Nine tactics probe where wording leaves room." },
          { n: "02", title: "Cross-examine", detail: "Code checks the quotes. Three judges weigh each claim." },
          { n: "03", title: "Repair", detail: "You sign a patch, then re-attack." },
        ].map((step) => (
          <div key={step.n} className="flex items-start gap-4 py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0 [&+div]:border-t [&+div]:border-border/70 sm:[&+div]:border-l sm:[&+div]:border-t-0">
            <span className="pt-0.5 font-mono text-xs text-attack">{step.n}</span>
            <div>
              <h2 className="text-sm font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </section>

      {publicProjects.length > 0 && (
        <section className="flex flex-col gap-4 py-10">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Public benchmarks</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicProjects.map(({ project, ruleCount, confirmedCount }) => (
              <Link key={project.id} href={`/a/${project.slug}`} className="group flex items-center justify-between gap-4 border border-border/70 bg-white/40 p-4 transition-colors hover:border-ink/40 hover:bg-white/80">
                <span>
                  <span className="block font-medium">{project.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{ruleCount} scenarios reviewed</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-attack group-hover:underline">{confirmedCount} found ↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
