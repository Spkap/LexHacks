import type { AttackProposal, DefenseVote, LegitVerdict, Quote, RepairProposal, Span } from './contracts';

export type GroundResult = { ok: true } | { ok: false; reasons: string[] };

export function normalize(s: string): string {
  return s.replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"').replace(/\s+/g, ' ').trim();
}

function spanMap(spans: Span[]): Map<string, string> {
  return new Map(spans.map((s) => [s.id, normalize(s.text)]));
}

export function checkQuotes(quotes: Quote[], spans: Span[]): string[] {
  const byId = spanMap(spans);
  const reasons: string[] = [];
  for (const q of quotes) {
    const text = byId.get(q.spanId);
    if (text === undefined) reasons.push(`unknown span ${q.spanId}`);
    else if (!text.includes(normalize(q.text))) reasons.push(`quote not found in ${q.spanId}: "${q.text}"`);
  }
  return reasons;
}

export function groundProposal(p: AttackProposal, spans: Span[]): GroundResult {
  const reasons = checkQuotes(p.quotes, spans);
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** A judge that says "blocked" must quote the words that block it; otherwise the vote is "unclear". */
export function groundVote(v: DefenseVote, spans: Span[]): DefenseVote {
  if (v.verdict !== 'blocked') return v;
  if (v.quotes.length === 0 || checkQuotes(v.quotes, spans).length > 0) return { ...v, verdict: 'unclear' };
  return v;
}

/** "Forbidden" must quote the forbidding words; otherwise the legit-use check is unclear (null). */
export function groundLegit(v: LegitVerdict, spans: Span[]): LegitVerdict | null {
  if (!v.forbidden) return v;
  return v.quotes.length > 0 && checkQuotes(v.quotes, spans).length === 0 ? v : null;
}

export function groundRepair(r: RepairProposal, spans: Span[]): GroundResult {
  const byId = spanMap(spans);
  const reasons: string[] = [];
  for (const edit of r.redline) {
    const text = byId.get(edit.spanId);
    if (text === undefined) { reasons.push(`unknown span ${edit.spanId}`); continue; }
    const hits = text.split(normalize(edit.before)).length - 1;
    if (hits !== 1) reasons.push(`before-text must appear exactly once in ${edit.spanId} (found ${hits})`);
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
