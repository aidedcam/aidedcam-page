// Viewer settings with defaults. Spec §2 (settings), §7 (time).
export const DEFAULT_SETTINGS = Object.freeze({
  control: 'auto',        // 'auto' | 'fanuc' | 'haas'
  system: 'A',            // G-code system: 'A' | 'B' | 'C'
  integerUnit: 'mm',      // meaning of X/Z/U/W/R/I/K without a decimal point: 'mm' | 'um'
  xDiameter: true,        // X and U are programmed as diameter
  rapidX: 20000,          // mm/min of X axis travel (radius); our desktop CycleTimeEstimator default
  rapidZ: 20000,          // mm/min
  toolChangeSeconds: 3,
  correctionPct: 0,       // multiplies every time figure by (1 + pct/100)
  oneLineRetract: 0.5,    // mm; G71/G72/G74/G75 retract when no first-line R was ever given (one-line forms too)
  arcSegments: 48,        // chords per arc for geometry searches
});

export function withDefaults(partial) {
  return { ...DEFAULT_SETTINGS, ...(partial || {}) };
}
