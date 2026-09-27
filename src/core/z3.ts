import { createRequire } from 'node:module';
import { init } from 'z3-solver';

type Z3Api = Awaited<ReturnType<typeof init>>;

let apiPromise: Promise<Z3Api> | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function getZ3(): Promise<Z3Api> {
  apiPromise ??= init();
  return apiPromise;
}

/** Serialize all solver work: one WASM instance, one check at a time (E-04). */
export function withSolver<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

export const SOLVER_TIMEOUT_MS = 3000;

let solverVersion: string | null = null;

export function getSolverVersion(): string {
  if (solverVersion) return solverVersion;
  const require = createRequire(import.meta.url);
  const pkg = require('z3-solver/package.json') as { version: string };
  solverVersion = pkg.version;
  return solverVersion;
}
