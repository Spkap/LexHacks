import { ImageResponse } from "next/og";
import { loadReportData } from "@/server/report-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { slug: string } }) {
  let title = "Loophole";
  let confirmedCount = 0;
  try {
    const data = await loadReportData(params.slug);
    title = data.project.name;
    confirmedCount = data.findings.filter((f) => f.verdict === "confirmed").length;
  } catch {
    // fall back to default title
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f7f6f2",
          color: "#17201f",
          fontSize: 56,
          fontWeight: 600,
        }}
      >
        <div>{title}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 24, fontSize: 32, color: "#d65a4a" }}>
          <span>{confirmedCount} loopholes confirmed by adversarial review</span>
        </div>
      </div>
    ),
    size,
  );
}
