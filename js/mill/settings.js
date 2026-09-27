// Milling viewer settings and their defaults (spec §2). Pure: no DOM.
export const MILL_DEFAULTS = Object.freeze({
  rapidX: 30000,            // mm/min
  rapidY: 30000,            // mm/min
  rapidZ: 30000,            // mm/min
  toolChangeSeconds: 5,     // s per M6
  correctionPct: 0,         // % added to every timed move
  integerUnit: 'mm',        // numbers without a decimal point: 'mm' or 'um' (least increment)
  peckClearance: 0.5,       // mm: G73 retract and G83 clearance "d" (Fanuc parameters 5114/5115)
  arcTolerance: 0.02,       // mm: end point off the start radius by more than this is an error
  chordError: 0.01,         // mm: arcs are drawn as chords within this error
  maxChords: 256,           // per arc
  maxMoves: 3000000,        // stored moves; past this the drawing stops (memory), time and checks go on
});

export function millSettings(partial) {
  return { ...MILL_DEFAULTS, ...(partial || {}) };
}

// Size limits (spec §3.4): above either one the program is not analysed and the page says so.
export const MILL_MAX_LINES = 1500000;
export const MILL_MAX_CHARS = 60 * 1024 * 1024;
