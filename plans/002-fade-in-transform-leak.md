# 002 — Clear the leaked `translateY(16px)` on both lead-gated pages

- **Status**: DONE (applied 2026-08-15, verified in-browser)
- **Commit**: 4ca455b
- **Severity**: HIGH
- **Category**: Physicality
- **Estimated scope**: 2 files, 2 lines

## Problem

Both gated pages reuse the global `.fade-in` class name on their **content
container** to reveal it after the lead form is submitted. The global rule sets
both `opacity: 0` and `transform: translateY(16px)`; the local override only
cancels the opacity half. Nothing ever adds `.visible` to the container, so the
transform is never cleared and the entire revealed page renders 16 pixels lower
than it should — permanently, for every visitor who passes the gate.

```css
/* css/editorial.css:369-370 — the global rule (do not change here) */
.fade-in { opacity: 0; transform: translateY(16px); transition: opacity 0.6s ease, transform 0.6s ease; }
.fade-in.visible { opacity: 1; transform: translateY(0); }
```

```css
/* what-you-gain.html:214-216 — current */
    .roi-content.fade-in {
      opacity: 1;
    }
```

```css
/* calculator.html:175 — current */
    .calc-content.fade-in { opacity: 1; }
```

```js
/* what-you-gain.html:1480 — where the class is added (do not change) */
        content.classList.add('fade-in');
```

```js
/* calculator.html:1333 — where the class is added (do not change) */
        content.classList.add('fade-in');
```

Specificity confirms the diagnosis: `.roi-content.fade-in` (0,2,0) beats
`.fade-in` (0,1,0) for `opacity`, but `transform` is declared *only* in the
global rule, so it applies unopposed.

Secondary effect: a `transform` on an element establishes a containing block for
any `position: fixed` descendant. Today the consent banner sits outside
`.roi-content` (which closes at `what-you-gain.html:973`), so nothing is broken
by that — but the offset itself is visible and the transition on `transform` is
dead code.

## Target

```css
/* what-you-gain.html:214-216 — target */
    .roi-content.fade-in {
      opacity: 1;
      transform: none;
    }
```

```css
/* calculator.html:175 — target */
    .calc-content.fade-in { opacity: 1; transform: none; }
```

## Repo conventions to follow

- Page-specific CSS stays in the page's inline `<style>`; shared CSS lives in
  `css/editorial.css`. This fix belongs in the pages, not the shared file —
  `.fade-in` itself is correct and is used by dozens of child elements.
- Exemplar of the intended child-level usage, which must keep working:
  `what-you-gain.html:1502` observes `.roi-content .fade-in` descendants and adds
  `.visible` to each. Those are a different set of elements from the container.

## Steps

1. `what-you-gain.html:214-216` — add `transform: none;` inside the
   `.roi-content.fade-in` rule.
2. `calculator.html:175` — add `transform: none;` inside the
   `.calc-content.fade-in` rule.

## Boundaries

- Do NOT edit `css/editorial.css:369-370`. The global `.fade-in` is correct and
  is relied on by every page.
- Do NOT rename the local class or change any JS. `content.classList.add('fade-in')`
  at `what-you-gain.html:1480` and `calculator.html:1333` stays as it is.
- Do NOT touch the descendant reveal logic at `what-you-gain.html:1493-1505`.
- If the code at a cited line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (CSS only, no build).
- **Feel check**:
  - Open `what-you-gain.html` in a private window, submit the gate form, and in
    DevTools inspect `#roiContent` → Computed → `transform` must read `none`
    (before the fix it reads `matrix(1, 0, 0, 1, 0, 16)`).
  - Compare the top edge of the revealed content against the navbar: after the
    fix it sits 16px higher and lines up with the container padding used by the
    rest of the site.
  - Repeat on `calculator.html` with `#calcContent`.
  - Reload with a stored lead in `localStorage` (`aidedcam-lead`) — the returning
    visitor path at `what-you-gain.html:1357` skips the gate and must also render
    with `transform: none`.
- **Done when**: computed `transform` on `#roiContent` and `#calcContent` is
  `none` on both the fresh-submit and returning-visitor paths.
