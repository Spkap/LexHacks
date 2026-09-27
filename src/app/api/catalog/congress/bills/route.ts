import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toHttpError } from '@/server/errors';
import { searchCongressBills } from '@/server/congress';
import { rateLimit } from '@/server/rate-limit';
import { RateLimitError } from '@/server/errors';
import { getOrCreateWorkspace } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  congress: z.coerce.number().int().min(93).max(120).default(119),
  billType: z.string().max(10).optional(),
  query: z.string().max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const { workspaceId } = await getOrCreateWorkspace();
    const limit = rateLimit(`congress-search:${workspaceId}`, 30, 3600);
    if (!limit.ok) throw new RateLimitError('too many Congress.gov searches this hour');

    const url = new URL(request.url);
    const params = Query.parse({
      congress: url.searchParams.get('congress') ?? undefined,
      billType: url.searchParams.get('billType') ?? undefined,
      query: url.searchParams.get('query') ?? undefined,
    });

    const bills = await searchCongressBills(params);
    return NextResponse.json({ bills });
  } catch (error) {
    const { status, body } = toHttpError(error);
    return NextResponse.json(body, { status });
  }
}
