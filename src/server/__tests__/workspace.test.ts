import { describe, it, expect, beforeEach, vi } from 'vitest';

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
  }),
}));

// The mocked `eq()` below returns `{ value }` for any column, so a `where: eq(table.col, x)`
// call resolves to comparing against `x` directly — enough to drive these fixtures without
// pulling in a real query builder.
vi.mock('drizzle-orm', () => ({
  eq: (_column: unknown, value: unknown) => ({ value }),
}));

interface FakeProject {
  id: string;
  workspaceId: string | null;
  isPublic: boolean;
}
interface FakeWorkspace {
  id: string;
  tokenHash: string;
}

const PUBLIC_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PRIVATE_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_PROJECT_ID = '33333333-3333-4333-8333-333333333333';

const projectsTable: FakeProject[] = [
  { id: PUBLIC_PROJECT_ID, workspaceId: 'owner-ws', isPublic: true },
  { id: PRIVATE_PROJECT_ID, workspaceId: 'owner-ws', isPublic: false },
];
const workspacesTable: FakeWorkspace[] = [{ id: 'owner-ws', tokenHash: 'owner-hash' }];

vi.mock('@/db/client', () => ({
  db: {
    query: {
      projects: {
        findFirst: async ({ where }: { where: { value: string } }) => projectsTable.find((p) => p.id === where.value),
      },
      workspaces: {
        findFirst: async ({ where }: { where: { value: string } }) => workspacesTable.find((w) => w.tokenHash === where.value),
      },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          const row = { id: 'new-ws', ...v };
          workspacesTable.push(row as FakeWorkspace);
          return [row];
        },
      }),
    }),
  },
}));

describe('requireProjectAccess', () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it('allows anyone to read a public project without a workspace cookie', async () => {
    const { requireProjectAccess } = await import('../workspace');
    const { project } = await requireProjectAccess(PUBLIC_PROJECT_ID, 'read');
    expect(project.id).toBe(PUBLIC_PROJECT_ID);
    expect(cookieStore.has('lh_ws')).toBe(false);
  });

  it('404s on a project that does not exist', async () => {
    const { requireProjectAccess, } = await import('../workspace');
    const { NotFoundError } = await import('../errors');
    await expect(requireProjectAccess(MISSING_PROJECT_ID, 'read')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('403s a write from a foreign workspace', async () => {
    cookieStore.set('lh_ws', 'not-the-owner-token');
    const { requireProjectAccess } = await import('../workspace');
    const { ForbiddenError } = await import('../errors');
    await expect(requireProjectAccess(PRIVATE_PROJECT_ID, 'write')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('403s a read of a private project from a foreign workspace', async () => {
    cookieStore.set('lh_ws', 'not-the-owner-token');
    const { requireProjectAccess } = await import('../workspace');
    const { ForbiddenError } = await import('../errors');
    await expect(requireProjectAccess(PRIVATE_PROJECT_ID, 'read')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('400s a malformed (non-UUID) projectId before touching the database', async () => {
    const { requireProjectAccess } = await import('../workspace');
    const { ZodError } = await import('zod');
    await expect(requireProjectAccess('not-a-uuid', 'read')).rejects.toBeInstanceOf(ZodError);
  });
});
