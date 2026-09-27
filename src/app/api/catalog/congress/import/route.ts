import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toHttpError } from '@/server/errors';
import { importBillText } from '@/server/congress';
import { rateLimit } from '@/server/rate-limit';
import { RateLimitError } from '@/server/errors';
import { getOrCreateWorkspace } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  congress: z.number().int().min(93).max(120),
  billType: z.string().min(1).max(10),
  billNumber: z.string().min(1).max(10),
});

export async function POST(request: Request) {
  try {
    const { workspaceId } = await getOrCreateWorkspace();
    const limit = rateLimit(`congress-import:${workspaceId}`, 10, 3600);
    if (!limit.ok) throw new RateLimitError('too many Congress.gov imports this hour');

    const json = await request.json();
    const body = Body.parse(json);

    const result = await importBillText(workspaceId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { status, body: errorBody } = toHttpError(error);
    return NextResponse.json(errorBody, { status });
  }
}
