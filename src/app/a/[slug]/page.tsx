import { notFound } from "next/navigation";
import type { AttackProposal, DefenseVote } from "@/core/contracts";
import { WarRoom } from "@/components/warroom/war-room";
import type { HydrateCandidate } from "@/components/warroom/reducer";
import { NotFoundError, ForbiddenError } from "@/server/errors";
import { loadWarRoomData } from "@/server/war-room-data";

export default async function WarRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data;
  try {
    data = await loadWarRoomData(slug);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }

  const latestAttack = data.latestAttack
    ? {
        runId: data.latestAttack.runId,
        candidates: data.latestAttack.candidates.map((c): HydrateCandidate => {
          const finding = data.latestAttack!.findings.find((f) => f.candidateId === c.id);
          return {
            id: c.id,
            label: c.label,
            status: c.status,
            candidate: c.candidate as AttackProposal,
            findingId: finding?.id,
            votes: (finding?.votes as DefenseVote[] | undefined) ?? [],
            effectiveStatus: finding?.effectiveStatus,
          };
        }),
      }
    : null;

  return (
    <WarRoom
      initial={{
        project: { id: data.project.id, slug: data.project.slug, name: data.project.name },
        source: data.source ? { id: data.source.id, sha256: data.source.sha256 } : null,
        spans: data.spans,
        purpose: data.purpose,
        latestAttack,
        patched: data.latestRepair?.status === "approved",
      }}
    />
  );
}
