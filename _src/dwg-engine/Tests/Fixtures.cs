using System.Text.Json;
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

// Synthetic files that the browser engine must measure exactly as the desktop engine does (spec §9). They are
// committed to _tests/dwg/fixtures/ with the desktop results in expected.json, and _tests/dwg/parity.html runs
// them through the published engine and compares. ACadSharp stamps files with the time they were written, so
// the committed bytes are the reference: set DWGQ_WRITE_FIXTURES=1 once to write them.
public class Fixtures
{
    static readonly string Dir = Path.Combine(Cad.Root(), "_tests", "dwg", "fixtures");

    public static Dictionary<string, byte[]> Build() => new()
    {
        ["rooms-2004.dxf"] = Greek1253(Cad.Bytes(Rooms(ACadVersion.AC1018, ascii: true), false)),
        ["rooms.dwg"] = Cad.Bytes(Rooms(ACadVersion.AC1032), true),
        ["blocks-2004.dxf"] = Greek1253(Cad.Bytes(BlocksDoc(ACadVersion.AC1018, ascii: true), false)),
        ["blocks.dwg"] = Cad.Bytes(BlocksDoc(ACadVersion.AC1032), true),
        ["curves.dwg"] = Cad.Bytes(Curves(), true),
        ["no-units-2004.dxf"] = Cad.Bytes(NoUnits(), false),
    };

    // Greek names, as a pre-2007 DXF from a Greek AutoCAD carries them: Windows-1253 bytes under
    // $DWGCODEPAGE ANSI_1253. ACadSharp's own DXF writer would write UTF-8 there, so the documents use ASCII
    // placeholders of the same byte length, swapped here for the Greek bytes.
    static readonly (string Ascii, string Greek)[] Names =
    {
        ("LYR_T1", "ΤΟΙΧΟΙ"), ("LYR_D1", "ΔΑΠΕΔΑ"), ("LYR_P1", "ΠΟΡΤΕΣ"), ("LYR_Y01", "ΥΔΡΕΥΣΗ"), ("TXT_S1", "ΣΑΛΟΝΙ"), ("~1", "Π1"), ("~2", "Π2"),
    };

    static string N(string greek, bool ascii) => ascii ? Names.Single(n => n.Greek == greek).Ascii : greek;

    static byte[] Greek1253(byte[] dxf)
    {
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
        var enc = System.Text.Encoding.GetEncoding(1253);
        foreach (var (a, g) in Names)
        {
            byte[] from = System.Text.Encoding.ASCII.GetBytes(a), to = enc.GetBytes(g);
            for (int i = 0; i + from.Length <= dxf.Length; i++)
                if (dxf.AsSpan(i, from.Length).SequenceEqual(from)) to.CopyTo(dxf, i);
        }
        return dxf;
    }

    // Rooms in centimetres: outlines, a hatched floor with an island, a door arc, a pipe run.
    static CadDocument Rooms(ACadVersion v, bool ascii = false)
    {
        var doc = Cad.Doc(UnitsType.Centimeters, v);
        doc.Header.CodePage = "ANSI_1253";
        doc.Entities.Add(Cad.Rect(0, 0, 500, 400).On(doc, N("ΤΟΙΧΟΙ", ascii)));
        doc.Entities.Add(Cad.Rect(500, 0, 300, 400).On(doc, N("ΤΟΙΧΟΙ", ascii)));
        var h = new Hatch { IsSolid = true, Pattern = new HatchPattern("SOLID") };
        var outer = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External | BoundaryPathFlags.Polyline };
        outer.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(0, 0, 0), new XYZ(500, 0, 0), new XYZ(500, 400, 0), new XYZ(0, 400, 0) } });
        var column = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline };
        column.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(200, 150, 0), new XYZ(240, 150, 0), new XYZ(240, 190, 0), new XYZ(200, 190, 0) } });
        h.Paths.Add(outer); h.Paths.Add(column);
        doc.Entities.Add(h.On(doc, N("ΔΑΠΕΔΑ", ascii)));
        doc.Entities.Add(new Arc { Center = new XYZ(500, 100, 0), Radius = 90, StartAngle = Math.PI / 2, EndAngle = Math.PI }.On(doc, N("ΠΟΡΤΕΣ", ascii)));
        doc.Entities.Add(Cad.Poly(false, (20, 380, 0), (480, 380, 0), (480, 20, -0.4142135623730950), (700, 20, 0)).On(doc, N("ΥΔΡΕΥΣΗ", ascii)));
        doc.Entities.Add(new TextEntity { Value = N("ΣΑΛΟΝΙ", ascii), Height = 20, InsertPoint = new XYZ(250, 200, 0) });
        return doc;
    }

    // Blocks in metres: counts per layer, an arrayed insert, nesting, a dynamic block's anonymous copy, attributes.
    static CadDocument BlocksDoc(ACadVersion v, bool ascii = false)
    {
        var doc = Cad.Doc(UnitsType.Meters, v);
        doc.Header.CodePage = "ANSI_1253";
        BlockRecord B(string name, params Entity[] es) { var b = new BlockRecord(name); foreach (var e in es) b.Entities.Add(e); doc.BlockRecords.Add(b); return b; }
        var valve = B("VALVE", Cad.Line(-0.1, 0, 0.1, 0), new Circle { Center = new XYZ(0, 0, 0), Radius = 0.05 });
        var lamp = B("LAMP", new Circle { Center = new XYZ(0, 0, 0), Radius = 0.1 });
        var wc = B("WC", Cad.Rect(0, 0, 0.4, 0.6));
        var bath = B("BATHROOM", Cad.Rect(0, 0, 2, 3), new Insert(wc) { InsertPoint = new XYZ(0.2, 0.2, 0) }, new Insert(wc) { InsertPoint = new XYZ(1.2, 0.2, 0) });
        var window = B("WINDOW", Cad.Rect(0, 0, 1, 0.2));
        var copy = B("*U12", Cad.Rect(0, 0, 1.2, 0.2));
        var app = new AppId("AcDbBlockRepBTag"); doc.AppIds.Add(app);
        copy.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));

        doc.Entities.Add(Cad.Line(0, 0, 20, 0).On(doc, "PIPE"));
        foreach (var x in new[] { 4.0, 12 }) doc.Entities.Add(new Insert(valve) { InsertPoint = new XYZ(x, 0, 0) }.On(doc, "PIPE"));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(0, 5, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2, ColumnSpacing = 3 }.On(doc, "LIGHT"));
        for (int i = 0; i < 2; i++) doc.Entities.Add(new Insert(bath) { InsertPoint = new XYZ(i * 5, 10, 0) }.On(doc, "SANITARY"));
        void Win(double x, BlockRecord b, string type, string w, string h)
        {
            var ins = new Insert(b) { InsertPoint = new XYZ(x, 15, 0) }.On(doc, "WINDOWS");
            ins.Attributes.Add(new AttributeEntity { Tag = "TYPE", Value = type });
            ins.Attributes.Add(new AttributeEntity { Tag = "W", Value = w });
            ins.Attributes.Add(new AttributeEntity { Tag = "H", Value = h });
            doc.Entities.Add(ins);
        }
        for (int i = 0; i < 3; i++) Win(i * 2, window, N("Π1", ascii), "100", "140");
        Win(8, copy, N("Π2", ascii), "120", "140");
        return doc;
    }

    // Curves in millimetres: a rational spline, an ellipse, a mirrored arc, a bulged slot, a bow tie, a 3D polyline.
    static CadDocument Curves()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        var sp = new Spline { Degree = 2 };
        foreach (var p in new[] { new XYZ(1000, 0, 0), new XYZ(1000, 1000, 0), new XYZ(0, 1000, 0) }) sp.ControlPoints.Add(p);
        foreach (var w in new[] { 1, Math.Sqrt(0.5), 1 }) sp.Weights.Add(w);
        foreach (var k in new[] { 0.0, 0, 0, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Flags |= SplineFlags.Rational;
        doc.Entities.Add(sp.On(doc, "SPLINE"));
        doc.Entities.Add(new Ellipse { Center = new XYZ(3000, 0, 0), MajorAxisEndPoint = new XYZ(800, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI }.On(doc, "ELLIPSE"));
        doc.Entities.Add(new Arc { Center = new XYZ(500, -2000, 0), Radius = 300, StartAngle = 0, EndAngle = Math.PI, Normal = new XYZ(0, 0, -1) }.On(doc, "MIRROR"));
        doc.Entities.Add(Cad.Poly(true, (0, 3000, 0), (400, 3000, 1), (400, 3200, 0), (0, 3200, 1)).On(doc, "SLOT"));
        doc.Entities.Add(Cad.Poly(true, (2000, 3000, 0), (2200, 3200, 0), (2200, 3000, 0), (2000, 3200, 0)).On(doc, "BAD"));
        var p3 = new Polyline3D();
        foreach (var q in new[] { new XYZ(0, -4000, 0), new XYZ(300, -4000, 400), new XYZ(300, -3500, 400) }) p3.Vertices.Add(new Vertex3D(q));
        doc.Entities.Add(p3.On(doc, "3D"));
        return doc;
    }

    static CadDocument NoUnits()
    {
        var doc = Cad.Doc(UnitsType.Unitless, ACadVersion.AC1018);
        doc.Entities.Add(Cad.Rect(0, 0, 2500, 1500).On(doc, "A"));
        return doc;
    }

    // The comparable summary of a result; parity.html computes the same from the engine's JSON.
    public static Dictionary<string, object> Summary(Result r)
    {
        static double R(double v) => Math.Round(v, 6);
        return new Dictionary<string, object>
        {
            ["units"] = r.Units + "/" + r.UnitsSource,
            ["layers"] = r.Layers.Select(l => $"{l.Name}|{R(l.Len)}|{l.LenCount}|{R(l.Area)}|{l.AreaCount}|{R(l.HatchArea)}|{l.HatchCount}|{l.Bad}").ToList(),
            ["blocks"] = r.Blocks.Select(b => $"{b.Name}|{b.Layer}|{b.Count}|{b.Nested}").ToList(),
            ["schedules"] = r.Schedules.SelectMany(s => s.Rows.Select(row => $"{s.Block}|{string.Join(",", s.Tags)}|{string.Join(",", row.Values)}|{row.Count}")).ToList(),
            ["items"] = r.Items.Count,
            ["notMeasured"] = $"{r.NotMeasured.Text}|{r.NotMeasured.Dim}|{r.NotMeasured.Other}|{r.NotMeasured.InsideBlocks}",
            ["warnings"] = r.Warnings.Select(w => w.Id).ToList(),
        };
    }

    [Fact]
    public void The_committed_fixtures_give_the_committed_expected_results()
    {
        var opts = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        var expectedPath = Path.Combine(Dir, "expected.json");
        if (Environment.GetEnvironmentVariable("DWGQ_WRITE_FIXTURES") == "1")
        {
            Directory.CreateDirectory(Dir);
            var all = new SortedDictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
            foreach (var (name, bytes) in Build())
            {
                File.WriteAllBytes(Path.Combine(Dir, name), bytes);
                all[name] = Summary(Quantities.Run(bytes, new Settings()));
            }
            File.WriteAllText(expectedPath, JsonSerializer.Serialize(all, opts) + "\n");
        }
        var expected = JsonDocument.Parse(File.ReadAllText(expectedPath)).RootElement;
        foreach (var file in expected.EnumerateObject())
        {
            var actual = JsonSerializer.Serialize(Summary(Quantities.Run(File.ReadAllBytes(Path.Combine(Dir, file.Name)), new Settings())), opts);
            Assert.Equal(JsonSerializer.Serialize(file.Value, opts), actual);
        }
    }

    [Fact]
    public void The_DWG_and_DXF_fixtures_agree()
    {
        var f = Build();
        foreach (var (dxf, dwg) in new[] { ("rooms-2004.dxf", "rooms.dwg"), ("blocks-2004.dxf", "blocks.dwg") })
        {
            var a = Summary(Quantities.Run(f[dxf], new Settings())); var b = Summary(Quantities.Run(f[dwg], new Settings()));
            Assert.Equal(JsonSerializer.Serialize(a), JsonSerializer.Serialize(b));
        }
    }
}
