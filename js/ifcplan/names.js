// IFC floor plans: the file names of the plans (spec §3). Pure: no DOM, no web-ifc.

// The name without its extension.
export const stem = name => String(name).replace(/\.[^./\\]*$/, '') || String(name);

// A name Windows accepts: runs of white space become one space, the characters Windows forbids (< > : " / \ | ? *
// and control characters) become '_', trailing dots and spaces go, and it is kept to 100 characters.
export function safeName(s, fallback) {
  const out = String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 100)
    .replace(/[. ]+$/, '');
  return out || fallback;
}

// One DXF name per storey, in level order: "NN <storey name>.dxf", NN from 01. A storey name used twice (in any case)
// gets " (2)", " (3)" …; an empty one becomes the fallback.
export function storeyFileNames(names, fallback) {
  const width = Math.max(2, String(names.length).length);
  const seen = new Map();
  return names.map((n, i) => {
    let base = safeName(n, fallback);
    const key = base.toLowerCase();
    const k = (seen.get(key) || 0) + 1;
    seen.set(key, k);
    if (k > 1) base = `${base} (${k})`;
    return `${String(i + 1).padStart(width, '0')} ${base}.dxf`;
  });
}

// The ZIP of every storey: "<IFC name>-dxf.zip".
export const zipName = fileName => `${safeName(stem(fileName), 'plans')}-dxf.zip`;
