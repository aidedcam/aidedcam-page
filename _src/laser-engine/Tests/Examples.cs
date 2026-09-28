using ACadSharp;
using CSMath;
using Xunit;

namespace AidedCam.Laser.Tests;

// The page's "Load example order" (spec §10): synthetic parts built here, committed to js/laser/examples/.
// Regenerate after a deliberate change with:  LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests
public static class Examples
{
    public static Dictionary<string, byte[]> All() => new()
    {
        // A mounting plate (DXF 2004, in mm): rounded corners (arcs), four bolt holes and two slots (bulge polylines).
        ["bracket.dxf"] = Bracket(),
        // A flange (DXF 2004, in mm): outer circle, bore and six bolt holes on a 110 mm pitch circle.
        ["flange.dxf"] = Flange(),
        // A cover as customers send it (old R12, no units): a corner gap, a doubled edge, a part number, a bend line, a marking.
        ["cover.dxf"] = new Dxf().CodePage("ANSI_1253").Layer("CUT").Layer("BEND", 30, "DASHED").Layer("MARK", 5)
            .Line(0, 0, 200, 0, "CUT").Line(200, 0, 200, 100, "CUT").Line(200, 100, 0, 100, "CUT").Line(0, 100, 0, 0.15, "CUT")
            .Line(0, 0, 200, 0, "CUT")
            .Rect(20, 30, 40, 40, "CUT").Circle(150, 50, 12, "CUT")
            .Line(100, 0, 100, 100, "BEND")
            .Line(20, 88, 60, 88, "MARK")
            .Text(20, 8, 6, "ΚΑΛΥΜΜΑ Κ-01", "MARK").Bytes(),
        // A spacer, as DWG 2018 in mm: a ring with four holes.
        ["spacer.dwg"] = Spacer(),
    };

    // Quantities the page applies to the example order.
    public static readonly Dictionary<string, int> Quantities = new() { ["bracket.dxf"] = 10, ["flange.dxf"] = 4, ["cover.dxf"] = 2, ["spacer.dwg"] = 20 };

    static CadDocument Mm(ACadVersion v)
    {
        var doc = new CadDocument(v);
        doc.Header.InsUnits = ACadSharp.Types.Units.UnitsType.Millimeters;
        return doc;
    }

    static byte[] Bracket()
    {
        var doc = Mm(ACadVersion.AC1018);
        var cut = new ACadSharp.Tables.Layer("CUT");
        void Line(double x1, double y1, double x2, double y2) => doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(x1, y1, 0), EndPoint = new XYZ(x2, y2, 0), Layer = cut });
        void Arc(double cx, double cy, double a0, double a1) => doc.Entities.Add(new ACadSharp.Entities.Arc { Center = new XYZ(cx, cy, 0), Radius = 10, StartAngle = a0 * Math.PI / 180, EndAngle = a1 * Math.PI / 180, Layer = cut });
        void Hole(double x, double y) => doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = 4.25, Layer = cut });
        void Slot(double x0, double y0, double x1, double y1)
        {
            var p = new ACadSharp.Entities.LwPolyline { IsClosed = true, Layer = cut };
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x0, y0)));
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x1, y0)) { Bulge = 1 });
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x1, y1)));
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x0, y1)) { Bulge = 1 });
            doc.Entities.Add(p);
        }
        Line(10, 0, 110, 0); Arc(110, 10, 270, 360); Line(120, 10, 120, 70); Arc(110, 70, 0, 90);
        Line(110, 80, 10, 80); Arc(10, 70, 90, 180); Line(0, 70, 0, 10); Arc(10, 10, 180, 270);
        Hole(15, 15); Hole(105, 15); Hole(15, 65); Hole(105, 65);
        Slot(40, 36, 80, 44); Slot(55, 15, 65, 23);
        return AcadFile.Write(doc, false);
    }

    static byte[] Flange()
    {
        var doc = Mm(ACadVersion.AC1018);
        var cut = new ACadSharp.Tables.Layer("CUT");
        void Circle(double x, double y, double r) => doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = r, Layer = cut });
        Circle(0, 0, 75); Circle(0, 0, 30);
        for (int i = 0; i < 6; i++) Circle(55 * Math.Cos(i * Math.PI / 3), 55 * Math.Sin(i * Math.PI / 3), 6);
        return AcadFile.Write(doc, false);
    }

    static byte[] Spacer()
    {
        var doc = Mm(ACadVersion.AC1032);
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 40 });
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 20 });
        foreach (var (x, y) in new[] { (30.0, 0.0), (0.0, 30.0), (-30.0, 0.0), (0.0, -30.0) })
            doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = 3 });
        return AcadFile.Write(doc, true);
    }
}

public class ExamplesTests
{
    static string Dir([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here), "..", "..", "..", "js", "laser", "examples"));

    [Fact]
    public void The_example_order_shows_what_the_tool_does()
    {
        var r = Examples.All().ToDictionary(kv => kv.Key, kv => Processor.Process(kv.Value, new Settings()));
        var bracket = Assert.Single(r["bracket.dxf"].Parts);
        Assert.Equal(6, bracket.Holes.Count);
        foreach (var clean in new[] { "bracket.dxf", "flange.dxf", "spacer.dwg" })
        {
            Assert.Empty(r[clean].Checks);                          // declared mm, nothing to repair: shows as ready
            Assert.Equal("mm", r[clean].Drawing.Units);
        }
        Assert.Contains(r["cover.dxf"].Checks, c => c.Id == "units-assumed");
        var flange = Assert.Single(r["flange.dxf"].Parts);
        Assert.Equal(7, flange.Holes.Count);
        Assert.Equal(Math.PI * (75 * 75 - 30 * 30 - 6 * 36), flange.Area, 6);
        var cover = r["cover.dxf"];
        var ids = cover.Checks.Select(c => c.Id).ToList();
        Assert.Contains("gaps-closed", ids);
        Assert.Contains("duplicates-removed", ids);
        Assert.Contains("text-kept", ids);
        Assert.DoesNotContain("open-path", ids);
        Assert.Equal(2, Assert.Single(cover.Parts).Holes.Count);
        Assert.Equal(40, cover.MarkLength, 6);
        Assert.Equal("dwg", r["spacer.dwg"].Drawing.Format);
        Assert.Equal(5, Assert.Single(r["spacer.dwg"].Parts).Holes.Count);
    }

    [Fact]
    public void Committed_example_files_are_current()
    {
        var dir = Dir();
        if (Environment.GetEnvironmentVariable("LASER_WRITE_FIXTURES") == "1") Fixtures.WriteChanged(dir, Examples.All());
        foreach (var (name, bytes) in Examples.All())
        {
            var path = Path.Combine(dir, name);
            Assert.True(File.Exists(path), $"missing example {name}");
            Assert.True(Fixtures.SameResult(File.ReadAllBytes(path), bytes), $"example {name} is stale");
        }
    }
}
