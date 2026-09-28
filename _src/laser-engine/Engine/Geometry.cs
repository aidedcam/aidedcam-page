namespace AidedCam.Laser;

// A 2D point in millimetres.
public readonly record struct P(double X, double Y)
{
    public static P operator +(P a, P b) => new(a.X + b.X, a.Y + b.Y);
    public static P operator -(P a, P b) => new(a.X - b.X, a.Y - b.Y);
    public static P operator *(P a, double k) => new(a.X * k, a.Y * k);
    public double Length => Math.Sqrt(X * X + Y * Y);
    public double DistanceTo(P o) => (this - o).Length;
    public static double Cross(P a, P b) => a.X * b.Y - a.Y * b.X;
}

public enum SegKind { Line, Arc, Circle }

// One piece of a contour.
// Line: A → B.
// Arc: A → B around centre C with radius R, counter-clockwise when Ccw.
// Circle: centre C, radius R; A and B are both the point at angle 0.
public sealed class Seg
{
    public SegKind Kind;
    public P A, B, C;
    public double R;
    public bool Ccw;
    public int Group;          // index into the file's groups
    public bool Bridge;        // a short line added to close a gap

    public static Seg Line(P a, P b, int group) => new() { Kind = SegKind.Line, A = a, B = b, Group = group };
    public static Seg Arc(P c, double r, P a, P b, bool ccw, int group) =>
        new() { Kind = SegKind.Arc, C = c, R = r, A = a, B = b, Ccw = ccw, Group = group };
    public static Seg Circle(P c, double r, int group)
    {
        var p = new P(c.X + r, c.Y);
        return new() { Kind = SegKind.Circle, C = c, R = r, A = p, B = p, Group = group };
    }

    public double StartAngle => Math.Atan2(A.Y - C.Y, A.X - C.X);
    public double EndAngle => Math.Atan2(B.Y - C.Y, B.X - C.X);

    // Sweep in radians, always positive: (0, 2π] for arcs, 2π for circles, 0 for lines.
    public double Sweep
    {
        get
        {
            if (Kind == SegKind.Circle) return 2 * Math.PI;
            if (Kind == SegKind.Line) return 0;
            double s = Ccw ? EndAngle - StartAngle : StartAngle - EndAngle;
            while (s <= 1e-12) s += 2 * Math.PI;
            while (s > 2 * Math.PI + 1e-12) s -= 2 * Math.PI;
            return s;
        }
    }

    public double Length => Kind == SegKind.Line ? A.DistanceTo(B) : R * Sweep;

    public Seg Reversed() => Kind == SegKind.Line
        ? new Seg { Kind = Kind, A = B, B = A, Group = Group, Bridge = Bridge }
        : new Seg { Kind = Kind, A = B, B = A, C = C, R = R, Ccw = !Ccw, Group = Group, Bridge = Bridge };

    // Point at parameter t in [0, 1] along the piece.
    public P PointAt(double t)
    {
        if (Kind == SegKind.Line) return A + (B - A) * t;
        double a = StartAngle + (Ccw || Kind == SegKind.Circle ? 1 : -1) * Sweep * t;
        return new P(C.X + R * Math.Cos(a), C.Y + R * Math.Sin(a));
    }

    // Points along the piece, first and last included, with chord error below maxErr (mm).
    public List<P> Sample(double maxErr = 0.01)
    {
        var pts = new List<P> { A };
        if (Kind == SegKind.Line) { pts.Add(B); return pts; }
        double step = R <= maxErr ? Math.PI / 2 : 2 * Math.Acos(1 - maxErr / R);
        int n = Math.Clamp((int)Math.Ceiling(Sweep / step), 2, 720);
        for (int i = 1; i < n; i++) pts.Add(PointAt((double)i / n));
        pts.Add(B);
        return pts;
    }

    // Axis-aligned bounds, exact for arcs (their extreme points are included).
    public (P Min, P Max) Bounds()
    {
        double x0 = Math.Min(A.X, B.X), y0 = Math.Min(A.Y, B.Y), x1 = Math.Max(A.X, B.X), y1 = Math.Max(A.Y, B.Y);
        if (Kind != SegKind.Line)
        {
            for (int q = 0; q < 4; q++)
            {
                double ang = q * Math.PI / 2;
                if (Kind == SegKind.Circle || ContainsAngle(ang))
                {
                    double x = C.X + R * Math.Cos(ang), y = C.Y + R * Math.Sin(ang);
                    x0 = Math.Min(x0, x); y0 = Math.Min(y0, y); x1 = Math.Max(x1, x); y1 = Math.Max(y1, y);
                }
            }
        }
        return (new P(x0, y0), new P(x1, y1));
    }

    // True when the direction ang (radians) lies on the arc between A and B.
    public bool ContainsAngle(double ang)
    {
        if (Kind == SegKind.Circle) return true;
        double from = Ccw ? StartAngle : EndAngle;
        double d = ang - from;
        while (d < 0) d += 2 * Math.PI;
        while (d >= 2 * Math.PI) d -= 2 * Math.PI;
        return d <= Sweep + 1e-12;
    }

    // DXF bulge of an arc piece: tan(sweep / 4), negative for clockwise; 0 for lines.
    public double Bulge => Kind == SegKind.Arc ? Math.Tan(Sweep / 4) * (Ccw ? 1 : -1) : 0;
}

public static class Geo
{
    // Signed area of a closed chain (counter-clockwise positive), exact for lines and arcs.
    public static double SignedArea(IReadOnlyList<Seg> chain)
    {
        if (chain.Count == 1 && chain[0].Kind == SegKind.Circle) return Math.PI * chain[0].R * chain[0].R;
        double a = 0;
        foreach (var s in chain)
        {
            a += P.Cross(s.A, s.B) / 2;                                  // the chord
            if (s.Kind == SegKind.Arc)
            {
                double t = s.Sweep;
                a += (s.Ccw ? 1 : -1) * s.R * s.R * (t - Math.Sin(t)) / 2;   // the circular segment beyond it
            }
        }
        return a;
    }

    // A polygon approximating a closed chain, for containment tests.
    public static List<P> Polygon(IReadOnlyList<Seg> chain, double maxErr = 0.05)
    {
        var pts = new List<P>();
        foreach (var s in chain)
        {
            var sp = s.Sample(maxErr);
            for (int i = 0; i < sp.Count - 1; i++) pts.Add(sp[i]);
        }
        return pts;
    }

    // Even-odd point-in-polygon test.
    public static bool Inside(P p, List<P> poly)
    {
        bool inside = false;
        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
        {
            var a = poly[i]; var b = poly[j];
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside;
    }
}
