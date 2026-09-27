import type { Lane, PurposeContract, Span } from '@/core/contracts';
import { renderPurpose, renderSpans, UNTRUSTED } from './shared';

export const SYSTEM_ATTACK = `You are red-team counsel for a company that wants to defeat the PURPOSE of a law while obeying its exact words.
Propose concrete schemes a motivated actor could really adopt.
Rules:
1. "scenario" is facts only (who does what, to whom, for what), at most 4 sentences, no legal argument.
2. "quotes" must copy words EXACTLY from the <source> spans, with the span id. Never paraphrase. Never quote text that is not there.
3. Put your legal argument in "whyWordsPermit" and "whyPurposeDefeated".
4. A scheme that the law's words clearly forbid, or that does not defeat the purpose, is useless. Only propose real gaps.
${UNTRUSTED}`;

const TACTIC_HINTS: Record<Lane, string> = {
  threshold_split: 'Structure the facts so a numeric threshold in a rule is narrowly avoided.',
  relabel: 'Relabel a role or recipient (e.g. claim an exception category) without changing the underlying substance.',
  affiliate: 'Route the conduct through an affiliate or nominal intermediary to change which rule applies.',
  timing: 'Sequence events so the rule that would forbid the outcome never actually triggers.',
  exception_abuse: 'Stretch a legitimate exception to cover conduct it was not meant to cover.',
  nominal_review: 'Satisfy a procedural checkbox in the rule without achieving the substantive outcome it exists for.',
  redefine_consideration: 'Structure payment or value exchange so it falls outside how the rule defines "consideration".',
  no_consideration: 'Remove monetary or other valuable consideration from the transaction entirely.',
  procedure_without_outcome: 'Follow the required procedure exactly while still producing the harm the rule was meant to prevent.',
};

const EXAMPLE = `EXAMPLE (tactic no_consideration):
scenario: "A covered business gives an opted-out consumer's browsing data to an ad network for free. The ad network uses it for cross-context behavioral advertising."
quotes: [{ "spanId": "S2", "text": "for monetary or other valuable consideration" }]
whyWordsPermit: "'Sell' requires consideration, so a free transfer is not a sale and the opt-out prohibition never applies."
whyPurposeDefeated: "The opted-out consumer's data still reaches a third party for cross-context advertising."`;

export function buildAttackPrompt(spans: Span[], purpose: PurposeContract, lane: Lane, k: number): string {
  return `${renderSpans(spans)}

${renderPurpose(purpose)}

Tactic: ${lane}
Hint: ${TACTIC_HINTS[lane]}

${EXAMPLE}

Propose up to ${k} distinct schemes using this tactic.`;
}
