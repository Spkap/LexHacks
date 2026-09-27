import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toHttpError } from '@/server/errors';
import { createPasteProject, forkGoldenProject } from '@/server/projects';
import { rateLimit } from '@/server/rate-limit';
import { getOrCreateWorkspace } from '@/server/workspace';
import { RateLimitError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.union([
  z.object({ template: z.literal('ccpa-2018') }),
  z.object({
    paste: z.object({
      title: z.string().min(1).max(200),
      text: z.string().min(1).max(60000),
      url: z.string().url().optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  try {
    const { workspaceId } = await getOrCreateWorkspace();

    const limit = rateLimit(`create-project:${workspaceId}`, 20, 3600);
    if (!limit.ok) throw new RateLimitError('too many project creations this hour');

    const json = await request.json();
    const body = Body.parse(json);

    const result = 'template' in body ? await forkGoldenProject(workspaceId) : await createPasteProject(workspaceId, body.paste);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { status, body: errorBody } = toHttpError(error);
    return NextResponse.json(errorBody, { status });
  }
}
