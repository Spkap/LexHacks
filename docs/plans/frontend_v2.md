# Loophole v2 Frontend: Product Flow, Routing, Layout

**Status:** adopted 2026-09-27. Pairs with [new_architecture.md](new_architecture.md) (engine) and the [v2 plan](2026-09-27-loophole-v2-plan.md) (Phase 5 War Room, Phase 6 landing + replay). Illustrative numbers in the wireframes follow the golden case (8 schemes: 3 blocked, 3 harmless, 2 loopholes).

**Intent this spec serves** (full version in [v2 plan section 0](2026-09-27-loophole-v2-plan.md#0-product-intent-read-before-every-phase)): flashy, demonstrative, very visual; hackathon friendly and intuitive; **not a case-study report**; a really good landing page; routing and layout treated as part of the product.

## 1. Diagnosis: why v1 feels like a case study

| v1 problem | Effect on a judge |
|---|---|
| 7 separate pages (Source → Purpose → Compile → Attack → Findings → Repair → Report) behind a sidebar | The story is chopped into forms. Nobody sees cause and effect on one screen. |
| Gate pages ("Lock the formalization before attacking") | Dead ends. First impression is "you can't do that yet". |
| Landing = headline + 3 buttons + 3 text boxes | Nothing moves. The product never shows itself. |
| Paper background, serif headings, long subtitles | Looks like a legal memo, not a tool. |
| Findings, Repair, Report are separate pages | The best moment (the loophole breaking through, then the patch sealing it) happens across page loads. |

**Product principle for v2:** *one battlefield, not a wizard.* The bill and the attack sit on the same screen, every verdict animates onto the exact clause it's about, and the patch happens in place. Time from landing to first loophole on screen: **under 10 seconds**.

---

## 2. Routes (3 surfaces instead of 9)

```text
/                     Landing. Self-playing hero battle, paste box, bill gallery.
/a/[slug]             War Room. Whole product loop on one page.
/a/[slug]?f=<id>      Same page, finding drawer open (deep link, back button closes it)
/a/[slug]?view=patch  Same page, bill panel in redline mode
/r/[slug]             Public replay: before/after scoreboard + replay button + OG image
/p/[slug]/*           Legacy. Redirects to /a/[slug] (keeps old links and e2e alive)
```

Drawer and view state live in `searchParams`, not new routes: shareable, refresh-safe, no intercepting-route complexity.

### App structure

```text
src/app/
  (marketing)/layout.tsx        top nav (logo, "Watch demo", GitHub), footer disclaimer
  (marketing)/page.tsx          landing
  a/[slug]/page.tsx             server: load project + latest runs, render <WarRoom>
  r/[slug]/page.tsx             replay
  r/[slug]/opengraph-image.tsx  "2 loopholes → 0" card
  p/[slug]/[[...rest]]/page.tsx redirect('/a/[slug]')
src/components/
  landing/   hero-battle.tsx  paste-box.tsx  how-it-works.tsx  history-strip.tsx  bill-gallery.tsx
  warroom/   war-room.tsx (client shell + reducer)  mission-bar.tsx  scoreboard.tsx
             bill-panel.tsx  arena.tsx  scheme-chip.tsx  finding-drawer.tsx
             purpose-sheet.tsx  patch-panel.tsx  reattack-banner.tsx
  shared/    verdict-stamp.tsx  quote-link.tsx (SVG connector chip → clause)
```

`war-room.tsx` owns one `useReducer` fed by the existing `useRunEvents` SSE hook. Every child reads from it, so chip, clause highlight, and scoreboard update from the same event in the same frame. Keep files under 250 lines.

---

## 3. Landing `/`

Goal: the product shows itself before anyone clicks, then gives two doors.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ◆ Loophole                                   Watch demo   GitHub         │
├──────────────────────────────────────────────────────────────────────────┤
│  Find the loophole                     ┌───── LIVE REPLAY (autoplay) ───┐│
│  before someone else does.             │ §1798.140(t) "Sell" means ...  ││
│                                        │   ▲ red chip: "Give data free" ││
│  AI attacks your bill. A jury of 3 AI  │   🛡 blocked   ○ harmless         ││
│  judges cross-examines every claim.    │   ★ LOOPHOLE  3/3  (coral stamp)││
│  You make the final call.              │ 8 schemes · 6 stopped · 2 found││
│                                        └────────────────────────────────┘│
│  [ ▶ Watch it catch a real loophole ]   ← primary, forks CCPA benchmark   │
│  [ Paste a bill…                    ][Attack] ← secondary                 │
├──────────────────────────────────────────────────────────────────────────┤
│  ① ATTACK            ② CROSS-EXAMINE          ③ PATCH & RE-ATTACK        │
│  9 tactics hit the   Bad quotes thrown out.  Minimal redline. Loophole    │
│  bill at once.       Jury of 3 AI judges.    closes. Legit uses survive.  │
│  (tiny looping anim) (shield anim)           (red → teal flip anim)       │
├──────────────────────────────────────────────────────────────────────────┤
│  2018 ───────● Loophole finds "free sharing" gap ────● 2020 California   │
│  CCPA text                (from 2018 text only)        adds "share". ✓    │
├──────────────────────────────────────────────────────────────────────────┤
│  Try another bill:  [CCPA 2018 · 2 found]  [SB-53 · ?]  [AB-1609 · ?]    │
├──────────────────────────────────────────────────────────────────────────┤
│  Research and drafting support. Not legal advice. …                      │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Hero battle** is a client component playing the recorded golden fixtures from a static import. No DB, no LLM, so it never fails or waits. Loops every ~12 s, pauses on hover, respects `prefers-reduced-motion` (shows the final frame).
- **One primary action.** "Watch it catch a real loophole" forks CCPA and lands in the War Room with Attack ready. Paste box is secondary but visible above the fold.
- **Copy budget:** headline ≤ 8 words, subline ≤ 25 words, each how-it-works card ≤ 12 words. No "formal model", no "Legal IR".
- Congress.gov import lives in the paste box as a small "or import from Congress.gov" link, not a third hero button.

---

## 4. War Room `/a/[slug]` (the product)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← CCPA 2018 (AB-375)  sha 3f9a…  │ Purpose: "Stop opted-out data reaching │
│                                  │ ad networks, even for free" ✎          │
│  ATTACK ▸ PATCH ▸ RE-ATTACK   (phase stepper, current one lit)           │
│  [  ⚔ ATTACK  ]   8 schemes · 3 blocked · 3 harmless · 2 LOOPHOLES        │
├───────────────────────────┬──────────────────────────────────────────────┤
│ THE BILL (paper panel)    │ ARENA (dark panel)   seats: T  P  E           │
│                           │ threshold split  ● ───────── ○ harmless        │
│ §1798.140(t)(1) "Sell"    │ relabel          ● ─── 🛡 blocked              │
│ means ... for monetary or │ no consideration ● ════════════ ★ LOOPHOLE 3/3│
│ ▓▓other valuable consid▓▓◄┼─── connector line from chip to quoted clause │
│ eration.                  │ affiliate        ● ════════════ ★ LOOPHOLE 3/3│
│                           │ timing           ● ─── ○ harmless              │
│ §1798.120(a) ...  (heat:  │ exception abuse  ● ─── ○ harmless              │
│  clauses glow coral when  │ (any bad quote)  ● ✕ thrown out: not in bill  │
│  a loophole cites them)   │ …                                             │
├───────────────────────────┴──────────────────────────────────────────────┤
│  Must stay legal:  ○ Service provider  ○ Consumer asked                  │
│  ○ Paid sale before opt-out     (○ = not checked yet, ✓/✕ after re-attack)│
└──────────────────────────────────────────────────────────────────────────┘
        Click a LOOPHOLE chip → right drawer slides over the arena:
        ┌──────────────── Finding drawer (?f=C1) ────────────────┐
        │ ★ LOOPHOLE  Confirmed by adversarial review (3/3)      │
        │ ┌ Law satisfied ✓ ┐ ┌ Purpose defeated ✕ ┐              │
        │ "Hand the data to the ad network for free."            │
        │ ATTACKER (red)          │ JURY                         │
        │ memo + quotes           │ Textualist ⚖ loophole        │
        │                         │ Purposivist ⚖ loophole       │
        │                         │ Enforcer ⚖ loophole          │
        │ [ Patch this loophole ] [ Overrule ] [ Verify ]        │
        └────────────────────────────────────────────────────────┘
```

### Interaction flow (one page, three phases)

1. **Arrive.** Golden: purpose pre-filled and approved, ATTACK pulses. Pasted bill: `purpose-sheet` opens first with the sentence builder, an AI-suggested purpose (one `FAST_MODEL` call, human edits and approves), and one legit use. That's the only gate.
2. **Attack.** All 9 tactic lanes fire together. Each chip travels: *proposed* (outline) → *grounding* (draws an SVG line to its quoted clause, which highlights in the bill) → *cross-examined* (3 named jury seats, Textualist / Purposivist / Enforcer, light up one by one with their vote) → stamp: 🛡 Blocked (teal), ○ Harmless (grey, "legal, but no harm to the purpose"), ★ LOOPHOLE 3/3 (coral), or Jury split (amber) with a gavel: "Loophole or Not a loophole?" One click and the human's ruling is stamped next to the jury's. Thrown-out chips' lines fizzle with "quote not in bill". The scoreboard counts up live.
3. **Inspect.** Click any chip: drawer opens (`?f=C1`), bill scrolls to the cited clause. The drawer shows the attacker's memo next to each judge's vote and reasoning (blocked votes carry the blocking quote), plus **Overrule** (human ruling) and **Verify** (recompute hash + re-run quote check). This is the "not a wrapper" proof, one click away.
4. **Patch.** "Patch this loophole" switches the bill panel to redline mode (`?view=patch`): strikethrough coral, insertions blue, directly in the document, with proposal tabs and a "History check" toggle that shows California's real 2020 text beside ours. **Human approves** (or edits) = new source version; nothing changes before that.
5. **Re-attack.** Stepper moves to RE-ATTACK and three check rows fill side by side (Old loophole · Fresh attack · Legit uses) while the arena replays against the patched text. The two loophole chips crack from coral to teal "PATCHED", fresh schemes fail, and the legit-use strip turns ○ ○ ○ into ✓ ✓ ✓. A banner: **"2 loopholes → 0. 3/3 legit uses kept."** with [Share replay] → `/r/[slug]`.
6. **Overbroad control (golden).** A small "Try the lazy fix" button in the patch panel applies "ban all disclosures" and the legit-use strip goes ✕ ✕. Ten-second demo beat.

### Visual language

- **Two materials:** the bill is a paper panel (existing `--paper`, serif body text, feels official). The arena is a dark ink panel (`--ink` background) where the action happens. That contrast is what makes it feel like a tool, not a report.
- Keep the existing tokens: coral = attack/loophole, teal = blocked/patched, grey = harmless/thrown out, blue = patch edits, amber = jury split. Status is always icon + word + color.
- **Motion does the explaining:** chip travel, connector lines, the verdict stamp (scale 1.3 → 1 + short shake on LOOPHOLE), crack-and-flip on PATCHED, number count-up. All `motion` with a `useReducedMotion` guard (instant state changes, no travel).
- Big numbers in the scoreboard (tabular mono), small everything else. No paragraph over 2 lines anywhere in the War Room; detail lives in the drawer.
- Provenance (sha, run id, jury votes, human ruling) stays visible but tiny, in the mission bar and drawer footer, for judges who look.

### Mobile / narrow

Bill panel collapses into a "Bill" tab; arena is the default view. Drawer becomes a bottom sheet. Demo is desktop-first, but nothing breaks at 375 px.

---

## 5. Replay `/r/[slug]`

Read-only. Top: the before/after scoreboard ("2 loopholes → 0 · 3/3 legit uses kept"), bill title, sha, date. Middle: a "▶ Replay the attack" button that runs the same arena animation from stored run events. Bottom: finding cards and the redline. "Fork and attack it yourself" CTA. OG image renders the scoreboard, so the link preview is itself flashy.

---

## 6. What we reuse and what we cut

- **Reuse:** `useRunEvents`, all API routes (plus the changes in v2 plan Task 3.6), `attack-arena.tsx` lane logic (becomes `arena.tsx` + `scheme-chip.tsx`), `purpose-editor.tsx` (becomes `purpose-sheet.tsx`), `repair-studio.tsx` redline rendering (moves into `patch-panel.tsx` and the bill panel's redline mode), `report-view.tsx` (becomes the replay page), design tokens, shadcn `sheet`/`tabs`/`dialog`.
- **Cut:** `stage-rail.tsx`, `provenance-strip.tsx` (merged into mission bar), all `/p/[slug]/*` pages (now redirects), gate screens, `components/compile/*`.

## 7. Acceptance checks

- Landing hero animates within 1 s of load with network throttled (static fixture).
- Landing → first LOOPHOLE stamp visible in the War Room in < 10 s in Demo Mode.
- The whole golden loop (attack, inspect, patch, re-attack, share) needs **no page navigation** except the final share.
- Every chip's connector points at a highlighted clause that contains its quote.
- Keyboard: Tab reaches ATTACK, each chip (Enter opens drawer, Esc closes), the gavel's two choices, patch approve. axe: 0 serious on `/`, `/a/[slug]`, `/r/[slug]`.
- Reduced motion: same states, no travel animations.
