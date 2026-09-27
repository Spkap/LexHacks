export interface PasteSpan {
  id: string;
  sectionPath: string;
  label: string;
  text: string;
}

const MAX_SPANS = 20;

// Matches a section boundary at the start of a line: "SEC. 3.", "Section 1798.140.",
// or a lettered/numbered subsection like "(a)", "(1)", "(A)".
const MARKER = /^(SEC\.\s*\d+[A-Za-z]?\.?|Section\s+[\d.]+[A-Za-z]?\.?|\([a-z]{1,2}\)|\([0-9]{1,3}\)|\([A-Z]{1,2}\))/m;

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 80 ? `${line.slice(0, 80)}...` : line;
}

/**
 * Splits pasted bill text into spans by section markers. Falls back to a single
 * full-text span when no markers are found, and caps at MAX_SPANS by folding any
 * overflow into the last kept span (spans stay contiguous, no text is dropped).
 */
export function splitIntoSpans(text: string, title: string): PasteSpan[] {
  const global = new RegExp(MARKER.source, 'gm');
  const starts: { index: number; marker: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    starts.push({ index: match.index, marker: match[0] });
    if (global.lastIndex === match.index) global.lastIndex += 1;
  }

  if (starts.length === 0) {
    return [{ id: 'S1', sectionPath: 'full-text', label: title, text }];
  }

  const boundaries = starts.length > MAX_SPANS ? starts.slice(0, MAX_SPANS) : starts;

  const chunks: { marker: string; text: string }[] = [];
  if (boundaries[0].index > 0) {
    chunks.push({ marker: 'preamble', text: text.slice(0, boundaries[0].index) });
  }
  for (let i = 0; i < boundaries.length; i += 1) {
    const start = boundaries[i].index;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : text.length;
    chunks.push({ marker: boundaries[i].marker, text: text.slice(start, end) });
  }

  return chunks
    .filter((c) => c.text.trim().length > 0)
    .map((c, i) => ({
      id: `S${i + 1}`,
      sectionPath: c.marker,
      label: firstLine(c.text) || c.marker,
      text: c.text.trim(),
    }));
}
