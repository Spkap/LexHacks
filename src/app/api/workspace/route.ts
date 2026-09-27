import { NextResponse } from 'next/server';
import { getOrCreateWorkspace } from '@/server/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await getOrCreateWorkspace();
  return new NextResponse(null, { status: 204 });
}
