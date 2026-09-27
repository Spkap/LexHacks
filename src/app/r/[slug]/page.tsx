import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { NotFoundError, ForbiddenError } from "@/server/errors";
import { loadReportData } from "@/server/report-data";

export const revalidate = 3600;

export default async function PublicCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadReportData(slug);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }

  if (!data.project.isPublic) notFound();

  return <ReportView data={data} forkable />;
}
