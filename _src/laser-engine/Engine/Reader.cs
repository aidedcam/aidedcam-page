using devDept.Eyeshot;
using devDept.Eyeshot.Entities;
using devDept.Eyeshot.Translators;
using devDept.Geometry;

namespace AidedCam.Laser;

// Reads a DXF or DWG with Eyeshot's managed readers and turns model space into flat pieces in mm (spec §4).
public static class Reader
{
    const double Deviation = 0.01;     // mm: splines and ellipses become lines within this error

    public static Drawing Read(byte[] bytes, Settings settings)
    {
        if (bytes.Length > Limits.MaxBytes) throw new LaserFileException("limit", "over 20 MB");
        var d = new Drawing();
        string head = System.Text.Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
        ReadFileAsync rd;
        if (head.StartsWith("AC10"))
        {
            d.Format = "dwg";
            d.Version = VersionName(head.Substring(0, 6));
            if (d.Version == "") throw new LaserFileException("version", $"DWG version {head.Substring(0, 6)} is not supported");
            rd = new ReadDWG(new MemoryStream(bytes), /* password */ null, /* fixErrors */ false, /* skipProxies */ true);
        }
        else if (head.StartsWith("AutoCAD Binary DXF")) throw new LaserFileException("read", "binary DXF is not supported");
        else if (head.Contains("SECTION"))
        {
            d.Format = "dxf";
            int v = head.IndexOf("$ACADVER");
            if (v >= 0) { var m = System.Text.RegularExpressions.Regex.Match(head.Substring(v), @"AC\d{4}"); if (m.Success) d.Version = VersionName(m.Value); }
            rd = new ReadDXF(new MemoryStream(bytes));
        }
        else throw new LaserFileException("read", "not a DXF or DWG file");

        try { rd.DoWork(null, CancellationToken.None); }
        catch (Exception ex) { throw new LaserFileException("read", ex.Message); }
        if (!rd.Result) throw new LaserFileException("read", "the file could not be read");

        double scale = UnitScale(rd.Units, settings, d);
        var layers = rd.Layers;
        var groups = new Dictionary<string, int>();
        foreach (var e in rd.Entities)
        {
            if (e is BlockReference br)
            {
                var inner = br.ExplodeDeep(rd.Blocks, /* keepTessellation */ false);
                if (inner == null || inner.Length == 0) d.EmptyBlocks.Add(br.BlockName ?? "?");   // Eyeshot reads R12 blocks without their geometry
                else foreach (var x in inner) Add(d, x, layers, groups, scale);
            }
            else Add(d, e, layers, groups, scale);
            if (d.Segs.Count > Limits.MaxCurves) throw new LaserFileException("limit", "over 200,000 curves");
        }
        AddArrays(d, bytes, rd.Blocks, layers, groups, scale);
        foreach (var g in d.Groups) g.Role = settings.Roles.TryGetValue(g.Key, out var r) && Roles.IsRole(r) ? r : g.DefaultRole;
        return d;
    }

    // Arrayed inserts (MINSERT). Eyeshot's conversion keeps only the first copy from a DXF file and drops the
    // whole insert from a DWG file, while ACadSharp, which Eyeshot reads with, keeps the array. So model-space
    // arrays are read again with ACadSharp and the missing copies are exploded here (spec §4). An array inside
    // a block definition is only recorded, for the block-array check. A DXF without one skips the second read.
    static void AddArrays(Drawing d, byte[] bytes, BlockKeyedCollection blocks, LayerKeyedCollection layers, Dictionary<string, int> groups, double k)
    {
        bool dwg = d.Format == "dwg";
        if (!dwg && !DxfHasArray(bytes)) return;
        ACadSharp.CadDocument doc;
        try { doc = dwg ? ACadSharp.IO.DwgReader.Read(new MemoryStream(bytes)) : ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes)); }
        catch { return; }                                   // Eyeshot read the file; without ACadSharp's view there is nothing to add
        static bool IsArray(ACadSharp.Entities.Insert i) => i.RowCount > 1 || i.ColumnCount > 1;
        foreach (var rec in doc.BlockRecords)
        {
            bool space = rec.Name.Equals("*Model_Space", StringComparison.OrdinalIgnoreCase) || rec.Name.StartsWith("*Paper_Space", StringComparison.OrdinalIgnoreCase);
            if (!space && rec.Entities.OfType<ACadSharp.Entities.Insert>().Any(IsArray)) d.NestedArrays.Add(rec.Name);
        }
        foreach (var ins in doc.Entities.OfType<ACadSharp.Entities.Insert>().Where(IsArray))
        {
            double cos = Math.Cos(ins.Rotation), sin = Math.Sin(ins.Rotation);
            for (int r = 0; r < Math.Max(1, (int)ins.RowCount); r++)
                for (int c = 0; c < Math.Max(1, (int)ins.ColumnCount); c++)
                {
                    if (!dwg && r == 0 && c == 0) continue;     // the copy Eyeshot kept
                    double ox = c * ins.ColumnSpacing, oy = r * ins.RowSpacing;     // the grid turns with the insert
                    var br = new BlockReference(ins.InsertPoint.X + ox * cos - oy * sin, ins.InsertPoint.Y + ox * sin + oy * cos, ins.InsertPoint.Z,
                        ins.Block.Name, ins.XScale, ins.YScale, ins.ZScale, ins.Rotation) { LayerName = ins.Layer?.Name ?? "0" };
                    var inner = br.ExplodeDeep(blocks, /* keepTessellation */ false);
                    if (inner == null || inner.Length == 0) d.EmptyBlocks.Add(ins.Block.Name);
                    else foreach (var x in inner) Add(d, x, layers, groups, k);
                    if (d.Segs.Count > Limits.MaxCurves) throw new LaserFileException("limit", "over 200,000 curves");
                }
        }
    }

    // True when a DXF file has an INSERT with more than one column (code 70) or row (code 71).
    static bool DxfHasArray(byte[] bytes)
    {
        var text = System.Text.Encoding.Latin1.GetString(bytes);
        if (text.IndexOf("INSERT", StringComparison.Ordinal) < 0) return false;
        var lines = text.Split('\n');
        bool insert = false;
        for (int i = 0; i + 1 < lines.Length; i += 2)
        {
            string code = lines[i].Trim(), value = lines[i + 1].Trim();
            if (code == "0") insert = value == "INSERT";
            else if (insert && (code == "70" || code == "71") && int.TryParse(value, out int n) && n > 1) return true;
        }
        return false;
    }

    static string VersionName(string ac) => ac switch
    {
        "AC1009" => "R12", "AC1012" => "R13", "AC1014" => "R14", "AC1015" => "2000", "AC1018" => "2004",
        "AC1021" => "2007", "AC1024" => "2010", "AC1027" => "2013", "AC1032" => "2018", _ => "",
    };

    static double UnitScale(linearUnitsType u, Settings s, Drawing d)
    {
        (string name, double k) = u switch
        {
            linearUnitsType.Millimeters => ("mm", 1.0),
            linearUnitsType.Centimeters => ("cm", 10.0),
            linearUnitsType.Meters => ("m", 1000.0),
            linearUnitsType.Inches => ("inch", 25.4),
            linearUnitsType.Feet => ("ft", 304.8),
            _ => ("none", 1.0),
        };
        d.Units = name;
        if (name != "none") { d.UnitsSource = "file"; return k; }   // a file's own units always win
        if (s.Units == "mm" || s.Units == "inch") { d.UnitsSource = "setting"; return s.Units == "inch" ? 25.4 : 1.0; }
        d.UnitsSource = "assumed";
        return 1.0;
    }

    static int GroupOf(Drawing d, Entity e, LayerKeyedCollection layers, Dictionary<string, int> groups)
    {
        string layer = string.IsNullOrEmpty(e.LayerName) ? "0" : e.LayerName;
        Layer l = layers.Contains(layer) ? layers[layer] : null;
        var color = e.ColorMethod == colorMethodType.byLayer && l != null ? l.Color : e.Color;
        string hex = $"#{color.R:x2}{color.G:x2}{color.B:x2}";
        string lt = (e.LineTypeMethod == colorMethodType.byLayer || string.IsNullOrEmpty(e.LineTypeName)) && l != null
            ? l.LineTypeName : e.LineTypeName;
        string key = layer + "|" + hex;
        if (!groups.TryGetValue(key, out int gi))
        {
            gi = d.Groups.Count;
            groups[key] = gi;
            d.Groups.Add(new Group { Layer = layer, Color = hex, LineType = (lt ?? "CONTINUOUS").ToUpperInvariant(), DefaultRole = Roles.Default(layer) });
        }
        return gi;
    }

    static void Add(Drawing d, Entity e, LayerKeyedCollection layers, Dictionary<string, int> groups, double k)
    {
        switch (e)
        {
            case Dimension: d.Ignored["dim"]++; return;      // Dimension derives from Text in Eyeshot: test it first
            case Text t:
                var ax = t.Plane.AxisX;
                d.Texts.Add(new TextItem
                {
                    At = new P(t.InsertionPoint.X * k, t.InsertionPoint.Y * k),
                    Height = t.Height * k,
                    Rotation = Math.Atan2(ax.Y, ax.X) * 180 / Math.PI,
                    Value = t.TextString ?? "",
                });
                return;
            case Hatch: d.Ignored["hatch"]++; return;
            case Leader: d.Ignored["leader"]++; return;
            case devDept.Eyeshot.Entities.Point: d.Ignored["point"]++; return;
        }
        if (e is not ICurve) { d.Ignored["other"]++; return; }
        int g = GroupOf(d, e, layers, groups);
        int before = d.Segs.Count;
        AddCurve(d, (ICurve)e, g, k);
        d.Groups[g].Curves += d.Segs.Count - before;
    }

    static bool Flat(Plane p) => Math.Abs(Math.Abs(p.AxisZ.Z) - 1) < 1e-9;
    static P Q(Point3D p, double k) => new(p.X * k, p.Y * k);

    static void AddCurve(Drawing d, ICurve c, int g, double k)
    {
        switch (c)
        {
            case Line ln:
                if (Math.Abs(ln.StartPoint.Z) > 1e-6 || Math.Abs(ln.EndPoint.Z) > 1e-6) d.NotFlat = true;
                d.Segs.Add(Seg.Line(Q(ln.StartPoint, k), Q(ln.EndPoint, k), g));
                return;
            case Circle ci when ci is not Arc && Flat(ci.Plane):
                if (Math.Abs(ci.Center.Z) > 1e-6) d.NotFlat = true;
                d.Segs.Add(Seg.Circle(Q(ci.Center, k), ci.Radius * k, g));
                return;
            case Arc ar when Flat(ar.Plane):
                if (Math.Abs(ar.Center.Z) > 1e-6) d.NotFlat = true;
                P a = Q(ar.StartPoint, k), b = Q(ar.EndPoint, k), m = Q(ar.MidPoint, k);
                bool ccw = P.Cross(b - a, m - a) < 0;
                d.Segs.Add(Seg.Arc(Q(ar.Center, k), ar.Radius * k, a, b, ccw, g));
                return;
            case CompositeCurve cc:
                foreach (var sub in cc.CurveList) AddCurve(d, sub, g, k);
                return;
            case LinearPath lp:
                AddPoints(d, lp.Vertices, g, k);
                return;
            default:
                // Splines, ellipses and anything tilted out of the XY plane: lines within the deviation.
                if (c is Circle tilted && !Flat(tilted.Plane)) d.NotFlat = true;
                var path = c.ConvertToLinearPath(/* deviation */ Deviation / k, /* angle */ 0);
                if (path != null) AddPoints(d, path.Vertices, g, k);
                return;
        }
    }

    static void AddPoints(Drawing d, Point3D[] v, int g, double k)
    {
        if (v == null) return;
        foreach (var p in v) if (Math.Abs(p.Z) > 1e-6) { d.NotFlat = true; break; }
        for (int i = 0; i + 1 < v.Length; i++) d.Segs.Add(Seg.Line(Q(v[i], k), Q(v[i + 1], k), g));
    }
}
