# Loophole (AGENTS.md)

Project: **Loophole**, LexHack 2026 entry. Full plan: [docs/plans/2026-09-27-loophole-lexhack-plan.md](docs/plans/2026-09-27-loophole-lexhack-plan.md). Product blueprint: [Loophole_Project_Blueprint.md](Loophole_Project_Blueprint.md).

This file applies to any AI coding agent working in this repo (Claude Code, Cursor, Copilot, Codex, or others). Content mirrors `CLAUDE.md`; if the two ever disagree, treat that as a bug and fix both.

One line: turn a rule plus its stated purpose into a formal model, let AI propose exploit scenarios, certify real ones with Z3, propose minimal repair, re-attack. AI explores, **Z3 decides**. Never claim "certified" without a solver run behind it.

## Project overview

One TypeScript monorepo, Next.js App Router, deployed on Vercel. `src/core` is a pure, framework-free proof engine (Legal IR, formula DSL, Z3 compiler, certifier). Neon Postgres (Drizzle) persists versioned artifacts, runs, and certificates. The Vercel AI SDK produces schema-validated JSON only, calling Groq and OpenRouter directly with no AI Gateway hop; the LLM never writes solver input directly.

## Workflow rules (non-negotiable)

- **No git worktrees, no feature branches, no sandboxes.** Work directly on `main`.
- **Commit after every completed task**, not after every phase. Small, reviewable commits.
- Execute the plan file task by task, in order, per its wave structure. Don't skip ahead.
- **Task 1.6 (the kill test) is a gate.** If the golden CCPA case doesn't produce `SAT` on the original law and `UNSAT` after repair, stop and fix `src/core`, don't paper over it with UI polish.
- Follow TDD where the plan marks a task `tdd="true"`: write the failing test first, run it, then implement.

## Architecture decisions (locked, see plan section 2 for rationale)

- `src/core` is the trust boundary: pure TypeScript, **zero framework imports**, fully unit-tested. All Legal IR, DSL parsing, Z3 compilation, and certification logic lives here. Nothing outside `src/core` is allowed to call Z3 directly.
- Formulas are a small DSL string (`and(covered_business, not(sell))`), parsed by our own recursive-descent parser in `src/core/dsl.ts`. **The LLM never writes SMT-LIB or executable code that the server runs**, it only produces DSL strings and JSON that get validated and recompiled.
- One Z3 `Context` per server instance; solves are serialized through a promise queue (`src/core/z3.ts`). Never call `check()` concurrently on one context.
- Runs use Next.js `after()` plus a `run_events` table in Neon for progress (not Vercel Workflow, not in-memory pub/sub, since serverless instances don't share memory).
- Auth is an anonymous workspace cookie (httpOnly, `sameSite: 'strict'`, `secure`, random token via `crypto.randomBytes(32)`, hashed at rest). No login wall for judges. Enforce ownership server-side regardless (403 on other workspaces' projects).
- Source text and all IR artifacts are versioned and immutable in Postgres (SHA-256 hashed). Never overwrite a source, Purpose Contract, formalization, or certificate, write a new version instead.
- `z3-solver` must be in `next.config.ts` `serverExternalPackages`; every route touching it sets `export const runtime = 'nodejs'`.
- LLM calls go straight to providers, no AI Gateway. Groq (`GROQ_API_KEY`, `REASONING_MODEL`, `FAST_MODEL`) is primary; OpenRouter (`OPENROUTER_API_KEY`, `FALLBACK_MODEL`, OpenAI-compatible base URL) is fallback only, tried by `callStructured` in a plain try/catch when the Groq call throws.

## Claim discipline (enforced in UI copy, not just docs)

- "Certified" always renders as **"Certified within model {formalizationId} v{version}"**, never bare "certified" or "proven."
- "No exploit found within this model and search budget." Never "no loopholes exist."
- Every page footer: "Research and drafting support. Not legal advice. Certificates apply only to the displayed formal model."
- Don't call this an "AI lawyer" or imply court-level correctness anywhere in copy, README, or the video script.

## Build and test commands

Next.js 16 (App Router) with TypeScript strict, Tailwind v4, shadcn/ui, Zod, `z3-solver`, Vercel AI SDK (`ai`) with direct `@ai-sdk/groq` (primary) and OpenRouter-via-`@ai-sdk/openai` (fallback) providers, no AI Gateway, Drizzle ORM plus `@neondatabase/serverless`, Vitest, Playwright, pnpm.

```bash
pnpm dev                     # local dev server
pnpm test                    # vitest, run before every commit touching src/core or src/ai
pnpm test -- --filter=<name> # single test file/suite, prefer this over the full suite while iterating
pnpm typecheck                # tsc --noEmit, run before commit
pnpm lint
pnpm exec playwright test e2e/demo.spec.ts   # the 3-minute demo path, run before Phase 7 ship
pnpm drizzle-kit generate    # after any schema.ts change
pnpm drizzle-kit migrate     # apply migrations (direct DB connection only, never in request path)
node scripts/seed-golden.ts  # loads the CCPA golden fixture into a fresh DB
```

Standalone Node scripts that touch `z3-solver` (`seed-golden.ts`, `eval.ts`) must end with `process.exit(0)`, the WASM runtime keeps the process alive otherwise. Vitest and route handlers are unaffected.

## Code style guidelines

- TypeScript strict, no `any`, use `unknown` plus narrowing.
- Zod-validate every external input (HTTP body, query params, LLM structured output) at the boundary.
- Discriminated unions for typed variables (`bool` / `int` / `enum`) in the Legal IR, see `src/core/ir.ts`.
- Files over ~250 lines get split.
- No `console.log` left in committed route handlers or `src/core`; use the project logger / audit_events table instead.

## Secrets and keys

This is a hackathon sprint, not a marathon. Don't build out security scaffolding (rate limiting, key rotation, hardened validation) unless asked.

The one rule that stays: no secrets hardcoded in files, keep them in `process.env.X` / `.env.local`. If a task needs an API key or secret, ask for it whenever it comes up, then wire it in and move on.

## Commit message guidelines

- Small commit per finished plan task, imperative subject line (`add golden CCPA fixture`, `implement DSL parser`).
- Never use em dashes in commit messages or anywhere else in this repo. Use a period, comma, or parentheses instead.

## Deployment

- Vercel-first, single Next.js app. Pin Node/runtime versions, lock dependencies.
- Neon Postgres: production branch for real data and migrations; preview branches for pull requests where plan limits allow. Runtime uses the pooled/serverless connection; migrations use the direct connection, never in the request path.
- See the plan's Phase 7 for the pre-submit checklist and required environment variables (`.env.example`).
