import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { NotFoundError } from "@/server/errors";
import { loadReportData } from "@/server/report-data";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadReportData(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  return <ReportView data={data} forkable />;
}
