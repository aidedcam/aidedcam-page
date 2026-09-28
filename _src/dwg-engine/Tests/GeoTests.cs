using Xunit;

namespace AidedCam.Dwg.Tests;

public class GeoTests
{
    [Fact]
    public void A_bulge_of_one_is_a_counter_clockwise_half_circle()
    {
        var p = Piece.Bulge(new V(0, 0), new V(2, 0), 1);
        Assert.Equal(PieceKind.Arc, p.Kind);
        Assert.Equal(1, p.R, 12);
        Assert.Equal(Math.PI, p.Length, 12);
        Assert.Equal(1, p.C.X, 12); Assert.Equal(0, p.C.Y, 12);
        Assert.Equal(2, p.End.X, 12); Assert.Equal(0, p.End.Y, 12);
        var pts = new List<V>();
        p.SampleInto(pts, 1e-6);
        Assert.True(pts[pts.Count / 2].Y < 0, "from (0,0) to (2,0) counter-clockwise runs through (1, −1)");
    }

    [Fact]
    public void Greens_theorem_gives_exact_areas_for_lines_and_arcs()
    {
        var disc = new Outline { Closed = true };
        disc.Pieces.Add(Piece.Arc(new V(3, 4), 2, 0.3, 2 * Math.PI));
        Assert.Equal(4 * Math.PI, disc.SignedArea, 12);

        var slot = new Outline { Closed = true };                                                      // 4 × 2 with round ends of r 1
        slot.Pieces.Add(Piece.Line(new V(0, 0), new V(4, 0)));
        slot.Pieces.Add(Piece.Bulge(new V(4, 0), new V(4, 2), 1));
        slot.Pieces.Add(Piece.Line(new V(4, 2), new V(0, 2)));
        slot.Pieces.Add(Piece.Bulge(new V(0, 2), new V(0, 0), 1));
        Assert.Equal(8 + Math.PI, slot.SignedArea, 12);
        Assert.Equal(8 + 2 * Math.PI, slot.Length, 12);

        var clockwise = new Outline { Closed = true };
        foreach (var p in Enumerable.Reverse(slot.Pieces)) clockwise.Pieces.Add(p.Reversed());
        Assert.Equal(-(8 + Math.PI), clockwise.SignedArea, 12);
    }

    [Fact]
    public void Self_intersection_finds_crossings_and_touches_but_not_neighbours()
    {
        var square = new List<V> { new(0, 0), new(1, 0), new(1, 1), new(0, 1) };
        var bowtie = new List<V> { new(0, 0), new(1, 1), new(1, 0), new(0, 1) };
        var touching = new List<V> { new(0, 0), new(4, 0), new(4, 4), new(2, 0.0), new(0, 4) };        // a vertex on the bottom edge
        Assert.False(Geo.SelfIntersects(square));
        Assert.True(Geo.SelfIntersects(bowtie));
        Assert.True(Geo.SelfIntersects(touching));
        Assert.False(Geo.SelfIntersects(new List<V> { new(0, 0), new(1, 0), new(1, 1), new(0, 1), new(0, 0) }));   // closing point repeated
    }

    [Fact]
    public void The_arbitrary_axis_algorithm_mirrors_X_for_a_downward_normal()
    {
        var ocs = Affine.Ocs(0, 0, -1);
        var p = ocs.Apply(2, 3, 0);
        Assert.Equal(-2, p.X, 12); Assert.Equal(3, p.Y, 12);
        var up = Affine.Ocs(0, 0, 1, 5).Apply(2, 3, 0);
        Assert.Equal(2, up.X, 12); Assert.Equal(3, up.Y, 12); Assert.Equal(5, up.Z, 12);
    }

    [Fact]
    public void Affine_maps_compose_inner_first()
    {
        var scale = new Affine(new double[] { 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0 });
        var shift = new Affine(new double[] { 1, 0, 0, 10, 0, 1, 0, 0, 0, 0, 1, 0 });
        var p = scale.Then(shift).Apply(1, 1, 0);                                                      // scale, then shift
        Assert.Equal(12, p.X, 12); Assert.Equal(2, p.Y, 12);
        Assert.Equal(2, scale.Then(shift).MaxScale, 12);
    }
}
