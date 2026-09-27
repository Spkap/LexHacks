# Loophole Wiki

LexHack 2026 entry. Compiles a rule + its stated purpose into a formal model, lets AI propose exploit scenarios, certifies real ones with Z3, proposes a minimal repair, and re-attacks. AI explores; **Z3 decides**.

## Contents

- [00.5 — Getting Started](00.5-getting-started.md)
- [01 — Overview](01-overview.md)
- [02 — Legal IR & DSL](02-legal-ir-and-dsl.md)
  - [02.1 — DSL Grammar Reference](02.1-dsl-grammar.md)
- [03 — Z3 Compilation & Certification Engine](03-z3-engine.md)
  - [03.1 — Certificates & Canonical Hashing](03.1-certificates-and-hashing.md)
- [04 — AI Pipeline](04-ai-pipeline.md)
  - [04.1 — Extraction & Reconciliation](04.1-extraction-and-reconciliation.md)
  - [04.2 — Attack Generation & Repair Synthesis](04.2-attack-and-repair.md)
- [05 — Server Layer: Runs, Workspace, Auth](05-server-layer.md)
- [06 — Database Schema (Drizzle + Neon)](06-database-schema.md)
- [07 — API Routes](07-api-routes.md)
- [08 — Frontend: Pages & Stage Flow](08-frontend-pages.md)
- [09 — Ingest Paths: Congress.gov & Paste-a-Draft](09-ingest-paths.md)
- [10 — Build & Development](10-build-and-development.md)
- [11 — Testing Infrastructure](11-testing.md)

## Reading order for new engineers

1. [00.5 — Getting Started](00.5-getting-started.md) to run it locally.
2. [01 — Overview](01-overview.md) for the full pipeline shape.
3. [02](02-legal-ir-and-dsl.md) → [03](03-z3-engine.md) for the trust boundary (`src/core`), which everything else calls into.
4. [04](04-ai-pipeline.md) for how the LLM layer proposes things `src/core` then checks.
5. [05](05-server-layer.md) → [06](06-database-schema.md) → [07](07-api-routes.md) for how a request becomes a run.
6. [08](08-frontend-pages.md) for the five-stage UI that drives it all.

## Team & ownership

Single-contributor hackathon repo (`git log` shows one author, `Spkap`, across all commits from 2026-09-27). There is no per-directory ownership split to document.
