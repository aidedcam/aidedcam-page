# Animation improvement plans

Produced by the `improve-animations` skill against commit `4ca455b`, from the
audit of the site's motion surface (findings 1, 2, 3, 5, 6 of 10 — the top five
by leverage). Each plan is self-contained: exact file paths, current code,
target values, boundaries, and a feel check. An executor needs no other context.

| # | Plan | Severity | Category | Files | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | [Drive the scroll-progress bar with `transform`, not `width`](001-scroll-progress-gpu.md) | HIGH | Performance | `css/editorial.css`, `index.html` | DONE |
| 002 | [Clear the leaked `translateY(16px)` on both lead-gated pages](002-fade-in-transform-leak.md) | HIGH | Physicality | `what-you-gain.html`, `calculator.html` | DONE |
| 003 | [Add an `--ease-out` token and use it for every entrance](003-ease-out-token.md) | HIGH | Easing & duration | `css/editorial.css`, `what-you-gain.html`, `calculator.html` | DONE |
| 004 | [Make smooth scrolling honour `prefers-reduced-motion`](004-reduced-motion-scroll.md) | MEDIUM | Accessibility | `css/editorial.css`, `index.html` | DONE |
| 005 | [Gate every hover lift behind `(hover: hover) and (pointer: fine)`](005-gate-hover-motion.md) | MEDIUM | Accessibility | `index.html`, `what-you-gain.html`, `css/methodos.css` | DONE |

All five were applied on 2026-08-15 in the order below and verified in a real
browser (Playwright over a local static server), not by inspection alone.

One correction came out of that verification: plan **004**'s original target put
`html { scroll-behavior: auto; }` inside the existing kill-switch block, which
sits *above* `html { scroll-behavior: smooth; }` and therefore lost the cascade.
The plan and the code now place the override after the base rule. See the
callout in `004-reduced-motion-scroll.md`.

## Recommended execution order

**002 → 001 → 004 → 003 → 005**

- **002 first** — it is a two-line bug fix with no dependencies, and it changes
  what the gated pages look like. Fixing it first means every later feel check
  on `what-you-gain.html` / `calculator.html` is judged against correct layout.
- **001 next** — the largest perf win, and it rewrites the block that 004 then
  edits.
- **004 after 001** — its JS target lives inside the IIFE that 001 rewrites.
  004 states how to find the handler either way, so the reverse order works, but
  this way avoids a stale line number.
- **003 and 005 last** — pure CSS, independent of everything above and of each
  other. Either order.

## Dependencies

- 004 → 001 (soft: line-number only, both plans note it)
- Nothing else. 002, 003 and 005 touch disjoint declarations.

## Not in this batch

Findings 4, 7, 8, 9, 10 from the audit — infinite `adStep`/`adDash` loops
(`index.html:578, 594`), the `width`/`max-height` layout transitions
(`what-you-gain.html:348`, `calculator.html:465, 517`), 450–500ms Μέθοδος tab
switches (`css/methodos.css:81, 107`), the perpetual `mdTaskPulse`
(`css/methodos.css:144-147`), and the eight `transition: all` declarations.
Re-run `improve-animations` to turn any of them into plans.

Additive motion suggestions (press feedback, calculator row enter/exit, gate
handoff, results stagger) came from `find-animation-opportunities` and are not
plans yet — `improve-animations plan <description>` writes one on request.

## Executing a plan

Any agent can run one: point it at the plan file. The plans forbid improvising —
if the code has drifted from commit `4ca455b`, the executor must stop and report
rather than guess. After execution, `review-animations` renders a verdict on the
diff.
