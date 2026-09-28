namespace AidedCam.Laser;

public sealed class Contour
{
    public int Id;
    public string Role;
    public bool Closed;
    public List<Seg> Segs = new();                 // consecutive: each piece's B is the next piece's A
    public double Length => Segs.Sum(s => s.Length);
    public int Part = -1;                          // part id, for closed cut contours
    public bool IsHole;
    public double Area;                            // |area| of a closed contour, mm²
}

public sealed class PartInfo
{
    public int Id;
    public int Outer;
    public List<int> Holes = new();
    public double Area, CutLength;
    public int Pierces;
    public P Min, Max;
}

// Step 5 of spec §5 (contours) and spec §6 (parts).
public static class Chains
{
    public static List<Contour> Build(Graph g, string role, List<Marker> markers, ref int branches)
    {
        var result = new List<Contour>();
        foreach (var c in g.Circles) result.Add(new Contour { Role = role, Closed = true, Segs = { c } });

        var incident = new List<int>[g.Nodes.Count];
        for (int i = 0; i < g.Nodes.Count; i++) incident[i] = new List<int>();
        for (int e = 0; e < g.Edges.Count; e++) { incident[g.Edges[e].a].Add(e); incident[g.Edges[e].b].Add(e); }
        var used = new bool[g.Edges.Count];

        for (int n = 0; n < g.Nodes.Count; n++)
        {
            int deg = incident[n].Count;
            if (deg == 1) markers.Add(new Marker { Kind = "open", At = g.Nodes[n] });
            if (deg >= 3) { markers.Add(new Marker { Kind = "branch", At = g.Nodes[n] }); branches++; }
        }

        // Open paths: walk from every node that is not a plain pass-through (degree != 2).
        for (int n = 0; n < g.Nodes.Count; n++)
        {
            if (incident[n].Count == 2) continue;
            foreach (int e0 in incident[n])
            {
                if (used[e0]) continue;
                var c = Walk(g, incident, used, n, e0, role);
                c.Closed = false;
                result.Add(c);
            }
        }
        // What is left are clean loops: every node on them has degree 2.
        for (int e0 = 0; e0 < g.Edges.Count; e0++)
        {
            if (used[e0]) continue;
            var c = Walk(g, incident, used, g.Edges[e0].a, e0, role);
            c.Closed = true;
            result.Add(c);
        }
        return result;
    }

    static Contour Walk(Graph g, List<int>[] incident, bool[] used, int start, int e0, string role)
    {
        var c = new Contour { Role = role };
        int node = start, e = e0;
        while (true)
        {
            used[e] = true;
            var (s, a, b) = g.Edges[e];
            var piece = a == node ? s : s.Reversed();
            c.Segs.Add(piece);
            node = a == node ? b : a;
            if (incident[node].Count != 2 || node == start) break;
            int next = incident[node][0] == e ? incident[node][1] : incident[node][0];
            if (used[next]) break;
            e = next;
        }
        return c;
    }

    // Closed contours that cross themselves; one marker per crossing found.
    public static int SelfIntersections(List<Contour> closed, List<Marker> markers)
    {
        int count = 0;
        foreach (var c in closed)
        {
            if (c.Segs.Count == 1 && c.Segs[0].Kind == SegKind.Circle) continue;
            var poly = new List<P>();
            foreach (var s in c.Segs) { var sp = s.Sample(0.05); for (int i = 0; i < sp.Count - 1; i++) poly.Add(sp[i]); }
            int n = poly.Count;
            if (n < 4) continue;
            // Bucket edges in a grid so only nearby edges are compared.
            double minX = poly.Min(p => p.X), minY = poly.Min(p => p.Y);
            double size = Math.Max(poly.Max(p => p.X) - minX, poly.Max(p => p.Y) - minY);
            double cell = Math.Max(size / Math.Sqrt(n), 1e-6);
            var grid = new Dictionary<(int, int), List<int>>();
            for (int i = 0; i < n; i++)
            {
                P a = poly[i], b = poly[(i + 1) % n];
                int x0 = (int)((Math.Min(a.X, b.X) - minX) / cell), x1 = (int)((Math.Max(a.X, b.X) - minX) / cell);
                int y0 = (int)((Math.Min(a.Y, b.Y) - minY) / cell), y1 = (int)((Math.Max(a.Y, b.Y) - minY) / cell);
                for (int x = x0; x <= x1; x++) for (int y = y0; y <= y1; y++)
                {
                    if (!grid.TryGetValue((x, y), out var l)) grid[(x, y)] = l = new List<int>();
                    l.Add(i);
                }
            }
            var seen = new HashSet<(int, int)>();
            bool found = false;
            foreach (var l in grid.Values)
            {
                for (int u = 0; u < l.Count && !found; u++)
                    for (int v = u + 1; v < l.Count && !found; v++)
                    {
                        int i = Math.Min(l[u], l[v]), j = Math.Max(l[u], l[v]);
                        if (j - i <= 1 || (i == 0 && j == n - 1) || !seen.Add((i, j))) continue;   // neighbours share a point
                        if (Cross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n], out var at))
                        {
                            markers.Add(new Marker { Kind = "self", At = at });
                            count++; found = true;
                        }
                    }
                if (found) break;
            }
        }
        return count;
    }

    // Proper crossing of segments pq and rs (touching at an end point does not count).
    static bool Cross(P p, P q, P r, P s, out P at)
    {
        at = default;
        var d1 = q - p; var d2 = s - r;
        double den = P.Cross(d1, d2);
        if (Math.Abs(den) < 1e-12) return false;
        double t = P.Cross(r - p, d2) / den, u = P.Cross(r - p, d1) / den;
        if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return false;
        at = p + d1 * t;
        return true;
    }

    // Spec §6: closed cut contours nested by containment. Even depth = part, odd depth = hole of its parent.
    public static List<PartInfo> Parts(List<Contour> closedCut)
    {
        foreach (var c in closedCut) c.Area = Math.Abs(Geo.SignedArea(c.Segs));
        var order = closedCut.OrderByDescending(c => c.Area).ToList();
        int n = order.Count;
        var boxes = new (P Min, P Max)[n];
        var polys = new List<P>[n];
        for (int i = 0; i < n; i++) boxes[i] = Bounds(order[i]);

        // Each box is listed in the grid cells it covers, so a probe only meets the contours whose box covers its
        // cell: a sheet with thousands of holes stays near-linear instead of comparing every pair.
        double gx0 = double.MaxValue, gy0 = double.MaxValue, gx1 = double.MinValue, gy1 = double.MinValue;
        foreach (var (mn, mx) in boxes) { gx0 = Math.Min(gx0, mn.X); gy0 = Math.Min(gy0, mn.Y); gx1 = Math.Max(gx1, mx.X); gy1 = Math.Max(gy1, mx.Y); }
        int side = Math.Max(1, (int)Math.Sqrt(n));
        double cw = Math.Max((gx1 - gx0) / side, 1e-9), ch = Math.Max((gy1 - gy0) / side, 1e-9);
        int Cx(double x) => Math.Clamp((int)((x - gx0) / cw), 0, side - 1);
        int Cy(double y) => Math.Clamp((int)((y - gy0) / ch), 0, side - 1);
        var grid = new List<int>[side * side];
        for (int j = 0; j < n; j++)                     // ascending j: every cell list stays sorted
            for (int x = Cx(boxes[j].Min.X); x <= Cx(boxes[j].Max.X); x++)
                for (int y = Cy(boxes[j].Min.Y); y <= Cy(boxes[j].Max.Y); y++)
                    (grid[y * side + x] ??= new List<int>()).Add(j);

        var parent = new int[n];
        var depth = new int[n];
        for (int i = 0; i < n; i++)
        {
            var c = order[i];
            var probe = c.Segs[0].PointAt(0.5);
            int best = -1;
            var cell = grid[Cy(probe.Y) * side + Cx(probe.X)];
            for (int k = cell.Count - 1; k >= 0; k--)   // smallest containing contour first
            {
                int j = cell[k];
                if (j >= i) continue;
                var (mn, mx) = boxes[j];
                if (probe.X < mn.X || probe.X > mx.X || probe.Y < mn.Y || probe.Y > mx.Y) continue;
                if (order[j].Area > c.Area && Geo.Inside(probe, polys[j] ??= Geo.Polygon(order[j].Segs))) { best = j; break; }
            }
            parent[i] = best;
            depth[i] = best < 0 ? 0 : depth[best] + 1;
        }
        var parts = new List<PartInfo>();
        var partOf = new PartInfo[n];
        for (int i = 0; i < n; i++)
        {
            if (depth[i] % 2 != 0) continue;
            var c = order[i];
            var p = new PartInfo { Id = parts.Count, Outer = c.Id, Min = boxes[i].Min, Max = boxes[i].Max, Area = c.Area, CutLength = c.Length, Pierces = 1 };
            c.Part = p.Id;
            parts.Add(p); partOf[i] = p;
        }
        for (int i = 0; i < n; i++)
        {
            if (depth[i] % 2 != 1) continue;
            var c = order[i];
            var p = partOf[parent[i]];
            c.Part = p.Id; c.IsHole = true;
            p.Holes.Add(c.Id); p.Area -= c.Area; p.CutLength += c.Length; p.Pierces++;
        }
        return parts;
    }

    public static (P, P) Bounds(Contour c)
    {
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var s in c.Segs)
        {
            var (mn, mx) = s.Bounds();
            x0 = Math.Min(x0, mn.X); y0 = Math.Min(y0, mn.Y); x1 = Math.Max(x1, mx.X); y1 = Math.Max(y1, mx.Y);
        }
        return (new P(x0, y0), new P(x1, y1));
    }
}
