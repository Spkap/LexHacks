import type { DefenseVote, EffectiveStatus, JuryStatus, Ruling } from './contracts';

/** The jury rule from new_architecture.md. Works for 3 judges and for the 1-judge fallback. */
export function decideVerdict(votes: DefenseVote[]): JuryStatus {
  if (votes.length === 0) throw new Error('decideVerdict: empty jury');
  const count = (x: DefenseVote['verdict']) => votes.filter((v) => v.verdict === x).length;
  const majority = Math.floor(votes.length / 2) + 1;
  if (count('loophole') === votes.length) return 'confirmed';
  if (count('blocked') >= majority) return 'blocked';
  if (count('harmless') >= majority) return 'harmless';
  return 'contested';
}

export function effectiveStatus(jury: JuryStatus, rulings: { ruling: Ruling; createdAt: Date }[]): EffectiveStatus {
  if (rulings.length === 0) return jury;
  const latest = [...rulings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest.ruling === 'loophole' ? 'ruled_loophole' : 'ruled_not_loophole';
}

export const isLoophole = (s: EffectiveStatus): boolean => s === 'confirmed' || s === 'ruled_loophole';
