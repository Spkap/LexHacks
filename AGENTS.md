# Loophole (AGENTS.md)

Project: **Loophole**, LexHack 2026 entry. Plan to execute: [docs/plans/2026-09-27-loophole-v2-plan.md](docs/plans/2026-09-27-loophole-v2-plan.md) (v2, agentic). v1 history: [docs/plans/2026-09-27-loophole-lexhack-plan.md](docs/plans/2026-09-27-loophole-lexhack-plan.md). Product blueprint: [Loophole_Project_Blueprint.md](Loophole_Project_Blueprint.md).

One line: paste a rule plus its stated purpose, an Attack agent proposes loopholes grounded in verbatim quotes, a jury of 3 AI judges rules on each (a human breaks ties), propose minimal repair, re-attack. **v2 (2026-09-27): Z3 is removed**, spec is [docs/plans/new_architecture.md](docs/plans/new_architecture.md) and it wins over older docs. Frontend pages/routing/layout: [docs/plans/frontend_v2.md](docs/plans/frontend_v2.md) (one-page War Room, self-playing landing). Never claim "certified" or "proven"; a finding is only "confirmed by adversarial review".

## Workflow rules (non-negotiable)

- **No git worktrees, no feature branches, no sandboxes.** Work directly on `main`.
- **Commit once per completed phase**, not after every task. One reviewable commit per phase, covering all its tasks.
- **Bypass permissions is already granted for this project.** Don't stop to ask for approval on tool calls (file edits, bash commands, deploys, etc.) within the scope of executing the plan. Proceed autonomously through the plan's tasks.
- Execute the plan file task by task, in order, per its wave structure. Don't skip ahead.
- **v2 plan Phase 4 (the pivot gate) is a gate.** If live golden CCPA runs don't confirm C1/C8, confirm none of C2 to C7, and pass all 3 re-attack checks after repair in 2 of 3 runs, stop and fix prompts or `src/core/verdict.ts`, don't paper over it with UI polish.
- Follow TDD where the plan marks a task `tdd="true"`: write the failing test first, run it, then implement.

## Architecture decisions (locked, see plan section 2 for rationale)

- `src/core` is the trust boundary: pure TypeScript, **zero framework imports**, fully unit-tested. IR schemas, the grounding gate (every quoted span must exist verbatim in the hashed source), the verdict rule, and finding hashes live here. No LLM decides a verdict on its own; `decideVerdict` does, from grounded votes.
- The jury **never sees the Attack agent's arguments** (`whyWordsPermit`, `whyPurposeDefeated`), only the scenario facts, the quoted spans, and the Purpose Contract. The Defense is a jury of 3 different judge prompts (Textualist, Purposivist, Enforcer); each vote is `blocked | harmless | loophole | unclear`. `decideVerdict`: 3/3 loophole → `confirmed`, 2+ blocked → `blocked`, 2+ harmless → `harmless`, else `contested` and a **human rules on it** (append-only `finding_rulings`, jury verdict kept). Humans also approve the purpose and sign every patch. Pitch: "AI argues. Code checks the quotes. Humans decide."
- **The LLM never writes executable code that the server runs**, it only produces JSON that gets Zod-validated and grounded.
- Runs use Next.js `after()` plus a `run_events` table in Neon for progress (not Vercel Workflow, not in-memory pub/sub, since serverless instances don't share memory).
- Auth is an anonymous workspace cookie (httpOnly, `sameSite: 'strict'`, `secure`, random token via `crypto.randomBytes(32)`, hashed at rest). No login wall for judges. Enforce ownership server-side regardless (403 on other workspaces' projects).
- Source text and all artifacts are versioned and immutable in Postgres (SHA-256 hashed). Never overwrite a source, Purpose Contract, or finding; an approved redline writes a new source version (`parent_source_id`).
- LLM calls go straight to providers, no AI Gateway. Groq (`GROQ_API_KEY`, `REASONING_MODEL`, `FAST_MODEL`) is primary; OpenRouter (`OPENROUTER_API_KEY`, `FALLBACK_MODEL`, OpenAI-compatible base URL) is fallback only, tried by `callStructured` in a plain try/catch when the Groq call throws.

## Claim discipline (enforced in UI copy, not just docs)

- A finding renders as **"Confirmed by adversarial review (3/3 judges, run {runId})"**. Never "certified", "proven", or `SAT`/`UNSAT` in UI copy.
- "No loophole survived review in this run's search budget." Never "no loopholes exist."
- Every page footer: "Research and drafting support. Not legal advice. Findings are AI-reviewed, grounded in quoted text, and require human judgment."
- Don't call this an "AI lawyer" or imply court-level correctness anywhere in copy, README, or the video script.

## Stack and commands

Next.js 16 (App Router) with TypeScript strict, Tailwind v4, shadcn/ui, Zod, Vercel AI SDK (`ai`) with direct `@ai-sdk/groq` (primary) and OpenRouter-via-`@ai-sdk/openai` (fallback) providers, no AI Gateway, Drizzle ORM plus `@neondatabase/serverless`, Vitest, Playwright, pnpm.

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

Standalone Node scripts (`seed-golden.ts`, `eval.ts`) end with `process.exit(0)` so open DB handles don't keep the process alive.

## Code style

- TypeScript strict, no `any`, use `unknown` plus narrowing.
- Zod-validate every external input (HTTP body, query params, LLM structured output) at the boundary.
- Discriminated unions for agent outputs and statuses (verdict `blocked | loophole | unclear`, candidate status), see `src/core/contracts.ts`.
- Files over ~250 lines get split.
- No `console.log` left in committed route handlers or `src/core`; use the project logger / audit_events table instead.

## Secrets and keys

This is a hackathon sprint, not a marathon. Don't build out security scaffolding (rate limiting, key rotation, hardened validation) unless asked.

The one rule that stays: no secrets hardcoded in files, keep them in `process.env.X` / `.env.local`. If a task needs an API key or secret, ask for it whenever it comes up, then wire it in and move on.

All required env vars are already in `.env.local`. Don't ask for them again.

## Neon CLI

Already authenticated (`neon me` works). Use the Neon CLI, not the Vercel Marketplace integration or the dashboard, for all Neon provisioning: creating projects, branches, databases, roles, and reading connection strings. Never hand-write a `DATABASE_URL` or ask the user for one, generate it with the CLI.

```bash
neon me                                                  # confirm auth / current account
neon projects list                                       # existing projects
neon projects create --name <name> --database neondb --set-context -o json
neon branches create --name preview/<pr-number> --parent main   # per-PR preview branch
neon branches list
neon connection-string main --pooled --database-name neondb     # -> DATABASE_URL (runtime)
neon connection-string main --database-name neondb               # -> DATABASE_DIRECT_URL (migrations)
neon databases create --name <db> --branch <branch>
neon branches delete preview/<pr-number>                 # teardown after PR merges/closes
```

`--set-context` after project creation pins it as default so later commands skip `--project-id`. Pooled connection string goes in `DATABASE_URL` (`drizzle-orm/neon-http` at runtime); direct connection string goes in `DATABASE_DIRECT_URL` (`drizzle.config.ts`, migrations only, never in the request path).

## Never use em dashes in any output

Use a period, comma, or parentheses instead. Applies to chat, commit messages, code comments, docs, and UI copy.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
