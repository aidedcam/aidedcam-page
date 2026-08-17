# 004 — Make smooth scrolling honour `prefers-reduced-motion`

- **Status**: DONE (applied 2026-08-15, verified in-browser)
- **Commit**: 4ca455b
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, ~6 lines

## Problem

The site's reduced-motion kill-switch only collapses `animation-duration` and
`transition-duration`. Neither property governs scrolling, so smooth scroll is
the one piece of motion on the site that ignores the user's preference
completely — and it is full-viewport motion, the kind most likely to trigger
vestibular symptoms.

```css
/* css/editorial.css:76-78 — current: does not cover scrolling */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
```

```css
/* css/editorial.css:82 — current: applies to every in-page anchor jump on every page */
html { scroll-behavior: smooth; }
```

```js
/* index.html:2588-2590 — current: JS smooth scroll bypasses CSS entirely */
      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
```

The CSS declaration affects every nav anchor on `index.html` (`#provlima`,
`#ti-kanoume`, `#kerdizeis`, `#methodos`, `#ergaleia`, `#giati`, `#contact`) and
the skip-to-content link on every page. The JS call is the back-to-top button,
which scrolls the full document height in one motion.

## Target

```css
/* css/editorial.css — target: a second query, placed AFTER the base rule */
html { scroll-behavior: smooth; }
/* Must follow the rule above: the kill-switch block higher up covers
   animation/transition durations only, and scroll-behavior is neither. */
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
```

> **Placement is load-bearing.** The obvious move — adding
> `html { scroll-behavior: auto; }` inside the existing kill-switch block at
> lines 76-78 — does **not** work. That block sits *above*
> `html { scroll-behavior: smooth; }` at line 82, and both rules have identical
> specificity, so the later declaration wins and smooth scrolling survives.
> Verified in-browser: with the override inside the top block, computed
> `scroll-behavior` under emulated reduced motion was still `smooth`. The
> override must come after the base rule.

```js
/* index.html:2588-2591 — target */
      backToTopBtn.addEventListener('click', function() {
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      });
```

## Repo conventions to follow

- The reduced-motion block at `css/editorial.css:76-78` is the single global
  place for this concern — extend it rather than adding a second media query
  elsewhere in the file.
- `index.html`'s inline script uses ES5-style `var`/`function`; keep that style.
- `window.matchMedia` needs no polyfill for the browsers this site targets and
  is used nowhere else in the repo — this is its first use, which is fine.

## Steps

1. `css/editorial.css:82` — directly below `html { scroll-behavior: smooth; }`,
   add the comment and the second `@media (prefers-reduced-motion: reduce)`
   block shown above. Leave the kill-switch block at lines 76-78 untouched.
2. `index.html:2588-2590` — replace the click handler with the target version
   above.

## Dependency

If plan **001** has already been applied, this handler sits at the bottom of the
rewritten IIFE rather than at line 2588 — find it by its
`window.scrollTo({ top: 0, behavior: 'smooth' })` body, which plan 001 leaves
untouched on purpose. Applying 001 first is recommended but not required.

## Boundaries

- Do NOT remove or weaken the existing `*` rule in the reduced-motion block —
  `CLAUDE.md` documents it as a deliberate site-wide kill-switch.
- Do NOT change `css/editorial.css:82` itself; smooth scroll stays the default
  for users who have not asked for reduced motion.
- Do NOT add reduced-motion branching anywhere else in this plan.
- No other page has a back-to-top button (`#backToTop` exists only at
  `index.html:1024`) — do not add the JS branch to other pages.
- If the code at a cited line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (no build). Console must stay error-free after the change.
- **Feel check**:
  - DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" →
    `reduce`. Click a nav anchor on `index.html`: the page must jump instantly,
    with no travel.
  - With the emulation still on, scroll past 500px and click the back-to-top
    button: it must jump to the top instantly.
  - Turn the emulation off and repeat both: smooth scrolling must return.
  - Tab to the skip-to-content link on `what-you-gain.html` and activate it under
    `reduce` — it must jump, not glide.
- **Done when**: under emulated reduced motion, no scroll on any page animates,
  and with the emulation off the behaviour is unchanged from today.
