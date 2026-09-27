import { hashOf } from './canonical';
import { groundRepair, normalize } from './grounding';
import type { RepairProposal, Span } from './contracts';

export interface FindingHashInput { sourceSha: string; purposeHash: string; proposal: unknown; votes: unknown }

export const findingHash = (f: FindingHashInput): string =>
  hashOf({ sourceSha: f.sourceSha, purposeHash: f.purposeHash, proposal: f.proposal, votes: f.votes });

export const verifyFinding = (f: FindingHashInput & { hash: string }): boolean => findingHash(f) === f.hash;

/**
 * Returns NEW spans with each edit applied. Patched spans are stored in normalized form
 * (straight quotes, single spaces): the patched text is our draft, not the official text.
 */
export function applyRedline(spans: Span[], redline: RepairProposal['redline']): Span[] {
  const check = groundRepair({ title: 'apply', rationale: 'apply', redline }, spans);
  if (!check.ok) throw new Error(`applyRedline: ${check.reasons.join('; ')}`);
  return spans.map((span) => {
    const edits = redline.filter((e) => e.spanId === span.id);
    if (edits.length === 0) return { ...span };
    // Function replacer: bill text often contains "$" ("$25,000,000"), which a string replacer would treat as a pattern.
    const text = edits.reduce((acc, e) => acc.replace(normalize(e.before), () => e.after), normalize(span.text));
    return { ...span, text };
  });
}
