using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class HatchTests
{
    static Hatch.BoundaryPath Square(double x, double y, double s, bool outer)
    {
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline | (outer ? BoundaryPathFlags.External : BoundaryPathFlags.Default) };
        p.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(x, y, 0), new XYZ(x + s, y, 0), new XYZ(x + s, y + s, 0), new XYZ(x, y + s, 0) } });
        return p;
    }

    static Hatch Hatch(HatchStyleType style, params Hatch.BoundaryPath[] paths)
    {
        var h = new Hatch { IsSolid = true, Style = style, Pattern = new HatchPattern("SOLID") };
        foreach (var p in paths) h.Paths.Add(p);
        return h;
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void An_island_is_subtracted_and_hatch_area_stays_out_of_the_polyline_areas(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Hatch(HatchStyleType.Normal, Square(0, 0, 10, true), Square(4, 4, 2, false)).On(doc, "FLOOR"));
        doc.Entities.Add(Cad.Rect(0, 0, 10, 10).On(doc, "FLOOR"));                                     // the room outlined too
        var r = Cad.Run(doc, dwg);
        Assert.Equal(96, r.Layer("FLOOR").HatchArea, 9);
        Assert.Equal(1, r.Layer("FLOOR").HatchCount);
        Assert.Equal(100, r.Layer("FLOOR").Area, 9);                                                   // never added together
        Assert.Equal(2, r.Items.Single(i => i.Kind == "hatch").Path.Count);
    }

    [Fact]
    public void Nested_islands_follow_the_hatch_style()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var loops = new[] { Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false) };   // 100, 36, 4
        doc.Entities.Add(Hatch(HatchStyleType.Normal, loops).On(doc, "N"));
        doc.Entities.Add(Hatch(HatchStyleType.Outer, Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false)).On(doc, "O"));
        doc.Entities.Add(Hatch(HatchStyleType.Ignore, Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false)).On(doc, "I"));
        var r = Cad.Run(doc);
        Assert.Equal(100 - 36 + 4, r.Layer("N").HatchArea, 9);
        Assert.Equal(100 - 36, r.Layer("O").HatchArea, 9);
        Assert.Equal(100, r.Layer("I").HatchArea, 9);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_boundary_of_line_and_arc_edges_is_exact_whichever_way_the_arc_turns(bool ccw)
    {
        // A half disc of radius 5: the arc from (5, 0) over the top to (−5, 0), then the diameter back.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        if (ccw) p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = 0, EndAngle = Math.PI, CounterClockWise = true });
        else p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = Math.PI, EndAngle = 2 * Math.PI, CounterClockWise = false });   // stored mirrored: −π … −2π clockwise is the same top half
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(-5, 0), End = new XY(5, 0) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "H"));
        var r = Cad.Run(doc);
        Assert.Equal(12.5 * Math.PI, r.Layer("H").HatchArea, 9);
        Assert.True(r.Items.Single().Path.Single().Where((v, i) => i % 2 == 1).All(y => y >= -1e-6));   // the top half
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_loop_whose_first_edge_is_stored_reversed_is_still_exact(bool dwg)
    {
        // A 10 × 10 square of line edges away from the origin (so every edge counts in the area), the first one
        // written end to start.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(15, 5), End = new XY(5, 5) });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(15, 5), End = new XY(15, 15) });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(15, 15), End = new XY(5, 15) });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(5, 15), End = new XY(5, 5) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "H"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(100, r.Layer("H").HatchArea, 9);
        Assert.Equal(0, r.Layer("H").Bad);
    }

    [Fact]
    public void A_hatch_without_a_usable_boundary_is_bad_not_zero()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Hatch(HatchStyleType.Normal).On(doc, "H"));
        doc.Entities.Add(Hatch(HatchStyleType.Normal, Square(0, 0, 1, true)).On(doc, "H"));
        var r = Cad.Run(doc);
        Assert.Equal(1, r.Layer("H").HatchArea, 9);
        Assert.Equal(1, r.Layer("H").HatchCount);
        Assert.Equal(1, r.Layer("H").Bad);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_DXF_hatch_stores_edge_angles_in_degrees_and_a_DWG_in_radians(bool dwg)
    {
        // A half disc of radius 5: the arc from (5, 0) over the top to (−5, 0), then the diameter back.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        if (dwg)
            p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = 0, EndAngle = Math.PI, CounterClockWise = true });
        else
            p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = 0, EndAngle = 180, CounterClockWise = true });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(-5, 0), End = new XY(5, 0) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "H"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(12.5 * Math.PI, r.Layer("H").HatchArea, 9);
    }

    [Fact]
    public void An_elliptical_hatch_edge_uses_angles_not_parameters()
    {
        // An ellipse sector (a=4, b=2, from angle 0 to π/4), closed with two lines to the origin.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        double a0 = 0, a1 = Math.PI / 4;
        double t1 = Math.Atan2(Math.Sin(a1) / 0.5, Math.Cos(a1));
        double ex = 4 * Math.Cos(t1), ey = 2 * Math.Sin(t1);
        p.Edges.Add(new Hatch.BoundaryPath.Ellipse { Center = new XY(0, 0), MajorAxisEndPoint = new XY(4, 0), MinorToMajorRatio = 0.5, StartAngle = a0, EndAngle = a1, CounterClockWise = true });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(ex, ey), End = new XY(0, 0) });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(0, 0), End = new XY(4, 0) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "E"));
        var r = Cad.Run(doc, true);
        double expected = 0.5 * 4 * 2 * t1;
        Assert.Equal(expected, r.Layer("E").HatchArea, 5);
    }

    [Fact]
    public void An_elliptical_hatch_edge_past_half_a_turn_keeps_its_side()
    {
        // An ellipse sector (a=4, b=2, from angle 0 to 3π/2 CCW), closed with two lines.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        double a1 = 3 * Math.PI / 2;
        double t1 = Math.Atan2(Math.Sin(a1) / 0.5, Math.Cos(a1));   // parameter at the end
        double ex = 4 * Math.Cos(t1), ey = 2 * Math.Sin(t1);        // end point (0, -2)
        p.Edges.Add(new Hatch.BoundaryPath.Ellipse { Center = new XY(0, 0), MajorAxisEndPoint = new XY(4, 0), MinorToMajorRatio = 0.5, StartAngle = 0, EndAngle = a1, CounterClockWise = true });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(ex, ey), End = new XY(0, 0) });
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(0, 0), End = new XY(4, 0) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "E"));
        var r = Cad.Run(doc, true);
        double expected = 0.5 * 4 * 2 * a1;  // for 3π/2, parameter sweep is also 3π/2
        Assert.Equal(expected, r.Layer("E").HatchArea, 3);
    }

    [Fact]
    public void A_clockwise_full_ellipse_edge_is_a_whole_ellipse()
    {
        // A full clockwise ellipse (a=4, b=2).
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        p.Edges.Add(new Hatch.BoundaryPath.Ellipse { Center = new XY(0, 0), MajorAxisEndPoint = new XY(4, 0), MinorToMajorRatio = 0.5, StartAngle = 0, EndAngle = 2 * Math.PI, CounterClockWise = false });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "E"));
        var r = Cad.Run(doc, true);
        Assert.Equal(8 * Math.PI, r.Layer("E").HatchArea, 4);
    }
}
