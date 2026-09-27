import { z } from 'zod';

export const LANES = [
  'threshold_split', 'relabel', 'affiliate', 'timing', 'exception_abuse',
  'nominal_review', 'redefine_consideration', 'no_consideration', 'procedure_without_outcome',
] as const;
export const Lane = z.enum(LANES);
export type Lane = z.infer<typeof Lane>;

export const Quote = z.object({ spanId: z.string().min(1), text: z.string().min(3) });
export type Quote = z.infer<typeof Quote>;

export const AttackProposal = z.object({
  tactic: Lane,
  title: z.string().min(3).max(80),
  scenario: z.string().min(10).max(700),
  quotes: z.array(Quote).min(1).max(4),
  whyWordsPermit: z.string().min(3).max(700),
  whyPurposeDefeated: z.string().min(3).max(700),
});
export type AttackProposal = z.infer<typeof AttackProposal>;

export const JUDGES = ['textualist', 'purposivist', 'enforcer'] as const;
export const Judge = z.enum(JUDGES);
export type Judge = z.infer<typeof Judge>;

export const VoteVerdict = z.enum(['blocked', 'harmless', 'loophole', 'unclear']);
export const DefenseVote = z.object({
  judge: Judge,
  verdict: VoteVerdict,
  quotes: z.array(Quote).max(3),
  reasoning: z.string().min(1).max(900),
});
export type DefenseVote = z.infer<typeof DefenseVote>;

export const LegitVerdict = z.object({
  forbidden: z.boolean(),
  quotes: z.array(Quote).max(3),
  reasoning: z.string().min(3).max(600),
});
export type LegitVerdict = z.infer<typeof LegitVerdict>;

export const RedlineEdit = z.object({ spanId: z.string().min(1), before: z.string().min(3), after: z.string() });
export const RepairProposal = z.object({
  title: z.string().min(3).max(80),
  redline: z.array(RedlineEdit).min(1).max(4),
  rationale: z.string().min(3).max(700),
});
export type RepairProposal = z.infer<typeof RepairProposal>;

export const PurposeSuggestion = z.object({
  sentence: z.object({
    protectedClass: z.string().min(2), preventOutcome: z.string().min(2),
    without: z.string().min(2), evenWhen: z.string().min(2),
  }),
  legitimateUses: z.array(z.string().min(10)).min(1).max(3),
});
export type PurposeSuggestion = z.infer<typeof PurposeSuggestion>;

export const PurposeContract = z.object({
  sentence: PurposeSuggestion.shape.sentence,
  legitimateUses: z.array(z.object({ id: z.string(), scenario: z.string().min(10) })).min(1).max(5),
});
export type PurposeContract = z.infer<typeof PurposeContract>;

export type JuryStatus = 'confirmed' | 'blocked' | 'harmless' | 'contested';
export type CandidateStatus = 'generated' | 'ungrounded' | JuryStatus;
export type EffectiveStatus = JuryStatus | 'ruled_loophole' | 'ruled_not_loophole';
export const Ruling = z.enum(['loophole', 'no_loophole']);
export type Ruling = z.infer<typeof Ruling>;

export interface Span { id: string; sectionPath: string; label: string; text: string }
