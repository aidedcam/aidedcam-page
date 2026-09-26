// Fanuc single canned cycles (system A). Pure. See _docs/gcode-viewer/cycles/single.md.
// G90 turning: rapid X in → cut Z → cut X out → rapid Z back.
// G92 threading: as G90, but the Z move is a thread and the X-out move is a rapid.
// G94 facing: rapid Z in → cut X → cut Z out → rapid X back.
export function boxMoves(code, a, t, taper = 0) {
  if (code === 90 || code === 92) {
    const threading = code === 92;
    return [
      { kind: 'rapid', to: { x: t.x + taper, z: a.z } },
      { kind: threading ? 'thread' : 'feed', to: { x: t.x, z: t.z } },
      { kind: threading ? 'rapid' : 'feed', to: { x: a.x, z: t.z } },
      { kind: 'rapid', to: { x: a.x, z: a.z } },
    ];
  }
  if (code === 94) {
    return [
      { kind: 'rapid', to: { x: a.x, z: t.z + taper } },
      { kind: 'feed', to: { x: t.x, z: t.z } },
      { kind: 'feed', to: { x: t.x, z: a.z } },
      { kind: 'rapid', to: { x: a.x, z: a.z } },
    ];
  }
  return [];
}
