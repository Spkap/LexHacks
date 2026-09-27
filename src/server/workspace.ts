import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/db/client';
import { projects, workspaces } from '@/db/schema';
import { ForbiddenError, NotFoundError } from './errors';

export function parseUuidParam(name: string, value: string): string {
  return z.object({ [name]: z.string().uuid() }).parse({ [name]: value })[name];
}

const COOKIE_NAME = 'lh_ws';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function getWorkspaceFromCookie(): Promise<{ workspaceId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.tokenHash, hashToken(token)) });
  return workspace ? { workspaceId: workspace.id } : null;
}

export async function getOrCreateWorkspace(): Promise<{ workspaceId: string }> {
  const existing = await getWorkspaceFromCookie();
  if (existing) return existing;

  const cookieStore = await cookies();
  const token = randomBytes(32).toString('base64url');
  const [workspace] = await db.insert(workspaces).values({ tokenHash: hashToken(token) }).returning();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return { workspaceId: workspace.id };
}

export type AccessMode = 'read' | 'write';

/**
 * Public projects are readable by anyone. Every other access (private reads, all
 * writes) requires the requester's workspace to own the project — 403 otherwise,
 * 404 if the project doesn't exist at all.
 */
export async function requireProjectAccess(
  projectId: string,
  mode: AccessMode,
): Promise<{ project: typeof projects.$inferSelect; workspaceId: string | null }> {
  parseUuidParam('projectId', projectId);
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new NotFoundError(`project '${projectId}' not found`);

  if (mode === 'read' && project.isPublic) {
    return { project, workspaceId: null };
  }

  const workspace = await getWorkspaceFromCookie();
  if (!workspace) throw new ForbiddenError('workspace cookie is missing or invalid');
  const { workspaceId } = workspace;
  if (project.workspaceId !== workspaceId) {
    throw new ForbiddenError('this workspace does not own this project');
  }
  return { project, workspaceId };
}
