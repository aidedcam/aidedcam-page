using Xunit;

namespace AidedCam.Laser.Tests;

public class PartsTests
{
    static Result Run(Dxf d, Settings s = null) => Processor.Process(d.Bytes(), s ?? new Settings());

    [Fact]
    public void A_plate_with_four_holes_is_one_part_with_exact_numbers()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Circle(10, 10, 5).Circle(90, 10, 5).Circle(10, 40, 5).Circle(90, 40, 5));
        var p = Assert.Single(r.Parts);
        Assert.Equal(4, p.Holes.Count);
        Assert.Equal(5000 - 4 * Math.PI * 25, p.Area, 6);
        Assert.Equal(300 + 4 * Math.PI * 10, p.CutLength, 6);
        Assert.Equal(5, p.Pierces);
        Assert.Equal(100, p.Max.X - p.Min.X, 9);
        Assert.Equal(50, p.Max.Y - p.Min.Y, 9);
    }

    [Fact]
    public void A_piece_inside_a_hole_is_its_own_part()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 100).Rect(20, 20, 60, 60).Rect(40, 40, 20, 20));
        Assert.Equal(2, r.Parts.Count);
        Assert.Equal(10000 - 3600, r.Parts[0].Area, 6);
        Assert.Equal(400, r.Parts[1].Area, 6);
        Assert.Contains(r.Checks, c => c.Id == "multi-part" && (int)c.Params["count"] == 2);
    }

    [Fact]
    public void Three_ends_at_one_point_are_a_branch_and_a_bow_tie_crosses_itself()
    {
        // A plate split by a middle line: the outline pieces meet the middle line end to end at (50,0) and (50,50).
        var branch = Run(new Dxf().Line(0, 0, 50, 0).Line(50, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 50, 50).Line(50, 50, 0, 50).Line(0, 50, 0, 0).Line(50, 0, 50, 50));
        Assert.Contains(branch.Checks, c => c.Id == "branch" && (int)c.Params["count"] == 2);
        Assert.Contains(branch.Markers, m => m.Kind == "branch");
        var bowTie = Run(new Dxf().Polyline(true, "0", (0, 0, 0), (100, 50, 0), (100, 0, 0), (0, 50, 0)));
        Assert.Contains(bowTie.Checks, c => c.Id == "self-intersect");
        var m = Assert.Single(bowTie.Markers, m => m.Kind == "self");
        Assert.Equal(50, m.At.X, 6); Assert.Equal(25, m.At.Y, 6);
    }

    [Fact]
    public void A_sheet_with_twenty_thousand_holes_nests_in_near_linear_time()
    {
        // A pairwise scan takes seconds here on the desktop and about 20 times longer in the browser.
        static Seg L(double x1, double y1, double x2, double y2) => Seg.Line(new P(x1, y1), new P(x2, y2), 0);
        var all = new List<Contour> { new() { Closed = true, Segs = { L(0, 0, 2000, 0), L(2000, 0, 2000, 1000), L(2000, 1000, 0, 1000), L(0, 1000, 0, 0) } } };
        for (int i = 0; i < 200; i++)
            for (int j = 0; j < 100; j++) all.Add(new Contour { Closed = true, Segs = { Seg.Circle(new P(5 + 10 * i, 5 + 10 * j), 3, 0) } });
        for (int k = 0; k < all.Count; k++) all[k].Id = k;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var p = Assert.Single(Chains.Parts(all));
        sw.Stop();
        Assert.Equal(20000, p.Holes.Count);
        Assert.Equal(2e6 - 20000 * Math.PI * 9, p.Area, 3);
        Assert.True(sw.ElapsedMilliseconds < 1000, $"{sw.ElapsedMilliseconds} ms");
    }
}
