using devDept.Geometry;
using EyLine = devDept.Eyeshot.Entities.Line;
using EyArc = devDept.Eyeshot.Entities.Arc;
using EyCurve = devDept.Eyeshot.Entities.ICurve;
using EyComposite = devDept.Eyeshot.Entities.CompositeCurve;
using EyRegion = devDept.Eyeshot.Entities.Region;

namespace AidedCam.Dwg;

// Whether a shape's plane map lies flat in the drawing's XY plane (normal ±Z), and the sign that turns its own
// counter-clockwise into the drawing's: −1 for a mirrored (normal −Z) entity.
public static class Flat
{
    public static bool Of(Affine map, out double sign)
    {
        var o = map.Apply(0, 0, 0); var ex = map.Apply(1, 0, 0); var ey = map.Apply(0, 1, 0); var ez = map.Apply(0, 0, 1);
        double zx = ez.X - o.X, zy = ez.Y - o.Y, zz = ez.Z - o.Z;
        double det = (ex.X - o.X) * (ey.Y - o.Y) - (ex.Y - o.Y) * (ey.X - o.X);
        sign = det < 0 ? -1 : 1;
        double len = Math.Sqrt(zx * zx + zy * zy + zz * zz);
        return len > 0 && Math.Abs(Math.Abs(zz) / len - 1) < 1e-9;
    }
}

// The last file's closed curves, kept for union requests after a remap (coverage pre-check, spec §3). One
// entry, replaced when the next file is measured.
public static class LastFile
{
    internal sealed class Entry { public Item Item; public Shape Shape; }
    static Dictionary<string, Entry> items = new();
    static double scale = 1;

    public static void Clear() { items = new(); scale = 1; }

    internal static void Keep(IEnumerable<(Item Item, Shape Shape)> list, double k)
    {
        var d = new Dictionary<string, Entry>();
        foreach (var (it, s) in list) if (s.Outlines.Count == 1 && s.Outlines[0].Closed) d[it.Id] = new Entry { Item = it, Shape = s };
        items = d; scale = k;
    }

    public static bool Has(string id) => items.ContainsKey(id);
    internal static bool TryGet(string id, out Entry e) => items.TryGetValue(id, out e);
    public static double Scale => scale;
}

// The union's answer: area in m², drawable paths and true vertices in metres, and the items left out.
public sealed class UnionResult
{
    public double Area;
    public List<double[]> Paths = new();
    public List<double[]> Verts = new();           // one [x, y, bulge, …] per contour: each part's outer first, then its holes
    public List<string> Bad = new();
    public int Parts;                               // separate pieces of the union
    public string Error;                            // set when the union itself failed: the page falls back to the sum
}

// The 2D union of closed outlines with Eyeshot's region booleans (managed core, spec §3). Outlines are moved
// near the origin first, so survey coordinates (ΕΓΣΑ87, millions of metres) keep their precision; areas and
// vertices come back from the resulting contours with the engine's own exact geometry.
public static class Union
{
    public static UnionResult Of(IEnumerable<string> ids)
    {
        var r = new UnionResult();
        var shapes = new List<(Item Item, List<Piece> Pieces)>();
        foreach (var id in ids.Distinct())
        {
            if (!LastFile.TryGet(id, out var e) || e.Item.Bad) { r.Bad.Add(id); continue; }
            var pieces = InDrawing(e.Shape, LastFile.Scale);
            if (pieces == null) { r.Bad.Add(id); continue; }
            shapes.Add((e.Item, pieces));
        }
        if (shapes.Count == 0) return r;

        // Local origin: the first vertex, so the region booleans work on small numbers.
        var origin = shapes[0].Pieces[0].Start;
        double sum = 0, max = 0;
        var regions = new List<EyRegion>();
        foreach (var (item, pieces) in shapes)
        {
            var local = pieces.Select(p => Move(p, origin * -1)).ToList();
            double a = Math.Abs(Signed(local));
            sum += a; max = Math.Max(max, a);
            regions.Add(new EyRegion(new EyComposite(local.SelectMany(ToEyeshot).ToList()), Plane.XY));
        }

        EyRegion[] result;
        try { result = regions.Count == 1 ? regions.ToArray() : EyRegion.Union(regions.ToArray()); }
        catch (Exception ex) { r.Error = ex.GetType().Name; return r; }

        double total = 0;
        foreach (var region in result)
        {
            bool outer = true;
            foreach (var contour in region.ContourList)
            {
                var pieces = FromEyeshot(contour);
                if (pieces == null) { r.Error = "contour"; return r; }
                double a = Signed(pieces);
                // Each part's outer contour counter-clockwise, its holes clockwise, whatever Eyeshot returned.
                if ((outer && a < 0) || (!outer && a > 0)) pieces = Reverse(pieces);
                total += outer ? Math.Abs(a) : -Math.Abs(a);
                pieces = Merge(pieces).Select(p => Move(p, origin)).ToList();
                r.Verts.Add(VertsOf(outer ? StartLowLeft(pieces) : pieces));
                var o = new Outline { Closed = true };
                o.Pieces.AddRange(pieces);
                var pts = o.Sample(Math.Max(Math.Sqrt(max), 1e-6) * 2e-4);
                var flat = new double[pts.Count * 2];
                for (int i = 0; i < pts.Count; i++) { flat[2 * i] = pts[i].X; flat[2 * i + 1] = pts[i].Y; }
                r.Paths.Add(flat);
                outer = false;
            }
            r.Parts++;
        }
        // A union is never smaller than its largest outline nor bigger than their sum: anything else is a failed
        // boolean, and the page shows the plain sum with a warning instead.
        double tol = Math.Max(1e-6, sum * 1e-7);
        if (total < max - tol || total > sum + tol) { r.Error = "check"; r.Paths.Clear(); r.Verts.Clear(); r.Parts = 0; return r; }
        r.Area = total;
        return r;
    }

    // The outline in drawing coordinates, in metres: lines and arcs (points pieces become short lines).
    static List<Piece> InDrawing(Shape s, double k)
    {
        if (s.Outlines.Count != 1 || !Flat.Of(s.Map, out double sign)) return null;
        var list = new List<Piece>();
        V At(V p) { var q = s.Map.Apply(p.X, p.Y, 0); return new V(q.X * k, q.Y * k); }
        foreach (var p in s.Outlines[0].Pieces)
        {
            switch (p.Kind)
            {
                case PieceKind.Line: list.Add(Piece.Line(At(p.A), At(p.B))); break;
                case PieceKind.Arc:
                {
                    var c = At(p.C); var a = At(p.Start);
                    list.Add(Piece.Arc(c, (a - c).Length, Math.Atan2(a.Y - c.Y, a.X - c.X), p.Sweep * sign));
                    break;
                }
                default:
                    for (int i = 1; i < p.Pts.Count; i++) list.Add(Piece.Line(At(p.Pts[i - 1]), At(p.Pts[i])));
                    break;
            }
        }
        // A points outline (spline, ellipse) closes back to its start.
        if (list.Count > 0 && (list[^1].End - list[0].Start).Length > 1e-9 * Math.Max(1, list[0].Start.Length)) list.Add(Piece.Line(list[^1].End, list[0].Start));
        list.RemoveAll(p => p.Length < 1e-12);
        return list.Count > 0 ? list : null;
    }

    static Piece Move(Piece p, V d) => p.Kind == PieceKind.Line ? Piece.Line(p.A + d, p.B + d) : Piece.Arc(p.C + d, p.R, p.A0, p.Sweep);

    static double Signed(List<Piece> pieces) { double s = 0; foreach (var p in pieces) s += p.AreaTerm; return s; }

    static List<Piece> Reverse(List<Piece> pieces) => Enumerable.Reverse(pieces).Select(p => p.Reversed()).ToList();

    static IEnumerable<EyCurve> ToEyeshot(Piece p)
    {
        if (p.Kind == PieceKind.Line) { yield return new EyLine(p.A.X, p.A.Y, 0, p.B.X, p.B.Y, 0); yield break; }
        // A full circle goes in as two halves; a clockwise arc is built counter-clockwise, then reversed.
        int n = Math.Abs(p.Sweep) > Math.PI * 1.5 ? 2 : 1;
        for (int i = 0; i < n; i++)
        {
            double a0 = p.A0 + p.Sweep * i / n, sw = p.Sweep / n;
            double s = sw >= 0 ? a0 : a0 + sw, e = sw >= 0 ? a0 + sw : a0;
            var arc = new EyArc(Plane.XY, new Point3D(p.C.X, p.C.Y, 0), p.R, s, e);
            if (sw < 0) arc.Reverse();
            yield return arc;
        }
    }

    // A contour of lines and arcs, back as pieces; null if it holds anything else.
    static List<Piece> FromEyeshot(EyCurve contour)
    {
        var curves = contour is EyComposite cc ? cc.CurveList.ToList() : new List<EyCurve> { contour };
        var list = new List<Piece>();
        foreach (var c in curves)
        {
            V s = new(c.StartPoint.X, c.StartPoint.Y), e = new(c.EndPoint.X, c.EndPoint.Y);
            if (c is EyArc arc)
            {
                V cen = new(arc.Center.X, arc.Center.Y);
                double a0 = Math.Atan2(s.Y - cen.Y, s.X - cen.X), len = arc.Domain.Length;
                double sweep = len * (arc.Plane.AxisZ.Z >= 0 ? 1 : -1);
                var p = Piece.Arc(cen, arc.Radius, a0, sweep);
                if ((p.End - e).Length > 1e-6 * Math.Max(1, arc.Radius)) p = Piece.Arc(cen, arc.Radius, a0, -sweep);
                list.Add(p);
            }
            else if (c is EyLine) { if ((e - s).Length > 1e-12) list.Add(Piece.Line(s, e)); }
            else return null;
        }
        return list;
    }

    // Consecutive collinear lines, and consecutive arcs of one circle turning the same way, become one piece:
    // the booleans split edges where other outlines touched them, and a vertex table must not list those points.
    static List<Piece> Merge(List<Piece> pieces)
    {
        var list = new List<Piece>(pieces);
        bool Same(Piece a, Piece b)
        {
            if (a.Kind != b.Kind) return false;
            if (a.Kind == PieceKind.Line)
            {
                V d1 = a.B - a.A, d2 = b.B - b.A;
                return Math.Abs(V.Cross(d1, d2)) <= 1e-9 * d1.Length * d2.Length && d1.X * d2.X + d1.Y * d2.Y > 0;
            }
            return (a.C - b.C).Length <= 1e-7 * Math.Max(1, a.R) && Math.Abs(a.R - b.R) <= 1e-7 * Math.Max(1, a.R) && Math.Sign(a.Sweep) == Math.Sign(b.Sweep)
                && Math.Abs(a.Sweep + b.Sweep) < 2 * Math.PI - 1e-9;
        }
        Piece Join(Piece a, Piece b) => a.Kind == PieceKind.Line ? Piece.Line(a.A, b.B) : Piece.Arc(a.C, a.R, a.A0, a.Sweep + b.Sweep);
        bool changed = true;
        while (changed && list.Count > 2)
        {
            changed = false;
            for (int i = 0; i < list.Count && list.Count > 2; i++)
            {
                int j = (i + 1) % list.Count;
                if (!Same(list[i], list[j])) continue;
                list[i] = Join(list[i], list[j]);
                list.RemoveAt(j);
                if (j < i) i--;
                changed = true;
            }
        }
        return list;
    }

    // The outer contour starts at its lowest vertex (then the leftmost), so a vertex table reads the same
    // whatever vertex the booleans happened to start from.
    static List<Piece> StartLowLeft(List<Piece> pieces)
    {
        int best = 0;
        for (int i = 1; i < pieces.Count; i++)
        {
            V a = pieces[i].Start, b = pieces[best].Start;
            if (a.Y < b.Y - 1e-9 || (Math.Abs(a.Y - b.Y) <= 1e-9 && a.X < b.X)) best = i;
        }
        return pieces.Skip(best).Concat(pieces.Take(best)).ToList();
    }

    static double[] VertsOf(List<Piece> pieces)
    {
        var v = new double[pieces.Count * 3];
        for (int i = 0; i < pieces.Count; i++)
        {
            var p = pieces[i];
            v[3 * i] = p.Start.X; v[3 * i + 1] = p.Start.Y;
            v[3 * i + 2] = p.Kind == PieceKind.Arc ? Math.Tan(p.Sweep / 4) : 0;
        }
        return v;
    }
}
