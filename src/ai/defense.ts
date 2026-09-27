import { DefenseVote, JUDGES, LegitVerdict, type Judge, type PurposeContract, type Span } from '@/core/contracts';
import { callStructured } from './call';
import { buildDefensePrompt, buildDefenseSystem, buildLegitPrompt, SYSTEM_LEGIT } from './prompts/defense';

const DefenseVoteOutput = DefenseVote.omit({ judge: true });

export const activeJudges = (): Judge[] =>
  process.env.DEFENSE_JURY === 'textualist' ? ['textualist'] : [...JUDGES];

export interface JudgeArgs {
  runId?: string;
  mode?: 'demo' | 'live';
  scenario: string;
  spans: Span[];
  purpose: PurposeContract;
}

async function judgeOnce(args: JudgeArgs & { judge: Judge }): Promise<DefenseVote | null> {
  const result = await callStructured(`jury-${args.judge}`, {
    runId: args.runId,
    mode: args.mode,
    model: 'reasoning',
    schema: DefenseVoteOutput,
    system: buildDefenseSystem(args.judge),
    prompt: buildDefensePrompt(args.scenario, args.spans, args.purpose),
    temperature: 0,
  });
  if (!result.ok) return null;
  return { ...result.data, judge: args.judge };
}

export async function judgeScheme(args: JudgeArgs): Promise<DefenseVote[]> {
  const judges = activeJudges();
  const votes = await Promise.all(judges.map((judge) => judgeOnce({ ...args, judge })));
  return votes.map((v, i) => v ?? { judge: judges[i], verdict: 'unclear' as const, quotes: [], reasoning: 'Judge unavailable.' });
}

export interface LegitArgs {
  runId?: string;
  mode?: 'demo' | 'live';
  scenario: string;
  spans: Span[];
}

export async function isForbidden(args: LegitArgs): Promise<LegitVerdict | null> {
  const result = await callStructured('legit-use', {
    runId: args.runId,
    mode: args.mode,
    model: 'reasoning',
    schema: LegitVerdict,
    system: SYSTEM_LEGIT,
    prompt: buildLegitPrompt(args.scenario, args.spans),
    temperature: 0,
  });
  return result.ok ? result.data : null;
}
