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

const projectsTable: FakeProject[] = [
  { id: 'public-project', workspaceId: 'owner-ws', isPublic: true },
  { id: 'private-project', workspaceId: 'owner-ws', isPublic: false },
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
    const { project } = await requireProjectAccess('public-project', 'read');
    expect(project.id).toBe('public-project');
    expect(cookieStore.has('lh_ws')).toBe(false);
  });

  it('404s on a project that does not exist', async () => {
    const { requireProjectAccess, } = await import('../workspace');
    const { NotFoundError } = await import('../errors');
    await expect(requireProjectAccess('missing-project', 'read')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('403s a write from a foreign workspace', async () => {
    cookieStore.set('lh_ws', 'not-the-owner-token');
    const { requireProjectAccess } = await import('../workspace');
    const { ForbiddenError } = await import('../errors');
    await expect(requireProjectAccess('private-project', 'write')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('403s a read of a private project from a foreign workspace', async () => {
    cookieStore.set('lh_ws', 'not-the-owner-token');
    const { requireProjectAccess } = await import('../workspace');
    const { ForbiddenError } = await import('../errors');
    await expect(requireProjectAccess('private-project', 'read')).rejects.toBeInstanceOf(ForbiddenError);
  });
});
