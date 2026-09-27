import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: { insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'p1' }]) })) })) } }));
vi.mock('@/db/schema', () => ({ projects: {}, sources: {}, sourceSpans: {} }));
vi.mock('../audit', () => ({ logAudit: vi.fn(async () => undefined) }));

import { CongressApiError, fetchBillTextVersions, importBillText, searchCongressBills, stripMarkupToText } from '../congress';

describe('stripMarkupToText', () => {
  it('strips tags and decodes basic entities', () => {
    const html = '<div><p>Section 1 &amp; 2</p><script>evil()</script><style>.x{}</style></div>';
    expect(stripMarkupToText(html)).toBe('Section 1 & 2');
  });

  it('collapses excess blank lines', () => {
    const html = '<p>A</p>\n\n\n\n<p>B</p>';
    expect(stripMarkupToText(html)).toBe('A \n\n B');
  });
});

describe('congress API calls (mocked fetch)', () => {
  const originalKey = process.env.CONGRESS_GOV_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.CONGRESS_GOV_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.CONGRESS_GOV_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when the API key is not configured', async () => {
    delete process.env.CONGRESS_GOV_API_KEY;
    await expect(searchCongressBills({ congress: 119 })).rejects.toThrow(CongressApiError);
  });

  it('refuses to fetch a text format from a host outside the allowlist', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/text?')) {
        return new Response(
          JSON.stringify({
            textVersions: [
              {
                type: 'Introduced in House',
                date: '2026-01-01',
                formats: [{ type: 'Formatted Text', url: 'https://evil.example.com/hr1.htm' }],
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch to ${url}`);
    }) as unknown as typeof fetch;

    await expect(importBillText('ws1', { congress: 119, billType: 'hr', billNumber: '1' })).rejects.toThrow(/disallowed host/);
  });

  it('filters bills by query client-side, since the v3 API has no full-text search', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          bills: [
            { congress: 119, type: 'HR', number: '1', title: 'Privacy Act', latestAction: { actionDate: '2026-01-01', text: 'Referred' } },
            { congress: 119, type: 'HR', number: '2', title: 'Unrelated Act', latestAction: {} },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const bills = await searchCongressBills({ congress: 119, query: 'privacy' });
    expect(bills).toHaveLength(1);
    expect(bills[0].title).toBe('Privacy Act');
  });

  it('rejects a response over the 2MB size cap via content-length', async () => {
    global.fetch = vi.fn(async () =>
      new Response('{}', { status: 200, headers: { 'content-length': String(3 * 1024 * 1024) } }),
    ) as unknown as typeof fetch;

    await expect(searchCongressBills({ congress: 119 })).rejects.toThrow(/2MB/);
  });

  it('prefers Formatted Text over PDF when picking a text format', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          textVersions: [
            {
              type: 'Introduced in House',
              date: '2026-01-01',
              formats: [
                { type: 'PDF', url: 'https://www.congress.gov/119/bills/hr1/BILLS-119hr1ih.pdf' },
                { type: 'Formatted Text', url: 'https://www.congress.gov/119/bills/hr1/BILLS-119hr1ih.htm' },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const versions = await fetchBillTextVersions(119, 'hr', '1');
    expect(versions[0].formats.find((f) => f.type === 'Formatted Text')).toBeDefined();
  });

  it('surfaces a clear error when only a PDF text version exists', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          textVersions: [
            {
              type: 'Introduced in House',
              date: '2026-01-01',
              formats: [{ type: 'PDF', url: 'https://www.congress.gov/119/bills/hr1/BILLS-119hr1ih.pdf' }],
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(importBillText('ws1', { congress: 119, billType: 'hr', billNumber: '1' })).rejects.toThrow(/PDF/);
  });
});
