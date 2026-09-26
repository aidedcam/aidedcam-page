# Single canned cycles G90 / G92 / G94 (+ G32)

Status: PARTLY VERIFIED against the sources below / UNVERIFIED: the exact per-block rapid/feed
motion breakdown for G90/G92/G94 (no reachable source showed the motion diagram, including the
G92 in-cycle X-out retract at step 3) — the box-move sequence below is kept as in the plan (it is
consistent with every fact that was verified) and should be re-checked against a FANUC lathe
operator's manual PDF when one is reachable.

## Task 12b sweep (this session)

- Re-fetched https://www.helmancnc.com/cnc-fanuc-g92-threading-cycle/ (helmancnc, secondary),
  looking again for the G92 in-cycle X-out retract move (step 3 in the table below). Its "Fanuc
  G92 Thread Cycle Completion" section states: *"Fanuc G92 Threading cycle can be canceled only by
  another motion command. If G00 is missing in the program, the control system will expect that
  there are more threads to cut. So the block after the last thread pass diameter block must be
  like this, N110 G00 X12.0 Z4.5 M09"*. This describes a separate, explicitly programmed block
  written by the programmer *after* the whole modal G92 cycle ends, to cancel the G92 group — not
  the automatic per-pass internal retract inside each G92 block that step 3 is about. It is the
  same quote already in the note before this sweep. Kept as **consistent with** the plan's step 3
  being rapid, not as a source that states the in-cycle retract's motion kind itself, so this item
  **stays UNVERIFIED.**
- Tried to close the G90/G92/G94 per-block rapid/feed motion diagram from the sources.md list
  (helmancnc.com's G90/G92/G94 pages were already read in the original task and only refer to an
  unreadable figure; cnccookbook.com and gcodetutor.com in sources.md carry no G90/G92/G94 pages,
  only G71-family ones). No additional source was reachable this sweep, and the Haas pages remain
  HTTP 403. **Still UNVERIFIED** — the four-step breakdown for G90/G92/G94 stays as the plan's
  assumption pending a FANUC manual PDF or a Haas mirror.

## Sources actually read this session

WebSearch was unavailable this session (per controller ruling); direct URLs were fetched with
WebFetch.

- **Haas, official** — `codes-settings...value=G90.html`, `...G92.html`, `...G94.html`
  (https://www.haascnc.com/service/codes-settings.type=gcode.machine=lathe.value=G90.html and the
  G92/G94 equivalents): all three returned **HTTP 403 Forbidden** (anti-bot block); no content
  reached. Not usable as evidence this session.
- **helmancnc.com, secondary** (fetched successfully):
  - https://www.helmancnc.com/g90-turning-cycle/ — word format `G90 X.. Z.. I..` / `G90 X.. Z.. R..`
    / `G90 U.. W..`; states *"some cnc controls use 'I' for taper in G90 straight cutting cycle and
    some newer cnc controls use 'R' for taper value"*; G90 is modal ("remains active until another
    motion command is given like G00, G01 etc."); repeat passes give only the changed X; cycle
    can only cut straight/taper, not arcs.
  - https://www.helmancnc.com/taper-turning-with-g90-modal-turning-cycle-cnc-example-code/ —
    example program uses negative R values (`R-1.75`, `R-3.5`, `R-5.25`) for a taper that reduces
    diameter; does not state the sign rule explicitly ("you yourself have to calculate the taper
    value"); does not give a numbered motion sequence (refers to a figure that could not be
    fetched as text).
  - https://www.helmancnc.com/cnc-fanuc-g92-threading-cycle/ — word format `G92 X.. Z.. F..`;
    *"does not have any special infeed methods, the only thread infeed method is a straight plunge
    type"*; *"can be canceled only by another motion command. If G00 is missing in the program,
    the control system will expect that there are more threads to cut."* — i.e. the retract step
    needs an explicit rapid, consistent with the X-out and Z-back moves being `rapid` below.
  - https://www.helmancnc.com/taper-threading-with-g92-threading-cycle/ — *"The R or I parameter
    in G92 threading cycle is the tapered value. Note that R or I is given as Radius value."*
    Confirms R/I is a radius, not a diameter, even though X in the same block is a diameter — see
    the caveat below.
  - https://www.helmancnc.com/fanuc-g94-facing-cycle-cnc-example-program/ — word format
    `G94 X.. Z..`; *"G94 is a modal G code"* that "stay[s] in effect until ... cancelled or
    replaced by a contradictory G code"; example shows repeat passes giving only the changed Z.

No source read this session contradicted the plan's move order, kinds, or R meaning, so `single.js`
and its tests are unchanged from the plan.

Start point A = tool position when the cycle block is read. All cycles end back at A.

| Cycle | Words | Moves from A |
|---|---|---|
| G90 turning | X/U Z/W R F | 1 rapid X to (X+R) · 2 feed to (X, Z) · 3 feed X back to A.x · 4 rapid Z back to A.z |
| G92 threading | X/U Z/W R F(lead) | 1 rapid X to (X+R) · 2 thread to (X, Z) · 3 rapid X back to A.x · 4 rapid Z back to A.z |
| G94 facing | X/U Z/W R F | 1 rapid Z to (Z+R) · 2 feed to (X, Z) · 3 feed Z back to A.z · 4 rapid X back to A.x |
| G32 | X/U Z/W F(lead) | one thread move |

- R (G90/G92) = radius at cut start minus radius at cut end (taper). R (G94) = Z at start minus Z
  at end. Confirmed as a radius value by the G92 source above; some older controls use `I` instead
  of `R` for the same taper word (helmancnc, G90 page).
- Units: X is normally programmed as a *diameter* on the machine, but R/I is a *radius* value in the
  same block. The viewer holds X as a radius internally (`targetOf` halves a diameter X), so the
  caller (`boxCycle` in `machine.js`) passes R to `boxMoves` unchanged, as a radius: `t.x + taper`
  is radius plus radius. Nothing is doubled.
- Modal: G90/G92/G94 stay active; a following block with only X (or only Z) repeats the cycle with
  the other coordinate from the previous cycle block. Confirmed for all three codes above.
- To verify: G92 chamfer pull-out (parameter-driven) is not drawn in v1. The exact per-block
  rapid/feed motion diagram for G90/G92/G94 (the four-step breakdown in the table, including the
  G92 in-cycle X-out retract at step 3) still needs a primary-source check (Haas pages were
  blocked; a FANUC manual PDF was not reached) — flagging for a later session rather than blocking
  this task, since nothing fetched contradicts it. See the Task 12b sweep above: the only quote
  found (helmancnc's post-cycle G00 cancellation block) is consistent with, but does not itself
  state, the in-cycle retract's motion kind.
