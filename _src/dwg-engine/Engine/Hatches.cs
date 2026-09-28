using ACadSharp.Entities;

namespace AidedCam.Dwg;

// Hatch area with islands subtracted (spec §4). Each boundary loop becomes an outline of exact pieces in the
// hatch's own plane, its edges joined head to tail; its area is exact (Green's theorem). Islands follow the
// hatch style: Normal alternates by nesting depth, Outer keeps the outermost loops minus the islands directly
// inside them, Ignore keeps the outermost loops only.
public static class Hatches
{
    public static Shape Measure(Hatch h, bool degrees = false)
    {
        var s = new Shape { Kind = "hatch", Map = Affine.Ocs(h.Normal.X, h.Normal.Y, h.Normal.Z, h.Elevation) };
        try
        {
            foreach (var path in h.Paths)
            {
                var o = Loop(path, degrees);
                if (o.Pieces.Count > 0 && Math.Abs(o.SignedArea) > 0) s.Outlines.Add(o);
            }
            if (s.Outlines.Count == 0) { s.Bad = true; return s; }
            double area = IslandArea(s.Outlines, h.Style);
            if (!(area > 0)) { s.Bad = true; s.Area = 0; return s; }
            s.Area = area;
        }
        catch { s.Bad = true; s.Area = 0; }
        return s;
    }

    public static double IslandArea(List<Outline> loops, HatchStyleType style)
    {
        var abs = loops.Select(l => Math.Abs(l.SignedArea)).ToArray();
        var rings = loops.Select(l => { var (min, max) = l.Bounds(double.MaxValue); return l.Sample(Math.Max(max.X - min.X, max.Y - min.Y) * 1e-4); }).ToList();
        double total = 0;
        for (int i = 0; i < loops.Count; i++)
        {
            // A point of the loop to test nesting with: the middle of its first edge, on no other loop in a sane hatch.
            var probe = (rings[i][0] + rings[i][1]) * 0.5;
            int depth = 0;
            for (int j = 0; j < loops.Count; j++)
                if (j != i && abs[j] > abs[i] && Geo.Inside(probe, rings[j])) depth++;
            total += style switch
            {
                HatchStyleType.Ignore => depth == 0 ? abs[i] : 0,
                HatchStyleType.Outer => depth == 0 ? abs[i] : depth == 1 ? -abs[i] : 0,
                _ => depth % 2 == 0 ? abs[i] : -abs[i],
            };
        }
        return total;
    }

    static Outline Loop(Hatch.BoundaryPath path, bool degrees = false)
    {
        var o = new Outline { Closed = true };
        foreach (var edge in path.Edges)
            foreach (var piece in EdgePieces(edge, degrees))
            {
                var p = piece;
                if (o.Pieces.Count == 1)
                {
                    // The first piece has no predecessor to orient it: take the pairing of ends with the smallest gap,
                    // and if the second piece joins the first one's start (strictly nearer), turn the first one round.
                    var f = o.Pieces[0];
                    double atEnd = Math.Min((p.Start - f.End).Length, (p.End - f.End).Length);
                    double atStart = Math.Min((p.Start - f.Start).Length, (p.End - f.Start).Length);
                    if (atStart < atEnd) o.Pieces[0] = f.Reversed();
                }
                if (o.Pieces.Count > 0)
                {
                    // Edges are stored head to tail, but some writers reverse one: follow the nearer end.
                    var end = o.Pieces[^1].End;
                    if ((p.End - end).Length < (p.Start - end).Length) p = p.Reversed();
                }
                o.Pieces.Add(p);
            }
        return o;
    }

    static IEnumerable<Piece> EdgePieces(Hatch.BoundaryPath.Edge edge, bool degrees = false)
    {
        double ToRad(double a) => degrees ? a * Math.PI / 180 : a;

        switch (edge)
        {
            case Hatch.BoundaryPath.Line l:
                yield return Piece.Line(new V(l.Start.X, l.Start.Y), new V(l.End.X, l.End.Y));
                break;
            case Hatch.BoundaryPath.Arc a:
            {
                // A clockwise arc edge is stored mirrored: its angles are negated.
                double start = ToRad(a.StartAngle);
                double end = ToRad(a.EndAngle);
                var (s0, sweep) = Sweep(start, end, a.CounterClockWise);
                yield return Piece.Arc(new V(a.Center.X, a.Center.Y), a.Radius, s0, sweep);
                break;
            }
            case Hatch.BoundaryPath.Ellipse e:
            {
                double start = ToRad(e.StartAngle);
                double end = ToRad(e.EndAngle);
                var (s0, sweep) = Sweep(start, end, e.CounterClockWise);

                // Hatch ellipse edges store angles, not parameters (as ezdxf reads them); unverified against a real AutoCAD file — see real-file-check.md.
                double t0, tSweep;
                if (Math.Abs(Math.Abs(sweep) - 2 * Math.PI) < 1e-9)
                {
                    t0 = 0;
                    tSweep = Math.Sign(sweep) * 2 * Math.PI;
                }
                else
                {
                    double P(double a) => Math.Atan2(Math.Sin(a) / e.MinorToMajorRatio, Math.Cos(a));
                    t0 = P(s0);
                    double tEnd = P(s0 + sweep);
                    double d = tEnd - t0;
                    if (sweep > 0)
                    {
                        while (d <= 0) d += 2 * Math.PI;
                        while (d > 2 * Math.PI) d -= 2 * Math.PI;
                    }
                    else
                    {
                        while (d >= 0) d -= 2 * Math.PI;
                        while (d < -2 * Math.PI) d += 2 * Math.PI;
                    }
                    tSweep = d;
                }

                var M = new V(e.MajorAxisEndPoint.X, e.MajorAxisEndPoint.Y);
                var m = new V(-M.Y, M.X) * e.MinorToMajorRatio;
                var c = new V(e.Center.X, e.Center.Y);
                int n = Piece.ArcSteps(1, Math.Abs(tSweep), 1e-6) * 2;
                var pts = new List<V>(n + 1);
                for (int i = 0; i <= n; i++) { double t = t0 + tSweep * i / n; pts.Add(c + M * Math.Cos(t) + m * Math.Sin(t)); }
                yield return Piece.Points(pts);
                break;
            }
            case Hatch.BoundaryPath.Spline sp:
            {
                var w = sp.Weights?.ToList() ?? new List<double>();
                int n = sp.ControlPoints.Count;
                if (n >= 2 && sp.Knots.Count == n + sp.Degree + 1)
                {
                    var cp = new devDept.Geometry.Point4D[n];
                    for (int i = 0; i < n; i++)
                    {
                        double wi = i < w.Count && w[i] > 0 ? w[i] : 1;
                        cp[i] = new devDept.Geometry.Point4D(sp.ControlPoints[i].X * wi, sp.ControlPoints[i].Y * wi, 0, wi);
                    }
                    var curve = new devDept.Eyeshot.Entities.Curve(sp.Degree, sp.Knots.ToArray(), cp);
                    double len = curve.Length();
                    var pts = curve.ConvertToLinearPath(Math.Max(len * 1e-6, 1e-12), 0).Vertices.Select(p => new V(p.X, p.Y)).ToList();
                    yield return Piece.Points(pts, len);
                }
                else if (sp.FitPoints.Count >= 2) yield return Piece.Points(sp.FitPoints.Select(p => new V(p.X, p.Y)).ToList());
                break;
            }
            case Hatch.BoundaryPath.Polyline pl:
            {
                var v = pl.Vertices;                                     // Z carries the bulge
                int count = pl.IsClosed ? v.Count : v.Count - 1;
                for (int i = 0; i < count; i++)
                {
                    var a = v[i]; var b = v[(i + 1) % v.Count];
                    if (Math.Abs(a.X - b.X) + Math.Abs(a.Y - b.Y) < 1e-15) continue;
                    yield return Piece.Bulge(new V(a.X, a.Y), new V(b.X, b.Y), a.Z);
                }
                break;
            }
        }
    }

    static (double Start, double Sweep) Sweep(double start, double end, bool ccw)
    {
        if (ccw) return (start, Norm(end - start));
        return (-start, -Norm(end - start));
    }

    static double Norm(double a)
    {
        while (a <= 0) a += 2 * Math.PI;
        while (a > 2 * Math.PI + 1e-12) a -= 2 * Math.PI;
        return a;
    }
}
