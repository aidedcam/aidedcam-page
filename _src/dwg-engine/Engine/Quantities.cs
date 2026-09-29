using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;

namespace AidedCam.Dwg;

// The whole measurement of one file (spec §4): model space only, every layer, results in metres.
public static class Quantities
{
    sealed class Pending
    {
        public Item Item;
        public Shape Shape;                       // curves and hatches
        public Insert Insert;                     // block inserts
    }

    public static Result Run(byte[] bytes, Settings settings)
    {
        var r = new Result();
        LastFile.Clear();                                                       // the union cache holds the last file only (coverage pre-check)
        var doc = Reader.Open(bytes, r);
        double k = Reader.Scale(doc, settings, r);
        var model = doc.Entities.ToList();
        if (model.Count > Limits.MaxEntities) throw new DwgFileException("limit", "over 300,000 entities");
        if (model.Count == 0)
        {
            bool paper = doc.BlockRecords.Any(b => b.Name.StartsWith("*Paper_Space", StringComparison.OrdinalIgnoreCase) && b.Entities.Count > 0);
            if (paper) throw new DwgFileException("empty", "model space is empty; the drawing is in paper space");
            throw new DwgFileException("blank", "the drawing is empty");
        }

        var blocks = new Blocks(doc, r.Format == "dxf");
        r.Xrefs = doc.BlockRecords.Where(Blocks.IsXref).Select(b => b.Name).OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();
        var pending = new List<Pending>();
        var counts = new Dictionary<(string Name, string Layer), BlockCount>();
        var schedules = new Dictionary<string, Dictionary<string, (List<string> Values, int Count)>>();
        var scheduleTags = new Dictionary<string, List<string>>();

        foreach (var e in model)
        {
            string layer = e.Layer?.Name ?? "0";
            string id = e.Handle.ToString("X");
            switch (e)
            {
                case Insert ins when ins.Block != null && !Blocks.IsXref(ins.Block):
                {
                    string name = blocks.Name(ins.Block);
                    int copies = Blocks.Copies(ins);
                    Count(counts, name, layer).Count += copies;
                    foreach (var kv in blocks.Nested(ins.Block)) Count(counts, kv.Key.Name, kv.Key.Layer ?? layer).Nested += copies * kv.Value;
                    r.NotMeasured.InsideBlocks += copies * blocks.Geometry(ins.Block);
                    AddSchedule(schedules, scheduleTags, name, ins, copies);
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = "insert", Block = name, Copies = copies }, Insert = ins });
                    break;
                }
                case Insert:
                    break;                                                          // an xref: listed, not loaded
                case Hatch h:
                {
                    var s = Hatches.Measure(h, r.Format == "dxf");
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = "hatch", Area = s.Area * k * k, Bad = s.Bad }, Shape = s });
                    break;
                }
                default:
                {
                    try
                    {
                        var s = Measure.Curve(e);
                        if (s == null) { NotMeasured(r.NotMeasured, e); break; }
                        var item = new Item { Id = id, Layer = layer, Kind = s.Kind, Len = s.Len * k, Area = s.Area * k * k, Bad = s.Bad };
                        var verts = s.Verts();
                        if (verts != null) { for (int i = 0; i < verts.Length; i += 3) { verts[i] *= k; verts[i + 1] *= k; } item.Verts = verts; }
                        pending.Add(new Pending { Item = item, Shape = s });
                    }
                    catch { r.NotMeasured.Other++; }
                    break;
                }
            }
        }

        Draw(r, pending, blocks, k);
        r.Items = pending.Select(p => p.Item).ToList();
        r.Layers = LayerTotals(doc, r.Items);
        r.Blocks = counts.Values.OrderBy(b => b.Name, StringComparer.OrdinalIgnoreCase).ThenBy(b => b.Name, StringComparer.Ordinal)
            .ThenBy(b => b.Layer, StringComparer.OrdinalIgnoreCase).ToList();
        r.Schedules = schedules.OrderBy(s => s.Key, StringComparer.OrdinalIgnoreCase).Select(s => new Schedule
        {
            Block = s.Key,
            Tags = scheduleTags[s.Key],
            Rows = s.Value.Values.OrderBy(v => string.Join("\u0001", v.Values), StringComparer.Ordinal)
                .Select(v => new ScheduleRow { Values = Pad(v.Values, scheduleTags[s.Key].Count), Count = v.Count }).ToList(),
        }).ToList();
        Warn(r, settings);
        LastFile.Keep(pending.Where(p => p.Shape != null && p.Shape.IsCurve).Select(p => (p.Item, p.Shape)), k);
        return r;
    }

    static BlockCount Count(Dictionary<(string, string), BlockCount> d, string name, string layer)
    {
        if (!d.TryGetValue((name, layer), out var b)) d[(name, layer)] = b = new BlockCount { Name = name, Layer = layer };
        return b;
    }

    // One schedule per block name, with its attribute tags as columns in order of first appearance; identical
    // rows are collapsed with a count (spec §4).
    static void AddSchedule(Dictionary<string, Dictionary<string, (List<string>, int)>> schedules, Dictionary<string, List<string>> tags, string name, Insert ins, int copies)
    {
        var attrs = ins.Attributes.ToList();
        if (attrs.Count == 0) return;
        if (!tags.TryGetValue(name, out var t)) { tags[name] = t = new List<string>(); schedules[name] = new(); }
        foreach (var a in attrs) if (!t.Contains(a.Tag ?? "")) t.Add(a.Tag ?? "");
        var values = t.Select(tag => attrs.FirstOrDefault(a => (a.Tag ?? "") == tag)?.Value ?? "").ToList();
        var rows = schedules[name];
        // Rows are keyed by their values under the tags known so far; a later tag only adds empty cells at the end.
        string key = string.Join("\u0001", values).TrimEnd('\u0001');
        rows[key] = rows.TryGetValue(key, out var row) ? (row.Item1, row.Item2 + copies) : (values, copies);
    }

    static List<string> Pad(List<string> v, int n) { var r = new List<string>(v); while (r.Count < n) r.Add(""); return r; }

    static void NotMeasured(NotMeasured nm, Entity e)
    {
        switch (e)
        {
            case TextEntity or MText or TableEntity: nm.Text++; break;          // AttributeEntity derives from TextEntity too
            case Dimension or Leader or MultiLeader or Tolerance: nm.Dim++; break;
            case Solid3D or Region or CadBody or ModelerGeometry: nm.Solid3d++; break;
            case Mesh or PolyfaceMesh or Face3D: nm.Mesh++; break;
            case ProxyEntity or UnknownEntity: nm.Proxy++; break;
            default: nm.Other++; break;
        }
    }

    // Paths in metres. The sampling tolerance follows the drawing's size; when the points would exceed the
    // budget, everything is sampled again more coarsely and the result says so (spec §8).
    static void Draw(Result r, List<Pending> pending, Blocks blocks, double k)
    {
        // The drawing's size, from a coarse pass (arcs as a few chords, blocks as their placements' origins).
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        void Grow(double x, double y) { x0 = Math.Min(x0, x); y0 = Math.Min(y0, y); x1 = Math.Max(x1, x); y1 = Math.Max(y1, y); }
        foreach (var p in pending)
        {
            if (p.Shape != null) { foreach (var line in p.Shape.Polylines(double.MaxValue, Affine.Identity)) foreach (var q in line) Grow(q.X, q.Y); }
            else Grow(p.Insert.InsertPoint.X, p.Insert.InsertPoint.Y);
        }
        double diag = x1 >= x0 ? Math.Sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) : 1;
        double dev = Math.Max(diag, 1e-9) * 2e-5;
        if (!Sample(pending, blocks, dev, k))
        {
            r.Simplified = true;
            Sample(pending, blocks, dev * 20, k, force: true);
        }
        x0 = double.MaxValue; y0 = double.MaxValue; x1 = double.MinValue; y1 = double.MinValue;
        foreach (var p in pending) foreach (var line in p.Item.Path) for (int i = 0; i + 1 < line.Length; i += 2) Grow(line[i], line[i + 1]);
        if (x1 >= x0) { r.X0 = x0; r.Y0 = y0; r.X1 = x1; r.Y1 = y1; }
    }

    // Returns false (and stops) when the point budget runs out, unless forced.
    static bool Sample(List<Pending> pending, Blocks blocks, double dev, double k, bool force = false)
    {
        long points = 0;
        foreach (var p in pending)
        {
            p.Item.Path.Clear();
            try
            {
                IEnumerable<List<(double X, double Y, double Z)>> lines;
                if (p.Shape != null) lines = p.Shape.Polylines(dev, Affine.Identity);
                else
                {
                    var inner = blocks.Drawing(p.Insert.Block, dev);
                    // Simplified: a block of many pieces is drawn as the outline of its extents, still one item.
                    if (force && inner.Count > 8) inner = new() { Box(inner) };
                    lines = Blocks.Placements(p.Insert).SelectMany(map => inner.Select(line => line.Select(q => map.Apply(q.X, q.Y, q.Z)).ToList()));
                }
                foreach (var line in lines)
                {
                    if (line.Count < 2) continue;
                    var flat = new double[line.Count * 2];
                    for (int i = 0; i < line.Count; i++) { flat[2 * i] = line[i].X * k; flat[2 * i + 1] = line[i].Y * k; }
                    p.Item.Path.Add(flat);
                    points += line.Count;
                }
            }
            catch { }  // An entity may fail to sample (e.g. Eyeshot curve operations): leave Path empty and continue.
            if (!force && points > Limits.MaxPathPoints) return false;
        }
        return true;
    }

    static List<(double X, double Y, double Z)> Box(List<List<(double X, double Y, double Z)>> lines)
    {
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var line in lines) foreach (var q in line) { x0 = Math.Min(x0, q.X); y0 = Math.Min(y0, q.Y); x1 = Math.Max(x1, q.X); y1 = Math.Max(y1, q.Y); }
        return new() { (x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0), (x0, y0, 0) };
    }

    static List<LayerTotal> LayerTotals(CadDocument doc, List<Item> items)
    {
        var d = new Dictionary<string, LayerTotal>();
        foreach (var it in items)
        {
            if (!d.TryGetValue(it.Layer, out var t))
            {
                d[it.Layer] = t = new LayerTotal { Name = it.Layer };
                if (doc.Layers.TryGetValue(it.Layer, out Layer l))
                {
                    t.Color = $"#{l.Color.R:x2}{l.Color.G:x2}{l.Color.B:x2}";
                    t.Off = !l.IsOn;
                    t.Frozen = l.Flags.HasFlag(LayerFlags.Frozen);
                }
            }
            if (it.Bad) t.Bad++;
            if (it.Kind == "insert") continue;
            if (it.Kind == "hatch")
            {
                if (!it.Bad) { t.HatchArea += it.Area; t.HatchCount++; }
                continue;
            }
            t.Len += it.Len; t.LenCount++;
            if (!it.Bad && it.Area > 0) { t.Area += it.Area; t.AreaCount++; }
        }
        return d.Values.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ThenBy(t => t.Name, StringComparer.Ordinal).ToList();
    }

    static void Warn(Result r, Settings s)
    {
        void W(string id, params (string, string)[] p) => r.Warnings.Add(new Warning { Id = id, Params = p.ToList() });
        if (r.UnitsSource == "assumed") W("units-assumed");
        if (r.UnitsSource == "setting") W("units-setting", ("units", s.Units));
        if (r.UnitsSource == "override" && r.Units == "none") W("units-override-none", ("units", s.Override));
        else if (r.UnitsSource == "override") W("units-override", ("units", s.Override), ("file", r.Units));
        if (r.Xrefs.Count > 0) W("xrefs", ("count", r.Xrefs.Count.ToString()));
        int bad = r.Items.Count(i => i.Bad);
        if (bad > 0) W("bad-area", ("count", bad.ToString()));
        if (r.NotMeasured.InsideBlocks > 0) W("inside-blocks", ("count", r.NotMeasured.InsideBlocks.ToString()));
        var nm = r.NotMeasured;
        int other = nm.Text + nm.Dim + nm.Solid3d + nm.Mesh + nm.Proxy + nm.Other;
        if (other > 0) W("not-measured", ("count", other.ToString()));
        if (r.Simplified) W("simplified");
    }
}
