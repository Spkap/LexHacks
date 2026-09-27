import type { AttackProposal, CandidateStatus, DefenseVote, EffectiveStatus, RepairProposal } from './contracts';

export type CheckName = 'old_loopholes' | 'fresh_attack' | 'legit_uses';

export type RunEventPayload =
  | { stage: 'candidate.proposed'; candidateId: string; label?: string; proposal: AttackProposal }
  | { stage: 'candidate.ungrounded'; candidateId: string; reasons: string[] }
  | { stage: 'candidate.grounded'; candidateId: string; spanIds: string[] }
  | { stage: 'jury.vote'; candidateId: string; vote: DefenseVote }
  | { stage: 'candidate.verdict'; candidateId: string; findingId: string; status: CandidateStatus }
  | { stage: 'repair.proposal'; index: number; proposal: RepairProposal }
  | { stage: 'check.item'; check: CheckName; id: string; status: EffectiveStatus | 'allowed' | 'forbidden' | 'unclear'; detail?: string }
  | { stage: 'check.done'; check: CheckName; pass: boolean; pending: number; detail: string }
  | { stage: 'run.summary'; counts: Record<string, number> };

export type RunStage = RunEventPayload['stage'];
