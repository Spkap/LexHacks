import type { AttackProposal, CandidateStatus, DefenseVote, EffectiveStatus, Lane, Quote, RepairProposal } from "@/core/contracts";
import type { CheckName, RunEventPayload } from "@/core/events";

export interface Chip {
  id: string;
  label?: string;
  lane: Lane;
  title: string;
  scenario: string;
  quotes: Quote[];
  phase: "proposed" | "grounded" | "ungrounded" | "judging" | "done";
  votes: DefenseVote[];
  status: CandidateStatus | EffectiveStatus;
  findingId?: string;
  ungroundedReasons?: string[];
}

export interface CheckItem {
  id: string;
  status: string;
  detail?: string;
}

export interface WarRoomState {
  step: "attack" | "patch" | "reattack";
  chips: Record<string, Chip>;
  order: string[];
  counts: { schemes: number; ungrounded: number; blocked: number; harmless: number; contested: number; confirmed: number };
  activeSpanIds: string[];
  checks: Record<CheckName, { items: CheckItem[]; done?: { pass: boolean; pending: number; detail: string } }>;
  proposals: RepairProposal[];
  patched: boolean;
  attackRunning: boolean;
}

export interface HydrateCandidate {
  id: string;
  label: string | null;
  status: CandidateStatus;
  candidate: AttackProposal;
  findingId?: string;
  votes: DefenseVote[];
  effectiveStatus?: EffectiveStatus;
}

export type Action =
  | { type: "event"; event: RunEventPayload }
  | { type: "ruled"; findingId: string; status: EffectiveStatus }
  | { type: "select"; spanIds: string[] }
  | { type: "reset-attack" }
  | { type: "step"; step: WarRoomState["step"] }
  | { type: "patched" }
  | { type: "hydrate-attack"; candidates: HydrateCandidate[] };

const emptyChecks = (): WarRoomState["checks"] => ({
  old_loopholes: { items: [] },
  fresh_attack: { items: [] },
  legit_uses: { items: [] },
});

export const initialState: WarRoomState = {
  step: "attack",
  chips: {},
  order: [],
  counts: { schemes: 0, ungrounded: 0, blocked: 0, harmless: 0, contested: 0, confirmed: 0 },
  activeSpanIds: [],
  checks: emptyChecks(),
  proposals: [],
  patched: false,
  attackRunning: false,
};

function tacticToLane(proposal: AttackProposal): Lane {
  return proposal.tactic;
}

export function reducer(state: WarRoomState, action: Action): WarRoomState {
  switch (action.type) {
    case "reset-attack":
      return { ...initialState, step: "attack", attackRunning: true };
    case "step":
      return { ...state, step: action.step };
    case "patched":
      return { ...state, patched: true, step: "reattack" };
    case "ruled": {
      const chip = Object.values(state.chips).find((c) => c.findingId === action.findingId);
      if (!chip) return state;
      return { ...state, chips: { ...state.chips, [chip.id]: { ...chip, status: action.status } } };
    }
    case "select":
      return { ...state, activeSpanIds: action.spanIds };
    case "event":
      return applyEvent(state, action.event);
    case "hydrate-attack":
      return hydrateAttack(state, action.candidates);
    default:
      return state;
  }
}

function hydrateAttack(state: WarRoomState, candidates: HydrateCandidate[]): WarRoomState {
  const chips: Record<string, Chip> = {};
  const order: string[] = [];
  const counts = { ...initialState.counts };
  for (const c of candidates) {
    const status = c.effectiveStatus ?? c.status;
    chips[c.id] = {
      id: c.id,
      label: c.label ?? undefined,
      lane: tacticToLane(c.candidate),
      title: c.candidate.title,
      scenario: c.candidate.scenario,
      quotes: c.candidate.quotes,
      phase: c.status === "ungrounded" ? "ungrounded" : "done",
      votes: c.votes,
      status,
      findingId: c.findingId,
    };
    order.push(c.id);
    counts.schemes += 1;
    if (c.status in counts) counts[c.status as keyof typeof counts] += 1;
  }
  return { ...state, chips, order, counts, attackRunning: false };
}

function applyEvent(state: WarRoomState, event: RunEventPayload): WarRoomState {
  switch (event.stage) {
    case "candidate.proposed": {
      const chip: Chip = {
        id: event.candidateId,
        label: event.label,
        lane: tacticToLane(event.proposal),
        title: event.proposal.title,
        scenario: event.proposal.scenario,
        quotes: event.proposal.quotes,
        phase: "proposed",
        votes: [],
        status: "generated",
      };
      return {
        ...state,
        attackRunning: true,
        chips: { ...state.chips, [chip.id]: chip },
        order: state.order.includes(chip.id) ? state.order : [...state.order, chip.id],
        counts: { ...state.counts, schemes: state.counts.schemes + 1 },
      };
    }
    case "candidate.ungrounded": {
      const chip = state.chips[event.candidateId];
      if (!chip) return state;
      return {
        ...state,
        chips: { ...state.chips, [chip.id]: { ...chip, phase: "ungrounded", status: "ungrounded", ungroundedReasons: event.reasons } },
        counts: { ...state.counts, ungrounded: state.counts.ungrounded + 1 },
      };
    }
    case "candidate.grounded": {
      const chip = state.chips[event.candidateId];
      if (!chip) return state;
      return { ...state, chips: { ...state.chips, [chip.id]: { ...chip, phase: "judging" } } };
    }
    case "jury.vote": {
      const chip = state.chips[event.candidateId];
      if (!chip) return state;
      return { ...state, chips: { ...state.chips, [chip.id]: { ...chip, votes: [...chip.votes, event.vote] } } };
    }
    case "candidate.verdict": {
      const chip = state.chips[event.candidateId];
      if (!chip) return state;
      return {
        ...state,
        chips: { ...state.chips, [chip.id]: { ...chip, phase: "done", status: event.status, findingId: event.findingId } },
        counts: { ...state.counts, [event.status as keyof WarRoomState["counts"]]: (state.counts[event.status as keyof WarRoomState["counts"]] ?? 0) + 1 },
      };
    }
    case "repair.proposal":
      return { ...state, proposals: [...state.proposals, event.proposal] };
    case "check.item": {
      const check = state.checks[event.check];
      const items = [...check.items.filter((i) => i.id !== event.id), { id: event.id, status: event.status, detail: event.detail }];
      return { ...state, checks: { ...state.checks, [event.check]: { ...check, items } } };
    }
    case "check.done": {
      const check = state.checks[event.check];
      return { ...state, checks: { ...state.checks, [event.check]: { ...check, done: { pass: event.pass, pending: event.pending, detail: event.detail } } } };
    }
    case "run.summary":
      return { ...state, attackRunning: false };
    default:
      return state;
  }
}
