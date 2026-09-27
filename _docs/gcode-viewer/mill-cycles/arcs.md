# Arcs: G02/G03 in G17/G18/G19, R sign, full circles, helical motion, radius check

Status: PARTLY VERIFIED against helmancnc, cnccookbook and one Fanuc alarm reference for the
plane/axis assignment, the R positive/negative minor/major-arc rule, the full-circle-needs-I/J/K
rule, and the existence and cause of the end-point radius-mismatch alarm. Three items are
UNVERIFIED, recorded below with what was tried: the G2/G3 clockwise convention is only confirmed
for the default G17 (XY) plane, not stated explicitly for G18/G19; helical motion on the third
axis was not found stated by any reachable source; and the 0.02 mm tolerance figure itself
(`s.arcTolerance`) was not found in any reachable source, the same way "PS0020" against
"Alarm 20" is handled below.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| G17 / G18 / G19 | select the XY / ZX / YZ plane | modal |
| I, J | arc centre offset from the start point, X/Y axes (G17) | mm |
| K, I | arc centre offset from the start point, Z/X axes (G18) | mm |
| J, K | arc centre offset from the start point, Y/Z axes (G19) | mm |
| R | arc radius; positive selects the minor (<=180 deg) arc, negative the major (>180 deg) arc | mm |
| the third axis | moves helically along the arc (Z in G17, Y in G18, X in G19) | mm |
| the tolerance | max. allowed start/end radius mismatch before the check flags an error (`s.arcTolerance`) | 0.02 mm |

## Move sequence (as the code draws it, `js/mill/arcs.js` `arcPath()`)

- G17 pairs I with X and J with Y around a Z normal; G18 pairs K with Z and I with X around a Y
  normal; G19 pairs J with Y and K with Z around an X normal (`PLANES` table).
- G3 sweeps counter-clockwise in the plane's (a, b) axes as seen from the positive end of the
  normal axis; G2 sweeps clockwise. This is stated by the module's own comment as matching how
  "Fanuc and Haas define it." Every reachable source that describes the direction does so only
  for the default G17 (XY) plane; the G18/G19 wording is the module's own comment, not confirmed
  independently (see Sources).
- With I/J/K, the centre is the start point plus the offset; with R, a positive R picks the
  shorter (minor) arc between start and end, a negative R the longer (major) one.
- A full circle (start === end) requires a centre from I/J/K; R cannot express one (the module
  returns a `'radius'` error if same-point with only R is given, since d=0 needs an R>0 but the
  chord check would still accept it as a zero-length full circle only via I/J/K).
- The third axis (the plane's `l`) interpolates linearly across the sweep, producing helical
  motion when its start and end values differ.
- The end-point radius check behaves differently depending on how the arc was specified —
  checked directly against the `arcPath` code in `task-7-brief.md`:
  - **With R (no centre given):** if the chord between the two points is too long for the given
    radius (including the same-point/full-circle case, which R cannot express at all), the
    module cannot place a centre; it reports the `'radius'` error and draws a single move
    straight to the commanded end point — the arc itself is not drawn.
  - **With I/J/K (a centre given):** a centre is always available, so the sweep is always drawn
    end to end. If the start-radius and end-radius differ by more than the tolerance, the module
    still sets the same `'radius'` error, but keeps sweeping: it blends the radius from the start
    value to the end value across the sweep (`rr = r0 + (r1 - r0) * f`), so the drawn arc still
    ends exactly at the commanded point instead of jumping there.
  - Both cases stand in for the real control's end-point radius-mismatch alarm; only the R-word
    case draws the alarm-triggering move as a straight jump rather than a (mismatched) arc.

## Fanuc vs Haas differences

- No Fanuc/Haas difference was found in any reachable source for plane/axis assignment, the R
  sign convention, or the full-circle rule; every source checked describes these identically for
  both, or as a Fanuc-labelled tutorial that a Haas-labelled forum post did not contradict.

## Sources checked

- helmancnc, "Circular Interpolation Concepts & Programming Part 3 (Use of I J K)" (secondary,
  tutorial site): `https://www.helmancnc.com/circular-interpolation-concepts-programming-part-3/`
  — "G17 (XY-plane): Use I and J," "G18 (XZ-plane): Use I and K," "G19 (YZ-plane): Use J and K,"
  and "I, J and K are the offsets from the current location" to "the DISTANCE from the ARC START
  POINT to the CENTER POINT of the arc." Matches the plan's `PLANES` table's axis-to-letter
  assignment exactly (K/I for G18, J/K for G19, in the plan's own naming order).
- cnccookbook, "Quick G-Code Arc Tutorial [Make G02 & G03 Easy]" (secondary, tutorial site):
  `https://www.cnccookbook.com/cnc-g-code-arc-circle-g02-g03/`
  — "If R is negative, it takes the longer path... Positive gets the shorter path," matching
  "R > 0 is the minor arc, R < 0 the major arc" exactly; "Full circles come about when the start
  and endpoints are identical and the center is specified via IJK... you can't specify a full
  gcode circle with the 'R' notation," matching the brief's "a full circle takes I/J/K with no
  end change" exactly; "Add the I to X axis, J to Y axis, and K to Z axis of the start point and
  you get the arc center," a generic (G17-flavoured) statement of the centre offset that matches
  the plan's `ca = from[a] + I`, `cb = from[b] + J` construction.
- WebSearch summary drawing on a Haas code-settings page title and secondary tutorials (pages not
  independently opened beyond the two above): "Use a positive R-value for radii of 180 or less,
  and a negative R-value for radii more than 180," repeating the same rule found directly on
  cnccookbook; used here only as corroboration, not independent verification.
- helmancnc, "Fanuc Alarm 20 OVER TOLERANCE OF RADIUS" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-alarm-20-over-tolerance-of-radius/`
  — "Alarm 20 - OVER TOLERANCE OF RADIUS," caused when circular interpolation is executed and
  "difference of the distance between the start point and the center of an arc and that between
  the end point and the center of the arc exceeded the value specified in parameter No. 3410."
  This confirms the alarm exists and its cause matches the plan's radius check exactly (start-
  radius vs end-radius, against a tolerance); the page names it "Alarm 20," not "PS0020" — the
  brief's "PS0020" number was not independently found on this or any other reachable page, so the
  alarm identity is treated as confirmed under the "Alarm 20" name the source actually uses, per
  the brief's own "or whatever the source names it" allowance.
- G2 clockwise-as-seen-from-the-positive-normal convention: not separately sourced beyond the
  cnccookbook/helmancnc pages above, which describe G2/G3 direction only in the default XY plane;
  no source was reachable that states the G18/G19 clockwise convention explicitly (i.e. "as seen
  from the positive end of the normal axis" for G18/G19 specifically). Recorded UNVERIFIED for
  G18/G19; not contradicted.
- Helical motion on the third axis (linear interpolation of Z/Y/X along the arc sweep): no
  reachable source discusses this explicitly; recorded UNVERIFIED, not contradicted. It follows
  the same principle Fanuc calls "helical interpolation," which the Haas G02/G03 page title
  (`https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G02.html`,
  returned via WebSearch snippet only, not opened directly — see below) also names ("Helical
  interpolation CW" appears alongside "Circular interpolation CW" in a GTCNC code table surfaced
  by the same search), but no source describes the linear-interpolation mechanics used here.
- Haas mill G02 code-settings page:
  `https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G02.html` and
  machiningdoctor.com's G02/G03 page — both returned HTTP 403 when fetched directly, tried once
  each, not retried.
- The 0.02 mm tolerance figure itself (`s.arcTolerance`, used for the radius-mismatch check
  above): no reachable source gives a number for this — the "Fanuc Alarm 20" page above names the
  *parameter* (No. 3410) that holds a real control's tolerance but not its value, and no tutorial
  page or manual excerpt was reachable that states 0.02 mm specifically. Recorded UNVERIFIED, the
  same way "PS0020" against the source's own "Alarm 20" is handled above; not contradicted by
  anything found.
