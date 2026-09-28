namespace AidedCam.Dwg;

public readonly record struct V(double X, double Y)
{
    public static V operator +(V a, V b) => new(a.X + b.X, a.Y + b.Y);
    public static V operator -(V a, V b) => new(a.X - b.X, a.Y - b.Y);
    public static V operator *(V a, double k) => new(a.X * k, a.Y * k);
    public double Length => Math.Sqrt(X * X + Y * Y);
    public static double Cross(V a, V b) => a.X * b.Y - a.Y * b.X;
}

public enum PieceKind { Line, Arc, Points }

// One piece of a planar outline, in the outline's own plane coordinates: a line, an arc (start angle A0 and a
// signed sweep, counter-clockwise positive, both in radians) or sampled points (splines and ellipses, whose
// exact length is measured separately and kept in ExactLength).
public sealed class Piece
{
    public PieceKind Kind;
    public V A, B;                      // line ends
    public V C; public double R, A0, Sweep;
    public List<V> Pts;
    public double ExactLength = double.NaN;

    public static Piece Line(V a, V b) => new() { Kind = PieceKind.Line, A = a, B = b };
    public static Piece Arc(V c, double r, double a0, double sweep) => new() { Kind = PieceKind.Arc, C = c, R = r, A0 = a0, Sweep = sweep };
    public static Piece Points(List<V> pts, double exactLength = double.NaN) => new() { Kind = PieceKind.Points, Pts = pts, ExactLength = exactLength };

    // The arc from a to b with the given polyline bulge (tan of a quarter of the sweep; positive = counter-clockwise).
    public static Piece Bulge(V a, V b, double bulge)
    {
        if (Math.Abs(bulge) < 1e-12) return Line(a, b);
        double sweep = 4 * Math.Atan(bulge);
        V d = b - a;
        double chord = d.Length;
        if (chord < 1e-15) return Line(a, b);
        double h = chord / 2 / Math.Tan(sweep / 2);                      // signed distance from the chord's middle to the centre
        V mid = (a + b) * 0.5, left = new(-d.Y / chord, d.X / chord);
        V c = mid + left * h;
        return Arc(c, (a - c).Length, Math.Atan2(a.Y - c.Y, a.X - c.X), sweep);
    }

    public Piece Reversed() => Kind switch
    {
        PieceKind.Line => Line(B, A),
        PieceKind.Arc => Arc(C, R, A0 + Sweep, -Sweep),
        _ => Points(Enumerable.Reverse(Pts).ToList(), ExactLength),
    };

    public V Start => Kind switch
    {
        PieceKind.Line => A,
        PieceKind.Arc => new(C.X + R * Math.Cos(A0), C.Y + R * Math.Sin(A0)),
        _ => Pts[0],
    };

    public V End => Kind switch
    {
        PieceKind.Line => B,
        PieceKind.Arc => new(C.X + R * Math.Cos(A0 + Sweep), C.Y + R * Math.Sin(A0 + Sweep)),
        _ => Pts[^1],
    };

    public double Length
    {
        get
        {
            switch (Kind)
            {
                case PieceKind.Line: return (B - A).Length;
                case PieceKind.Arc: return R * Math.Abs(Sweep);
                default:
                    if (!double.IsNaN(ExactLength)) return ExactLength;
                    double s = 0;
                    for (int i = 1; i < Pts.Count; i++) s += (Pts[i] - Pts[i - 1]).Length;
                    return s;
            }
        }
    }

    // This piece's share of Green's theorem, ½∮(x dy − y dx): summed over a closed outline it is the exact
    // signed area (counter-clockwise positive).
    public double AreaTerm
    {
        get
        {
            switch (Kind)
            {
                case PieceKind.Line: return V.Cross(A, B) / 2;
                case PieceKind.Arc:
                    double a1 = A0 + Sweep;
                    return (R * C.X * (Math.Sin(a1) - Math.Sin(A0)) - R * C.Y * (Math.Cos(a1) - Math.Cos(A0)) + R * R * Sweep) / 2;
                default:
                    double s = 0;
                    for (int i = 1; i < Pts.Count; i++) s += V.Cross(Pts[i - 1], Pts[i]) / 2;
                    return s;
            }
        }
    }

    // Appends this piece's points to a polyline, without repeating the first point when the polyline already
    // ends there. dev is the largest allowed distance between an arc and its chords.
    public void SampleInto(List<V> into, double dev)
    {
        switch (Kind)
        {
            case PieceKind.Line:
                AddPoint(into, A); into.Add(B);
                return;
            case PieceKind.Arc:
                int n = ArcSteps(R, Sweep, dev);
                AddPoint(into, Start);
                for (int i = 1; i <= n; i++)
                {
                    double t = A0 + Sweep * i / n;
                    into.Add(new V(C.X + R * Math.Cos(t), C.Y + R * Math.Sin(t)));
                }
                return;
            default:
                AddPoint(into, Pts[0]);
                for (int i = 1; i < Pts.Count; i++) into.Add(Pts[i]);
                return;
        }
    }

    static void AddPoint(List<V> into, V p)
    {
        if (into.Count == 0 || (into[^1] - p).Length > 1e-12) into.Add(p);
    }

    public static int ArcSteps(double r, double sweep, double dev)
    {
        if (r <= 0 || dev <= 0) return 2;
        double c = 1 - dev / r;
        double step = c <= -1 ? Math.PI : 2 * Math.Acos(c);
        return Math.Clamp((int)Math.Ceiling(Math.Abs(sweep) / Math.Max(step, 1e-9)), 2, 1024);
    }
}

// A planar outline: connected pieces in order. Measured in its own plane, so tilted entities keep their
// true length and area; drawn by sampling and mapping each point to model space.
public sealed class Outline
{
    public readonly List<Piece> Pieces = new();
    public bool Closed;

    public double Length { get { double s = 0; foreach (var p in Pieces) s += p.Length; return s; } }

    // Exact signed area of a closed outline; 0 for an open one.
    public double SignedArea
    {
        get
        {
            if (!Closed || Pieces.Count == 0) return 0;
            double s = 0;
            foreach (var p in Pieces) s += p.AreaTerm;
            var gap = Pieces[^1].End - Pieces[0].Start;                       // a points outline closes back to its start
            if (gap.Length > 0) s += V.Cross(Pieces[^1].End, Pieces[0].Start) / 2;
            return s;
        }
    }

    public List<V> Sample(double dev)
    {
        var pts = new List<V>();
        foreach (var p in Pieces) p.SampleInto(pts, dev);
        if (Closed && pts.Count > 1 && (pts[^1] - pts[0]).Length > 1e-12) pts.Add(pts[0]);
        return pts;
    }

    public (V Min, V Max) Bounds(double dev)
    {
        var pts = Sample(dev);
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var p in pts) { x0 = Math.Min(x0, p.X); y0 = Math.Min(y0, p.Y); x1 = Math.Max(x1, p.X); y1 = Math.Max(y1, p.Y); }
        return (new V(x0, y0), new V(x1, y1));
    }
}

public static class Geo
{
    // Signed area of a closed polygon given as points (the last point may repeat the first).
    public static double Area(IReadOnlyList<V> pts)
    {
        double s = 0;
        for (int i = 0; i < pts.Count; i++) s += V.Cross(pts[i], pts[(i + 1) % pts.Count]);
        return s / 2;
    }

    // Even-odd point-in-polygon.
    public static bool Inside(V p, IReadOnlyList<V> poly)
    {
        bool inside = false;
        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
        {
            V a = poly[i], b = poly[j];
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside;
    }

    // True when two non-adjacent edges of a closed ring cross or touch. The ring's last point may repeat the
    // first. Edges are bucketed on a grid, so a ring of thousands of points stays near-linear.
    public static bool SelfIntersects(IReadOnlyList<V> ring)
    {
        var pts = new List<V>(ring);
        if (pts.Count > 1 && (pts[^1] - pts[0]).Length < 1e-12) pts.RemoveAt(pts.Count - 1);
        int n = pts.Count;
        if (n < 4) return false;
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var p in pts) { x0 = Math.Min(x0, p.X); y0 = Math.Min(y0, p.Y); x1 = Math.Max(x1, p.X); y1 = Math.Max(y1, p.Y); }
        double size = Math.Max(x1 - x0, y1 - y0);
        if (size <= 0) return false;
        double eps = size * 1e-9;
        int cells = Math.Clamp((int)Math.Sqrt(n), 1, 256);
        double cw = (x1 - x0) / cells + eps, ch = (y1 - y0) / cells + eps;
        var grid = new Dictionary<int, List<int>>();
        for (int i = 0; i < n; i++)
        {
            V a = pts[i], b = pts[(i + 1) % n];
            int cx0 = (int)((Math.Min(a.X, b.X) - x0) / cw), cx1 = (int)((Math.Max(a.X, b.X) - x0) / cw);
            int cy0 = (int)((Math.Min(a.Y, b.Y) - y0) / ch), cy1 = (int)((Math.Max(a.Y, b.Y) - y0) / ch);
            for (int gx = cx0; gx <= cx1; gx++)
                for (int gy = cy0; gy <= cy1; gy++)
                {
                    int key = gx * 1024 + gy;
                    if (!grid.TryGetValue(key, out var list)) grid[key] = list = new List<int>();
                    foreach (int j in list)
                    {
                        if (Math.Abs(i - j) <= 1 || (i == 0 && j == n - 1) || (j == 0 && i == n - 1)) continue;
                        if (Cross(a, b, pts[j], pts[(j + 1) % n], eps)) return true;
                    }
                    list.Add(i);
                }
        }
        return false;
    }

    static bool Cross(V p1, V p2, V q1, V q2, double eps)
    {
        double d1 = V.Cross(p2 - p1, q1 - p1), d2 = V.Cross(p2 - p1, q2 - p1);
        double d3 = V.Cross(q2 - q1, p1 - q1), d4 = V.Cross(q2 - q1, p2 - q1);
        double l1 = (p2 - p1).Length, l2 = (q2 - q1).Length;
        double t1 = eps * l1, t2 = eps * l2;
        if (((d1 > t1 && d2 < -t1) || (d1 < -t1 && d2 > t1)) && ((d3 > t2 && d4 < -t2) || (d3 < -t2 && d4 > t2))) return true;
        // An end point lying on the other edge counts as touching.
        return OnSeg(q1, p1, p2, d1, t1) || OnSeg(q2, p1, p2, d2, t1) || OnSeg(p1, q1, q2, d3, t2) || OnSeg(p2, q1, q2, d4, t2);
    }

    static bool OnSeg(V p, V a, V b, double cross, double tol)
    {
        if (Math.Abs(cross) > tol) return false;
        double dot = (p.X - a.X) * (b.X - a.X) + (p.Y - a.Y) * (b.Y - a.Y), len2 = (b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y);
        return dot > len2 * 1e-9 && dot < len2 * (1 - 1e-9);
    }
}

// A 3D affine map (3 × 4, row-major): plane coordinates → model space, block space → model space.
public readonly struct Affine
{
    readonly double[] m;
    public Affine(double[] m) { this.m = m; }
    public static readonly Affine Identity = new(new double[] { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0 });

    public (double X, double Y, double Z) Apply(double x, double y, double z) =>
        (m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]);

    // outer ∘ this: apply this first, then outer.
    public Affine Then(Affine outer)
    {
        var a = outer.m; var b = m; var r = new double[12];
        for (int i = 0; i < 3; i++)
        {
            for (int j = 0; j < 3; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j];
            r[i * 4 + 3] = a[i * 4] * b[3] + a[i * 4 + 1] * b[7] + a[i * 4 + 2] * b[11] + a[i * 4 + 3];
        }
        return new Affine(r);
    }

    // Largest factor by which the map stretches a length (for choosing a sampling tolerance in block space).
    public double MaxScale => Math.Max(Math.Sqrt(m[0] * m[0] + m[4] * m[4] + m[8] * m[8]), Math.Max(Math.Sqrt(m[1] * m[1] + m[5] * m[5] + m[9] * m[9]), Math.Sqrt(m[2] * m[2] + m[6] * m[6] + m[10] * m[10])));

    // From a map given by where it sends the origin and the three unit axes.
    public static Affine FromBasis((double X, double Y, double Z) o, (double X, double Y, double Z) ex, (double X, double Y, double Z) ey, (double X, double Y, double Z) ez) =>
        new(new[] { ex.X - o.X, ey.X - o.X, ez.X - o.X, o.X, ex.Y - o.Y, ey.Y - o.Y, ez.Y - o.Y, o.Y, ex.Z - o.Z, ey.Z - o.Z, ez.Z - o.Z, o.Z });

    // AutoCAD's arbitrary-axis algorithm: the object coordinate system of an entity with the given normal.
    public static Affine Ocs(double nx, double ny, double nz, double elevation = 0)
    {
        double len = Math.Sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-12) { nx = 0; ny = 0; nz = 1; len = 1; }
        nx /= len; ny /= len; nz /= len;
        double ax, ay, az;
        if (Math.Abs(nx) < 1.0 / 64 && Math.Abs(ny) < 1.0 / 64) { ax = nz; ay = 0; az = -nx; }       // Wy × N
        else { ax = -ny; ay = nx; az = 0; }                                                          // Wz × N
        double al = Math.Sqrt(ax * ax + ay * ay + az * az);
        ax /= al; ay /= al; az /= al;
        double bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;               // N × Ax
        return new(new[] { ax, bx, nx, nx * elevation, ay, by, ny, ny * elevation, az, bz, nz, nz * elevation });
    }
}
