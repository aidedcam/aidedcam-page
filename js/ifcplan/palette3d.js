// IFC floor plans, the 3D view: each layer's colour and opacity (3D spec §5). Light tints of the plan's layer hues, so
// the dark cut lines stand out on them; glass and rooms are see-through. Pure: no DOM, no three.js.
export const PALETTE_3D = {
  IFC_WALL: ['#d8d4c8', 1], IFC_SLAB: ['#bfbcb2', 1], IFC_COLUMN: ['#c98a84', 1], IFC_BEAM: ['#a9adb4', 1],
  IFC_DOOR: ['#6fb3c2', 1], IFC_WINDOW: ['#8fb4f0', 0.45], IFC_CURTAINWALL: ['#7fb2d6', 0.45], IFC_STAIR: ['#8cc29a', 1],
  IFC_RAILING: ['#e0a07a', 1], IFC_FURNITURE: ['#d8c08a', 1], IFC_MEP: ['#cf93cf', 1], IFC_OTHER: ['#b5b0a8', 1],
  IFC_SPACE: ['#e8c96a', 0.15],
};

// { color, opacity, transparent, order }: order 0 for the solids, 1 for glass, 2 for the rooms, drawn in that order so
// the see-through layers blend over what is behind them.
export function style3d(layer) {
  const [color, opacity] = PALETTE_3D[layer] || PALETTE_3D.IFC_OTHER;
  const transparent = opacity < 1;
  return { color, opacity, transparent, order: !transparent ? 0 : layer === 'IFC_SPACE' ? 2 : 1 };
}
