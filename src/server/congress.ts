import { sha256Hex } from '@/core/canonical';
import { db } from '@/db/client';
import { projects, sources, sourceSpans } from '@/db/schema';
import { logAudit } from './audit';
import { splitIntoSpans } from './paste-split';

const API_BASE = 'https://api.congress.gov/v3';
const ALLOWED_HOSTS = new Set(['api.congress.gov', 'www.congress.gov', 'www.govinfo.gov']);
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

export class CongressApiError extends Error {}

function apiKey(): string {
  const key = process.env.CONGRESS_GOV_API_KEY;
  if (!key) throw new CongressApiError('CONGRESS_GOV_API_KEY is not configured');
  return key;
}

function assertAllowedHost(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new CongressApiError(`refusing to fetch from disallowed host: ${parsed.hostname}`);
  }
  return parsed;
}

async function fetchWithLimits(url: string, init?: RequestInit): Promise<string> {
  assertAllowedHost(url);
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new CongressApiError(`request to ${new URL(url).hostname} failed: ${res.status}`);
  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    throw new CongressApiError('response exceeds 2MB size cap');
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new CongressApiError('response exceeds 2MB size cap');
  return new TextDecoder('utf-8').decode(buf);
}

export interface CongressBillSummary {
  congress: number;
  type: string;
  number: string;
  title: string;
  latestActionDate: string | null;
  latestActionText: string | null;
}

interface RawBillListItem {
  congress: number;
  type: string;
  number: string;
  title: string;
  latestAction?: { actionDate?: string; text?: string };
}

/**
 * The Congress.gov v3 API has no full-text search parameter (confirmed against the
 * BillEndpoint docs): it only lists bills by congress/type sorted by latest action.
 * We fetch a page of that list and filter client-side by title/number substring match.
 */
export async function searchCongressBills(args: { congress: number; billType?: string; query?: string; limit?: number }): Promise<CongressBillSummary[]> {
  const key = apiKey();
  const limit = Math.min(args.limit ?? 20, 100);
  const path = args.billType ? `bill/${args.congress}/${args.billType.toLowerCase()}` : `bill/${args.congress}`;
  const url = `${API_BASE}/${path}?format=json&limit=${limit}&api_key=${key}`;
  const text = await fetchWithLimits(url);
  const json = JSON.parse(text) as { bills?: RawBillListItem[] };
  const bills = json.bills ?? [];

  const q = args.query?.trim().toLowerCase();
  const filtered = q ? bills.filter((b) => b.title.toLowerCase().includes(q) || `${b.type}${b.number}`.toLowerCase().includes(q)) : bills;

  return filtered.map((b) => ({
    congress: b.congress,
    type: b.type,
    number: b.number,
    title: b.title,
    latestActionDate: b.latestAction?.actionDate ?? null,
    latestActionText: b.latestAction?.text ?? null,
  }));
}

interface TextFormat {
  type: string;
  url: string;
}
interface TextVersion {
  type: string;
  date: string | null;
  formats: TextFormat[];
}

const FORMAT_PREFERENCE = ['Formatted Text', 'Text', 'Formatted XML', 'PDF'];

function pickBestFormat(formats: TextFormat[]): TextFormat | null {
  for (const preferred of FORMAT_PREFERENCE) {
    const match = formats.find((f) => f.type === preferred);
    if (match) return match;
  }
  return formats[0] ?? null;
}

export async function fetchBillTextVersions(congress: number, billType: string, billNumber: string): Promise<TextVersion[]> {
  const key = apiKey();
  const url = `${API_BASE}/bill/${congress}/${billType.toLowerCase()}/${billNumber}/text?format=json&api_key=${key}`;
  const text = await fetchWithLimits(url);
  const json = JSON.parse(text) as { textVersions?: TextVersion[] };
  return json.textVersions ?? [];
}

/** Strips HTML/XML tags and collapses whitespace. Government formatted-text responses are
 * simple markup (no scripts/styles to worry about), so a regex strip is sufficient here. */
export function stripMarkupToText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ImportBillInput {
  congress: number;
  billType: string;
  billNumber: string;
}

export async function importBillText(workspaceId: string, input: ImportBillInput): Promise<{ projectId: string; slug: string }> {
  const versions = await fetchBillTextVersions(input.congress, input.billType, input.billNumber);
  if (versions.length === 0) throw new CongressApiError('no text versions available for this bill yet');

  const latest = versions[versions.length - 1];
  const format = pickBestFormat(latest.formats);
  if (!format) throw new CongressApiError('no text format available for the latest version');
  if (format.type === 'PDF') throw new CongressApiError('only a PDF text version is available; PDF import is not supported');

  const raw = await fetchWithLimits(format.url);
  const text = stripMarkupToText(raw);

  const title = `${input.billType.toUpperCase()} ${input.billNumber} (${input.congress}th Congress)`;
  const officialVersionId = `${input.congress}-${input.billType.toLowerCase()}-${input.billNumber}-${latest.type}`;
  const canonicalUrl = `https://www.congress.gov/bill/${input.congress}th-congress/${input.billType.toLowerCase()}/${input.billNumber}`;

  const { randomBytes } = await import('node:crypto');
  const slug = `import-${randomBytes(4).toString('hex')}`;

  const [project] = await db
    .insert(projects)
    .values({ workspaceId, slug, name: title, isPublic: false, demoTemplate: null })
    .returning();

  const [sourceRow] = await db
    .insert(sources)
    .values({
      projectId: project.id,
      title,
      jurisdiction: 'US',
      canonicalUrl,
      officialVersionId,
      retrievedAt: new Date().toISOString().slice(0, 10),
      sha256: sha256Hex(text),
      text,
      metadata: { sourceType: 'congress-import', textVersionType: latest.type },
    })
    .returning();

  const spans = splitIntoSpans(text, title);
  await db.insert(sourceSpans).values(
    spans.map((s) => ({
      sourceId: sourceRow.id,
      id: s.id,
      sectionPath: s.sectionPath,
      label: s.label,
      text: s.text,
    })),
  );

  await logAudit({ projectId: project.id, actor: workspaceId, action: 'create', entityType: 'project', entityId: project.id, metadata: { via: 'congress-import', officialVersionId } });

  return { projectId: project.id, slug };
}
