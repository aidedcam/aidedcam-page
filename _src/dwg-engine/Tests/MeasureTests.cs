using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class MeasureTests
{
    [Fact]
    public void Lines_arcs_and_bulged_polylines_are_totalled_per_layer_in_metres()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Line(0, 0, 3000, 4000).On(doc, "PIPE"));                                  // 5 m
        doc.Entities.Add(new Arc { Center = new XYZ(0, 0, 0), Radius = 1000, StartAngle = 0, EndAngle = Math.PI / 2 }.On(doc, "PIPE"));   // π/2 m
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (2000, 0, 1), (2000, 2000, 0)).On(doc, "DUCT"));   // a half circle of Ø2 m, then 2 m straight
        var r = Cad.Run(doc);
        Assert.Equal(5 + Math.PI / 2, r.Layer("PIPE").Len, 9);
        Assert.Equal(2, r.Layer("PIPE").LenCount);
        Assert.Equal(Math.PI + 2, r.Layer("DUCT").Len, 9);
        Assert.Equal(0, r.Layer("DUCT").AreaCount);                                                     // open: no area
    }

    [Fact]
    public void Closed_outlines_have_exact_areas_and_a_bulged_slot_counts_its_round_ends()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Rect(0, 0, 4, 3).On(doc, "ROOMS"));                                        // 12 m²
        doc.Entities.Add(new Circle { Center = new XYZ(10, 0, 0), Radius = 1 }.On(doc, "ROOMS"));     // π m²
        doc.Entities.Add(Cad.Poly(true, (0, 10, 0), (4, 10, 1), (4, 12, 0), (0, 12, 1)).On(doc, "SLOT")); // 4 × 2 plus two half discs of r 1
        var r = Cad.Run(doc);
        Assert.Equal(12 + Math.PI, r.Layer("ROOMS").Area, 9);
        Assert.Equal(2, r.Layer("ROOMS").AreaCount);
        Assert.Equal(14 + 2 * Math.PI, r.Layer("ROOMS").Len, 9);
        Assert.Equal(8 + Math.PI, r.Layer("SLOT").Area, 9);
        Assert.Equal(8 + 2 * Math.PI, r.Layer("SLOT").Len, 9);
    }

    [Fact]
    public void A_negative_bulge_is_a_clockwise_half_circle_with_the_right_length_and_area()
    {
        // (0, 0) to (2, 0) with bulge −1: clockwise, so the half circle of r 1 above the x axis; the closing edge is
        // the diameter.
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(true, (0, 0, -1), (2, 0, 0)).On(doc, "A"));
        var r = Cad.Run(doc);
        Assert.Equal(Math.PI + 2, r.Layer("A").Len, 9);
        Assert.Equal(Math.PI / 2, r.Layer("A").Area, 9);
        Assert.True(r.Items.Single().Path.Single().Where((v, i) => i % 2 == 1).All(y => y >= -1e-6));   // drawn above the axis
    }

    [Fact]
    public void A_polyline_that_returns_to_its_start_is_closed_without_the_flag()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (2, 0, 0), (2, 2, 0), (0, 2, 0), (0, 0, 0)).On(doc, "A"));
        Assert.Equal(4, Cad.Run(doc).Layer("A").Area, 9);
    }

    [Fact]
    public void A_self_intersecting_outline_keeps_its_length_but_its_area_is_bad_and_left_out()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(true, (0, 0, 0), (2, 2, 0), (2, 0, 0), (0, 2, 0)).On(doc, "A"));   // a bow tie
        doc.Entities.Add(Cad.Rect(10, 0, 1, 1).On(doc, "A"));
        var r = Cad.Run(doc);
        Assert.Equal(1, r.Layer("A").Area, 9);
        Assert.Equal(1, r.Layer("A").AreaCount);
        Assert.Equal(1, r.Layer("A").Bad);
        Assert.Equal(4 + 2 * Math.Sqrt(8) + 4, r.Layer("A").Len, 9);                                  // two sides and two diagonals, and the square
        Assert.Contains(r.Warnings, w => w.Id == "bad-area");
        Assert.True(r.Items.Single(i => i.Bad).Area == 0);
    }

    [Fact]
    public void A_rational_spline_quarter_circle_is_measured_exactly()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var sp = new Spline { Degree = 2 };
        foreach (var p in new[] { new XYZ(10, 0, 0), new XYZ(10, 10, 0), new XYZ(0, 10, 0) }) sp.ControlPoints.Add(p);
        foreach (var w in new[] { 1, Math.Sqrt(0.5), 1 }) sp.Weights.Add(w);
        foreach (var k in new[] { 0.0, 0, 0, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Flags |= SplineFlags.Rational;
        doc.Entities.Add(sp.On(doc, "S"));
        var r = Cad.Run(doc);
        Assert.Equal(5 * Math.PI, r.Layer("S").Len, 9);
        Assert.Equal("spline", r.Items.Single().Kind);
    }

    [Fact]
    public void A_full_ellipse_has_its_true_perimeter_and_area()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(new Ellipse { Center = new XYZ(0, 0, 0), MajorAxisEndPoint = new XYZ(4, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI }.On(doc, "E"));
        var r = Cad.Run(doc);
        // Reference perimeter of a = 4, b = 2 from a million-chord polygon: 19.376896441095…
        double reference = 0; double px = 4, py = 0;
        for (int i = 1; i <= 1_000_000; i++) { double t = 2 * Math.PI * i / 1_000_000; double x = 4 * Math.Cos(t), y = 2 * Math.Sin(t); reference += Math.Sqrt((x - px) * (x - px) + (y - py) * (y - py)); px = x; py = y; }
        Assert.True(Math.Abs(r.Layer("E").Len / reference - 1) < 1e-4, $"{r.Layer("E").Len} vs {reference}");
        Assert.Equal(8 * Math.PI, r.Layer("E").Area, 9);
    }

    [Fact]
    public void A_mirrored_arc_keeps_its_length_and_is_drawn_mirrored()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        // Normal −Z: the object coordinate system's X points the other way, so centre (5, 0) lies at (−5, 0).
        doc.Entities.Add(new Arc { Center = new XYZ(5, 0, 0), Radius = 1, StartAngle = 0, EndAngle = Math.PI, Normal = new XYZ(0, 0, -1) }.On(doc, "M"));
        var r = Cad.Run(doc);
        Assert.Equal(Math.PI, r.Layer("M").Len, 9);
        var path = r.Items.Single().Path.Single();
        Assert.Equal(-6, path[0], 6); Assert.Equal(0, path[1], 6);                                     // starts at angle 0 → (−6, 0)
        Assert.All(Enumerable.Range(0, path.Length / 2), i => Assert.InRange(path[2 * i], -6.0001, -3.9999));
    }

    [Fact]
    public void A_3D_polyline_has_its_true_length_and_no_area()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Polyline3D();
        p.Vertices.Add(new Vertex3D(new XYZ(0, 0, 0))); p.Vertices.Add(new Vertex3D(new XYZ(3, 0, 4))); p.Vertices.Add(new Vertex3D(new XYZ(3, 5, 4)));
        doc.Entities.Add(p.On(doc, "P"));
        var r = Cad.Run(doc);
        Assert.Equal(10, r.Layer("P").Len, 9);
        Assert.Equal(0, r.Layer("P").AreaCount);
    }
}
