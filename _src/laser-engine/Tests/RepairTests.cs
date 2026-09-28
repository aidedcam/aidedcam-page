using Xunit;

namespace AidedCam.Laser.Tests;

public class RepairTests
{
    static Seg L(double x1, double y1, double x2, double y2) => Seg.Line(new P(x1, y1), new P(x2, y2), 0);

    static List<Contour> Chain(List<Seg> segs, RepairStats st, List<Marker> markers, double gap = 0.2)
    {
        int branches = 0;
        var merged = Repair.MergeOverlaps(Repair.RemoveTiny(segs, st), 0.01, st);
        return Chains.Build(Repair.Join(merged, 0.01, gap, st, markers), Roles.Cut, markers, ref branches);
    }

    [Fact]
    public void Tiny_pieces_are_removed_and_counted()
    {
        var st = new RepairStats();
        var keep = Repair.RemoveTiny(new List<Seg> { L(0, 0, 10, 0), L(10, 0, 10.0005, 0) }, st);
        Assert.Single(keep);
        Assert.Equal(1, st.TinyRemoved);
    }

    [Fact]
    public void Identical_reversed_and_overlapping_lines_are_cut_once()
    {
        var st = new RepairStats();
        var outp = Repair.MergeOverlaps(new List<Seg>
        {
            L(0, 0, 100, 0), L(100, 0, 0, 0),          // the same line twice, once reversed
            L(50, 0, 150, 0),                           // overlaps the first by 50
            L(150, 0, 200, 0),                          // only touches: stays its own piece
            L(0, 10, 100, 10),                          // parallel, not collinear
        }, 0.01, st);
        Assert.Equal(3, outp.Count);
        var merged = outp.Single(s => s.A.Y == 0 && s.Length > 100);
        Assert.Equal(150, merged.Length, 9);
        Assert.Equal(2, st.DuplicatesRemoved);
        Assert.Equal(150, st.DuplicateLength, 9);       // 100 + 100 + 100 read, 150 kept
    }

    [Fact]
    public void Arcs_on_one_circle_merge_and_a_full_circle_covers_them()
    {
        var st = new RepairStats();
        var c = new P(0, 0);
        var outp = Repair.MergeOverlaps(new List<Seg>
        {
            Seg.Arc(c, 10, new P(10, 0), new P(-10, 0), true, 0),
            Seg.Arc(c, 10, new P(0, 10), new P(0, -10), true, 0),     // overlaps the first quarter to half
        }, 0.01, st);
        var a = Assert.Single(outp);
        Assert.Equal(SegKind.Arc, a.Kind);
        Assert.Equal(Math.PI * 1.5, a.Sweep, 6);
        var withCircle = Repair.MergeOverlaps(new List<Seg> { Seg.Circle(c, 10, 0), Seg.Arc(c, 10, new P(10, 0), new P(0, 10), true, 0) }, 0.01, new RepairStats());
        Assert.Equal(SegKind.Circle, Assert.Single(withCircle).Kind);
    }

    [Fact]
    public void Ends_within_the_join_tolerance_meet_and_a_rectangle_closes()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100.005, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.004) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        Assert.Equal(0, st.GapsClosed);
        Assert.Empty(markers);
    }

    [Fact]
    public void A_gap_between_two_lines_is_closed_at_the_midpoint_and_marked()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.15) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        Assert.Equal(1, st.GapsClosed);
        Assert.Equal(0.15, st.MaxGapClosed, 9);
        var m = Assert.Single(markers);
        Assert.Equal("gap", m.Kind);
        Assert.Equal(0.075, m.At.Y, 9);
        Assert.DoesNotContain(c.Segs, s => s.Bridge);
    }

    [Fact]
    public void A_gap_at_an_arc_end_gets_a_short_bridge_line_so_the_radius_stays()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        // A half circle closed by a diameter line that stops 0.1 short of the arc.
        var cs = Chain(new List<Seg> { Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(-10, 0), true, 0), L(-10, 0, 9.9, 0) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        var bridge = Assert.Single(c.Segs, s => s.Bridge);
        Assert.Equal(0.1, bridge.Length, 9);
        Assert.Equal(10, c.Segs.Single(s => s.Kind == SegKind.Arc).R, 9);
    }

    [Fact]
    public void A_gap_wider_than_the_tolerance_stays_open_with_red_ends()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.5) }, st, markers);
        var c = Assert.Single(cs);
        Assert.False(c.Closed);
        Assert.Equal(2, markers.Count(m => m.Kind == "open"));
        Assert.Equal(0, st.GapsClosed);
    }

    [Fact]
    public void A_nearly_closed_arc_becomes_a_circle()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        double end = 359.9995 * Math.PI / 180;
        var arc = Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(10 * Math.Cos(end), 10 * Math.Sin(end)), true, 0);
        var c = Assert.Single(Chain(new List<Seg> { arc }, st, markers));
        Assert.True(c.Closed);
        var piece = Assert.Single(c.Segs);
        Assert.Equal(SegKind.Circle, piece.Kind);
        Assert.Equal(10, piece.R, 9);
    }

    [Fact]
    public void An_arc_shorter_than_the_join_tolerance_is_removed_not_turned_into_a_circle()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        // A 100 x 50 rectangle with a 0.005 mm long R100 arc (centre at the origin) at its corner (100, 0):
        // the arc runs from (100, 0) to (100 cos t, 100 sin t), t = 0.005 / 100, both ends within 0.01 of the corner.
        double t = 0.005 / 100;
        var arc = Seg.Arc(new P(0, 0), 100, new P(100, 0), new P(100 * Math.Cos(t), 100 * Math.Sin(t)), true, 0);
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0), arc }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        Assert.DoesNotContain(c.Segs, s => s.Kind == SegKind.Circle);
        Assert.Equal(300, c.Length, 0.02);
        Assert.True(st.TinyRemoved >= 1);
    }

    [Fact]
    public void A_duplicate_edge_with_floating_point_noise_is_still_cut_once()
    {
        // The noise tilts the copy by about 2e-13 rad. Tilted clockwise its angle wraps to exactly 0 already;
        // tilted counter-clockwise it sorts after the rectangle's top edge (same angle 0, offset 50).
        foreach (var dy in new[] { 1e-11, -1e-11 })
        {
            var st = new RepairStats(); var markers = new List<Marker>();
            var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0), L(0, dy, 100, -dy) }, st, markers);
            var c = Assert.Single(cs);
            Assert.True(c.Closed);
            Assert.Equal(300, c.Length, 1e-6);
            Assert.True(st.DuplicatesRemoved >= 1);
        }
    }
}
