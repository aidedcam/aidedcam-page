using Xunit;

namespace AidedCam.Laser.Tests;

public class GeometryTests
{
    [Fact]
    public void Arc_sweep_length_and_bulge_follow_the_direction()
    {
        var ccw = Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(0, 10), true, 0);      // quarter, counter-clockwise
        Assert.Equal(Math.PI / 2, ccw.Sweep, 9);
        Assert.Equal(10 * Math.PI / 2, ccw.Length, 9);
        Assert.Equal(Math.Tan(Math.PI / 8), ccw.Bulge, 9);
        var cw = ccw.Reversed();                                                          // the same arc walked back
        Assert.False(cw.Ccw);
        Assert.Equal(Math.PI / 2, cw.Sweep, 9);
        Assert.Equal(-Math.Tan(Math.PI / 8), cw.Bulge, 9);
        var big = Seg.Arc(new P(0, 0), 10, new P(0, 10), new P(10, 0), true, 0);         // three quarters
        Assert.Equal(3 * Math.PI / 2, big.Sweep, 9);
    }

    [Fact]
    public void Signed_area_is_exact_for_lines_and_arcs()
    {
        // A 20 × 10 rectangle with its right side replaced by a half circle bulging out (radius 5).
        var chain = new List<Seg>
        {
            Seg.Line(new P(0, 0), new P(20, 0), 0),
            Seg.Arc(new P(20, 5), 5, new P(20, 0), new P(20, 10), true, 0),
            Seg.Line(new P(20, 10), new P(0, 10), 0),
            Seg.Line(new P(0, 10), new P(0, 0), 0),
        };
        Assert.Equal(200 + Math.PI * 25 / 2, Geo.SignedArea(chain), 9);
        Assert.Equal(-(200 + Math.PI * 25 / 2), Geo.SignedArea(chain.AsEnumerable().Reverse().Select(s => s.Reversed()).ToList()), 9);
        Assert.Equal(Math.PI * 9, Geo.SignedArea(new List<Seg> { Seg.Circle(new P(1, 1), 3, 0) }), 9);
    }

    [Fact]
    public void Arc_bounds_include_the_extreme_points_it_passes()
    {
        var (min, max) = Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(-10, 0), true, 0).Bounds();   // upper half
        Assert.Equal(-10, min.X, 9); Assert.Equal(0, min.Y, 9); Assert.Equal(10, max.X, 9); Assert.Equal(10, max.Y, 9);
    }

    [Fact]
    public void Samples_stay_within_the_chord_error()
    {
        var arc = Seg.Arc(new P(0, 0), 50, new P(50, 0), new P(-50, 0), true, 0);
        var pts = arc.Sample(0.01);
        for (int i = 0; i + 1 < pts.Count; i++)
        {
            var mid = (pts[i] + pts[i + 1]) * 0.5;
            Assert.True(50 - mid.Length <= 0.0101, $"chord error {50 - mid.Length}");
        }
    }
}
