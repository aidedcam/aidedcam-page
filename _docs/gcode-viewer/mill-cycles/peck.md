# Peck drilling: G83, G73

Status: VERIFIED against helmancnc for G73's motion and its retract parameter number (5114);
PARTLY VERIFIED for G83, whose motion sequence is confirmed but whose retract parameter number
(5115) was not stated by any reachable source. For the Haas equivalents: Setting 52 (G83's extra
retract above R) is VERIFIED, from a page fetched directly. Setting 22 and its 0.5 mm default —
which matches the plan's `peckClearance` default — is UNVERIFIED: the only support is an unopened
WebSearch summary of a Haas page that itself returned HTTP 403 when fetched directly; treated as
supporting evidence only, not independent verification.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| X, Y | hole position | mm |
| Z | final depth | mm |
| R | R-plane | mm |
| Q | peck depth (depth of each cut) | mm, positive |
| F | cutting feedrate | mm/min |
| K | repeat count | integer |

## Move sequence (as the code draws it, `js/mill/cycles.js` `holeMoves()`)

- **G83** (peck, full retract): feed down Q, rapid all the way back to R, rapid back down to
  `d` above the last depth reached, feed on to the next depth; repeat until Z is reached, then
  rapid to the return level. `d` is the viewer's `peckClearance` setting (0.5 mm).
- **G73** (peck, chip-break retract): feed down Q, rapid back by `d` only (not to R), feed on;
  repeat, then rapid to the return level.
- When Q is smaller than `d`, the G73 retract and the G83 approach point land above R. The drawing
  follows the rule literally rather than clamping them to R.
- A peck cycle whose Z is at or above R is drawn like G81: one feed to Z, then the return level.
- Haas also writes G73/G83 with I (the first peck), J (how much each peck shrinks) and K (the smallest
  peck) instead of Q. The viewer pecks that way, and K is then not a repeat count (Haas repeats with
  L). Source: the Haas G83 reference cited by the final review; not opened here (haascnc.com returns
  HTTP 403), so UNVERIFIED.

## Fanuc vs Haas differences

- `d` is a Fanuc machine parameter: No. 5115 for G83, No. 5114 for G73. Only 5114 (G73) was
  confirmed by a reachable source; 5115 (G83) matches the brief's assumption but was not found
  independently.
- Haas equivalent: Setting 22 sets the G73 chip-break retract amount, said (by an unopened
  WebSearch summary, not independently verified) to default to 0.02 in (0.5 mm) — matching the
  viewer's `peckClearance` default, but recorded UNVERIFIED, not confirmed. Setting 52, VERIFIED
  from a page fetched directly, sets an additional retract distance above R for G83's
  full-retract move (letting the R-plane sit closer to the part).

## Sources checked

- helmancnc, "G83 Peck Drilling Cycle: Syntax and Motion Sequence" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-g83-peck-drilling-cycle/`
  — "Rapid traverse to X, Y drilling position," "Rapid traverse to R-plane," "Drilling with feed
  Q deep," "Retraction with Rapid traverse to R-plane," "Rapid traverse to Q-d deep (d value is
  specified in parameters)," "Drilling with feed Q+d deep," repeating "until reaching Z-depth."
  Confirms the brief's "feed Q, rapid to R, rapid back to the last depth + d, feed on" for G83,
  and that `d` is a machine parameter, but does not give the parameter number.
- helmancnc, "G73 High Speed Peck Drilling Cycle - Syntax & Parameters" (secondary, tutorial
  site): `https://www.helmancnc.com/fanuc-g73-high-speed-peck-drilling-cycle/`
  — "The tool dips into the workpiece for the infeed Q, drives back (retraction) 1mm to break
  chips, dips in again, until end depth is reached, then retracts with rapid feed" and
  "Retraction amount can be set in parameter 5114." Confirms both the brief's "feed Q, retract d,
  feed on" motion for G73 and the parameter number 5114 exactly.
- helmancnc, "Haas Setting 52 G83 Retract Above R - Haas Mill" (secondary, tutorial site):
  `https://www.helmancnc.com/haas-setting-52-g83-retract-above-r-haas-mill/`
  — "Range 0.0 to 30.00 inches or 0-761mm). This setting changes the way G83 ... behaves," used
  to let the R-plane sit closer to the part while the tool still clears chips by the setting's
  amount above R on the retract move.
- WebSearch summary citing Haas documentation (setting name/number, not independently opened):
  "On Haas machines, G73 ... retracts the amount of Setting 22 (Default value = 0.02" or 0.5 mm)
  after each peck, instead of completely exiting the hole like G83 does." This is the source for
  the Haas Setting 22 default of 0.5 mm quoted above; the underlying Haas page was not opened
  directly (see below).
- Haas mill G73/G83 code-settings pages:
  `https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G83.html` and the
  G73 equivalent — HTTP 403, tried once each, not retried.
- No reachable source states the Fanuc parameter number for G83's retract distance (5115); the
  brief's number is recorded UNVERIFIED, not contradicted.
