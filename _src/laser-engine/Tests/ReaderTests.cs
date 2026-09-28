using ACadSharp;
using CSMath;
using Xunit;

namespace AidedCam.Laser.Tests;

public class ReaderTests
{
    static Drawing Read(byte[] b, Settings s = null) => Reader.Read(b, s ?? new Settings());

    [Fact]
    public void Lines_arcs_circles_and_bulge_polylines_become_pieces_in_groups()
    {
        var d = Read(new Dxf().Layer("CUT").Layer("ENGRAVE", 5)
            .Rect(0, 0, 100, 50, "CUT")
            .Circle(20, 25, 5, "CUT")
            .Polyline(true, "CUT", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1))
            .Line(10, 10, 30, 10, "ENGRAVE").Bytes());
        Assert.Equal("dxf", d.Format);
        Assert.Equal("R12", d.Version);
        Assert.Equal(4 + 1 + 4 + 1, d.Segs.Count);
        Assert.Equal(1, d.Segs.Count(s => s.Kind == SegKind.Circle));
        Assert.Equal(2, d.Segs.Count(s => s.Kind == SegKind.Arc));
        var groups = d.Groups.ToDictionary(g => g.Layer);
        Assert.Equal(Roles.Cut, groups["CUT"].Role);
        Assert.Equal(Roles.Mark, groups["ENGRAVE"].Role);
        Assert.Equal("#0000ff", groups["ENGRAVE"].Color);
        Assert.Equal(9, groups["CUT"].Curves);
    }

    [Fact]
    public void A_colour_on_one_line_makes_its_own_group()
    {
        var d = Read(new Dxf().Line(0, 0, 10, 0).Line(0, 5, 10, 5, "0", 1).Bytes());
        Assert.Equal(2, d.Groups.Count);
        Assert.Contains(d.Groups, g => g.Key == "0|#ff0000");
    }

    [Fact]
    public void Blocks_are_exploded_with_scale_and_rotation_in_dxf_2004_and_dwg()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(40, 10, 0), XScale = 2, YScale = 2, Rotation = Math.PI / 6 });
        foreach (var dwg in new[] { false, true })
        {
            var d = Read(AcadFile.Write(doc, dwg));
            var c = Assert.Single(d.Segs);
            Assert.Equal(SegKind.Circle, c.Kind);
            Assert.Equal(6, c.R, 9);
            Assert.Equal(40, c.C.X, 9); Assert.Equal(10, c.C.Y, 9);
            Assert.Empty(d.EmptyBlocks);
        }
    }

    [Fact]
    public void Arrayed_inserts_are_exploded_copy_by_copy_in_dxf_and_dwg()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0), ColumnCount = 3, RowCount = 2, ColumnSpacing = 20, RowSpacing = 15, Rotation = Math.PI / 2 });
        doc.PaperSpace.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(500, 0, 0) });   // ignored
        // Turned 90°: the columns run along +Y and the rows along −X.
        var expected = new List<(double, double)>();
        for (int r = 0; r < 2; r++) for (int c = 0; c < 3; c++) expected.Add((10 - 15 * r, 10 + 20 * c));
        foreach (var dwg in new[] { false, true })
        {
            var d = Read(AcadFile.Write(doc, dwg));
            Assert.All(d.Segs, s => Assert.Equal(SegKind.Circle, s.Kind));
            Assert.Equal(expected.OrderBy(p => p), d.Segs.Select(s => (Math.Round(s.C.X, 6), Math.Round(s.C.Y, 6))).OrderBy(p => p));
            Assert.Empty(d.NestedArrays);
            Assert.Empty(d.EmptyBlocks);   // the recovered array must not also be reported as an empty block
        }
    }

    [Fact]
    public void An_array_inside_a_block_is_recorded_not_lost_silently()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var hole = new ACadSharp.Tables.BlockRecord("HOLE");
        hole.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(hole);
        var grid = new ACadSharp.Tables.BlockRecord("GRID");
        grid.Entities.Add(new ACadSharp.Entities.Insert(hole) { ColumnCount = 4, ColumnSpacing = 10 });
        doc.BlockRecords.Add(grid);
        doc.Entities.Add(new ACadSharp.Entities.Insert(grid) { InsertPoint = new XYZ(5, 5, 0) });
        foreach (var dwg in new[] { false, true }) Assert.Equal(new[] { "GRID" }, Read(AcadFile.Write(doc, dwg)).NestedArrays);
    }

    [Fact]
    public void An_R12_block_that_comes_in_empty_is_recorded_not_lost_silently()
    {
        var d = Read(new Dxf().Rect(0, 0, 100, 50).Block("HOLE", b => b.Circle(0, 0, 3)).Insert("HOLE", 40, 10).Bytes());
        Assert.Equal(new[] { "HOLE" }, d.EmptyBlocks);
        Assert.Equal(4, d.Segs.Count);
    }

    [Fact]
    public void Greek_text_in_a_1253_file_is_read_as_text_not_geometry()
    {
        var d = Read(new Dxf().CodePage("ANSI_1253").Text(5, 40, 3, "ΤΕΜΑΧΙΟ Α-1").Rect(0, 0, 10, 10).Bytes());
        var t = Assert.Single(d.Texts);
        Assert.Equal("ΤΕΜΑΧΙΟ Α-1", t.Value);
        Assert.Equal(3, t.Height, 9);
        Assert.Equal(4, d.Segs.Count);
    }

    [Fact]
    public void Layer_rules_match_greek_and_english_names_without_accents_or_case()
    {
        Assert.Equal(Roles.Mark, Roles.Default("ΧΑΡΑΞΗ"));
        Assert.Equal(Roles.Mark, Roles.Default("σήμανση"));
        Assert.Equal(Roles.Bend, Roles.Default("Κάμψεις"));
        Assert.Equal(Roles.Bend, Roles.Default("BEND_UP"));
        Assert.Equal(Roles.Ignore, Roles.Default("Defpoints"));
        Assert.Equal(Roles.Ignore, Roles.Default("διαστάσεις"));
        Assert.Equal(Roles.Cut, Roles.Default("0"));
        Assert.True(Roles.IsDashed("DASHED2"));
        Assert.False(Roles.IsDashed("CONTINUOUS"));
    }

    [Fact]
    public void R12_files_have_no_units_so_mm_is_assumed_unless_set()
    {
        var bytes = new Dxf().Line(0, 0, 1, 0).Bytes();
        var d = Read(bytes);
        Assert.Equal("assumed", d.UnitsSource);
        Assert.Equal(1, d.Segs[0].Length, 9);
        var inch = Read(bytes, new Settings { Units = "inch" });
        Assert.Equal("setting", inch.UnitsSource);
        Assert.Equal(25.4, inch.Segs[0].Length, 9);
    }

    [Fact]
    public void A_file_drawn_in_inches_is_converted_to_mm()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        doc.Header.InsUnits = ACadSharp.Types.Units.UnitsType.Inches;
        doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(2, 0, 0) });
        var bytes = AcadFile.Write(doc, false);
        var d = Read(bytes);
        Assert.Equal("inch", d.Units);
        Assert.Equal("file", d.UnitsSource);
        Assert.Equal(50.8, d.Segs[0].Length, 9);
        var set = Read(bytes, new Settings { Units = "mm" });   // the file's own units win over the setting
        Assert.Equal(50.8, set.Segs[0].Length, 9);
        Assert.Equal("file", set.UnitsSource);
    }

    [Fact]
    public void A_dwg_file_is_read_with_its_text()
    {
        var doc = new CadDocument(ACadVersion.AC1032);
        doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(100, 0, 0) });
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(20, 25, 0), Radius = 5 });
        doc.Entities.Add(new ACadSharp.Entities.TextEntity { Value = "ΑΒΓ", InsertPoint = new XYZ(5, 40, 0), Height = 3 });
        var d = Read(AcadFile.Write(doc, true));
        Assert.Equal("dwg", d.Format);
        Assert.Equal("2018", d.Version);
        Assert.Equal(2, d.Segs.Count);
        Assert.Equal("ΑΒΓ", Assert.Single(d.Texts).Value);
    }

    [Fact]
    public void Files_that_are_not_cad_or_are_binary_dxf_are_refused_with_a_reason()
    {
        var e1 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("hello world")));
        Assert.Equal("read", e1.Reason);
        var e2 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("AutoCAD Binary DXF\r\n\u001a\0")));
        Assert.Equal("read", e2.Reason);
        var e3 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("AC1040 future dwg")));
        Assert.Equal("version", e3.Reason);
    }
}
