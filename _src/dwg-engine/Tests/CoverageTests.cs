using System.Text;
using System.Text.Json;
using ACadSharp.Types.Units;
using Xunit;

namespace AidedCam.Dwg.Tests;

// The two engine additions for the coverage pre-check (spec §3, §11): true vertices of closed polylines, and the
// union of closed items of the last file. The vertex fixtures are DXF text written the way AutoCAD writes it
// (group codes, subclass markers, a mirrored polyline's −Z extrusion), not ACadSharp round trips.
public class CoverageTests
{
    // A minimal AutoCAD 2000 DXF: header with the units, the layer table, then the entities as given.
    public static byte[] Dxf(int insunits, string[] layers, params string[] entities)
    {
        var sb = new StringBuilder();
        void G(int code, object v) => sb.Append(code.ToString().PadLeft(3)).Append("\r\n").Append(Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture)).Append("\r\n");
        G(0, "SECTION"); G(2, "HEADER");
        G(9, "$ACADVER"); G(1, "AC1015");
        G(9, "$INSUNITS"); G(70, insunits);
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "TABLES");
        G(0, "TABLE"); G(2, "LAYER"); G(5, "2"); G(100, "AcDbSymbolTable"); G(70, layers.Length + 1);
        int h = 0x10;
        foreach (var l in new[] { "0" }.Concat(layers))
        {
            G(0, "LAYER"); G(5, (h++).ToString("X")); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbLayerTableRecord");
            G(2, l); G(70, 0); G(62, 7); G(6, "Continuous");
        }
        G(0, "ENDTAB");
        // The block records the entities' owner handle (330) points at, as AutoCAD writes them.
        G(0, "TABLE"); G(2, "BLOCK_RECORD"); G(5, "1"); G(100, "AcDbSymbolTable"); G(70, 2);
        G(0, "BLOCK_RECORD"); G(5, "1F"); G(330, "1"); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbBlockTableRecord"); G(2, "*Model_Space"); G(340, "0");
        G(0, "BLOCK_RECORD"); G(5, "1B"); G(330, "1"); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbBlockTableRecord"); G(2, "*Paper_Space"); G(340, "0");
        G(0, "ENDTAB");
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "BLOCKS");
        G(0, "BLOCK"); G(5, "20"); G(330, "1F"); G(100, "AcDbEntity"); G(8, "0"); G(100, "AcDbBlockBegin"); G(2, "*Model_Space"); G(70, 0); G(10, 0.0); G(20, 0.0); G(30, 0.0); G(3, "*Model_Space"); G(1, "");
        G(0, "ENDBLK"); G(5, "21"); G(330, "1F"); G(100, "AcDbEntity"); G(8, "0"); G(100, "AcDbBlockEnd");
        G(0, "BLOCK"); G(5, "1C"); G(330, "1B"); G(100, "AcDbEntity"); G(67, 1); G(8, "0"); G(100, "AcDbBlockBegin"); G(2, "*Paper_Space"); G(70, 0); G(10, 0.0); G(20, 0.0); G(30, 0.0); G(3, "*Paper_Space"); G(1, "");
        G(0, "ENDBLK"); G(5, "1D"); G(330, "1B"); G(100, "AcDbEntity"); G(67, 1); G(8, "0"); G(100, "AcDbBlockEnd");
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "ENTITIES");
        foreach (var e in entities) sb.Append(e);
        G(0, "ENDSEC");
        G(0, "EOF");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }

    static string Codes(params (int Code, object Value)[] g)
    {
        var sb = new StringBuilder();
        foreach (var (c, v) in g) sb.Append(c.ToString().PadLeft(3)).Append("\r\n").Append(Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture)).Append("\r\n");
        return sb.ToString();
    }

    // LWPOLYLINE as AutoCAD writes it: handle, subclasses, vertex count, flags (1 = closed), constant width, then
    // 10/20 per vertex with 42 (bulge) after the vertex it starts from; 210/220/230 only for a non-default extrusion.
    public static string Lw(string handle, string layer, bool closed, (double X, double Y, double B)[] v, bool mirrored = false)
    {
        var g = new List<(int, object)> { (0, "LWPOLYLINE"), (5, handle), (330, "1F"), (100, "AcDbEntity"), (8, layer), (100, "AcDbPolyline"), (90, v.Length), (70, closed ? 1 : 0), (43, 0.0) };
        foreach (var (x, y, b) in v) { g.Add((10, x)); g.Add((20, y)); if (b != 0) g.Add((42, b)); }
        if (mirrored) { g.Add((210, 0.0)); g.Add((220, 0.0)); g.Add((230, -1.0)); }
        return Codes(g.ToArray());
    }

    // An old-style 2D POLYLINE: header with 66 (vertices follow) and 70 (1 = closed), VERTEX entities, SEQEND.
    static string Poly2D(string handle, string layer, (double X, double Y, double B)[] v)
    {
        var g = new List<(int, object)> { (0, "POLYLINE"), (5, handle), (330, "1F"), (100, "AcDbEntity"), (8, layer), (100, "AcDb2dPolyline"), (66, 1), (10, 0.0), (20, 0.0), (30, 0.0), (70, 1) };
        int h = Convert.ToInt32(handle, 16);
        foreach (var (x, y, b) in v)
        {
            g.AddRange(new (int, object)[] { (0, "VERTEX"), (5, (++h).ToString("X")), (330, handle), (100, "AcDbEntity"), (8, layer), (100, "AcDbVertex"), (100, "AcDb2dVertex"), (10, x), (20, y), (30, 0.0) });
            if (b != 0) g.Add((42, b));
            g.Add((70, 0));
        }
        g.AddRange(new (int, object)[] { (0, "SEQEND"), (5, (++h).ToString("X")), (330, handle), (100, "AcDbEntity"), (8, layer) });
        return Codes(g.ToArray());
    }

    static Result Run(byte[] dxf) => Quantities.Run(dxf, new Settings());

    static void Near(double[] expected, double[] actual, int digits = 6)
    {
        Assert.NotNull(actual);
        Assert.Equal(expected.Length, actual.Length);
        for (int i = 0; i < expected.Length; i++) Assert.True(Math.Abs(expected[i] - actual[i]) < Math.Pow(10, -digits), $"[{i}] expected {expected[i]}, got {actual[i]}\n{string.Join(", ", actual)}");
    }

    [Fact]
    public void A_closed_lightweight_polyline_with_a_bulge_reports_its_true_vertices_in_metres()
    {
        // In millimetres: a 10 × 5 m room whose top edge is a half circle of radius 5 m bulging upwards.
        var dxf = Dxf(4, new[] { "AC_COVER" }, Lw("2A", "AC_COVER", true, new[] { (0.0, 0.0, 0.0), (10000.0, 0.0, 0.0), (10000.0, 5000.0, 1.0), (0.0, 5000.0, 0.0) }));
        var r = Run(dxf);
        var it = Assert.Single(r.Items);
        Assert.False(string.IsNullOrEmpty(it.Id));                                                     // ACadSharp may renumber a handle that clashes with its defaults
        Near(new[] { 0, 0, 0, 10, 0, 0, 10, 5, 1.0, 0, 5, 0 }, it.Verts);
        Assert.Equal(50 + Math.PI * 25 / 2, it.Area, 9);                                              // 89.2699…: the arc counts exactly
    }

    [Fact]
    public void A_closed_2D_polyline_reports_its_true_vertices()
    {
        // Metres: a 6 × 4 plot with one side bowed outwards by a quarter-circle bulge (tan(π/8)).
        double b = Math.Tan(Math.PI / 8);
        var dxf = Dxf(6, new[] { "AC_PLOT" }, Poly2D("40", "AC_PLOT", new[] { (0.0, 0.0, 0.0), (6.0, 0.0, b), (6.0, 4.0, 0.0), (0.0, 4.0, 0.0) }));
        var r = Run(dxf);
        var it = Assert.Single(r.Items);
        Assert.Equal("polyline", it.Kind);
        Near(new[] { 0, 0, 0, 6, 0, b, 6, 4, 0, 0, 4, 0 }, it.Verts, 9);
        // Chord 4 and a 90° sweep: radius 4/√2 (r² = 8), segment area r²(θ − sin θ)/2 = 4·(π/2 − 1) = 2.2832.
        Assert.Equal(24 + 4 * (Math.PI / 2 - 1), it.Area, 9);
    }

    [Fact]
    public void A_mirrored_polyline_reports_drawing_coordinates_and_flips_its_bulges()
    {
        // AutoCAD's MIRROR can leave an extrusion of (0, 0, −1): the stored x is the negated drawing x, and an arc
        // stored counter-clockwise runs clockwise in the drawing.
        var dxf = Dxf(6, new[] { "L" }, Lw("50", "L", true, new[] { (0.0, 0.0, 0.0), (4.0, 0.0, 0.5), (4.0, 3.0, 0.0), (0.0, 3.0, 0.0) }, mirrored: true));
        var it = Assert.Single(Run(dxf).Items);
        Near(new[] { 0, 0, 0, -4, 0, -0.5, -4, 3, 0, 0, 3, 0 }, it.Verts, 9);
    }

    [Fact]
    public void Open_polylines_circles_and_lines_carry_no_vertices()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (5, 0, 0), (5, 5, 0)).On(doc, "OPEN"));
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(20, 0, 0), Radius = 2 }.On(doc, "C"));
        doc.Entities.Add(Cad.Line(0, 0, 1, 1).On(doc, "L"));
        var r = Cad.Run(doc);
        Assert.All(r.Items, i => Assert.Null(i.Verts));
        var json = JsonDocument.Parse(ResultJson.Write("x.dwg", r)).RootElement;
        foreach (var i in json.GetProperty("items").EnumerateArray()) Assert.False(i.TryGetProperty("verts", out _));   // DWG quantities' contract unchanged
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void The_DWG_and_the_DXF_give_the_same_vertices(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Centimeters);
        doc.Entities.Add(Cad.Poly(true, (0, 0, 0), (1000, 0, 0), (1000, 500, -0.25), (0, 500, 0)).On(doc, "R"));
        var it = Assert.Single(Cad.Run(doc, dwg).Items);
        Near(new[] { 0, 0, 0, 10, 0, 0, 10, 5, -0.25, 0, 5, 0 }, it.Verts, 9);
    }

    // ---- the union ----

    static string[] Load(params (double X, double Y, double W, double H)[] rects)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        foreach (var r in rects) doc.Entities.Add(Cad.Rect(r.X, r.Y, r.W, r.H).On(doc, "AC_COVER"));
        return Cad.Run(doc).Items.Select(i => i.Id).ToArray();
    }

    static double[][] Contours(UnionResult u) => u.Verts.ToArray();

    [Fact]
    public void Two_overlapping_squares_unite_into_one_outline_of_eight_vertices()
    {
        var ids = Load((0, 0, 10, 10), (5, 5, 10, 10));
        var u = Union.Of(ids);
        Assert.Null(u.Error);
        Assert.Equal(175, u.Area, 9);                                                                   // 100 + 100 − 25
        Assert.Equal(1, u.Parts);
        Near(new double[] { 0, 0, 0, 10, 0, 0, 10, 5, 0, 15, 5, 0, 15, 15, 0, 5, 15, 0, 5, 10, 0, 0, 10, 0 }, Assert.Single(Contours(u)), 9);
        Assert.Empty(u.Bad);
    }

    [Fact]
    public void Two_touching_squares_unite_without_the_shared_edges_points()
    {
        var u = Union.Of(Load((0, 0, 10, 10), (10, 0, 10, 10)));
        Assert.Equal(200, u.Area, 9);
        Near(new double[] { 0, 0, 0, 20, 0, 0, 20, 10, 0, 0, 10, 0 }, Assert.Single(Contours(u)), 9);   // (10, 0) and (10, 10) merged away
    }

    [Fact]
    public void Four_bars_around_a_courtyard_unite_into_a_square_with_a_hole()
    {
        var u = Union.Of(Load((0, 0, 30, 10), (0, 20, 30, 10), (0, 0, 10, 30), (20, 0, 10, 30)));
        Assert.Equal(900 - 100, u.Area, 9);
        Assert.Equal(1, u.Parts);
        var c = Contours(u);
        Assert.Equal(2, c.Length);
        Near(new double[] { 0, 0, 0, 30, 0, 0, 30, 30, 0, 0, 30, 0 }, c[0], 9);                        // outer, counter-clockwise
        Assert.Equal(12, c[1].Length);                                                                  // the courtyard: 4 vertices, clockwise
        double a = 0;
        for (int i = 0; i < 4; i++) { int j = (i + 1) % 4; a += c[1][3 * i] * c[1][3 * j + 1] - c[1][3 * j] * c[1][3 * i + 1]; }
        Assert.Equal(-200, a, 9);
    }

    [Fact]
    public void Separate_outlines_stay_separate_parts_and_add_up()
    {
        var u = Union.Of(Load((0, 0, 10, 10), (20, 0, 5, 4)));
        Assert.Equal(120, u.Area, 9);
        Assert.Equal(2, u.Parts);
    }

    [Fact]
    public void Survey_coordinates_keep_their_precision()
    {
        var u = Union.Of(Load((410000, 4495000, 10, 15), (410005, 4495005, 10, 10)));
        Assert.Equal(150 + 100 - 50, u.Area, 6);
        Near(new double[] { 410000, 4495000, 0, 410010, 4495000, 0, 410010, 4495005, 0, 410015, 4495005, 0, 410015, 4495015, 0, 410000, 4495015, 0 }, Assert.Single(Contours(u)), 6);
    }

    [Fact]
    public void An_outline_with_an_arc_keeps_it_as_a_bulge()
    {
        // A 10 × 10 square whose left side is a half circle bulging out (radius 5), and a 10 × 5 bar overlapping it.
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(true, (0, 10, 1), (0, 0, 0), (10, 0, 0), (10, 10, 0)).On(doc, "A"));
        doc.Entities.Add(Cad.Rect(5, 0, 10, 5).On(doc, "A"));
        var u = Union.Of(Cad.Run(doc).Items.Select(i => i.Id));
        Assert.Null(u.Error);
        Assert.Equal(100 + Math.PI * 12.5 + 25, u.Area, 6);
        var v = Assert.Single(Contours(u));
        Assert.Equal(6 * 3, v.Length);                                                                  // (0,0) (15,0) (15,5) (10,5) (10,10) (0,10)~arc
        int arc = Enumerable.Range(0, 6).Single(i => v[3 * i + 2] != 0);
        Assert.Equal(0, v[3 * arc], 6); Assert.Equal(10, v[3 * arc + 1], 6); Assert.Equal(1, v[3 * arc + 2], 9);
    }

    [Fact]
    public void Open_self_crossing_and_unknown_items_are_left_out_and_listed()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Rect(0, 0, 10, 10).On(doc, "C"));
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (5, 0, 0), (5, 5, 0)).On(doc, "C"));
        doc.Entities.Add(Cad.Poly(true, (20, 0, 0), (22, 2, 0), (22, 0, 0), (20, 2, 0)).On(doc, "C"));    // a bow tie
        var ids = Cad.Run(doc).Items.Select(i => i.Id).ToList();
        var u = Union.Of(ids.Append("FFFF"));
        Assert.Equal(100, u.Area, 9);
        Assert.Equal(new[] { ids[1], ids[2], "FFFF" }, u.Bad);
    }

    [Fact]
    public void A_circle_joins_the_union()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(0, 0, 0), Radius = 2 }.On(doc, "C"));
        doc.Entities.Add(Cad.Rect(0, -2, 4, 4).On(doc, "C"));
        var u = Union.Of(Cad.Run(doc).Items.Select(i => i.Id));
        Assert.Equal(16 + Math.PI * 4 / 2, u.Area, 6);
    }

    [Fact]
    public void The_union_answers_for_the_last_file_only_and_as_json()
    {
        var first = Load((0, 0, 10, 10));
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "AC_COVER"));
        doc.Entities.Add(Cad.Rect(2000, 0, 4000, 3000).On(doc, "AC_COVER"));
        var run = JsonDocument.Parse(ResultJson.Run(Cad.Bytes(doc, true), "b.dwg", new Settings())).RootElement;
        var ids = run.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToArray();
        var json = JsonDocument.Parse(ResultJson.Union(JsonSerializer.Serialize(ids))).RootElement;
        Assert.Equal("union", json.GetProperty("type").GetString());
        Assert.Equal(18, json.GetProperty("area").GetDouble(), 6);                                     // millimetres to metres: 6 × 3
        Assert.Equal(JsonValueKind.Null, json.GetProperty("error").ValueKind);
        Assert.Equal(12, json.GetProperty("verts")[0].GetArrayLength());
        Assert.Equal(10, json.GetProperty("paths")[0].GetArrayLength());
        // An id of the first file is unknown now.
        var stale = JsonDocument.Parse(ResultJson.Union(JsonSerializer.Serialize(first.Where(f => !ids.Contains(f)).Append("ABCDEF")))).RootElement;
        Assert.Equal(0, stale.GetProperty("area").GetDouble());
        Assert.Contains("ABCDEF", stale.GetProperty("bad").EnumerateArray().Select(b => b.GetString()));
        Assert.Equal(JsonValueKind.String, JsonDocument.Parse(ResultJson.Union("not json")).RootElement.GetProperty("error").ValueKind);   // never throws
    }

    [Fact]
    public void Fifty_outlines_unite_quickly()
    {
        var rects = Enumerable.Range(0, 50).Select(i => ((double)(i % 10) * 7, (double)(i / 10) * 7, 8.0, 8.0)).ToArray();
        var ids = Load(rects);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var u = Union.Of(ids);
        sw.Stop();
        Assert.Null(u.Error);
        Assert.Equal((9 * 7 + 8) * (4 * 7 + 8), u.Area, 6);                                            // they overlap into one 71 × 36 block
        Assert.True(sw.ElapsedMilliseconds < 1500, $"{sw.ElapsedMilliseconds} ms");
    }
    // ---- the committed drawings (written by _tests/coverage/make-examples.mjs) ----

    [Fact]
    public void The_example_permit_measures_as_spec_12_says()
    {
        var bytes = File.ReadAllBytes(Path.Combine(Cad.Root(), "js", "coverage", "examples", "example-permit.dxf"));
        var r = Quantities.Run(bytes, new Settings());
        Assert.Equal("dxf", r.Format); Assert.Equal("2000", r.Version);
        Assert.Equal("m", r.Used); Assert.Equal("file", r.UnitsSource);
        var expected = new Dictionary<string, double>
        {
            ["AC_PLOT"] = 500, ["AC_COVER"] = 150, ["AC_GREEN"] = 140, ["AC_LVL_B1"] = 150, ["AC_LVL_00"] = 150, ["AC_LVL_01"] = 150, ["AC_LVL_02"] = 150,
            ["AC_SEMIOPEN"] = 20 + 30 + 40, ["AC_STAIR_COMMON"] = 60, ["AC_BALCONY"] = 30,
        };
        foreach (var (layer, area) in expected) Assert.Equal(area, r.Layer(layer).Area, 6);
        Assert.Equal(16, r.Items.Count);                                                                // 15 outlines and the open polyline
        Assert.Single(r.Items, i => i.Layer == "AC_GREEN" && i.Area == 0 && i.Verts == null);
        var plot = r.Items.Single(i => i.Layer == "AC_PLOT");
        Near(new double[] { 410000, 4495000, 0, 410020, 4495000, 0, 410020, 4495025, 0, 410000, 4495025, 0 }, plot.Verts, 6);
        var u = Union.Of(r.Items.Where(i => i.Layer == "AC_COVER").Select(i => i.Id));
        Assert.Equal(150, u.Area, 6);
        Near(new double[] { 410000, 4495010, 0, 410010, 4495010, 0, 410010, 4495025, 0, 410000, 4495025, 0 }, Assert.Single(u.Verts), 6);
    }

    [Fact]
    public void The_layer_template_carries_every_template_layer_and_a_Greek_legend()
    {
        var bytes = File.ReadAllBytes(Path.Combine(Cad.Root(), "js", "coverage", "examples", "layer-template.dxf"));
        Assert.StartsWith("  0\r\nSECTION", Encoding.ASCII.GetString(bytes, 0, 14));
        var doc = ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes));
        var names = doc.Layers.Select(l => l.Name).ToHashSet();
        var expected = new[] { "AC_PLOT", "AC_COVER", "AC_LVL_B2", "AC_LVL_B1", "AC_LVL_00", "AC_LVL_09", "AC_LVL_ATTIC", "AC_MEZZ", "AC_SEMIOPEN", "AC_BALCONY",
            "AC_STAIR_COMMON", "AC_STAIR_UNIT", "AC_VOID", "AC_PILOTIS", "AC_BSMT_MAIN", "AC_EXCL_OTHER", "AC_GREEN" };
        foreach (var n in expected) Assert.Contains(n, names);
        Assert.Equal(25, names.Count(n => n.StartsWith("AC_")));                                        // the 25 template layers
        var texts = doc.Entities.OfType<ACadSharp.Entities.TextEntity>().Select(t => t.Value).ToList();
        Assert.Contains(texts, t => t.StartsWith("AC_PLOT") && t.Contains("Οικόπεδο"));
        Assert.Contains(texts, t => t.StartsWith("AC_LVL_B1") && t.Contains("Υπόγειο -1"));
    }
}
