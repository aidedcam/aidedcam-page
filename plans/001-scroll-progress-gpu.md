# 001 — Drive the scroll-progress bar with `transform`, not `width`

- **Status**: DONE (applied 2026-08-15, verified in-browser)
- **Commit**: 4ca455b
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 files, ~30 lines

## Problem

The scroll-progress bar is the only element on the site that animates on every
scroll frame, and it animates a layout property. Three separate scroll listeners
on `index.html` are also non-passive, and one of them reads layout inside the
handler.

```css
/* css/editorial.css:317 — current */
.scroll-progress { position: fixed; top: 0; left: 0; height: 2px; width: 0%; background: var(--accent); z-index: 1001; transition: width 0.05s linear; }
```

```js
/* index.html:2571-2591 — current */
    (function() {
      var progressBar = document.getElementById('scrollProgress');
      var backToTopBtn = document.getElementById('backToTop');

      window.addEventListener('scroll', function() {
        var scrollTop = window.scrollY;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var progress = (scrollTop / docHeight) * 100;
        progressBar.style.width = progress + '%';

        if (scrollTop > 500) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });

      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })();
```

Why it matters: `width` triggers layout → paint → composite on every scroll
event. `document.documentElement.scrollHeight` inside the handler forces a
synchronous layout before the browser can paint the frame. Non-passive scroll
listeners make the compositor wait for JS before it may scroll at all. Together
this is the largest source of scroll jank on the page. Only `transform` and
`opacity` skip layout and paint and run on the GPU.

`#scrollProgress` and `#backToTop` exist **only** on `index.html:1021` and
`index.html:1024` — no other page has them.

## Target

```css
/* css/editorial.css:317 — target */
.scroll-progress {
  position: fixed; top: 0; left: 0; height: 2px; width: 100%;
  background: var(--accent); z-index: 1001;
  transform: scaleX(0); transform-origin: 0 50%;
  will-change: transform;
}
```

```js
/* index.html:2571-2591 — target */
    (function() {
      var progressBar = document.getElementById('scrollProgress');
      var backToTopBtn = document.getElementById('backToTop');
      var docHeight = 0;
      var ticking = false;
      var lastVisible = null;

      function measure() {
        docHeight = document.documentElement.scrollHeight - window.innerHeight;
      }

      function update() {
        ticking = false;
        var scrollTop = window.scrollY;
        var progress = docHeight > 0 ? scrollTop / docHeight : 0;
        if (progress < 0) progress = 0;
        if (progress > 1) progress = 1;
        progressBar.style.transform = 'scaleX(' + progress + ')';

        var visible = scrollTop > 500;
        if (visible !== lastVisible) {
          backToTopBtn.classList.toggle('visible', visible);
          lastVisible = visible;
        }
      }

      measure();
      window.addEventListener('load', measure);
      window.addEventListener('resize', measure, { passive: true });
      window.addEventListener('scroll', function() {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      update();

      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })();
```

Also add `{ passive: true }` to the two other scroll listeners on the page:

```js
/* index.html:2367-2369 — target */
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
```

```js
/* index.html:2454-2462 — target: same body, add the options argument */
      window.addEventListener('scroll', function() {
        /* ...unchanged body... */
      }, { passive: true });
```

## Repo conventions to follow

- No build step, no framework, no bundler. Plain ES5-style `var`/`function` in
  `index.html`'s inline `<script>`; keep that style — do not introduce `const`,
  arrow functions, or optional chaining into the IIFE at 2571 (the arrow
  function at 2367 is pre-existing, leave its style alone).
- Shared CSS lives in `css/editorial.css`; page CSS stays inline in the page.
  `.scroll-progress` is shared CSS — edit it in `css/editorial.css` only.
- Exemplar of the passive pattern already in this repo: `index.html:2245` and
  `index.html:2252` both pass `{ passive: true }`.

## Steps

1. `css/editorial.css:317` — replace the `.scroll-progress` rule with the target
   block above. Note the `width` goes from `0%` to `100%` and the `transition`
   is removed entirely (the bar tracks scroll position directly; a transition
   would make it lag behind the finger).
2. `index.html:2571-2591` — replace the whole IIFE with the target block above.
3. `index.html:2369` — add `, { passive: true }` as the second argument to
   `addEventListener`.
4. `index.html:2462` — add `, { passive: true }` as the second argument to
   `addEventListener`.

## Boundaries

- Do NOT touch `what-you-gain.html`, `calculator.html`, `privacy.html`,
  `legal.html` — none of them has a progress bar.
- Do NOT change the `500`px back-to-top threshold or any markup.
- Do NOT alter the `behavior: 'smooth'` call in this plan — plan 004 handles it.
- Do NOT add dependencies or a build step.
- If the code at a cited line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: no build to run. Open `index.html` in a browser; the console
  must be free of errors, and the green bar must reach full width exactly at the
  bottom of the page.
- **Feel check**:
  - Scroll fast with a trackpad — the bar tracks the finger with no lag and no
    visible stepping.
  - DevTools → Performance → record a scroll: no `Layout` entries attributable
    to the progress bar, and the scroll listener no longer appears as a
    long task blocking the frame.
  - DevTools → Rendering → enable "Paint flashing": the bar should not repaint
    the whole strip on each frame.
  - Resize the window, then scroll to the bottom — the bar still lands at 100%
    (this proves `measure()` re-runs on resize).
  - Back-to-top button still appears past 500px and hides below it.
- **Done when**: `progressBar.style.width` appears nowhere in the codebase, all
  five scroll listeners across the site that remain non-passive are only the ones
  outside this plan's scope, and the bar behaves as above.
