using System.Globalization;
using System.Text;
using System.Text.Json;
using ACadSharp;
using CSMath;

namespace AidedCam.Laser.Tests;

// Synthetic files that the browser engine must read exactly as the desktop engine does (spec §13).
// They are committed to _tests/laser/fixtures/ with the desktop results in expected.json, and
// _tests/laser/parity.html runs them through the published engine and compares.
public static class Fixtures
{
    public static Dictionary<string, byte[]> All()
    {
        var f = new Dictionary<string, byte[]>
        {
            ["plate-holes.dxf"] = new Dxf().Rect(0, 0, 100, 50).Circle(10, 10, 5).Circle(90, 10, 5).Circle(10, 40, 5).Circle(90, 40, 5).Bytes(),
            ["gaps.dxf"] = new Dxf().Line(0, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 0, 50).Line(0, 50, 0, 0.15)
                .Arc(50, 25, 10, 0, 180).Line(40, 25, 59.9, 25).Circle(20, 25, 5).Bytes(),
            ["nested.dxf"] = new Dxf().Rect(0, 0, 100, 100).Rect(20, 20, 60, 60).Rect(40, 40, 20, 20).Bytes(),
            ["slot-bulge.dxf"] = new Dxf().Rect(0, 0, 120, 60).Polyline(true, "0", (40, 25, 0), (80, 25, 1), (80, 35, 0), (40, 35, 1)).Bytes(),
            ["roles-text.dxf"] = new Dxf().CodePage("ANSI_1253").Layer("ΧΑΡΑΞΗ", 5).Layer("BEND", 30, "DASHED").Layer("DIM")
                .Rect(0, 0, 200, 100).Line(20, 80, 80, 80, "ΧΑΡΑΞΗ").Line(100, 0, 100, 100, "BEND").Line(0, -10, 200, -10, "DIM")
                .Text(10, 10, 5, "ΤΕΜ. 1").Rect(150, 20, 30, 30).Line(150, 20, 180, 20).Bytes(),
            ["open.dxf"] = new Dxf().Line(0, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 0, 50).Line(0, 50, 0, 1).Bytes(),
        };
        f["blocks-2004.dxf"] = AcadFile.Write(BlocksDoc(), false);
        f["blocks.dwg"] = AcadFile.Write(BlocksDoc(), true);
        f["curves-2004.dxf"] = AcadFile.Write(CurvesDoc(), false);
        f["array-2004.dxf"] = AcadFile.Write(ArrayDoc(), false);
        f["array.dwg"] = AcadFile.Write(ArrayDoc(), true);
        return f;
    }

    static CadDocument BlocksDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        var corners = new[] { new XYZ(0, 0, 0), new XYZ(80, 0, 0), new XYZ(80, 40, 0), new XYZ(0, 40, 0) };
        for (int i = 0; i < 4; i++) doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = corners[i], EndPoint = corners[(i + 1) % 4] });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0) });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(70, 30, 0), XScale = 2, YScale = 2, Rotation = Math.PI / 6 });
        return doc;
    }

    static CadDocument CurvesDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        doc.Entities.Add(new ACadSharp.Entities.Ellipse { Center = new XYZ(50, 30, 0), MajorAxisEndPoint = new XYZ(40, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI });
        var sp = new ACadSharp.Entities.Spline { Degree = 3 };
        foreach (var p in new[] { (20.0, 25.0), (35.0, 40.0), (50.0, 20.0), (65.0, 40.0), (80.0, 25.0) }) sp.ControlPoints.Add(new XYZ(p.Item1, p.Item2, 0));
        foreach (var k in new[] { 0.0, 0, 0, 0, 0.5, 1, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Layer = new ACadSharp.Tables.Layer("MARK");
        doc.Entities.Add(sp);
        return doc;
    }

    // A plate with a 3 × 2 array of holes as one MINSERT, turned 90°: Eyeshot alone keeps one hole from the
    // DXF and none from the DWG.
    static CadDocument ArrayDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        var corners = new[] { new XYZ(-40, 0, 0), new XYZ(20, 0, 0), new XYZ(20, 70, 0), new XYZ(-40, 70, 0) };
        for (int i = 0; i < 4; i++) doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = corners[i], EndPoint = corners[(i + 1) % 4] });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0), ColumnCount = 3, RowCount = 2, ColumnSpacing = 20, RowSpacing = 15, Rotation = Math.PI / 2 });
        return doc;
    }

    // The comparable summary of a result; parity.html computes the same from the engine's JSON.
    public static Dictionary<string, object> Summary(Result r)
    {
        static double R3(double v) => Math.Round(v, 3);
        return new Dictionary<string, object>
        {
            ["parts"] = r.Parts.OrderByDescending(p => p.Area)
                .Select(p => new Dictionary<string, object> { ["area"] = R3(p.Area), ["cutLength"] = R3(p.CutLength), ["pierces"] = p.Pierces, ["holes"] = p.Holes.Count }).ToList(),
            ["checks"] = r.Checks.Select(c => c.Id).ToList(),
            ["openCutLength"] = R3(r.OpenCutLength),
            ["markLength"] = R3(r.MarkLength),
            ["contours"] = r.Contours.Count,
            ["texts"] = r.Drawing.Texts.Select(t => t.Value).ToList(),
        };
    }

    // Two files read the same when their summaries match.
    public static bool SameResult(byte[] a, byte[] b) =>
        JsonSerializer.Serialize(Summary(Processor.Process(a, new Settings()))) == JsonSerializer.Serialize(Summary(Processor.Process(b, new Settings())));

    // Writes only the files that are missing or read differently. ACadSharp stamps the save time into DXF 2004
    // and DWG, so rewriting an unchanged file would change its bytes in git for nothing.
    public static void WriteChanged(string dir, Dictionary<string, byte[]> files)
    {
        Directory.CreateDirectory(dir);
        foreach (var (name, bytes) in files)
        {
            var path = Path.Combine(dir, name);
            if (!File.Exists(path) || !SameResult(File.ReadAllBytes(path), bytes)) File.WriteAllBytes(path, bytes);
        }
    }

    public static string ExpectedJson() => JsonSerializer.Serialize(
        All().OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => Summary(Processor.Process(kv.Value, new Settings()))),
        new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
}
