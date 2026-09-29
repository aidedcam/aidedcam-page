using ACadSharp.Entities;
using CSMath;

namespace AidedCam.Dwg;

// A measured entity, in drawing units: its kind, its true length and area, and outlines in its own plane
// that Map carries into model space (or block space, for entities inside a block definition).
public sealed class Shape
{
    public string Kind = "line";
    public double Len, Area;
    public bool Bad;                                // an area that cannot be trusted (self-intersecting outline)
    public bool IsCurve => Kind != "hatch";
    public List<Outline> Outlines = new();
    public Affine Map = Affine.Identity;
    public bool HasVerts;                           // a closed 2D or lightweight polyline: its true vertices are reported (Verts)

    // The true vertices of a closed polyline in drawing coordinates (units, not metres): [x, y, bulge, …], arcs as
    // bulges. Null unless HasVerts, or when the polyline does not lie flat in the drawing's XY plane.
    public double[] Verts()
    {
        if (!HasVerts || Outlines.Count != 1 || !Flat.Of(Map, out double sign)) return null;
        var o = Outlines[0];
        var v = new double[o.Pieces.Count * 3];
        for (int i = 0; i < o.Pieces.Count; i++)
        {
            var p = o.Pieces[i];
            var a = Map.Apply(p.Start.X, p.Start.Y, 0);
            v[3 * i] = a.X; v[3 * i + 1] = a.Y;
            v[3 * i + 2] = p.Kind == PieceKind.Arc ? Math.Tan(p.Sweep / 4) * sign : 0;
        }
        return v;
    }

    public IEnumerable<List<(double X, double Y, double Z)>> Polylines(double dev, Affine outer)
    {
        var map = Map.Then(outer);
        double k = Math.Max(map.MaxScale, 1e-12);
        foreach (var o in Outlines)
        {
            var pts = o.Sample(dev / k);
            var line = new List<(double, double, double)>(pts.Count);
            foreach (var p in pts) line.Add(map.Apply(p.X, p.Y, 0));
            yield return line;
        }
    }
}

// Measures the curve entities (spec §4): lines, arcs, circles, polylines (with bulges), splines and ellipses.
// Everything is measured in the entity's own plane, so a tilted circle keeps its true length and area.
public static class Measure
{
    public static bool IsCurveType(Entity e) => e is Line or Circle or LwPolyline or Polyline2D or Polyline3D or Spline or Ellipse;

    // Returns null for anything that is not a curve.
    public static Shape Curve(Entity e) => e switch
    {
        Line l => LineShape(l),
        Arc a => ArcShape(a),                       // Arc derives from Circle: test it first
        Circle c => CircleShape(c),
        LwPolyline p => LwShape(p),
        Polyline2D p => Poly2DShape(p),
        Polyline3D p => Poly3DShape(p),
        Spline s => SplineShape(s),
        Ellipse el => EllipseShape(el),
        _ => null,
    };

    static Shape LineShape(Line l)
    {
        var s = new Shape { Kind = "line" };
        var o = new Outline();
        o.Pieces.Add(Piece.Line(new V(l.StartPoint.X, l.StartPoint.Y), new V(l.EndPoint.X, l.EndPoint.Y)));
        s.Outlines.Add(o);
        var d = l.EndPoint - l.StartPoint;
        s.Len = Math.Sqrt(d.X * d.X + d.Y * d.Y + d.Z * d.Z);
        return s;
    }

    static Shape ArcShape(Arc a)
    {
        double sweep = a.EndAngle - a.StartAngle;
        while (sweep <= 0) sweep += 2 * Math.PI;
        while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
        var o = new Outline();
        o.Pieces.Add(Piece.Arc(new V(a.Center.X, a.Center.Y), a.Radius, a.StartAngle, sweep));
        var s = new Shape { Kind = "arc", Map = Affine.Ocs(a.Normal.X, a.Normal.Y, a.Normal.Z, a.Center.Z) };
        s.Outlines.Add(o);
        s.Len = a.Radius * sweep;
        return s;
    }

    static Shape CircleShape(Circle c)
    {
        var o = new Outline { Closed = true };
        o.Pieces.Add(Piece.Arc(new V(c.Center.X, c.Center.Y), c.Radius, 0, 2 * Math.PI));
        var s = new Shape { Kind = "circle", Map = Affine.Ocs(c.Normal.X, c.Normal.Y, c.Normal.Z, c.Center.Z) };
        s.Outlines.Add(o);
        s.Len = 2 * Math.PI * c.Radius;
        s.Area = Math.PI * c.Radius * c.Radius;
        return s;
    }

    static Shape LwShape(LwPolyline p)
    {
        var pts = p.Vertices.Select(v => (new V(v.Location.X, v.Location.Y), v.Bulge)).ToList();
        var s = BulgeShape(pts, p.IsClosed);
        s.Map = Affine.Ocs(p.Normal.X, p.Normal.Y, p.Normal.Z, p.Elevation);
        s.HasVerts = s.Outlines[0].Closed && s.Outlines[0].Pieces.Count > 0;
        return s;
    }

    static Shape Poly2DShape(Polyline2D p)
    {
        // Spline-fit polylines keep their frame (control) vertices: only the curve's own vertices are measured.
        var pts = p.Vertices.Where(v => !v.Flags.HasFlag(VertexFlags.SplineFrameControlPoint))
            .Select(v => (new V(v.Location.X, v.Location.Y), v.Bulge)).ToList();
        var s = BulgeShape(pts, p.IsClosed);
        s.Map = Affine.Ocs(p.Normal.X, p.Normal.Y, p.Normal.Z, p.Elevation);
        s.HasVerts = s.Outlines[0].Closed && s.Outlines[0].Pieces.Count > 0;
        return s;
    }

    // A 3D polyline has no plane: its length is the true 3D length, it has no area, and it is drawn projected.
    static Shape Poly3DShape(Polyline3D p)
    {
        var v = p.Vertices.Where(x => !x.Flags.HasFlag(VertexFlags.SplineFrameControlPoint)).Select(x => x.Location).ToList();
        if (p.IsClosed && v.Count > 2) v.Add(v[0]);
        var s = new Shape { Kind = "polyline" };
        var o = new Outline();
        if (v.Count >= 2) o.Pieces.Add(Piece.Points(v.Select(q => new V(q.X, q.Y)).ToList()));
        s.Outlines.Add(o);
        for (int i = 1; i < v.Count; i++) { var d = v[i] - v[i - 1]; s.Len += Math.Sqrt(d.X * d.X + d.Y * d.Y + d.Z * d.Z); }
        return s;
    }

    static Shape BulgeShape(List<(V P, double Bulge)> v, bool closedFlag)
    {
        var s = new Shape { Kind = "polyline" };
        var o = new Outline();
        s.Outlines.Add(o);
        if (v.Count < 2) return s;
        // A polyline whose last vertex returns to its first is closed too, even without the flag.
        bool closed = closedFlag || (v.Count > 2 && (v[^1].P - v[0].P).Length < 1e-9 * Math.Max(1, v[0].P.Length));
        int n = closedFlag ? v.Count : v.Count - 1;
        for (int i = 0; i < n; i++)
        {
            var a = v[i]; var b = v[(i + 1) % v.Count];
            if ((b.P - a.P).Length < 1e-15) continue;                               // a repeated vertex
            o.Pieces.Add(Piece.Bulge(a.P, b.P, a.Bulge));
        }
        o.Closed = closed;
        s.Len = o.Length;
        if (closed) SetArea(s, o);
        return s;
    }

    // Exact area, unless the outline crosses itself (then the area is meaningless: Bad, left out of totals).
    static void SetArea(Shape s, Outline o)
    {
        double len = o.Length;
        if (len <= 0) return;
        var ring = o.Sample(len * 1e-5);
        if (Geo.SelfIntersects(ring)) { s.Bad = true; s.Area = 0; return; }
        s.Area = Math.Abs(o.SignedArea);
    }

    // Splines go through Eyeshot's NURBS curve for an exact length (spec §3). Eyeshot takes rational control
    // points in homogeneous form (x·w, y·w, z·w, w).
    static Shape SplineShape(Spline sp)
    {
        var s = new Shape { Kind = "spline" };
        List<XYZ> pts3;
        double len;
        var curve = ToEyeshot(sp);
        if (curve != null)
        {
            len = curve.Length();
            double dev = Math.Max(len * 1e-5, 1e-12);
            var path = curve.ConvertToLinearPath(dev, 0);
            pts3 = path.Vertices.Select(p => new XYZ(p.X, p.Y, p.Z)).ToList();
        }
        else if (sp.FitPoints.Count >= 2)
        {
            pts3 = sp.FitPoints.ToList();                                           // a fit-point spline Eyeshot can't take: chords through the fit points
            len = 0;
            for (int i = 1; i < pts3.Count; i++) len += (pts3[i] - pts3[i - 1]).GetLength();
        }
        else return null;
        s.Len = len;
        var flat = pts3.Select(p => new V(p.X, p.Y)).ToList();
        bool closed = sp.IsClosed || sp.IsPeriodic || (pts3.Count > 2 && (pts3[^1] - pts3[0]).GetLength() < len * 1e-9);
        var o = new Outline { Closed = closed };
        o.Pieces.Add(Piece.Points(flat, len));
        s.Outlines.Add(o);
        if (closed)
        {
            if (Geo.SelfIntersects(flat)) s.Bad = true;
            else s.Area = Newell(pts3);
        }
        return s;
    }

    static devDept.Eyeshot.Entities.Curve ToEyeshot(Spline sp)
    {
        int n = sp.ControlPoints.Count;
        if (n < 2 || sp.Knots.Count != n + sp.Degree + 1) return null;
        var cp = new devDept.Geometry.Point4D[n];
        for (int i = 0; i < n; i++)
        {
            double w = i < sp.Weights.Count && sp.Weights[i] > 0 ? sp.Weights[i] : 1;
            var p = sp.ControlPoints[i];
            cp[i] = new devDept.Geometry.Point4D(p.X * w, p.Y * w, p.Z * w, w);
        }
        try { return new devDept.Eyeshot.Entities.Curve(sp.Degree, sp.Knots.ToArray(), cp); }
        catch { return null; }
    }

    // Ellipses: P(t) = C + cos t · M + sin t · m, with m = (N × M) · ratio. The length is integrated numerically
    // (Gauss–Legendre on 64 panels), accurate far beyond the drawing's precision.
    static Shape EllipseShape(Ellipse el)
    {
        var n = el.Normal; var M = el.MajorAxisEndPoint;
        double nl = Math.Sqrt(n.X * n.X + n.Y * n.Y + n.Z * n.Z);
        if (nl < 1e-12) { n = new XYZ(0, 0, 1); nl = 1; }
        var mnr = new XYZ((n.Y * M.Z - n.Z * M.Y) / nl, (n.Z * M.X - n.X * M.Z) / nl, (n.X * M.Y - n.Y * M.X) / nl) * el.RadiusRatio;
        double t0 = el.StartParameter, t1 = el.EndParameter;
        while (t1 <= t0) t1 += 2 * Math.PI;
        bool full = el.IsFullEllipse || Math.Abs(t1 - t0 - 2 * Math.PI) < 1e-9;
        if (full) { t0 = 0; t1 = 2 * Math.PI; }
        double a = M.GetLength(), b = mnr.GetLength();
        XYZ At(double t) => el.Center + M * Math.Cos(t) + mnr * Math.Sin(t);
        double Speed(double t) => (M * -Math.Sin(t) + mnr * Math.Cos(t)).GetLength();
        var s = new Shape { Kind = "ellipse", Len = Integrate(Speed, t0, t1) };
        int steps = Piece.ArcSteps(Math.Max(a, 1e-12), t1 - t0, Math.Max(a, 1e-12) * 2e-4) * 2;
        var pts = new List<V>(steps + 1);
        for (int i = 0; i <= steps; i++) { var p = At(t0 + (t1 - t0) * i / steps); pts.Add(new V(p.X, p.Y)); }
        var o = new Outline { Closed = full };
        o.Pieces.Add(Piece.Points(pts, s.Len));
        s.Outlines.Add(o);
        if (full) s.Area = Math.PI * a * b;
        return s;
    }

    static readonly double[] GlX = { -0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640 };
    static readonly double[] GlW = { 0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891 };

    public static double Integrate(Func<double, double> f, double a, double b, int panels = 64)
    {
        double h = (b - a) / panels, s = 0;
        for (int i = 0; i < panels; i++)
        {
            double m = a + h * (i + 0.5);
            for (int k = 0; k < 5; k++) s += GlW[k] * f(m + h / 2 * GlX[k]);
        }
        return s * h / 2;
    }

    // Area of a planar polygon in 3D (Newell's method): the right area whatever plane the curve lies in.
    public static double Newell(IReadOnlyList<XYZ> p)
    {
        double x = 0, y = 0, z = 0;
        for (int i = 0; i < p.Count; i++)
        {
            var a = p[i]; var b = p[(i + 1) % p.Count];
            x += (a.Y - b.Y) * (a.Z + b.Z); y += (a.Z - b.Z) * (a.X + b.X); z += (a.X - b.X) * (a.Y + b.Y);
        }
        return Math.Sqrt(x * x + y * y + z * z) / 2;
    }
}
