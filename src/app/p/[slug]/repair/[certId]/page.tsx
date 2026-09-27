import { notFound } from "next/navigation";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";
import { RepairStudio } from "@/components/repair/repair-studio";
import { getProjectBySlug } from "@/server/projects";

export const dynamic = "force-dynamic";

export default async function RepairPage({ params }: { params: Promise<{ slug: string; certId: string }> }) {
  const { slug, certId } = await params;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="font-heading text-2xl font-semibold">Repair Studio</h1>
        <p className="text-sm text-muted-foreground">
          A minimal legislative fix, drafted by AI, scored by re-attacking with Z3 before you approve it.
        </p>
        <RepairStudio projectId={project.id} certificateId={certId} slug={slug} />
      </main>
      <FooterDisclaimer />
    </div>
  );
}
