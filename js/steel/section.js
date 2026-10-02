// Steel take-off: a section's area and painted perimeter from its dimensions (spec §3, §4), for the NC1 pieces whose
// header leaves the weight or the paint surface empty, for the geometry check, and for the IFC's parametric profiles.
// Dimensions in mm, per DSTV profile code: h height (or diameter), b width, tf flange thickness, tw web thickness, r
// root radius. Returns { area } in mm² and { perimeter } in mm, or null when the dimensions do not describe the
// section. Pure.
const PI = Math.PI;
const pos = v => Number.isFinite(v) && v > 0;
const fil = r => (1 - PI / 4) * r * r;           // the area a fillet of radius r adds to a right-angled corner

// The flange slope of tapered channels (UPN / U: 8 % to DIN 1026-1); every other channel has parallel flanges.
export function taperOf(profile) {
  return /^\s*(UPN|UNP|U)\s*\d/i.test(String(profile || '')) ? 0.08 : 0;
}

// s: { code, h, b, tf, tw, r, r2?, taper?, ri?, profile? }.
export function section(s) {
  const { code } = s;
  const h = s.h, b = s.b, r = pos(s.r) ? s.r : 0;
  const t = pos(s.tw) ? s.tw : s.tf;
  switch (code) {
    case 'I': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      return { area: 2 * b * s.tf + (h - 2 * s.tf) * s.tw + 4 * fil(r), perimeter: 2 * h + 4 * b - 2 * s.tw + (2 * PI - 8) * r };
    }
    case 'U':
    case 'C': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      // A tapered flange is tf thick at b/2 from the back of the web; r2 rounds the inner corner of its tip.
      const k = Number.isFinite(s.taper) ? s.taper : taperOf(s.profile);
      const r2 = Number.isFinite(s.r2) ? s.r2 : k ? r / 2 : 0;
      const tTip = s.tf - k * b / 2, tRoot = s.tf + k * (b / 2 - s.tw);
      return {
        area: h * s.tw + 2 * (b - s.tw) * (s.tf - k * s.tw / 2) + 2 * (fil(r) - fil(r2)),
        perimeter: h + 2 * b + 2 * tTip + (h - 2 * tRoot) + 2 * (b - s.tw) * Math.sqrt(1 + k * k) + (PI - 4) * (r + r2),
      };
    }
    case 'L': {
      if (![h, t].every(pos)) return null;
      const w = pos(b) ? b : h, r2 = Number.isFinite(s.r2) ? s.r2 : r / 2;
      return { area: t * (h + w - t) + fil(r) - 2 * fil(r2), perimeter: 2 * (h + w) + (PI / 2 - 2) * (r + 2 * r2) };
    }
    case 'T': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      return { area: b * s.tf + (h - s.tf) * s.tw + 2 * fil(r), perimeter: 2 * b + 2 * h + (PI - 4) * r };
    }
    case 'M': {
      if (![h, b, t].every(pos)) return null;
      // Corners as EN 10210-2 computes them: outer radius ro (1.5 t when not given), inner radius ro / 1.5.
      const ro = r || 1.5 * t, ri = Number.isFinite(s.ri) ? s.ri : ro / 1.5;
      return { area: 2 * t * (h + b - 2 * t) - (4 - PI) * (ro * ro - ri * ri), perimeter: 2 * (h + b) - (8 - 2 * PI) * ro };
    }
    case 'RO': {
      if (![h, t].every(pos) || 2 * t > h) return null;
      return { area: PI / 4 * (h * h - (h - 2 * t) * (h - 2 * t)), perimeter: PI * h };
    }
    case 'RU': {
      if (!pos(h)) return null;
      return { area: PI / 4 * h * h, perimeter: PI * h };
    }
    case 'B': {
      const { t: th, w } = plateDims(s);
      if (![th, w].every(pos)) return null;
      return { area: w * th, perimeter: 2 * (w + th) };
    }
    default:
      return null;
  }
}

// A flat's or a plate's thickness (the web, else the flange thickness, else the smaller dimension) and its width
// (the other dimension), from the header.
export function plateDims(s) {
  const t = pos(s.tw) ? s.tw : pos(s.tf) ? s.tf : Math.min(s.h || 0, s.b || 0);
  return { t, w: Math.abs((s.h || 0) - t) < 1e-6 ? s.b : s.h };
}
