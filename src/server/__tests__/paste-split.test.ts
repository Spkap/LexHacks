import { describe, expect, it } from 'vitest';
import { splitIntoSpans } from '../paste-split';

describe('splitIntoSpans', () => {
  it('falls back to a single full-text span when no markers are found', () => {
    const spans = splitIntoSpans('just some plain prose with no structure at all', 'Draft');
    expect(spans).toEqual([{ id: 'S1', sectionPath: 'full-text', label: 'Draft', text: 'just some plain prose with no structure at all' }]);
  });

  it('splits on SEC. markers', () => {
    const text = 'SEC. 1. Short title.\nThis act may be cited as the Test Act.\nSEC. 2. Findings.\nThe legislature finds as follows.';
    const spans = splitIntoSpans(text, 'Test Bill');
    expect(spans).toHaveLength(2);
    expect(spans[0].sectionPath).toBe('SEC. 1.');
    expect(spans[0].text).toContain('Short title');
    expect(spans[1].sectionPath).toBe('SEC. 2.');
    expect(spans[1].text).toContain('Findings');
  });

  it('splits on Section markers and lettered subsections', () => {
    const text = 'Section 1798.140. Definitions.\n(a) Aggregate consumer information means information.\n(b) Biometric information means data.';
    const spans = splitIntoSpans(text, 'CCPA excerpt');
    expect(spans.map((s) => s.sectionPath)).toEqual(['Section 1798.140.', '(a)', '(b)']);
  });

  it('keeps a preamble chunk before the first marker', () => {
    const text = 'An act to amend Section 5.\nSEC. 1. This act does X.';
    const spans = splitIntoSpans(text, 'Draft');
    expect(spans[0].sectionPath).toBe('preamble');
    expect(spans[0].text).toContain('An act to amend');
    expect(spans[1].sectionPath).toBe('SEC. 1.');
  });

  it('caps at 20 spans and folds overflow into the last one, dropping no text', () => {
    const sections = Array.from({ length: 25 }, (_, i) => `SEC. ${i + 1}. Body text for section ${i + 1}.`);
    const text = sections.join('\n');
    const spans = splitIntoSpans(text, 'Big bill');
    expect(spans.length).toBeLessThanOrEqual(20);
    const rejoined = spans.map((s) => s.text).join('\n');
    for (let i = 1; i <= 25; i += 1) {
      expect(rejoined).toContain(`Body text for section ${i}`);
    }
  });

  it('assigns unique sequential ids', () => {
    const text = 'SEC. 1. A.\nSEC. 2. B.\nSEC. 3. C.';
    const spans = splitIntoSpans(text, 'Draft');
    expect(spans.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
  });
});
