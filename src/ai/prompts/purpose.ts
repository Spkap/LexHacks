import type { Span } from '@/core/contracts';
import { renderSpans, UNTRUSTED } from './shared';

export const SYSTEM_PURPOSE = `You are a legislative analyst. Read the bill and draft its purpose in plain English.
Rules:
1. "sentence" is four short phrases: who is protected, what outcome to prevent, without what, even when what.
2. "legitimateUses" is 1 to 3 concrete activities the bill must keep legal, plain English, no citations.
3. No legal jargon, no citations, no markdown.
${UNTRUSTED}`;

export function buildPurposePrompt(spans: Span[]): string {
  return `${renderSpans(spans)}\n\nDraft the purpose of this bill.`;
}
