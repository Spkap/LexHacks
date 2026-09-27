import { describe, expect, it } from "vitest";
import type { AttackProposal, DefenseVote } from "@/core/contracts";
import type { RunEventPayload } from "@/core/events";
import { initialState, reducer, type WarRoomState } from "../reducer";

const proposal = (title: string): AttackProposal => ({
  tactic: "no_consideration",
  title,
  scenario: "s",
  quotes: [{ spanId: "S2", text: "for monetary or other valuable consideration" }],
  whyWordsPermit: "w",
  whyPurposeDefeated: "p",
});

const vote = (judge: DefenseVote["judge"], verdict: DefenseVote["verdict"]): DefenseVote => ({ judge, verdict, quotes: [], reasoning: "r" });

function run(events: RunEventPayload[]): WarRoomState {
  return events.reduce((state, event) => reducer(state, { type: "event", event }), initialState);
}

describe("war room reducer", () => {
  it("tracks a confirmed loophole end to end", () => {
    const events: RunEventPayload[] = [
      { stage: "candidate.proposed", candidateId: "c1", label: "C1", proposal: proposal("Free hand-off") },
      { stage: "candidate.grounded", candidateId: "c1", spanIds: ["S2"] },
      { stage: "jury.vote", candidateId: "c1", vote: vote("textualist", "loophole") },
      { stage: "jury.vote", candidateId: "c1", vote: vote("purposivist", "loophole") },
      { stage: "jury.vote", candidateId: "c1", vote: vote("enforcer", "loophole") },
      { stage: "candidate.verdict", candidateId: "c1", findingId: "f1", status: "confirmed" },
      { stage: "run.summary", counts: { schemes: 1, confirmed: 1 } },
    ];
    const state = run(events);
    expect(state.chips.c1.status).toBe("confirmed");
    expect(state.chips.c1.votes).toHaveLength(3);
    expect(state.counts).toMatchObject({ schemes: 1, confirmed: 1 });
    expect(state.attackRunning).toBe(false);
  });

  it("marks a bad quote ungrounded and never judges it", () => {
    const events: RunEventPayload[] = [
      { stage: "candidate.proposed", candidateId: "c2", label: "C2", proposal: proposal("Bad quote") },
      { stage: "candidate.ungrounded", candidateId: "c2", reasons: ["quote not found in S2: \"x\""] },
    ];
    const state = run(events);
    expect(state.chips.c2.status).toBe("ungrounded");
    expect(state.chips.c2.phase).toBe("ungrounded");
    expect(state.counts.ungrounded).toBe(1);
  });

  it("a human ruling overrides the chip status shown for a contested finding", () => {
    let state = run([
      { stage: "candidate.proposed", candidateId: "c3", label: "C3", proposal: proposal("Split jury") },
      { stage: "candidate.verdict", candidateId: "c3", findingId: "f3", status: "contested" },
    ]);
    state = reducer(state, { type: "ruled", findingId: "f3", status: "ruled_loophole" });
    expect(state.chips.c3.status).toBe("ruled_loophole");
  });

  it("accumulates check.item and check.done events per check name", () => {
    const state = run([
      { stage: "check.item", check: "legit_uses", id: "G1", status: "allowed" },
      { stage: "check.item", check: "legit_uses", id: "G2", status: "forbidden" },
      { stage: "check.done", check: "legit_uses", pass: false, pending: 0, detail: "1/2 kept" },
    ]);
    expect(state.checks.legit_uses.items).toHaveLength(2);
    expect(state.checks.legit_uses.done).toEqual({ pass: false, pending: 0, detail: "1/2 kept" });
  });
});
