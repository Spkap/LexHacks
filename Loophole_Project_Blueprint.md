# Loophole

> **Fuzz your law before AI agents do.**

**Hackathon-grade product, demo, and technical blueprint**  
**Target:** LexHack 2026 — AI Safety, Ethics & Governance × Legal Automation × Civic Technology  
**Build posture:** a narrow, functioning adversarial review system, not a generic legal chatbot and not a pretend “AI lawyer.”

> **v2 (2026-09-27): Z3 removed.** The trust engine is now Attack agent → verbatim-quote gate (code) → jury of 3 AI judges (blind to the attacker's arguments) → human tie-break → Repair agent → human signs patch → 3-check re-attack. UI: one War Room page ([docs/plans/frontend_v2.md](docs/plans/frontend_v2.md)). Spec: [docs/plans/new_architecture.md](docs/plans/new_architecture.md), which wins on any conflict. Plan: [docs/plans/2026-09-27-loophole-v2-plan.md](docs/plans/2026-09-27-loophole-v2-plan.md). Sections marked *v2 note* are kept only as history.

---

## 1. The product in one sentence

**Loophole takes a proposed rule and its stated purpose, searches for ways a rational actor could obey the words while defeating the purpose, confirms only the schemes that quote the text verbatim and survive an independent defense review, proposes the smallest repair, and attacks the repaired draft again.**

The interface should make legislation feel testable in the same way software is testable.

### The judge-friendly explanation

Software teams fuzz code before attackers do. Legislators rarely get the same protection. Loophole is a **pre-deployment red team for rules**:

1. upload a bill or select an official version;
2. state the outcome the bill is supposed to protect;
3. press **Attack**;
4. receive only schemes that quote the bill verbatim and survive a blind jury of 3 AI judges (you break any tie);
5. press **Repair**, approve a minimal amendment, and **Re-attack**.

The memorable moment is not an AI-generated paragraph. It is watching most clever-sounding schemes die (bad quote, a judge quotes the clause that blocks them, or it turns out to be harmless), **two surviving all three judges**, then flipping from **Confirmed to Blocked** after the repair while every legitimate use stays allowed.

---

## 2. What problem it solves

Rules fail in a distinctive way: an organization can comply with every literal condition while frustrating the policy goal. The failure often hides in:

- definitions that omit a near-equivalent activity;
- thresholds that can be split across entities, time windows, or transactions;
- nominal human review that is not meaningful review;
- exceptions whose scope is wider than intended;
- duties attached to the wrong actor;
- “and/or,” timing, geography, control, or ownership ambiguities;
- procedural steps that can be satisfied without changing the harmful outcome.

Today, legislative drafters and public-interest reviewers find these failures through manual review, comments, litigation, or real-world exploitation. Ordinary LLM review is useful for brainstorming, but it can invent facts, ignore interacting conditions, or confidently describe a scenario that the text does not permit.

Loophole divides the job correctly:

- **AI explores:** it extracts candidate rules, generates adversarial restructurings, explains findings, and proposes repairs.
- **Humans define and approve meaning:** the Purpose Contract and every repair are human-approved.
- **Code gates, a jury judges, a human decides ties:** a claim must quote the source verbatim (deterministic check), then all 3 AI judges (strict reader, purpose reader, regulator), who never see the attacker's arguments, must agree the text permits it and the purpose is defeated. A split goes to the human.

The product must always say **“confirmed by adversarial review,”** never “legally proven” or “the law definitely has this loophole.”

---

## 3. The sharpened product thesis

The original concept becomes much stronger with five design changes.

### 3.1 The purpose is a test contract, not a vague prompt

The user converts intent into explicit, testable outcomes:

- protected population;
- prohibited or required outcome;
- permitted exceptions;
- minimum coverage expectations;
- legitimate scenarios that must remain legal;
- severity if the purpose is defeated.

This is the **Purpose Contract**. A loophole exists only when a scenario satisfies the encoded law but violates at least one approved purpose invariant.

### 3.2 The formalization is a first-class review screen

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). v2 has no formal model; traceability comes from verbatim quotes on every claim.

The system never hides text-to-logic conversion. Each symbol, predicate, and constraint has:

- a source-clause citation;
- plain-language paraphrase;
- type and allowed values;
- confidence/status: `AI proposed`, `human approved`, or `disputed`;
- a round-trip rendering back into plain English.

The user can edit the mapping before any certificate is trusted. *(v1 only.)*

### 3.3 Findings are evidence bundles, not chat messages

Every finding is a **Loophole Card** containing:

- the concrete actor and scenario;
- exploited clauses and exact source spans;
- purpose invariant violated;
- Defense votes and reasoning (with blocking or permitting quotes);
- assumptions and disputed mappings;
- a “why this complies / why this harms” split explanation;
- smallest suggested textual change;
- before/after re-attack result.

### 3.4 Repairs are regression-tested

Closing one gap can accidentally ban legitimate conduct. Every repair runs two suites:

- **Negative tests:** previously confirmed exploits should become Blocked.
- **Positive tests:** user-approved legitimate scenarios should remain possible.

### 3.5 The demo uses retrodiction, not a hand-picked fictional win

The credibility test is historical:

1. freeze an older rule version;
2. hide the later amendment from the attack pipeline;
3. ask Loophole to find the same *class* of gap;
4. reveal the later official text and compare.

The recommended golden case is the transition from the original CCPA’s focus on a **sale for monetary or other valuable consideration** to the CPRA-era addition of **sharing for cross-context behavioral advertising whether or not consideration is exchanged**. Current California Civil Code §1798.140 exposes both definitions in an official source. This does **not** prove that every ad-tech arrangement escaped the older law; the benchmark must claim only that the later text closes the targeted no-consideration scenario class. [Official California code](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140)

---

## 4. Primary users and real workflow

### Primary user

A legislative drafter, policy clinic, civil-society organization, regulator, standards body, or AI-governance team reviewing a bounded draft.

### Secondary users

- investigative journalists who need a reproducible explanation;
- researchers building computational-law benchmarks;
- advocacy groups preparing public comments;
- compliance teams testing an internal policy before rollout.

### The exact job to be done

> “Before we publish this rule, show me a concrete way a motivated actor can technically comply while defeating the outcome we intended—and show me the smallest safe fix.”

### Explicit non-users and non-goals

- It is not consumer legal advice.
- It does not predict court interpretation.
- It does not replace counsel or legislative drafting offices.
- It does not scan every law in a jurisdiction during the hackathon.
- It does not call LLM prose a proof.
- It does not autonomously publish amendments.

---

## 5. End-to-end project flow

| Stage | User action | System action | Visible artifact | Trust gate |
|---|---|---|---|---|
| 1. Create | Select “Historical benchmark,” import an official bill, or paste text | Create project and immutable source version | Source Pack | Source URL, version, retrieval time, hash |
| 2. Declare intent | Complete Purpose Contract | Validate invariant schema | Intent cards | Human approval required |
| 3. Seed tests | Write legitimate uses in plain language | Stored with the Purpose Contract | Must-stay-legal cards | At least one legitimate use |
| 4. Attack | Press **Attack** | Attack agent proposes schemes per tactic lane, each quoting the bill | Live Attack Arena | Output untrusted until grounded and reviewed |
| 5. Ground | Automatic | Check every quote is verbatim in the hashed source | Ungrounded chips greyed out | Deterministic, no LLM |
| 6. Cross-examine | Automatic, human on splits | Jury of 3 judges votes, blind to the attacker's arguments | Verdict chips | 3/3 `loophole` required; split → human ruling |
| 7. Explain | Open a confirmed finding | Show scenario, quotes, attacker memo vs defense votes | Loophole Card | Every claim links to a quoted span |
| 8. Repair | Press **Repair** and approve/edit amendment | Generate minimal patch; recompile affected rules | Side-by-side redline | Human approval required |
| 9. Re-attack | Press **Re-attack** | Run exploit regression, legitimate-use checks, then fresh attacks | Before/after report | Old exploit must be Blocked; legitimate uses stay allowed |
| 10. Share | Export replay | Produce read-only, citation-rich report | Public demo link | Disclaimer and model scope included |

### System sequence

`Official source → immutable Source Pack → reviewed Purpose Contract → Attack agent → verbatim-quote gate → blind Defense agent (3 votes) → confirmed finding → minimal repair → regression suite → fresh re-attack → shareable replay`

---

## 6. The app: how it should look and feel

### Product personality

Loophole should feel like a precise investigative workbench: calm, serious, visual, and slightly dramatic when a finding is confirmed. It must not look like a chatbot with a legal-themed gradient.

### Visual direction

- **Base:** warm paper white (`#F7F6F2`) and ink (`#17201F`).
- **Primary:** deep teal (`#0F5C5A`) for approved/verified state.
- **Attack:** restrained coral (`#D65A4A`) for exploitable paths.
- **Repair:** electric blue (`#276EF1`) for proposed edits.
- **Uncertainty:** amber (`#B7791F`) for disputed mappings.
- **Typography:** an editorial serif for titles (for example, Source Serif) and a highly legible sans for controls (Inter/Geist); monospace only for formulas and IDs.
- **Motion:** short, purposeful transitions—clause highlights flow into constraints, rejected attacks fade out, and a confirmed finding locks into place.
- **Accessibility:** WCAG AA contrast, full keyboard navigation, never encode status by color alone, reduced-motion mode, and plain-language labels for every status.

### Global layout

- Left rail: project stages and completion state.
- Main canvas: the current task.
- Right evidence drawer: source clause, quotes, defense votes, and audit history.
- Persistent top strip: source version, purpose version, model version, and “reviewed/unreviewed” status.

### Screen 1 — Project Gallery

Three large choices:

1. **Run the historical benchmark** — ready-to-demo CCPA fixture.
2. **Import from Congress.gov** — search and select a bill version.
3. **Paste or upload a draft** — text, HTML, XML, or PDF.

Each project card shows `clauses`, `approved rules`, `confirmed findings`, `last run`, and a compact attack/repair sparkline.

### Screen 2 — Source Pack

Show the legal text, official metadata, prior/later versions, and extracted sections. The user can select 10–20 clauses for the bounded analysis. Source provenance must remain visible.

### Screen 3 — Purpose Contract

Use sentence-shaped controls instead of a raw form:

> For **[covered businesses]**, prevent **[cross-context disclosure]** from occurring without **[a usable opt-out]**, even when **[no money changes hands]**.

Below it, show “must remain allowed” examples. This screen is the human specification gate.

### Screen 4 — Clause Compiler

> **v2: removed.** This screen was the setup wall; v2 goes Purpose Contract → Attack directly.

Three synchronized columns:

1. original clause with exact highlighted spans;
2. plain-language rule;
3. typed rule/constraint.

Clicking any symbol highlights its source. Differences between extractor A and extractor B appear as review items, not silently averaged results.

### Screen 5 — Attack Arena

This is the visual hero screen. Display tactic lanes:

- split thresholds;
- relabel an activity;
- interpose an affiliate;
- shift time or geography;
- exploit an exception;
- nominal human oversight;
- redefine consideration/control;
- satisfy procedure without outcome.

Candidate cards move through `proposed → grounded → cross-examined → thrown out / blocked / harmless / jury split / LOOPHOLE`. Judges can see that most plausible stories are rejected, each with the reason quoted.

### Screen 6 — Confirmed Loophole Card

The card opens with:

> **Confirmed by adversarial review (3/3 judges)**  
> The actor can disclose data for cross-context advertising without receiving consideration; “sell” requires consideration, so the opt-out prohibition never triggers, while the stated purpose is defeated.

Then show:

- `Law satisfied ✓`
- `Purpose defeated ✕`
- exploited definition, quoted;
- concrete scenario;
- attacker memo vs defense votes, side by side;
- source citations;
- assumptions and model limitations.

The full debate transcript and finding hash are behind **Debate transcript**, never forced on a nontechnical judge.

### Screen 7 — Repair Studio

Show the original and proposed text as a legislative redline. A coverage panel explains exactly which exploit path the added words close. The user can edit the repair before recompilation.

### Screen 8 — Re-attack Report

A single compelling comparison:

| | Original | Repaired |
|---|---:|---:|
| Historical exploit | LOOPHOLE | PATCHED |
| Legitimate scenarios preserved | 3/3 | 3/3 |
| Confirmed fresh exploits | 2 | 0 in selected tactic set |

Use “no loophole survived review in this run's search budget,” never “no loopholes exist.”

---

## 7. The three-minute demo

### Demo thesis

The video should tell one story, not tour every setting. Use a seeded, deterministic fixture so network or model latency cannot ruin the presentation; then briefly show that a live import path exists.

### Storyboard

| Time | Screen/action | Narration purpose |
|---:|---|---|
| 0:00–0:12 | Cold open: old rule on the left, “purpose protected” on the right; press **Attack** | “Software gets red-teamed before launch. Law usually gets red-teamed after harm.” |
| 0:12–0:30 | Project overview and official source/version badge | Establish real source and bounded claim |
| 0:30–0:50 | Purpose Contract and one positive scenario | Show that intent is explicit and human-approved |
| 0:50–1:12 | War Room: schemes hit clauses, jury seats light up | Hero moment: one AI attacks, code and a blind jury filter |
| 1:12–1:32 | Open a blocked chip, see the quoted blocking clause | Prove this is not a hidden prompt |
| 1:32–1:55 | Open a LOOPHOLE: quotes, memo vs the 3 judges | Explain compliance versus purpose defeat in plain language |
| 1:55–2:18 | Reveal later official wording and Loophole repair side by side | Historical retrodiction credibility |
| 2:18–2:38 | Approve repair and re-attack | Old loophole flips to PATCHED |
| 2:38–2:50 | Legitimate scenarios still allowed; overbroad fix fails | Repair did not simply prohibit everything |
| 2:50–3:00 | Paste a current bill and closing line | “Loophole is CI for public rules: attack, cross-examine, repair, repeat.” |

### Demo reliability rules

- Bundle the exact official source text, parsed clauses, attack proposals, defense votes, and repairs as versioned fixtures.
- The **Demo Mode** replays recorded agent output from a real Live run, while the verbatim-quote gate and hash checks run live.
- A **Live Mode** can call the model and official APIs after the core demo.
- Never fake a verdict. Recorded fixtures must come from a Live run that passed the pivot gate.
- Record a clean backup video before submission day.

---

## 8. System architecture

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). Keep Next.js, Neon, AI SDK, run events; drop Z3, Vercel Workflow, and Blob.

### Architecture decision

Use one TypeScript repository and keep the hackathon deployment Vercel-first:

- **Next.js App Router** for product UI and route handlers;
- **Vercel Workflow** for durable multi-stage compile/attack/repair jobs;
- the official **`z3-solver` TypeScript/WebAssembly binding** in a server-side workflow step;
- **Neon Postgres** as the relational system of record;
- **Vercel Blob** for original PDFs and large immutable source artifacts;
- **Vercel AI SDK** with a provider adapter for structured model output;
- **SSE/streaming** for visible run progress.

This avoids a second Python deployment during the hackathon. If WASM memory, bundle size, or execution profiling fails the pre-demo load test, keep the API contract and move only `SolverAdapter` to a small Python Z3 worker after the hackathon. Z3’s official distribution includes TypeScript/JavaScript bindings, and Vercel Workflow is designed for durable multi-step work with retries and resumability. [Z3 JavaScript guide](https://microsoft.github.io/z3guide/programming/Z3%20JavaScript%20Examples/) · [Vercel Workflow concepts](https://vercel.com/docs/workflows/concepts)

<div style="width:100%;box-sizing:border-box;background:#fafbfc;padding:16px;border:1px solid #e5e7eb;border-radius:6px;color:#1f2937;font-family:Inter,Arial,sans-serif"><div style="text-align:center;font-size:20px;font-weight:700;margin-bottom:12px">Loophole system architecture</div><div style="display:flex;gap:12px"><div style="flex:1;min-width:0"><div style="padding:12px;margin:7px 0;border:2px solid #3b82f6;border-radius:6px;background:#eff6ff"><div style="font-weight:700;text-align:center;margin-bottom:8px;color:#1d4ed8">Experience layer — Next.js on Vercel</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px"><div style="background:white;border:1px solid #bfdbfe;padding:8px;text-align:center">Source Pack</div><div style="background:white;border:1px solid #bfdbfe;padding:8px;text-align:center">Clause Compiler</div><div style="background:white;border:1px solid #bfdbfe;padding:8px;text-align:center">Attack Arena</div><div style="background:white;border:1px solid #bfdbfe;padding:8px;text-align:center">Repair Studio</div></div></div><div style="padding:12px;margin:7px 0;border:2px solid #d97706;border-radius:6px;background:#fffbeb"><div style="font-weight:700;text-align:center;margin-bottom:8px;color:#92400e">Application layer</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px"><div style="background:white;border:1px solid #fde68a;padding:8px;text-align:center">Route handlers<br><small>Zod contracts</small></div><div style="background:white;border:1px solid #fde68a;padding:8px;text-align:center">Vercel Workflow<br><small>durable steps</small></div><div style="background:white;border:1px solid #fde68a;padding:8px;text-align:center">SSE progress<br><small>run events</small></div><div style="background:white;border:1px solid #fde68a;padding:8px;text-align:center">Report renderer<br><small>share replay</small></div></div></div><div style="padding:12px;margin:7px 0;border:2px solid #16a34a;border-radius:6px;background:#f0fdf4"><div style="font-weight:700;text-align:center;margin-bottom:8px;color:#15803d">Intelligence and proof layer</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px"><div style="background:white;border:1px solid #bbf7d0;padding:8px;text-align:center">Dual extractors<br><small>structured output</small></div><div style="background:white;border:1px solid #bbf7d0;padding:8px;text-align:center">Adversarial generator<br><small>typed candidates</small></div><div style="background:white;border:2px solid #16a34a;padding:8px;text-align:center;font-weight:700">Z3 verifier<br><small>WASM / SMT-LIB</small></div><div style="background:white;border:1px solid #bbf7d0;padding:8px;text-align:center">Repair synthesizer<br><small>regression loop</small></div></div></div><div style="padding:12px;margin:7px 0;border:2px solid #db2777;border-radius:6px;background:#fdf2f8"><div style="font-weight:700;text-align:center;margin-bottom:8px;color:#9d174d">Data layer</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px"><div style="background:white;border:1px solid #fbcfe8;padding:8px;text-align:center">Neon Postgres<br><small>projects, IR, runs, certificates</small></div><div style="background:white;border:1px solid #fbcfe8;padding:8px;text-align:center">Vercel Blob<br><small>PDF/XML/source snapshots</small></div><div style="background:white;border:1px solid #fbcfe8;padding:8px;text-align:center">Official APIs<br><small>Congress, GovInfo, regulations</small></div></div></div></div><div style="width:190px;flex-shrink:0"><div style="padding:10px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;margin:7px 0"><div style="font-weight:700;text-align:center">Trust controls</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:6px;text-align:center">Human approval gates</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">Clause-level citations</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">Immutable input hashes</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">Model/prompt provenance</div></div><div style="padding:10px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;margin:7px 0"><div style="font-weight:700;text-align:center">Operations</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:6px;text-align:center">Idempotent jobs</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">Timeout/search budgets</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">Audit events</div><div style="background:white;border:1px solid #e5e7eb;padding:6px;margin-top:5px;text-align:center">OpenTelemetry/Sentry</div></div></div></div></div>

### Why not a vector database as the core?

The core problem is structured constraint reasoning, not semantic retrieval. Neon stores legal structure, provenance, tests, and certificates relationally. Enable `pgvector` only for optional clause discovery across long documents; never use embedding similarity as proof. For a 10–20 clause demo, PostgreSQL full-text search and deterministic section selection are enough. Neon documents both serverless connection choices and the `pgvector` extension. [Neon connection guidance](https://neon.com/docs/connect/choose-connection) · [Neon pgvector](https://neon.com/docs/extensions/pgvector)

---

## 9. Domain model and Legal IR

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). See its section 2 for the `AttackProposal`, `DefenseVote`, and `RepairProposal` contracts.

### Core types

```ts
type LegalRule = {
  id: string;
  sourceSpanIds: string[];
  actorType: string;
  trigger: Expr;
  duty?: Expr;
  prohibition?: Expr;
  exception?: Expr;
  temporalScope?: TimeWindow;
  jurisdiction?: string;
  definitionsUsed: string[];
  extractionStatus: "proposed" | "approved" | "disputed";
};

type PurposeInvariant = {
  id: string;
  protectedClass: Expr;
  desiredOutcome: Expr;
  severity: "low" | "medium" | "high" | "critical";
  approvedByUser: boolean;
};

type AttackCandidate = {
  tactic: "threshold_split" | "relabel" | "affiliate" | "timing" |
          "exception_abuse" | "nominal_review" | "no_consideration";
  assignments: Record<string, Scalar>;
  claimedLawSatisfied: boolean;
  claimedPurposeViolated: boolean;
  citedRuleIds: string[];
};
```

### Certification condition

For approved law constraints `L(x)`, approved purpose invariant `P(x)`, and scenario bounds `B(x)`, a loophole certificate requires:

```text
SAT( L(x) AND B(x) AND NOT P(x) )
```

The returned model `x*` is the concrete counterexample. A repaired draft `L'(x)` closes that exact class only if:

```text
UNSAT( L'(x) AND exploit_family_bounds(x) AND NOT P(x) )
```

Positive coverage scenario `Gᵢ(x)` must remain possible:

```text
SAT( L'(x) AND Gᵢ(x) )
```

### Important modeling boundary

Natural-language interpretation is not decidable by Z3. Loophole proves a property of a finite, human-reviewable model. The UI therefore makes formalization coverage and assumptions more prominent than the LLM’s confidence score.

---

## 10. AI pipeline

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). Stages B, C and E are gone; D (tactic lanes) and G (repair) stay; F becomes the Defense agent.

### Stage A — Document structure

Parse official XML/HTML first. Use OCR only for image-only PDFs. Preserve section hierarchy, definitions, cross-references, page/paragraph anchors, and the exact source bytes/hash.

### Stage B — Independent extraction

Run two logically independent passes:

- **Extractor A:** clause → actors, triggers, duties, exceptions, thresholds.
- **Extractor B:** definitions and cross-reference resolver → normalized graph.

A deterministic reconciler compares the typed outputs. Conflicts become review items. Do not ask a third LLM to silently “decide the truth.”

### Stage C — Round-trip check

Render the Legal IR back into constrained plain English. Ask the user: “Does this preserve the meaning of the highlighted clause?” The answer is stored as an approval event.

### Stage D — Adversarial search

Generate candidates by explicit tactic family, not one broad “find loopholes” prompt. The model may invent entities and restructurings only inside the project’s declared type universe and bounds.

### Stage E — Deterministic compile and solve

The LLM never writes executable code that the server runs. Application code compiles validated IR and candidate JSON into SMT-LIB/typed Z3 expressions. Apply time, cardinality, and numeric bounds; run each candidate with a timeout; persist status, model, elapsed time, and input hash.

### Stage F — Grounded explanation

Generate the explanation from four immutable inputs only:

1. approved source spans;
2. approved Purpose Contract;
3. validated candidate;
4. solver model/certificate.

### Stage G — Repair synthesis

Generate a constrained redline targeting the exploited trigger/definition/exception. Prefer the smallest semantic delta. Recompile, rerun the exploit, run positive regression fixtures, then launch fresh attacks.

### Model strategy

Use the Vercel AI SDK provider abstraction so the project is not coupled to one vendor. Configure models by environment:

- `REASONING_MODEL`: extraction reconciliation, adversarial generation, repair;
- `FAST_MODEL`: labels, summaries, round-trip renderings;
- `EMBEDDING_MODEL`: optional clause retrieval only.

Require schema-constrained output with Zod. Vercel’s AI SDK supports typed structured generation and streaming across providers. [AI SDK documentation](https://vercel.com/docs/ai-sdk)

---

## 11. Backend API design

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). v2 drops compile/formalization/rule routes and renames certificates to findings ([v2 plan](docs/plans/2026-09-27-loophole-v2-plan.md) Task 3.6).

All mutating endpoints require authentication, project access, a Zod-validated payload, and an idempotency key. Long operations return `202 Accepted` with a `runId`; the client subscribes to run events.

### Projects and sources

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/projects` | Create a project from template, import, or upload |
| `GET` | `/api/projects/:projectId` | Fetch project summary and stage state |
| `POST` | `/api/projects/:projectId/sources/import` | Import an official API URL/version |
| `POST` | `/api/projects/:projectId/sources/upload` | Issue upload URL and register immutable artifact |
| `GET` | `/api/projects/:projectId/sources/:sourceId` | Fetch parsed text, metadata, anchors, and hash |

### Intent and compilation

| Method | Endpoint | Purpose |
|---|---|---|
| `PUT` | `/api/projects/:projectId/purpose-contract` | Version the purpose invariants and fixtures |
| `POST` | `/api/projects/:projectId/compile-runs` | Start parse/extract/reconcile workflow |
| `GET` | `/api/runs/:runId` | Get stage, progress, result, and errors |
| `GET` | `/api/runs/:runId/events` | SSE stream of durable run events |
| `PATCH` | `/api/projects/:projectId/rules/:ruleId` | Edit/approve/dispute a rule mapping |
| `POST` | `/api/projects/:projectId/formalization/lock` | Freeze an approved formalization version |

### Attack, certification, and repair

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/projects/:projectId/attack-runs` | Start tactic-bounded attack workflow |
| `GET` | `/api/attack-runs/:attackRunId/candidates` | Paginated candidates and statuses |
| `GET` | `/api/certificates/:certificateId` | Human trace plus raw solver artifact |
| `POST` | `/api/projects/:projectId/repair-runs` | Generate repair candidates for one certificate |
| `PATCH` | `/api/repairs/:repairId` | Edit or approve the proposed redline |
| `POST` | `/api/repairs/:repairId/retest-runs` | Recompile, regression-test, and re-attack |
| `GET` | `/api/projects/:projectId/report` | Read-only, citation-rich project replay |

### Public data proxy

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/catalog/congress/bills` | Search Congress.gov through a server-side key |
| `POST` | `/api/catalog/congress/import` | Fetch selected metadata and text version, then snapshot |
| `GET` | `/api/catalog/federal-register` | Search proposed/final rules |

Do not expose government API keys to the browser. Cache immutable text versions by canonical identifier and checksum.

---

## 12. Neon database design

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). See its section 3 for the one-migration diff (`findings` replaces `formalizations`/`certificates`).

Use **Neon Postgres + Drizzle ORM**. Runtime access should follow Neon/Vercel’s current recommended pooled/serverless connection guidance; migrations use a direct connection. Preview deployments get isolated Neon branches where available.

### Core schema

| Table | Important columns | Role |
|---|---|---|
| `users` | `id`, `auth_subject`, `created_at` | App identity mapping |
| `projects` | `id`, `owner_id`, `name`, `status`, `demo_template` | Workspace root |
| `project_members` | `project_id`, `user_id`, `role` | Authorization |
| `sources` | `id`, `project_id`, `jurisdiction`, `canonical_url`, `sha256`, `blob_key` | Immutable legal artifacts |
| `source_versions` | `id`, `source_id`, `official_version_id`, `issued_at`, `retrieved_at`, `metadata jsonb` | Official version history |
| `source_spans` | `id`, `version_id`, `section_path`, `text`, `start_offset`, `end_offset` | Citation anchors |
| `purpose_contracts` | `id`, `project_id`, `version`, `status`, `contract jsonb` | Human-approved intent |
| `formalizations` | `id`, `project_id`, `source_version_id`, `version`, `status`, `coverage` | Formal model root |
| `legal_rules` | `id`, `formalization_id`, `rule_type`, `ir jsonb`, `status` | Typed rules |
| `rule_sources` | `rule_id`, `source_span_id`, `mapping_kind` | Many-to-many traceability |
| `test_fixtures` | `id`, `project_id`, `kind`, `assignments jsonb`, `expected_status` | Positive/negative regression cases |
| `runs` | `id`, `project_id`, `type`, `status`, `input_hash`, `started_at`, `finished_at` | Durable job state |
| `run_events` | `id`, `run_id`, `sequence`, `stage`, `payload jsonb` | UI progress/audit stream |
| `attack_candidates` | `id`, `run_id`, `tactic`, `candidate jsonb`, `validation_status` | AI-proposed scenarios |
| `solver_certificates` | `id`, `candidate_id`, `result`, `smtlib`, `model jsonb`, `elapsed_ms`, `solver_version` | Reproducible proof artifacts |
| `repairs` | `id`, `certificate_id`, `patch jsonb`, `status`, `approved_by` | Versioned amendments |
| `model_calls` | `id`, `run_id`, `stage`, `provider`, `model`, `prompt_hash`, `schema_version`, `usage jsonb` | AI provenance/cost |
| `audit_events` | `id`, `project_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata jsonb` | Append-only trust log |

### Database rules

- Never overwrite a source, Purpose Contract, formalization, or certificate; create a new version.
- Put relational identity and queryable status in columns; put evolving IR payloads in `jsonb` with a schema version.
- Store original large files in Blob, but keep hashes and canonical metadata in Neon.
- Index `project_id`, `run_id`, status/time fields, official IDs, and source paths.
- Add `tsvector` full-text indexes for source spans. Add `vector` only if long-document retrieval is implemented.
- Enforce tenant ownership in application queries and database policies/roles where practical.

---

## 13. Official APIs and datasets

### Use in the hackathon MVP

| Source | Verified capability | Auth/access | Exact role in Loophole |
|---|---|---|---|
| [Congress.gov API v3](https://api.congress.gov/) | Bill metadata, actions, summaries, amendments, and a list of text versions; JSON/XML | Free `api.data.gov` key | Search/import a federal bill and preserve version metadata |
| [Congress.gov API repository and OpenAPI](https://github.com/LibraryOfCongress/api.congress.gov) | Primary endpoint contract and schemas | Public | Generate/validate the ingestion client |
| [GovInfo Developer Hub](https://www.govinfo.gov/developers) | API plus bulk collections; Congressional bill text from the 113th Congress onward, bill status from the 108th, statutes, U.S. Code, CFR, and Federal Register collections | API key for API; bulk files publicly available | Structured XML/USLM source, offline fixtures, and reproducible snapshots |
| [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1) | Search and retrieve Federal Register documents and metadata | Public API | Proposed-rule/final-rule discovery and future retrodiction cases |
| [Regulations.gov API v4](https://open.gsa.gov/api/regulationsgov/) | GET documents, comments, and dockets; OpenAPI contract | `api.data.gov` key | Import rulemaking dockets and public evidence; do **not** post comments |
| [California Legislative Information](https://leginfo.legislature.ca.gov/) | Official bill text, versions, comparisons, and California code | Public web source | Historical benchmark and current AI-policy stress tests |

### Golden and contemporary cases

| Case | Why it is useful | Use boundary |
|---|---|---|
| CCPA → CPRA “sale”/“sharing” | Simple enough to formalize; later text explicitly covers cross-context behavioral advertising without consideration | Golden retrodiction; validate the chosen archived text/version before final filming |
| [California SB-53 version comparison](https://leginfo.legislature.ca.gov/faces/billVersionsCompareClient.xhtml?bill_id=202520260SB53) | Many revisions to frontier-model duties and definitions | Contemporary import showcase; do not promise a known loophole in advance |
| [California SB-833](https://leginfo.legislature.ca.gov/faces/billCompareClient.xhtml?bill_id=202520260SB833&showamends=false) | Human-oversight duties plus a “substantially disruptive” alternative-review branch | Strong adversarial test candidate for nominal oversight and exception abuse |
| [California AB-1609](https://leginfo.legislature.ca.gov/faces/billCompareClient.xhtml?bill_id=202520260AB1609&showamends=false) | Current customer-service chatbot duties with multiple versions | Optional current-bill import, subject to status/version recheck before demo |

The contemporary cases are **attack targets, not pre-declared findings**. The system earns credibility only if a finding quotes the bill verbatim and survives a unanimous blind defense vote.

### Expansion sources—not hackathon dependencies

| Source/tool | Future value | Why it stays out of the core demo |
|---|---|---|
| [EUR-Lex/Cellar reuse services](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html) | EU metadata via SPARQL, Cellar REST, XML/Formex, and data dumps | Multi-jurisdiction semantics would expand scope dramatically |
| [Catala](https://github.com/CatalaLang/catala) | Research-grade programming language for literate, executable law | Excellent future interoperability; unnecessary second formal language now |
| [OpenFisca](https://openfisca.org/) | Executable tax/benefit rule models and simulations | Best for quantitative entitlement rules, not this bounded definition/exception demo |

### Dataset principle

Do not train on a giant undifferentiated “legal dataset.” For this product, a small expert-reviewed benchmark is more valuable:

- 1 golden historical version pair;
- 3–5 human-written attack scenarios per tactic family;
- 3 legitimate scenarios per case;
- exact source spans and an approved Legal IR;
- expected `SAT`/`UNSAT` outcomes;
- a hidden holdout bill/version for evaluation.

Store this benchmark as versioned JSON fixtures in the repository with source URLs, retrieval dates, checksums, and licenses/terms notes.

---

## 14. Workflow internals

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md).

### Compile workflow

1. Snapshot and hash source.
2. Parse structure and anchors.
3. Select bounded clauses.
4. Run extractor A and B with versioned schemas.
5. Reconcile deterministically.
6. Persist disputes and proposed rules.
7. Wait for human approval through a workflow hook.
8. Lock the formalization and run fixture checks.

### Attack workflow

1. Load only approved formalization and purpose versions.
2. Allocate an attack budget per tactic.
3. Generate candidate batches as typed JSON.
4. Reject schema/type/bound violations.
5. Deduplicate by canonical assignment signature.
6. Compile each candidate deterministically.
7. Solve with per-candidate timeout and global run budget.
8. Persist all outcomes, including rejections.
9. Explain only certified (`SAT`) candidates.
10. Stop after the demo target or budget—not after the first persuasive story.

### Repair workflow

1. Freeze selected certificate.
2. Identify the minimal exploited rule slice.
3. Generate up to three textual patches.
4. User selects/edits one.
5. Re-extract only affected clauses, but rerun model consistency.
6. Test the exploit family, all positive fixtures, and other certified findings.
7. Run a fresh tactic budget against the repaired version.
8. Produce a signed/hash-addressed comparison report.

### Idempotency and replay

Every run input is content-addressed from source version, purpose version, formalization version, tactic budget, model/prompt/schema versions, and solver version. Repeating the same deterministic solve should reuse or reproduce the same certificate. AI generations remain auditable even when nondeterministic.

---

## 15. Security, safety, and legal integrity

- Treat uploaded documents and official-page content as untrusted input; never follow instructions embedded in them.
- Separate source text from model instructions using explicit structured fields.
- Do not execute model-generated code or SMT-LIB directly. Compile from validated application-owned AST nodes.
- Enforce parser limits, upload limits, solver timeouts, candidate bounds, and per-user rate limits.
- Keep provider and government API keys server-side.
- Use signed upload URLs and malware/type checks for files.
- Hash immutable sources and certificates; expose hashes in reports.
- Log approvals, edits, model versions, prompt hashes, and solver versions.
- Add a visible disclaimer: “Research and drafting support. Not legal advice. Findings are AI-reviewed, grounded in quoted text, and require human judgment.”
- Prevent weaponization-by-obscurity concerns through responsible output: projects are private by default; public sharing is explicit; sensitive unpublished drafts are not used for training.
- Include a **Report modeling error** action on every rule and finding.

---

## 16. Evaluation plan

### Core metrics

| Metric | Definition | Hackathon target |
|---|---|---:|
| Source trace coverage | Approved rules with at least one exact source span | 100% |
| Grounding | Findings whose every quote is verbatim in the source | 100% (enforced) |
| Schema validity | Model outputs passing typed validation | ≥95% after one retry |
| Golden verdict agreement | C1 to C8 verdicts match expectations | 8/8 in 2 of 3 live runs |
| Defense unanimity | Share of verdicts with a unanimous vote | reported, no target |
| Historical retrodiction | Golden exploit class independently rediscovered | 1/1 |
| Positive preservation | Legitimate uses still allowed after repair | 100% |
| Exploit closure | Golden exploits Blocked after repair | 100% |
| Citation correctness | Finding claims linked to relevant approved evidence | 100% in demo report |
| Demo latency | Seeded attack → first confirmed finding visible | <15 seconds |
| Fresh-run budget | Complete bounded live run | <2 minutes or async with progress |

### Negative controls

- An attack quoting words not in the bill must be rejected as ungrounded.
- An attack the text plainly forbids (golden C2, C3, C7) must be blocked with a quote.
- A legal but harmless scheme (golden C4, C5, C6) must be judged harmless, not a loophole.
- An overbroad repair (“ban all data transfer”) must fail at least one legitimate use.
- A split jury must show "Jury split" and wait for a human, never LOOPHOLE.
- A finding altered after generation must fail its hash check.

### The four-hour kill test

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). Its replacement is the pivot gate ([v2 plan](docs/plans/2026-09-27-loophole-v2-plan.md) Phase 4).

Proceed with Loophole only if the team can:

1. encode the golden case;
2. reproduce a valid `SAT` counterexample;
3. explain it from source spans;
4. apply the later repair concept; and
5. make the exploit family `UNSAT` while preserving positive fixtures.

If that loop cannot work, narrow the model further. Do not hide a failed solver behind polished LLM prose.

---

## 17. Hackathon build plan

### Must ship

- one official historical Source Pack;
- 10–20 bounded clauses/definitions;
- reviewed Purpose Contract;
- quote-to-source traceability on every claim;
- 5–8 attack candidates across at least three tactics;
- at least one finding confirmed 3/3 in a real Live run;
- inspectable debate transcript;
- one approved repair and complete re-attack;
- positive regression fixtures;
- shareable read-only report;
- deterministic Demo Mode and deployed Vercel URL.

### Should ship

- Congress.gov import;
- contemporary California bill import;
- attack progress streaming;
- model/prompt provenance panel;
- responsive, keyboard-accessible UI.

### Could ship

- Federal Register import;
- collaborative comments;
- automatic bill-version diff;
- optional pgvector clause retrieval;
- PDF report export after the hackathon.

### Explicitly cut

- case-law interpretation;
- all-jurisdiction support;
- autonomous legal drafting;
- an open-ended legal chat assistant;
- training a custom foundation model;
- a graph database or separate vector service;
- blockchain/notarization gimmicks;
- claims of universal legal correctness.

### Suggested implementation order

> **v2 note:** this section describes the retired Z3 design. The v2 equivalent is in [docs/plans/new_architecture.md](docs/plans/new_architecture.md). Remaining work: the [v2 plan](docs/plans/2026-09-27-loophole-v2-plan.md) (Phases 0 to 8, ending with ship).

| Block | Outcome |
|---|---|
| 0–4 hours | Golden fixture, Legal IR, Z3 `SAT → repair → UNSAT` kill test |
| 4–10 hours | Neon schema, run/certificate persistence, deterministic APIs |
| 10–18 hours | Clause Compiler and Certified Loophole Card |
| 18–26 hours | Attack Arena, Workflow orchestration, structured model generation |
| 26–34 hours | Repair Studio, regression matrix, replay/report |
| 34–40 hours | Official import path, provenance, security limits |
| Final block | Accessibility, tests, deployment, seeded demo, video and Devpost |

---

## 18. Testing strategy

### Unit tests

- Legal IR schema and migrations;
- AST-to-Z3 compiler;
- definition/cross-reference resolution;
- candidate normalization and deduplication;
- certificate hashing;
- permission checks.

### Property tests

- equivalent normalized assignments compile identically;
- stronger prohibitions cannot make a previously impossible exploit possible within the same bounded domain;
- every compiled symbol has a declared type and source or purpose origin;
- serializing/deserializing IR preserves semantics.

### Integration tests

- official source import → immutable snapshot;
- approved formalization → attack workflow → certificate;
- repair → recompile → negative and positive suites;
- retrying a workflow step does not duplicate certificates or charges;
- SSE reconnect resumes from the last event sequence.

### End-to-end demo test

Run the exact three-minute path in Playwright on the production preview. Assert the visible source version, purpose version, `SAT` certificate, repair redline, `UNSAT` retest, and positive fixture count.

---

## 19. Deployment blueprint

### Vercel

- Deploy the Next.js app, route handlers, and Workflow steps.
- Pin Node/runtime versions and lock dependencies.
- Use preview deployments for UI review.
- Stream run events to the browser; persist the canonical state in Neon so a refresh does not lose progress.
- Configure function/workflow duration and memory only after profiling the real Z3 WASM bundle.
- Use Vercel Observability plus Sentry/OpenTelemetry for exceptions and workflow traces.

Vercel documents durable workflows, queues, streaming responses, and function duration behavior; confirm the selected plan’s current quotas immediately before implementation because limits and product availability can change. [Workflow documentation](https://vercel.com/docs/workflows) · [Queues documentation](https://vercel.com/docs/queues) · [Streaming guide](https://vercel.com/kb/guide/what-is-streaming)

### Neon

- Production branch: protected data and migrations.
- Preview branches: isolated schema/data for pull requests where plan limits allow.
- Runtime connection: current Neon/Vercel-recommended pooled connection.
- Migration connection: direct URL, never used in user request paths.
- Scheduled backup/export of golden fixtures and certificates.

### Environment variables

```text
DATABASE_URL
DATABASE_DIRECT_URL
AUTH_SECRET / provider credentials
AI_GATEWAY_API_KEY or selected model-provider key
CONGRESS_GOV_API_KEY
REGULATIONS_GOV_API_KEY
BLOB_READ_WRITE_TOKEN
SENTRY_DSN
APP_BASE_URL
REASONING_MODEL
FAST_MODEL
```

Do not require Regulations.gov, EUR-Lex, or any live government endpoint for the golden demo.

---

## 20. Architecture decisions that should not drift

| Decision | Choice | Reason |
|---|---|---|
| Product boundary | Draft/policy red-team, not legal advice | Clear user, safer claim, differentiated demo |
| Proof boundary | “Confirmed by adversarial review” | Agents review, they do not prove; claims stay grounded in quotes |
| Database | Neon Postgres | Relational provenance, JSONB IR, serverless fit, optional pgvector |
| Judge | Deterministic quote gate + blind jury of 3 + human tie-break | Handles real legal language; zero setup per bill |
| Orchestration | Next.js `after()` + `run_events` | Refresh-safe, no beta surface |
| AI layer | Vercel AI SDK provider abstraction | Structured output and model portability |
| Retrieval | SQL/full-text first | Bounded corpus; vector similarity is not proof |
| Source strategy | Official APIs + immutable snapshots | Reproducibility and version traceability |
| Demo strategy | Seeded retrodiction plus optional live import | Reliable and independently meaningful |
| Repair strategy | Minimal patch plus two-sided regression | Prevent “fix by banning everything” |

---

## 21. Why this can win LexHack

The concept maps unusually well to the published judging criteria:

| LexHack criterion | Weight | What judges see |
|---|---:|---|
| Real-world impact & feasibility | 25% | A deployable pre-publication workflow for drafters and civic groups; official source integrations; bounded claim |
| Technical execution & functionality | 25% | Deterministic quote gate, blind jury of 3, human tie-break, immutable versions, 3-check re-attack, not a prompt wrapper |
| UX & design | 20% | Paste a bill and attack; a visual attack/verdict/repair loop anyone can follow |
| Innovation & originality | 15% | Fuzzing and red-team/blue-team review with regression-tested repair applied to legislation |
| Presentation & documentation | 15% | A three-minute historical retrodiction with a live Confirmed → Blocked flip |

The hackathon explicitly rewards solutions at the intersection of AI, law, civic technology, governance, automation, real-world impact, usability, and innovation. Loophole hits those goals with one coherent mechanism rather than a bundle of unrelated features.

### What makes it more than an LLM wrapper

- The attacker cannot award itself a finding.
- Every claim must quote the hashed source verbatim, checked by code.
- Three judges who never hear the attacker's pitch can reject a persuasive but wrong scenario, and must quote why; ties go to a human.
- Repairs must survive both exploit and legitimate-use regression tests.
- Every visible conclusion can be replayed from versioned inputs.

### The closing pitch

> “AI agents will find specification gaps faster than institutions can react. Loophole gives rulemakers the same advantage before deployment: state the purpose, attack the rule, cross-examine every claim, repair it, and run the tests again.”

---

## 22. Submission copy

### Short summary

**Loophole is a pre-deployment red team for law. It uses one AI to generate specification-gaming schemes against a bill and its stated purpose, keeps only those that quote the text verbatim and survive a blind jury of 3 AI judges (a human breaks ties), proposes a minimal amendment, and re-attacks the repaired draft.**

### Problem

Legal rules are often tested only after publication—through public harm, enforcement disputes, or litigation. LLMs can brainstorm weaknesses, but they also invent plausible-sounding scenarios that the text does not actually permit.

### Solution

Loophole pits a red-team agent against a jury of three AI judges under code-enforced rules, with a human breaking ties. Every claim quotes a hashed source clause, the judges never hear the attacker's argument, and every repair must close the exploit without breaking approved legitimate scenarios.

### Suggested tagline options

1. **Fuzz your law before AI agents do.**
2. **CI for public rules.**
3. **Attack. Cross-examine. Repair. Re-attack.**

Use option 1 as the primary tagline and option 3 as the product loop.

---

## 23. Source and implementation notes

Research checked on **27 September 2026**. Platform plans, quotas, bill status, and API limits are time-sensitive and must be rechecked immediately before implementation or filming.

### Primary references

- LexHack 2026 brief and judging criteria: local downloaded hackathon description; canonical event page: [LexHack 2026 on Devpost](https://lexhack-2026.devpost.com/)
- [Congress.gov API](https://api.congress.gov/)
- [Library of Congress Congress.gov API information](https://www.loc.gov/apis/additional-apis/congress-dot-gov-api/)
- [Congress.gov API source and OpenAPI](https://github.com/LibraryOfCongress/api.congress.gov)
- [GovInfo Developer Hub](https://www.govinfo.gov/developers)
- [Federal Register API v1](https://www.federalregister.gov/developers/documentation/api/v1)
- [Regulations.gov API v4](https://open.gsa.gov/api/regulationsgov/)
- [California Civil Code §1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140)
- [Vercel AI SDK](https://vercel.com/docs/ai-sdk)
- [Neon connection guidance](https://neon.com/docs/connect/choose-connection)
- [EUR-Lex data reuse](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html)

### Claim discipline

- “Confirmed” always means confirmed by adversarial review in a specific run, never proven.
- “Repair closes exploit” means the original scheme is Blocked, a fresh attack confirms nothing, and legitimate uses stay allowed.
- “No loophole survived review” never means no loophole exists.
- The historical benchmark result must be regenerated by the implemented system before it appears in the final submission.

---

## Final build recommendation

Build **one impeccable loop**:

> **official text → explicit purpose → adversarial search → verbatim-quote gate → blind jury of 3 → human tie-break → minimal repair → 3-check re-attack**

If this loop works visibly and reproducibly, Loophole will feel ambitious, technically serious, product-complete, and unusually credible. Everything else is secondary.
