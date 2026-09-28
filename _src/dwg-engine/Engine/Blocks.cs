using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;

namespace AidedCam.Dwg;

// Block definitions (spec §4): the names users see, what is nested inside, and the drawing of an insert.
// Everything here is cached per block definition, so a block placed a thousand times is walked once.
public sealed class Blocks(CadDocument doc, bool dxf = false)
{
    const int MaxDepth = 16;
    readonly Dictionary<ulong, string> names = new();
    readonly Dictionary<ulong, Dictionary<(string Name, string Layer), int>> nested = new();
    readonly Dictionary<ulong, int> geometry = new();
    readonly Dictionary<ulong, List<List<(double X, double Y, double Z)>>> drawings = new();
    double drawingDev = double.NaN;

    public static bool IsXref(BlockRecord b) =>
        b.Flags.HasFlag(ACadSharp.Blocks.BlockTypeFlags.XRef) || b.Flags.HasFlag(ACadSharp.Blocks.BlockTypeFlags.XRefOverlay);

    // The name a user sees. A dynamic block's insert points at an anonymous copy (*U…); AutoCAD links the copy
    // back to its dynamic block with the extended data AcDbBlockRepBTag, whose handle names the original.
    public string Name(BlockRecord b)
    {
        if (names.TryGetValue(b.Handle, out var n)) return n;
        n = b.Name;
        if (n.StartsWith("*"))
        {
            if (b.Source != null) n = b.Source.Name;
            else if (b.ExtendedData.TryGet("AcDbBlockRepBTag", out var xd))
                foreach (var rec in xd.Records)
                {
                    if (rec is not ACadSharp.XData.ExtendedDataHandle h) continue;
                    // ACadSharp 3.3.23 reads this handle from a DWG with its bytes reversed (its own DWG writer
                    // round-trips 0x46 as 0x4600000000000000), so both byte orders are tried.
                    if ((doc.TryGetCadObject<BlockRecord>(h.Value, out var src) && src != null) ||
                        (doc.TryGetCadObject<BlockRecord>(System.Buffers.Binary.BinaryPrimitives.ReverseEndianness(h.Value), out src) && src != null))
                    { n = src.Name; break; }
                }
        }
        return names[b.Handle] = n;
    }

    public static int Copies(Insert i) => Math.Max(1, (int)i.RowCount) * Math.Max(1, (int)i.ColumnCount);

    // Inserts inside a block definition, by (name, layer), times their placements. A nested insert on layer
    // "0" takes the layer of the insert that places it: its layer here is null until then.
    public Dictionary<(string Name, string Layer), int> Nested(BlockRecord b, int depth = 0)
    {
        if (nested.TryGetValue(b.Handle, out var d)) return d;
        d = new Dictionary<(string, string), int>();
        if (depth < MaxDepth)
            foreach (var child in b.Entities.OfType<Insert>())
            {
                if (child.Block == null || IsXref(child.Block)) continue;
                string layer = child.Layer?.Name is null or "0" ? null : child.Layer.Name;
                int copies = Copies(child);
                Add(d, (Name(child.Block), layer), copies);
                foreach (var kv in Nested(child.Block, depth + 1))
                    Add(d, (kv.Key.Name, kv.Key.Layer ?? layer), copies * kv.Value);
            }
        return nested[b.Handle] = d;
    }

    static void Add(Dictionary<(string, string), int> d, (string, string) key, int n) => d[key] = d.GetValueOrDefault(key) + n;

    // Curves and hatches inside a block definition, counting nested blocks by their placements. None of them
    // is added to the layer totals: a block is an item, not metres (spec §4).
    public int Geometry(BlockRecord b, int depth = 0)
    {
        if (geometry.TryGetValue(b.Handle, out var n)) return n;
        n = 0;
        foreach (var e in b.Entities)
        {
            if (e is Hatch || Measure.IsCurveType(e)) n++;
            else if (e is Insert child && child.Block != null && !IsXref(child.Block) && depth < MaxDepth) n += Copies(child) * Geometry(child.Block, depth + 1);
        }
        return geometry[b.Handle] = n;
    }

    // The block's curves and hatch boundaries as polylines in block coordinates, nested blocks included,
    // sampled within dev. Attributes and text are not drawn.
    public List<List<(double X, double Y, double Z)>> Drawing(BlockRecord b, double dev, int depth = 0)
    {
        if (drawingDev != dev) { drawings.Clear(); drawingDev = dev; }
        if (drawings.TryGetValue(b.Handle, out var lines)) return lines;
        lines = new List<List<(double, double, double)>>();
        drawings[b.Handle] = lines;                                   // a block that (wrongly) contains itself draws once
        if (depth >= MaxDepth) return lines;
        var bp = b.BlockEntity?.BasePoint ?? new CSMath.XYZ(0, 0, 0);
        var toBase = new Affine(new double[] { 1, 0, 0, -bp.X, 0, 1, 0, -bp.Y, 0, 0, 1, -bp.Z });
        foreach (var e in b.Entities)
        {
            if (e is Insert child)
            {
                if (child.Block == null || IsXref(child.Block)) continue;
                var inner = Drawing(child.Block, dev, depth + 1);
                foreach (var map in Placements(child))
                    foreach (var line in inner) lines.Add(Apply(line, map.Then(toBase)));
                continue;
            }
            try
            {
                var shape = e is Hatch h ? Hatches.Measure(h, dxf) : Measure.Curve(e);
                if (shape == null) continue;
                foreach (var line in shape.Polylines(dev, toBase)) lines.Add(line);
            }
            catch { }
        }
        return lines;
    }

    static List<(double X, double Y, double Z)> Apply(List<(double X, double Y, double Z)> line, Affine map)
    {
        var r = new List<(double, double, double)>(line.Count);
        foreach (var p in line) r.Add(map.Apply(p.X, p.Y, p.Z));
        return r;
    }

    // Block space → the insert's owner space, one map per copy (a MINSERT has rows × columns copies; the grid
    // turns with the insert). ACadSharp's transform ignores the block's base point; Drawing takes it off.
    public static IEnumerable<Affine> Placements(Insert i)
    {
        var t = i.GetTransform();
        (double, double, double) P(double x, double y, double z) { var v = t.ApplyTransform(new CSMath.XYZ(x, y, z)); return (v.X, v.Y, v.Z); }
        var baseMap = Affine.FromBasis(P(0, 0, 0), P(1, 0, 0), P(0, 1, 0), P(0, 0, 1));    // ignores the base point
        int rows = Math.Max(1, (int)i.RowCount), cols = Math.Max(1, (int)i.ColumnCount);
        double cos = Math.Cos(i.Rotation), sin = Math.Sin(i.Rotation);
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                double ox = c * i.ColumnSpacing, oy = r * i.RowSpacing;
                double dx = ox * cos - oy * sin, dy = ox * sin + oy * cos;
                yield return baseMap.Then(new Affine(new double[] { 1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, 0 }));
            }
    }
}
