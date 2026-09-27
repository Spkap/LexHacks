import type { AttackProposal, PurposeContract, Span } from '@/core/contracts';
import { renderPurpose, renderSpans, SPAN_ID_RULE, UNTRUSTED } from './shared';

export const SYSTEM_REPAIR = `You are legislative drafting counsel. Close the loophole with the SMALLEST possible textual change.
Rules:
1. Each edit names a span id, a "before" string copied EXACTLY from that span (it must appear once), and the "after" replacement.
2. Add new definitions inside the "after" text of an existing span (e.g. append a sentence to a definition).
3. Never ban the legitimate uses listed under MUST STAY LEGAL.
4. If one change can close several listed loopholes, prefer it.
${UNTRUSTED}
${SPAN_ID_RULE}`;

export interface RepairFindingContext {
  proposal: AttackProposal;
}

export function buildRepairPrompt(
  finding: RepairFindingContext,
  otherLoopholes: RepairFindingContext[],
  spans: Span[],
  purpose: PurposeContract,
): string {
  const others = otherLoopholes
    .map((f) => `- ${f.proposal.title}: ${f.proposal.scenario}`)
    .join('\n');

  return `${renderSpans(spans)}

${renderPurpose(purpose)}

LOOPHOLE TO CLOSE:
Title: ${finding.proposal.title}
Scenario: ${finding.proposal.scenario}
Quotes: ${finding.proposal.quotes.map((q) => `[${q.spanId}] "${q.text}"`).join('; ')}

OTHER CONFIRMED LOOPHOLES ON THIS SOURCE (close them too if one change can do it):
${others || 'none'}

Propose up to 3 alternative repairs, ordered best first.`;
}
