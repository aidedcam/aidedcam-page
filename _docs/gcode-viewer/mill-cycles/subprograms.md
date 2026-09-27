# Subprograms: M98, M99, Haas M97, nesting depth

Status: PARTLY VERIFIED. M98's two call forms, M99's return, Haas M97's sequence-number call and
the "main-program M99 loops" behaviour are each confirmed by a reachable source. The 4-level
nesting limit is confirmed as a general Fanuc statement, not specifically for the 0i-MF. G65/G66
macro calls not being interpreted is a statement about what the plan's code does, not something a
source was found to confirm or deny.

## Syntax

| Word | Meaning | Unit |
|---|---|---|
| O / : | subprogram number, at the start of the line | integer |
| M98 P\<o\> | call subprogram O\<o\> | — |
| M98 P\<r\>\<oooo\> | older combined form: last 4 digits are the O number, the rest is the repeat count | — |
| L / K | repeat count on M98 (Haas / Fanuc) | integer |
| M97 P\<n\> | Haas: call the local sequence number N\<n\> in the same program | integer |
| M99 | return to the caller; in the main program, loops back to the start on a real control | — |

## Move sequence (as the code draws it, `js/mill/subprograms.js`)

- M98 P\<o\>, optionally with L or K, calls the subprogram whose O-line was indexed by
  `indexPrograms()`; L/K repeats it that many times before returning.
- The older `M98 P<repeat><oooo>` form is only used when neither L nor K is present and the P
  digit string is longer than 4 digits: the last 4 digits are the O number, the rest the repeat
  count.
- A P longer than 4 digits is ambiguous, because Haas uses five-digit O numbers (`M98 P12345` calls
  O12345). When the file has that full O number, the viewer calls it once; otherwise it splits P as
  above. A missing subprogram is reported with the full P as written.
- M99 resumes the caller, but only on the *last* repeat: while an L/K repeat count still has
  iterations left, M99 jumps back to the start of the subprogram instead of returning (the call
  stack's `remaining` counter is decremented and `run.pc` reset to `start`); only once the count
  is exhausted does it pop the call stack and resume after the M98/M97 line. If the stack is
  already empty (M99 in the main program), the plan reports the info note `main-m99` and
  **stops** the analysis there, instead of looping back to line 1 the way a real control would —
  an intentional, disclosed divergence (`js/mill/subprograms.js`: "the control would loop"), not
  a misreading of the M99-in-main behaviour.
- Haas M97 P\<n\>, with L, jumps to the line indexed by `indexSequenceNumbers()` for N\<n\> and
  returns the same way at M99.
- The call stack is capped at `MAX_DEPTH = 4`; a fifth nested call reports `sub-loop` and does
  not descend further.
- G65/G66 macro calls are not recognised as flow instructions at all — they fall through as plain
  (unsupported) G-codes with no call/return effect.

## Fanuc vs Haas differences

- Fanuc uses K for the M98 repeat count and has no M97; Haas uses L for both M98 and M97's repeat
  count, and adds M97 as a same-program jump-to-sequence-number call that Fanuc does not have.
- Both P-forms of M98 (plain P\<o\>, and the older combined P\<repeat\>\<oooo\>) were found
  described only on Fanuc-labelled sources; no Haas source was found stating whether Haas
  supports the combined form.

## Sources checked

- helmancnc, "Fanuc Sub Programming" (secondary, tutorial site):
  `https://www.helmancnc.com/fanuc-sub-programming/`
  — "Sub-program is called by the use of an M98 command followed by the sub-program number
  preceded with a letter P," e.g. `M98 P1004` calling O1004; "an M99 command on the last line of
  sub-program is used" to return; "M99 P100 ... will move the control to line number N100 in the
  main program" (a return-with-jump form the plan does not implement); combined form example
  `M98 P331004` "calls program O1004 thirty-three times"; and, directly on point, "M99 can also
  be written at the end of a main program, and would result in a continuous program loop" —
  matching the brief's "M99 in the main program would loop back to the start" exactly. Does not
  state a nesting depth limit.
- helmancnc, "CNC Subprograms Basics for CNC Machinists" (secondary, tutorial site):
  `https://www.helmancnc.com/cnc-subprograms-basics-for-cnc-machinists/`
  — "subprograms end with M99," "When a sub-program ends with M99 the control is given back to
  the calling program," and, on nesting: "Normally subprogram can be nested up-to four levels" —
  matching `MAX_DEPTH = 4` exactly, though the statement is general ("normally"), not tied to the
  Fanuc 0i-MF specifically; no 0i-MF operator's manual excerpt was reachable to confirm the exact
  model.
- WebSearch summary of Fanuc parameter-0001-bit-1 format switching (source pages not
  independently opened: cnczone/practicalmachinist forum threads and a cnctrainingcentre-style
  explainer surfaced by search): "the rightmost four digits are for program number, with
  repetition count to the left," e.g. "P0050001 would execute program number 1 five times," and
  that a parameter bit chooses between "FS15 format (M98 P_ K_)" and "Standard FS16 Format ...
  M98 P___****". This corroborates the combined-P form and the K-vs-L split, but was not opened
  directly, so it is supporting rather than fully independent evidence.
- helmancnc, "Haas CNC M97 Local Sub-Program Call with CNC Program Example" (secondary, tutorial
  site): `https://www.helmancnc.com/haas-cnc-m97-local-sub-program-call/`
  — Syntax `"M97 P... L..."`, "P - A line number within same program (Subprogram must end with
  M99)," "L - Number of subprogram repetitions," example `M97 P1000 L2` running "N1000 line
  twice." Matches the brief's "Haas M97 P<n>" exactly, including the L repeat.
- No reachable source discusses G65/G66 macro calls in the context of subprogram nesting or
  states that they are (or are not) interpreted by a viewer; the brief's "not interpreted" is a
  statement about the plan's own code, recorded as such, not verified or contradicted externally.
