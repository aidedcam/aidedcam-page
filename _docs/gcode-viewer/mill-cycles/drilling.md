# Plain drilling/boring cycles: G81, G82, G85, G86, G89

Status: PARTLY VERIFIED against helmancnc for the four move sequences (G81, G82, G85, G86) and
the Fanuc/Haas dwell-unit convention. G89's move sequence is UNVERIFIED: no tutorial describing
G89 directly was reached — the only evidence is a link-text paraphrase on the G86 page ("This
cycle differs from the standard Boring cycle G85 allowing to program a dwell time") plus the
inference that G89 sits in the same feed-in/dwell/feed-out family as G82 and G85. Haas mill
code-settings pages returned HTTP 403.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| X, Y | hole position | mm |
| Z | depth (feed from R to Z) | mm |
| R | R-plane | mm |
| P | dwell (G82/G89) | ms without a decimal point, s with one (Haas: same rule) |
| F | feedrate | mm/min |
| K / L | repeat count | integer |

## Move sequence (as the code draws it, `js/mill/cycles.js` `holeMoves()`)

- **G81** (plain drilling): feed from R to Z, then rapid to the return level (initial level on
  G98, R on G99). No dwell.
- **G82** (drilling with dwell): feed from R to Z, dwell P seconds at the bottom, then rapid to
  the return level.
- **G85** (boring, feed out): feed from R to Z, then feed (not rapid) back out to R; if G98, an
  additional rapid from R up to the initial level follows.
- **G86** (boring, rapid out): feed from R to Z, spindle stop at the bottom (not drawn as a
  separate move), then rapid to the return level.
- **G89** (boring with dwell, feed out): feed from R to Z, dwell P seconds, feed back out to R,
  then (G98) rapid up to the initial level.

## Fanuc vs Haas differences

- Dwell P: on both Fanuc and Haas, a decimal point makes P seconds; no decimal point makes it
  milliseconds. Confirmed for Fanuc by helmancnc's dedicated G04 article and for Haas by
  helmancnc's Haas-specific G04 article, using near-identical wording and examples (`P10.` = 10 s,
  `P10` = 10 ms on both).
- G86's motion is otherwise the same on both controls in every source checked; no Haas-specific
  wording was found for G81/G82/G85/G89 beyond the shared dwell-unit rule.

## Sources checked

- helmancnc, "G81 Drilling Cycle: Syntax and Motion Sequence" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc/fanuc-g81-drilling-cycle/`
  — Four-step sequence: rapid to X/Y, rapid to R, "Drilling with specified Feed from R-plane
  position to Z-depth position," then rapid to initial level or R depending on G98/G99. Matches
  the brief's "feed to Z, rapid out" for G81 exactly; no dwell mentioned.
- helmancnc, "G82 Drilling Cycle: Syntax, Motion, and P Parameter" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc/fanuc-g82-drilling-cycle/`
  — Five-step sequence ending "4- Dwell for specified time at hole bottom. 5- Rapid traverse to
  R-plane or Initial-level." Matches the brief's "dwell at the bottom" for G82. Does not state
  whether P is ms or s, or the decimal-point rule (covered instead by the dedicated dwell pages
  below).
- helmancnc, "G85 Boring Cycle Syntax and Motion Sequence" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-g85-boring-cycle/`
  — "Boring with feed from R-plane to Z-depth," then "Retraction with feed from Z-depth to
  R-plane" — explicitly feed in both directions, matching the brief's "G85: feed in, feed out."
  States the G98/return-to-initial-level step is separate from the feed-out-to-R step, matching
  the code's `feed(r); if (retLevel === 98) rapid(initZ)` split.
- helmancnc, "G86 Boring Cycle Syntax and Motion" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-g86-boring-cycle/`
  — "Boring with feed from R-plane to Z-depth," "Spindle stop at bottom of the hole," "Rapid
  traverse to R-plane (G99) or Initial-level (G98)." Matches "G86: feed in, rapid out" and adds a
  spindle-stop detail the plan does not draw as a move (consistent — the plan has no spindle
  visualisation). Also links to an "ECS G89 Boring with Dwell Cycle" page, described only as
  differing from G85 "by allowing a dwell time," not reached directly.
- helmancnc, "Fanuc Dwell G04 Command" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-dwell-g04-command/`
  — "With address P no decimal point is allowed," "G04 P1000 (dwell time = 1 sec = 1000 msec)";
  X/U dwell "(sec)" with decimal points shown, e.g. "G04 X2.5 (dwell time = 2.5sec)". This is the
  G04 dwell word specifically, used here as evidence for the general Fanuc P-in-ms convention
  that the plan also applies to G82/G89's cycle-dwell P.
- helmancnc, "Haas G04 Dwell Command - Dwell time in Seconds or Milliseconds" (secondary,
  tutorial site): `https://www.helmancnc.com/haas-g04-dwell-command-dwell-time-in-seconds-or-milliseconds/`
  — "G04 P10. (is a dwell of 10 seconds, see decimal at the end)" vs "G04 P10 (is a dwell of 10
  milliseconds. No decimal point)". Confirms the plan's `dwellP()` decimal-point rule for Haas as
  well as Fanuc.
- Haas mill code-settings pages for G81/G82/G85/G86/G89:
  `https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G81.html` (and
  equivalents) — HTTP 403, tried once each, not retried.
