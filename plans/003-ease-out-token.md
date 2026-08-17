# 003 — Add an `--ease-out` token and use it for every entrance

- **Status**: DONE (applied 2026-08-15, verified in-browser)
- **Commit**: 4ca455b
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 3 files, ~10 lines

## Problem

Every scroll reveal on every page — the site's most-seen motion — enters with
the built-in `ease` curve over 600ms. `ease` is symmetric-ish and starts slow,
which delays the exact moment the eye lands on the element; the standard for
entering and exiting elements is `ease-out`, and built-in CSS easings are too
weak for deliberate motion. 600ms is also longer than this reveal needs.

```css
/* css/editorial.css:369-374 — current */
.fade-in { opacity: 0; transform: translateY(16px); transition: opacity 0.6s ease, transform 0.6s ease; }
.fade-in.visible { opacity: 1; transform: translateY(0); }
.fade-in-delay-1 { transition-delay: 0.06s; }
.fade-in-delay-2 { transition-delay: 0.12s; }
.fade-in-delay-3 { transition-delay: 0.18s; }
.fade-in-delay-4 { transition-delay: 0.24s; }
```

The same weak curve is applied to the two gate exits and the content entrance
that follows them:

```css
/* what-you-gain.html:207-210 — current */
    .roi-content {
      display: none; opacity: 0;
      transition: opacity 0.6s ease;
    }
```

```css
/* calculator.html:171-174 — current */
    .calc-content {
      display: none; opacity: 0;
      transition: opacity 0.6s ease;
    }
```

```js
/* what-you-gain.html:1473 — current */
      gate.style.transition = 'opacity 0.4s ease';
```

```js
/* calculator.html:1327 — current */
      gate.style.transition = 'opacity 0.4s ease';
```

There is no easing token in `:root` today, so every call site hardcodes a curve.

## Target

Add one token to `:root` in `css/editorial.css` (the file already groups tokens
under commented headings — put it in a new `/* —— Motion —— */` group directly
after the elevation group that ends at line 36):

```css
/* target — css/editorial.css, inside :root */
  /* —— Motion —— */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

```css
/* css/editorial.css:369 — target */
.fade-in { opacity: 0; transform: translateY(16px); transition: opacity 450ms var(--ease-out), transform 450ms var(--ease-out); }
```

Lines 370-374 (`.fade-in.visible` and the four delay classes) are unchanged —
60/120/180/240ms stagger is already inside the correct 30–80ms band.

```css
/* what-you-gain.html:209 — target */
      transition: opacity 450ms var(--ease-out);
```

```css
/* calculator.html:173 — target */
      transition: opacity 450ms var(--ease-out);
```

```js
/* what-you-gain.html:1473 and calculator.html:1327 — target */
      gate.style.transition = 'opacity 400ms var(--ease-out)';
```

`var()` resolves normally inside an inline `style.transition` string because
custom properties inherit from `:root` — no JS lookup is needed.

## Repo conventions to follow

- All tokens live in `:root` in `css/editorial.css` (lines 8-74), grouped under
  `/* —— … —— */` comment headings. Follow that formatting exactly: two-space
  indent, aligned values.
- `css/editorial.css:34-36` is the exemplar token group to imitate.
- `css/methodos.css` deliberately keeps its own local palette (see its header
  comment) — do not add the token there.

## Boundaries

- Do NOT change any `:hover` or color transition anywhere. `ease` is the
  **correct** curve for hover and color changes; only entrances and exits move
  to `ease-out`. This means leaving `css/editorial.css:180, 187, 209, 216, 228,
  254, 265, 281, 299, 304, 313, 323, 347` exactly as they are.
- Do NOT touch `css/methodos.css` in this plan (its 450/500ms durations are
  finding #8, a separate plan).
- Do NOT change the `.fade-in-delay-*` values.
- Do NOT convert other hardcoded curves (`cubic-bezier(0.16,1,0.3,1)` at
  `what-you-gain.html:348` and `calculator.html:465`) — those bar fills are
  covered by a different finding and change property, not just curve.
- If the code at a cited line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (no build). Grep `--ease-out` and confirm it is defined
  once and referenced five times.
- **Feel check**:
  - Scroll `index.html` slowly past a section: elements should snap into place
    and settle, rather than drifting in from a slow start.
  - DevTools → Animations panel → set playback speed to 10%, then scroll to a
    fresh section. Confirm the curve is front-loaded (most of the 16px travel
    happens in the first third of the 450ms) and that opacity and transform stay
    in sync — they must, since both use the same duration and curve.
  - Submit the gate on `what-you-gain.html` and watch the handoff: the form
    should leave quickly rather than lingering.
  - DevTools → Rendering → "Emulate prefers-reduced-motion" → the reveal must
    still show content (the global kill-switch at `css/editorial.css:76-78`
    collapses the duration to 0.001ms; nothing should stay invisible).
- **Done when**: the four entrance/exit call sites use `var(--ease-out)`, no
  hover or color transition was modified, and the reveal reads as fast-then-settle
  at 10% playback speed.
