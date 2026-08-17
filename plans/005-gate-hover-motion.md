# 005 — Gate every hover lift behind `(hover: hover) and (pointer: fine)`

- **Status**: DONE (applied 2026-08-15, verified in-browser)
- **Commit**: 4ca455b
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, 6 rules

## Problem

Six card rules lift by `translateY(-3px)` on hover, none of them gated for
pointer type. On a touch device a tap fires a synthetic hover, so the card lifts
and **stays lifted** until the user taps somewhere else — motion the visitor
never asked for, stuck in a state they cannot clear. There is no
`@media (hover: hover)` query anywhere in the repo today.

```css
/* index.html:677-680 — current */
    .benefit-card:hover {
      border-color: var(--line-strong);
      transform: translateY(-3px);
    }
```

```css
/* index.html:741-744 — current */
    .tool-card:hover {
      transform: translateY(-3px);
      border-color: var(--line-strong);
    }
```

```css
/* what-you-gain.html:373 — current */
    .scaling-card:hover { border-color: var(--line-strong); transform: translateY(-3px); }
```

```css
/* what-you-gain.html:411 — current */
    .quality-card:hover { transform: translateY(-3px); border-color: var(--line-strong); }
```

```css
/* what-you-gain.html:461 — current */
    .custom-col:hover { border-color: var(--line-strong); transform: translateY(-3px); }
```

```css
/* css/methodos.css:238 — current */
.tm-root .q-card:hover { border-color: var(--line-strong, #c2bfb1); transform: translateY(-3px); }
```

## Target

Split each rule: the `border-color` change stays ungated (a colour shift on tap
is harmless and reads as useful feedback), the `transform` moves inside the
gate. Pattern, applied six times:

```css
/* target — index.html */
    .benefit-card:hover {
      border-color: var(--line-strong);
    }
    @media (hover: hover) and (pointer: fine) {
      .benefit-card:hover { transform: translateY(-3px); }
    }
```

```css
/* target — index.html */
    .tool-card:hover {
      border-color: var(--line-strong);
    }
    @media (hover: hover) and (pointer: fine) {
      .tool-card:hover { transform: translateY(-3px); }
    }
```

```css
/* target — what-you-gain.html */
    .scaling-card:hover { border-color: var(--line-strong); }
    @media (hover: hover) and (pointer: fine) {
      .scaling-card:hover { transform: translateY(-3px); }
    }
```

```css
/* target — what-you-gain.html */
    .quality-card:hover { border-color: var(--line-strong); }
    @media (hover: hover) and (pointer: fine) {
      .quality-card:hover { transform: translateY(-3px); }
    }
```

```css
/* target — what-you-gain.html */
    .custom-col:hover { border-color: var(--line-strong); }
    @media (hover: hover) and (pointer: fine) {
      .custom-col:hover { transform: translateY(-3px); }
    }
```

```css
/* target — css/methodos.css */
.tm-root .q-card:hover { border-color: var(--line-strong, #c2bfb1); }
@media (hover: hover) and (pointer: fine) {
  .tm-root .q-card:hover { transform: translateY(-3px); }
}
```

Each gated block goes **immediately after** the rule it splits, at the same
indentation as its neighbours in that file (4 spaces inside the inline `<style>`
blocks in the HTML pages; 0 at top level in `css/methodos.css`).

## Repo conventions to follow

- Breakpoint media queries in this repo are written as
  `@media (max-width: 768px)` and grouped at the bottom of each file. This plan's
  queries are **capability** queries, not breakpoints — keep them inline next to
  the rule they modify, not in the responsive section.
- `css/methodos.css` keeps its own local fallback values in `var()` calls
  (e.g. `var(--line-strong, #c2bfb1)`) — preserve that fallback exactly.
- The base `transition` on each card already lists `transform`
  (`index.html:659, 736`; `what-you-gain.html:371, 409, 459`;
  `css/methodos.css:231`) — leave those declarations alone; they are harmless on
  touch once the transform never changes.

## Steps

1. `index.html:677-680` — split into the two target blocks.
2. `index.html:741-744` — split into the two target blocks.
3. `what-you-gain.html:373` — split into the two target blocks.
4. `what-you-gain.html:411` — split into the two target blocks.
5. `what-you-gain.html:461` — split into the two target blocks.
6. `css/methodos.css:238` — split into the two target blocks.

## Boundaries

- Do NOT gate `:hover` rules that only change colour, border, or opacity —
  there are many across the site (`.nav-link:hover`, `.footer-links a:hover`,
  `.trust-badge img:hover`, `.m-tab:hover`, …) and they are all correct as-is.
- Do NOT touch `css/methodos.css:239` (`.q-card:hover::before { width: 5px }`).
  It is a separate finding (layout animation on hover) covered by a different
  plan; leaving it ungated for now is intentional.
- Do NOT change the `-3px` distance, the transition durations, or any markup.
- Do NOT add a `@media (hover: hover)` wrapper around whole style blocks — gate
  the individual `transform` declarations only.
- If the code at a cited line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (CSS only). Grep `@media (hover: hover) and (pointer: fine)`
  → exactly 6 occurrences across the 3 files.
- **Feel check**:
  - Desktop with a mouse: hover each of the six card types — the 3px lift must
    still happen exactly as before.
  - DevTools → Device toolbar → any phone preset (which reports
    `pointer: coarse`) → tap a card: the border may change colour, but the card
    must NOT lift, and nothing must remain visibly stuck after the tap.
  - Real touch device if available (the emulator's pointer emulation is not
    always faithful) — tap a `.benefit-card` on `index.html` and a `.q-card` in
    the Μέθοδος questions grid, then scroll away and back; no card is left
    raised.
  - Confirm keyboard tabbing through cards is unaffected (these are not
    focusable elements; nothing should change).
- **Done when**: all six lifts are mouse-only, all six colour changes still fire
  on touch, and no card can be left in a stuck raised state on a phone.
