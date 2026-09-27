# Common drilling frame (G81-G89 modal state)

Status: PARTLY VERIFIED against helmancnc (G81 initial-level/R-plane mechanics, K/L repeat and
K0/L0 store-only behaviour) and CNC Training Centre (K/L repeat with G91 incremental stepping).
Two items are UNVERIFIED, recorded below with what was tried: the retention of the initial level
across a cycle-code change without an intervening G80 (no source addresses this specific point;
it is only inferred from "canned cycles are modal" language), and drilling being scoped to G17
only — no source reached states that canned cycles are G17-only or that G18/G19 excludes them;
the G02/G03 plane-selection pages found only describe I/J/K axis assignment, not drilling-cycle
scope. Haas mill pages for G81 and G98/G99 returned HTTP 403 (tried once each, not retried).

## Syntax (words shared by every G73/G74/G76/G81-G89 block)

| Word | Meaning | Unit |
|---|---|---|
| X, Y | hole position | mm (or inch under G20) |
| Z | absolute (G90) or incremental-from-R (G91) depth | mm |
| R | absolute (G90) or incremental-from-initial-level (G91) R-plane | mm |
| Q | peck depth (G73/G83) or shift amount (G76) | mm, positive |
| P | dwell at the bottom, or shift dwell (G76/G88) | ms without a decimal point, s with one |
| K | Fanuc repeat count, G91 steps X/Y by the programmed increment each repeat | integer |
| L | Haas repeat count, same meaning as K | integer |
| G98 / G99 | return to the initial level / return to R | modal |

## Move sequence (as the code draws it, `js/mill/machine.js` `drill()`)

1. On the first drilling G-code seen after G80 (or after start), the **initial level** is
   captured as the current Z and is *not* recaptured while the cycle code changes from one
   drilling G-code to another without an intervening G80 — the code only resets `c.initZ` when
   `st.cycle === null`.
2. R: read as absolute in G90; in G91 it is added to the initial level.
3. Z: read as absolute in G90; in G91 it is added to R (not to the initial level).
4. G98 returns to the initial level; G99 returns to R (`st.retLevel`).
5. K (Fanuc) or L (Haas) repeats the hole; in G91 each repeat steps X/Y by the same increment
   that produced the first hole. K0/L0 stores the cycle's R/Z/Q/P without drilling (rep <= 0
   returns immediately).
6. Any subsequent block that is still in cycle mode and carries X, Y, Z or R drills another hole
   at the current level.
7. G80, or a plain G0/G1/G2/G3, cancels the cycle.
8. Drilling is only interpreted in G17; a cycle word seen while G18 or G19 is active is reported
   `unsupported` and not expanded into hole moves.

## Fanuc vs Haas differences

- Repeat word: K on Fanuc, L on Haas; the plan treats them identically and uses whichever is
  present as `rep`, in that order.
- Haas mill pages (G81, G98/G99, "codes-settings" URLs) returned 403 both times tried, so no
  Haas-specific wording on the initial-level/R-plane split was found; the CNC Training Centre K/L
  page describes both letters as interchangeable ("K5 or L5 means do it 5 times").

## Sources checked

- helmancnc, "G81 Drilling Cycle: Syntax and Motion Sequence" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc/fanuc-g81-drilling-cycle/`
  — "Rapid traverse to the specified x,y axis position", "Rapid traverse to the R plane
  position", "Drilling with specified Feed from R-plane position to Z-depth position", "Rapid
  traverse to Initial level or R-plane depends on G98, G99 modes." States G98 = "Drill will
  return to the Initial level" and G99 = "Drill will return to R-plane." Confirms the frame's
  G98/G99 split; does not discuss G90/G91 measurement of R and Z, or retention of the initial
  level across a code change.
- CNC Training Centre, "Repeat Canned Cycle Using L and K" (secondary, tutorial site):
  `https://www.cnctrainingcentre.com/repeat-canned-cycle-using-l-and-k/`
  — "the L5 or K5 means do it 5 times" (L for Haas, K for Fanuc); "You can also use L0 or K0
  which means do it zero times (don't do it)" and describes the control remembering the cycle's
  parameters without machining, matching the brief's "K0/L0 stores the cycle without drilling."
  Worked example `G81 G98 Z-15. R1. F200. G91 X10. L5` confirms G91 steps X by the programmed
  increment on each repeat.
- machiningdoctor.com, G02/G03 page: `https://www.machiningdoctor.com/gcodes/g2-3-circular/` —
  returned HTTP 403 (tried once, not retried); this was going to be used for the plane-selection
  side of "drilling in G18/G19 is not interpreted" but a WebSearch snippet of the same site
  independently paraphrased "G17 uses IJ, G18 uses IK and G19 uses JK", which is a plane-selection
  statement, not a drilling-cycle-scope statement — it does not confirm that canned cycles are
  G17-only.
- No reachable source states outright that canned drilling cycles only run in G17, or that
  Fanuc/Haas mills reject/ignore G81-G89 while G18 or G19 is selected. The plan's `unsupported`
  handling for that case is recorded UNVERIFIED, not contradicted.
- No reachable source states whether the initial level is re-captured when the cycle code
  changes (e.g. G81 then G82) without an intervening G80. WebSearch on Fanuc canned-cycle
  documentation returned only general "canned cycles are modal" statements (Practical Machinist
  forum threads, ICAM and Machinist Guides G98 explainers), none of which address this specific
  point. Recorded UNVERIFIED; not contradicted by anything found.
- Haas mill G81 and codes-settings pages: `https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G81.html`
  (and the equivalent G98/G99 URLs) — HTTP 403, tried once each, not retried.
