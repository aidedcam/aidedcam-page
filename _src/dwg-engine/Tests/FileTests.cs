using System.Text.Json;
using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class FileTests
{
    [Theory]
    [InlineData(UnitsType.Centimeters, "auto", 0.01, "file", "cm")]
    [InlineData(UnitsType.Unitless, "auto", 0.001, "assumed", "mm")]
    [InlineData(UnitsType.Unitless, "m", 1.0, "setting", "m")]
    [InlineData(UnitsType.Inches, "m", 0.0254, "file", "inch")]                                       // the file's own units win
    public void Units_come_from_the_file_then_the_setting_then_millimetres(UnitsType units, string setting, double metres, string source, string used)
    {
        var doc = Cad.Doc(units);
        doc.Entities.Add(Cad.Line(0, 0, 100, 0).On(doc, "L"));
        var r = Cad.Run(doc, true, setting);
        Assert.Equal(100 * metres, r.Layer("L").Len, 9);
        Assert.Equal(source, r.UnitsSource);
        Assert.Equal(used, r.Used);                                                                    // the unit the numbers are in
        Assert.Equal(source == "assumed", r.Warnings.Any(w => w.Id == "units-assumed"));
        Assert.Equal(source == "setting", r.Warnings.Any(w => w.Id == "units-setting"));
    }

    [Fact]
    public void The_visitors_override_corrects_a_file_that_states_the_wrong_units()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);                                                      // says mm, drawn in cm
        doc.Entities.Add(Cad.Line(0, 0, 450, 0).On(doc, "L"));
        var r = Quantities.Run(Cad.Bytes(doc, true), new Settings { Override = "cm" });
        Assert.Equal(4.5, r.Layer("L").Len, 9);
        Assert.Equal("override", r.UnitsSource);
        Assert.Equal("cm", r.Used);
        Assert.Equal("mm", r.Units);                                                                   // what the file said, kept for the banner
        Assert.Contains(r.Warnings, w => w.Id == "units-override" && w.Params.Contains(("units", "cm")) && w.Params.Contains(("file", "mm")));
    }

    [Fact]
    public void Overriding_a_file_that_states_no_units_says_so()
    {
        var doc = Cad.Doc(UnitsType.Unitless);
        doc.Entities.Add(Cad.Line(0, 0, 450, 0).On(doc, "L"));
        var r = Quantities.Run(Cad.Bytes(doc, true), new Settings { Override = "cm" });
        Assert.Equal(4.5, r.Layer("L").Len, 9);
        Assert.Equal("none", r.Units);
        Assert.Equal("cm", r.Used);
        var w = Assert.Single(r.Warnings, w => w.Id.StartsWith("units-"));
        Assert.Equal("units-override-none", w.Id);
        Assert.Equal(new[] { ("units", "cm") }, w.Params);
    }

    [Fact]
    public void The_same_drawing_as_DWG_and_DXF_gives_the_same_numbers()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "ROOMS"));
        doc.Entities.Add(new Arc { Center = new XYZ(0, 0, 0), Radius = 900, StartAngle = 0, EndAngle = Math.PI / 2 }.On(doc, "DOORS"));
        doc.Entities.Add(new Circle { Center = new XYZ(500, 500, 0), Radius = 100 }.On(doc, "PIPE"));
        var a = Cad.Run(doc, true); var b = Cad.Run(doc, false);
        Assert.Equal(a.Layers.Select(l => (l.Name, Math.Round(l.Len, 9), Math.Round(l.Area, 9))), b.Layers.Select(l => (l.Name, Math.Round(l.Len, 9), Math.Round(l.Area, 9))));
        Assert.Equal("dwg", a.Format); Assert.Equal("2018", a.Version);
        Assert.Equal("dxf", b.Format); Assert.Equal("2018", b.Version);
    }

    [Fact]
    public void Layer_state_and_colour_are_reported()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var l = Cad.Layer(doc, "HIDDEN", 1);
        l.IsOn = false;
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "HIDDEN"));
        var r = Cad.Run(doc);
        Assert.True(r.Layer("HIDDEN").Off);
        Assert.Equal("#ff0000", r.Layer("HIDDEN").Color);
        Assert.Equal(1, r.Layer("HIDDEN").Len, 9);                                                     // measured all the same
    }

    [Fact]
    public void Text_dimensions_and_other_entities_are_counted_as_not_measured()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "L"));
        doc.Entities.Add(new TextEntity { Value = "ΣΑΛΟΝΙ", Height = 0.2 });
        doc.Entities.Add(new MText { Value = "note", Height = 0.2 });
        doc.Entities.Add(new Point(new XYZ(1, 1, 0)));
        var r = Cad.Run(doc);
        Assert.Equal(2, r.NotMeasured.Text);
        Assert.Equal(1, r.NotMeasured.Other);
        Assert.Contains(r.Warnings, w => w.Id == "not-measured" && w.Params.Contains(("count", "3")));
    }

    [Fact]
    public void A_drawing_with_everything_in_paper_space_is_refused_plainly()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.PaperSpace.Entities.Add(Cad.Line(0, 0, 1, 0));
        var ex = Assert.Throws<DwgFileException>(() => Cad.Run(doc));
        Assert.Equal("empty", ex.Reason);
        Assert.Contains("paper space", ex.Message);
    }

    [Fact]
    public void A_drawing_with_nothing_in_model_or_paper_space_is_refused_as_blank()
    {
        var ex = Assert.Throws<DwgFileException>(() => Cad.Run(Cad.Doc(UnitsType.Meters)));
        Assert.Equal("blank", ex.Reason);
    }

    [Fact]
    public void Files_that_are_not_drawings_or_too_big_are_refused_with_a_reason()
    {
        Assert.Equal("read", Assert.Throws<DwgFileException>(() => Quantities.Run(System.Text.Encoding.ASCII.GetBytes("hello"), new Settings())).Reason);
        Assert.Equal("limit", Assert.Throws<DwgFileException>(() => Quantities.Run(new byte[Limits.MaxBytes + 1], new Settings())).Reason);
        var dwg = Cad.Bytes(Cad.Doc(), true);
        System.Text.Encoding.ASCII.GetBytes("AC1099").CopyTo(dwg, 0);
        Assert.Equal("version", Assert.Throws<DwgFileException>(() => Quantities.Run(dwg, new Settings())).Reason);
    }

    [Fact]
    public void The_json_follows_the_contract()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "ΔΩΜΑΤΙΑ"));
        var json = ResultJson.Run(Cad.Bytes(doc, true), "κάτοψη.dwg", new Settings());
        using var d = JsonDocument.Parse(json);
        var root = d.RootElement;
        Assert.Equal("result", root.GetProperty("type").GetString());
        Assert.Equal("κάτοψη.dwg", root.GetProperty("file").GetProperty("name").GetString());
        Assert.Equal("mm", root.GetProperty("file").GetProperty("used").GetString());
        var layer = root.GetProperty("layers")[0];
        Assert.Equal("ΔΩΜΑΤΙΑ", layer.GetProperty("name").GetString());
        Assert.Equal(12, layer.GetProperty("area").GetDouble(), 6);
        Assert.Equal(14, layer.GetProperty("len").GetDouble(), 6);
        var item = root.GetProperty("items")[0];
        Assert.Equal("polyline", item.GetProperty("kind").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("block").ValueKind);
        Assert.Equal(10, item.GetProperty("path")[0].GetArrayLength());                                 // 4 corners and back to the first
        Assert.Equal(4, root.GetProperty("bbox").GetProperty("x1").GetDouble(), 6);
        var err = JsonDocument.Parse(ResultJson.Run(new byte[] { 1, 2, 3 }, "x.dwg", new Settings())).RootElement;
        Assert.Equal("error", err.GetProperty("type").GetString());
        Assert.Equal("read", err.GetProperty("reason").GetString());
    }

    [Fact]
    public void A_closed_outline_of_twenty_thousand_vertices_is_checked_in_near_linear_time()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        int n = 20_000;
        var v = Enumerable.Range(0, n).Select(i => { double t = 2 * Math.PI * i / n, r = 10 + 0.5 * Math.Sin(40 * t); return (r * Math.Cos(t), r * Math.Sin(t), 0.0); }).ToArray();
        doc.Entities.Add(Cad.Poly(true, v).On(doc, "CONTOUR"));
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var r = Cad.Run(doc);
        Assert.True(sw.ElapsedMilliseconds < 2000, $"{sw.ElapsedMilliseconds} ms");
        Assert.Equal(0, r.Layer("CONTOUR").Bad);
        Assert.InRange(r.Layer("CONTOUR").Area, 314, 316);
    }

    [Fact]
    public void A_drawing_over_the_point_budget_is_drawn_simplified_but_measured_in_full()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var block = new ACadSharp.Tables.BlockRecord("GRID");
        for (int i = 0; i < 100; i++) block.Entities.Add(Cad.Line(i * 0.01, 0, i * 0.01, 1));
        doc.BlockRecords.Add(block);
        for (int i = 0; i < 6000; i++) doc.Entities.Add(new Insert(block) { InsertPoint = new XYZ(i % 80 * 2, i / 80 * 2, 0) }.On(doc, "G"));
        var r = Cad.Run(doc);
        Assert.True(r.Simplified);
        Assert.Contains(r.Warnings, w => w.Id == "simplified");
        Assert.Equal(6000, r.Blocks.Single().Count);
        Assert.Equal(600_000, r.NotMeasured.InsideBlocks);
        Assert.True(r.Items.Sum(i => i.Path.Sum(p => p.Length / 2)) <= Limits.MaxPathPoints);           // blocks drawn as their outlines
        Assert.Equal(5, r.Items[0].Path.Single().Length / 2);
    }

    [Fact]
    public void A_degenerate_spline_does_not_fail_the_file()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "L"));
        // A spline with 2 identical control points (degenerate), degree 1
        var sp = new Spline { Degree = 1 };
        sp.ControlPoints.Add(new XYZ(0, 0, 0));
        sp.ControlPoints.Add(new XYZ(0, 0, 0));
        sp.Knots.Add(0);
        sp.Knots.Add(0);
        sp.Knots.Add(1);
        sp.Knots.Add(1);
        doc.Entities.Add(sp.On(doc, "S"));
        // The per-entity guard in Quantities.Run has no input known to reach it; this pins the degenerate case that motivated it.
        var r = Cad.Run(doc);
        Assert.Equal(1, r.Layer("L").Len, 9);
        Assert.Equal(2, r.Items.Count);
    }
}
