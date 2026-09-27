# Boring approximations: G76, G87, G88

Status: VERIFIED that the plan's G76/G87/G88 moves are deliberate simplifications of the real
cycles, not a misreading of them — each real cycle is confirmed by a secondary source to involve
spindle orientation and a lateral shift (G76, G87) or a program-halting manual retract (G88) that
the viewer does not draw. No source contradicts the plan's stated approximation; it is exactly
what the plan's `APPROXIMATED` flag and checks.js `approximated` warning say it is.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| X, Y | hole position | mm |
| Z | depth (G76/G88) or bottom (G87) | mm |
| R | R-plane, or (G87) the top-of-hole level | mm |
| Q | shift amount at the bottom (G76), or shift via I/J (G87) | mm, positive |
| P | dwell (G76/G88) | ms without a decimal point, s with one |
| F | feedrate | mm/min |

## Move sequence (as the plan draws it, `js/mill/cycles.js` `holeMoves()`, `APPROXIMATED`)

- **G76** (fine boring): approximated as feed in to Z, dwell P, rapid out to the return level.
  The real cycle additionally stops and orients the spindle at the bottom and shifts the tool
  laterally by Q (in the direction set by a machine parameter) before retracting, so the tool
  clears the wall instead of dragging over the finished bore — none of that lateral shift is
  drawn.
- **G87** (back boring): approximated as feed in to Z, rapid out to the return level, with no
  dwell. The real cycle orients and shifts the spindle *before* going down to the bottom of the
  hole from the back side, shifts back, cuts on the way back up, orients and shifts again, then
  retracts — a materially different, more involved sequence than a straight feed-and-rapid.
- **G88** (boring with manual retract): approximated as feed in to Z, dwell P, rapid out to the
  return level. The real cycle dwells at the bottom, stops the spindle, and halts the program in
  feed-hold so the operator retracts the boring bar by hand before the operator resumes and the
  control rapids out — the plan draws a rapid retract in the operator's place, with no program
  halt.

## Fanuc vs Haas differences

- No Haas-specific wording was found for G76/G87/G88; the sources checked are Fanuc-flavoured
  tutorials, and one general secondary CNC-programming blog for G87/G88 that does not name a
  control.

## Sources checked

- helmancnc, "Fanuc G76 Fine Boring Cycle: Syntax and Motion Sequence" (secondary, tutorial
  site): `https://www.helmancnc.com/fanuc-g76-fine-boring-cycle-cnc-mill/`
  — "Q: Shift amount at the bottom of a hole," "the spindle is stopped at the fixed rotation
  position, and the tool is moved in the direction opposite to the tool tip and retracted,"
  shift direction set by "parameter 5101 bits 4-5." Confirms the brief's "orient, shift Q" for
  G76, and that the plan's feed-in/dwell/rapid-out is a simplification of this (the shift is not
  drawn).
- cnc-programming-tips.blogspot.com, "G87 Back Boring cycle" (secondary, tutorial blog):
  `https://cnc-programming-tips.blogspot.com/2015/12/g87-back-boring-cycle.html`
  — Full 14-step sequence including "Spindle Orientation," "Shift outward by Q value (or I/J
  amounts)," "Rapid motion to R level (hole bottom)," "Shift inward," "Spindle starts (M03),"
  "Feed to Z depth," and the mirrored shift/orient/retract on the way out; also states "G99 is
  never used with the G87 cycle." Confirms this is a materially richer sequence than the plan's
  feed-in/rapid-out approximation, as expected.
- cnc-programming-tips.blogspot.com, "G88 Boring cycle" (secondary, tutorial blog):
  `https://cnc-programming-tips.blogspot.com/2015/12/g88-boring-cycle.html`
  — Seven-step sequence: rapid to X/Y, rapid to R, "Feedrate motion to the depth in Z," "Dwell at
  the depth - in milli seconds (P)," "Spindle rotation STOP (Feed hold condition is generated and
  the CNC operator switch's to manual operation mode and performs a manual task, then switches
  back to memory mode)," then "Rapid retract to the initial level (with G98) or Rapid retract to
  R level (with G99)." Confirms the brief's "manual retract" characterisation and that the plan's
  dwell-then-rapid-out is standing in for a program halt, not mis-drawing a documented rapid.
- No reachable source gave a Haas-specific description of G76/G87/G88, or contradicted the
  dwell-unit convention (ms without a decimal point, s with one) used elsewhere in this plan.
