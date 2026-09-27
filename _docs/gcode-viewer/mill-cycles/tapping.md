# Tapping: G84, G74, rigid tapping M29

Status: PARTLY VERIFIED. The G84/G74 motion and the M29 rigid-tapping trigger are each confirmed
by a reachable source. Two items are UNVERIFIED, recorded below with what was tried: the F =
pitch x S feedrate formula in G94, whose only support is an unopened WebSearch summary of an
unnamed tutorial (treated as supporting evidence only, not independent verification); and
G84.2/G84.3 being read as G84/G74, which was not found in any reachable source.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| X, Y | hole position | mm |
| Z | tap depth | mm |
| R | R-plane | mm |
| F | feedrate — pitch x S in G94 (feed/min); pitch directly in G95 (feed/rev) | mm/min or mm/rev |
| K | repeat count | integer |

## Move sequence (as the code draws it, `js/mill/cycles.js` `holeMoves()`)

- **G84** (right-hand tap): feed in to Z, spindle reverses, feed out to R, then (G98) rapid up to
  the initial level.
- **G74** (left-hand tap): same sequence with the spindle direction reversed at each stage.
- Both are drawn as feed-in / feed-out only — the spindle reversal itself is not a drawn move.
- **G84.2 / G84.3**: read by the plan as plain G84 / G74 (`DRILL_ALIAS` in `js/mill/machine.js`).

## Fanuc vs Haas differences

- No Haas-specific wording was found beyond the shared M29 rigid-tapping mechanism and F=pitch×S
  formula; the sources checked are Fanuc-labelled tutorials and a Fanuc/lathe-labelled cnccookbook
  page that also covers G74.

## Sources checked

- helmancnc, "G84 and G74 Tapping Cycle Syntax" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-g84-tapping-cycle/`
  — "Rapid traverse to X, Y position (pre-drill hole position). Rapid traverse to R-plane.
  Tapping operation is done till Z-depth (with tapping feed given with G84)," then "Spindle is
  rotated CCW" and "Tap is Retracted with the specified feed." Confirms feed-in, spindle
  reversal, feed-out for G84. For G74: "works the way as G84 tapping cycle" with spindle
  direction as the only stated difference — matches the brief's G84/G74 symmetry. Does not
  mention F=pitch×S, M29 or G84.2/G84.3.
- cnccookbook, "G84 G-Code: Programming Tapping Cycles in CNC" (secondary, tutorial site):
  `https://www.cnccookbook.com/g84-g-code-tapping-cycle-rigid-fanuc-lathe/`
  — "M29 is the common way to do this [trigger rigid tapping] on Fanuc controls" and "G74 G Code:
  Tapping of left hand threads to be done with M4 spindle rotation." Confirms M29 as the rigid-
  tap trigger and G74 as the left-hand tap code; does not state the F=pitch×S formula or mention
  G84.2/G84.3.
- WebSearch summary of an unnamed Fanuc rigid-tapping tutorial (not independently opened, cited
  only for the formula): "for an M10 x 1.5 tap at 300 RPM, F=300x1.5=450 mm/min" under "G94 (Feed
  per Minute): Calculate feedrate as Spindle Speed x Pitch," and "in G95 mode, the feed (F) in
  the G84 line is the pitch of the thread." Matches the brief's "F is pitch x S in G94" exactly,
  but was not confirmed against a source opened directly, so it is recorded as supporting rather
  than fully verifying evidence.
- No reachable source discusses G84.2 or G84.3 at all; the brief's "read as G84/G74" alias is
  recorded UNVERIFIED, not contradicted.
