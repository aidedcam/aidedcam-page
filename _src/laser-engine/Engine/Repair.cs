namespace AidedCam.Laser;

public sealed class Marker
{
    public string Kind;          // "open", "gap", "branch" or "self"
    public P At;
    public double Size;          // gap width for "gap", 0 otherwise
}

public sealed class RepairStats
{
    public int TinyRemoved, DuplicatesRemoved, OverlapsMerged, GapsClosed;
    public double DuplicateLength, MaxGapClosed;
}

// Repair steps 1–4 of spec §5, on the pieces of one role. Steps 3–4 give every piece start/end node ids.
public static class Repair
{
    // Step 1: pieces shorter than Limits.Tiny.
    public static List<Seg> RemoveTiny(List<Seg> segs, RepairStats st)
    {
        var keep = segs.Where(s => s.Length >= Limits.Tiny).ToList();
        st.TinyRemoved += segs.Count - keep.Count;
        return keep;
    }

    // Step 2: identical pieces and overlaps. Collinear lines and arcs on the same circle are merged
    // where they overlap by more than tol, so each stretch is cut once.
    public static List<Seg> MergeOverlaps(List<Seg> segs, double tol, RepairStats st)
    {
        var lines = segs.Where(s => s.Kind == SegKind.Line).ToList();
        var round = segs.Where(s => s.Kind != SegKind.Line).ToList();
        var outp = new List<Seg>();
        outp.AddRange(MergeLines(lines, tol, st));
        outp.AddRange(MergeRound(round, tol, st));
        return outp;
    }

    static List<Seg> MergeLines(List<Seg> lines, double tol, RepairStats st)
    {
        // Canonical direction angle in [0, π) and signed offset of the infinite line from the origin.
        var items = lines.Select(s =>
        {
            var d = s.B - s.A; double len = d.Length;
            var u = new P(d.X / len, d.Y / len);
            if (u.Y < 0 || (u.Y == 0 && u.X < 0)) u = new P(-u.X, -u.Y);
            double ang = Math.Atan2(u.Y, u.X);
            if (ang >= Math.PI - 1e-9) { ang = 0; u = new P(1, 0); }
            double off = P.Cross(u, s.A);
            return (s, u, ang, off);
        }).OrderBy(x => x.ang).ToList();

        // Clusters of one direction: split wherever consecutive angles differ by more than 1e-6, then sort each
        // cluster by offset, so a copy whose angle differs by floating-point noise still lands next to its twin.
        var sorted = new List<(Seg s, P u, double ang, double off)>(items.Count);
        for (int c0 = 0; c0 < items.Count;)
        {
            int c1 = c0 + 1;
            while (c1 < items.Count && items[c1].ang - items[c1 - 1].ang <= 1e-6) c1++;
            sorted.AddRange(items.GetRange(c0, c1 - c0).OrderBy(x => x.off));
            sorted.Add((null, default, double.NaN, 0));        // cluster boundary
            c0 = c1;
        }

        var result = new List<Seg>();
        int i = 0;
        while (i < sorted.Count)
        {
            if (sorted[i].s == null) { i++; continue; }
            // A run of parallel lines on the same infinite line (within tol).
            int j = i + 1;
            while (j < sorted.Count && sorted[j].s != null && Math.Abs(sorted[j].ang - sorted[i].ang) < 1e-6
                   && Math.Abs(sorted[j].off - sorted[j - 1].off) <= tol) j++;
            var run = sorted.GetRange(i, j - i);
            i = j;
            if (run.Count == 1) { result.Add(run[0].s); continue; }
            var u0 = run[0].u;
            var iv = run.Select(x =>
            {
                double t0 = x.s.A.X * u0.X + x.s.A.Y * u0.Y, t1 = x.s.B.X * u0.X + x.s.B.Y * u0.Y;
                return t0 <= t1 ? (lo: t0, hi: t1, pLo: x.s.A, pHi: x.s.B, s: x.s) : (lo: t1, hi: t0, pLo: x.s.B, pHi: x.s.A, s: x.s);
            }).OrderBy(x => x.lo).ToList();
            int k = 0;
            while (k < iv.Count)
            {
                var cur = iv[k]; int members = 1; double sum = cur.hi - cur.lo;
                int m = k + 1;
                while (m < iv.Count && iv[m].lo < cur.hi - tol)
                {
                    sum += iv[m].hi - iv[m].lo;
                    if (iv[m].hi > cur.hi) { cur.hi = iv[m].hi; cur.pHi = iv[m].pHi; }
                    members++; m++;
                }
                if (members == 1) result.Add(cur.s);
                else
                {
                    result.Add(Seg.Line(cur.pLo, cur.pHi, cur.s.Group));
                    st.DuplicatesRemoved += members - 1;
                    st.OverlapsMerged++;
                    st.DuplicateLength += sum - (cur.hi - cur.lo);
                }
                k = m;
            }
        }
        return result;
    }

    static List<Seg> MergeRound(List<Seg> round, double tol, RepairStats st)
    {
        var result = new List<Seg>();
        var used = new bool[round.Count];
        double cell = Math.Max(tol, 1e-6) * 2;
        var byCentre = new Dictionary<(long, long), List<int>>();
        for (int i = 0; i < round.Count; i++)
        {
            var k = ((long)Math.Floor(round[i].C.X / cell), (long)Math.Floor(round[i].C.Y / cell));
            if (!byCentre.TryGetValue(k, out var l)) byCentre[k] = l = new List<int>();
            l.Add(i);
        }
        for (int i = 0; i < round.Count; i++)
        {
            if (used[i]) continue;
            var same = new List<Seg> { round[i] }; used[i] = true;
            long kx = (long)Math.Floor(round[i].C.X / cell), ky = (long)Math.Floor(round[i].C.Y / cell);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (byCentre.TryGetValue((kx + dx, ky + dy), out var near))
                        foreach (int j in near)
                            if (!used[j] && round[j].C.DistanceTo(round[i].C) <= tol && Math.Abs(round[j].R - round[i].R) <= tol) { same.Add(round[j]); used[j] = true; }
            if (same.Count == 1) { result.Add(same[0]); continue; }
            var circle = same.FirstOrDefault(s => s.Kind == SegKind.Circle);
            if (circle != null)
            {
                // A full circle covers every arc on it.
                result.Add(circle);
                st.DuplicatesRemoved += same.Count - 1; st.OverlapsMerged++;
                st.DuplicateLength += same.Where(s => s != circle).Sum(s => s.Length);
                continue;
            }
            // Arcs as counter-clockwise angular intervals [lo, lo + sweep], merged where they overlap.
            var iv = same.Select(s =>
            {
                var c = s.Ccw ? s : s.Reversed();
                return (lo: c.StartAngle, sw: c.Sweep, pLo: c.A, pHi: c.B, s);
            }).OrderBy(x => x.lo).ToList();
            double angTol = tol / same[0].R;
            var merged = new List<(double lo, double sw, P pLo, P pHi, Seg s, int n, double sum)>();
            foreach (var x in iv)
            {
                bool joined = false;
                for (int q = 0; q < merged.Count; q++)
                {
                    var g = merged[q];
                    double d = x.lo - g.lo; while (d < 0) d += 2 * Math.PI;
                    if (d < g.sw - angTol)
                    {
                        double end = Math.Max(g.sw, d + x.sw);
                        merged[q] = (g.lo, end, g.pLo, end > g.sw ? x.pHi : g.pHi, g.s, g.n + 1, g.sum + x.sw);
                        joined = true; break;
                    }
                }
                if (!joined) merged.Add((x.lo, x.sw, x.pLo, x.pHi, x.s, 1, x.sw));
            }
            foreach (var g in merged)
            {
                if (g.n == 1) { result.Add(g.s); continue; }
                st.DuplicatesRemoved += g.n - 1; st.OverlapsMerged++;
                double r = g.s.R;
                if (g.sw >= 2 * Math.PI - angTol) { st.DuplicateLength += (g.sum - 2 * Math.PI) * r; result.Add(Seg.Circle(g.s.C, r, g.s.Group)); }
                else { st.DuplicateLength += (g.sum - g.sw) * r; result.Add(Seg.Arc(g.s.C, r, g.pLo, g.pHi, true, g.s.Group)); }
            }
        }
        return result;
    }

    // Steps 3 and 4. Returns the node positions; every non-circle piece gets Start/End node ids in the lists.
    public static Graph Join(List<Seg> segs, double joinTol, double gapTol, RepairStats st, List<Marker> markers)
    {
        var g = new Graph();
        double cell = Math.Max(gapTol, joinTol) * 2;
        var grid = new Dictionary<(long, long), List<int>>();
        (long, long) Key(P p) => ((long)Math.Floor(p.X / cell), (long)Math.Floor(p.Y / cell));

        int NodeFor(P p)
        {
            var k = Key(p);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (grid.TryGetValue((k.Item1 + dx, k.Item2 + dy), out var list))
                        foreach (int n in list) if (g.Nodes[n].DistanceTo(p) <= joinTol) return n;
            g.Nodes.Add(p);
            if (!grid.TryGetValue(k, out var l2)) grid[k] = l2 = new List<int>();
            l2.Add(g.Nodes.Count - 1);
            return g.Nodes.Count - 1;
        }

        foreach (var s in segs)
        {
            if (s.Kind == SegKind.Circle) { g.Circles.Add(s); continue; }
            int a = NodeFor(s.A), b = NodeFor(s.B);
            if (a == b && s.Kind == SegKind.Line) { st.TinyRemoved++; continue; }     // collapsed by the join
            if (a == b)
            {
                // Both arc ends on one node: its sweep before snapping tells a circle drawn as one arc
                // (over π) from a sliver shorter than the join tolerance.
                if (s.Sweep > Math.PI) g.Circles.Add(Seg.Circle(s.C, s.R, s.Group));
                else st.TinyRemoved++;
                continue;
            }
            s.A = g.Nodes[a]; s.B = g.Nodes[b];
            g.Edges.Add((s, a, b));
        }

        // Gap closing: pair loose ends (nodes with one piece end) within gapTol of each other, nearest first.
        var degree = new int[g.Nodes.Count];
        var edgeAt = new int[g.Nodes.Count];
        for (int q = 0; q < g.Edges.Count; q++) { var e = g.Edges[q]; degree[e.a]++; degree[e.b]++; edgeAt[e.a] = q; edgeAt[e.b] = q; }
        var pairs = new List<(double d, int a, int b)>();
        for (int n = 0; n < g.Nodes.Count; n++)
        {
            if (degree[n] != 1) continue;
            var k = Key(g.Nodes[n]);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (grid.TryGetValue((k.Item1 + dx, k.Item2 + dy), out var list))
                        foreach (int m in list)
                        {
                            if (m <= n || degree[m] != 1) continue;
                            double d = g.Nodes[n].DistanceTo(g.Nodes[m]);
                            if (d > gapTol) continue;
                            if (edgeAt[n] == edgeAt[m] && g.Edges[edgeAt[n]].s.Kind == SegKind.Line) continue;   // both ends of one line
                            pairs.Add((d, n, m));
                        }
        }
        var done = new HashSet<int>();
        foreach (var (d, a, b) in pairs.OrderBy(p => p.d))
        {
            if (done.Contains(a) || done.Contains(b)) continue;
            done.Add(a); done.Add(b);
            var mid = (g.Nodes[a] + g.Nodes[b]) * 0.5;
            int ia = edgeAt[a], ib = edgeAt[b];
            var sa = g.Edges[ia].s; var sb = g.Edges[ib].s;
            if (sa.Kind == SegKind.Line && sb.Kind == SegKind.Line)
            {
                // Both ends are lines: pull them together at the midpoint; node b folds into node a.
                g.Nodes[a] = mid;
                if (g.Edges[ia].a == a) sa.A = mid; else sa.B = mid;
                if (g.Edges[ib].a == b) sb.A = mid; else sb.B = mid;
                var eb = g.Edges[ib];
                if (eb.a == b) eb.a = a;
                if (eb.b == b) eb.b = a;
                g.Edges[ib] = eb;
            }
            else
            {
                // An arc end: moving it would change the radius, so a short line bridges the gap.
                var bridge = Seg.Line(g.Nodes[a], g.Nodes[b], (sa.Kind == SegKind.Line ? sb : sa).Group);
                bridge.Bridge = true;
                g.Edges.Add((bridge, a, b));
            }
            st.GapsClosed++;
            st.MaxGapClosed = Math.Max(st.MaxGapClosed, d);
            markers.Add(new Marker { Kind = "gap", At = mid, Size = d });
        }
        return g;
    }
}

// Nodes (joined piece ends) and edges (pieces between them). Circles are closed on their own.
public sealed class Graph
{
    public List<P> Nodes = new();
    public List<(Seg s, int a, int b)> Edges = new();
    public List<Seg> Circles = new();
}
