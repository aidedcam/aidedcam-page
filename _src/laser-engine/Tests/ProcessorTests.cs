using System.Text.Json;
using devDept.Eyeshot.Entities;
using devDept.Eyeshot.Translators;
using Xunit;

namespace AidedCam.Laser.Tests;

public class ProcessorTests
{
    static Result Run(Dxf d, Settings s = null) => Processor.Process(d.Bytes(), s ?? new Settings());
    static List<string> Ids(Result r) => r.Checks.Select(c => c.Id).ToList();

    [Fact]
    public void Roles_split_cut_mark_bend_and_ignore()
    {
        var r = Run(new Dxf().Layer("MARK", 5).Layer("BEND", 30, "DASHED").Layer("DIM")
            .Rect(0, 0, 100, 50).Line(10, 10, 40, 10, "MARK").Line(50, 0, 50, 50, "BEND").Line(0, -10, 100, -10, "DIM"));
        Assert.Single(r.Parts);
        Assert.Equal(30, r.MarkLength, 9);
        Assert.Equal(1, r.MarkStarts);
        Assert.Single(r.Contours, c => c.Role == Roles.Bend);
        Assert.Single(r.Contours, c => c.Role == Roles.Ignore);
        Assert.DoesNotContain("branch", Ids(r));               // the bend line touches the outline but is not cut
    }

    [Fact]
    public void A_role_change_from_the_table_is_applied()
    {
        var bytes = new Dxf().Layer("NOTES").Rect(0, 0, 10, 10).Rect(20, 0, 10, 10, "NOTES").Bytes();
        Assert.Equal(2, Processor.Process(bytes, new Settings()).Parts.Count);
        var s = new Settings(); s.Roles["NOTES|#ffffff"] = Roles.Ignore;
        Assert.Single(Processor.Process(bytes, s).Parts);
    }

    [Fact]
    public void Checks_report_what_happened()
    {
        var r = Run(new Dxf().Layer("CUT2", 7, "DASHED")
            .Rect(0, 0, 100, 50).Line(0, 0, 100, 0)                   // a doubled edge
            .Line(200, 0, 300, 0)                                     // an open path
            .Line(0, 60, 40, 60, "CUT2").Line(40, 60, 40, 60.0005)    // dashed layer; a tiny piece
            .Text(0, 80, 5, "PART 1"));
        var ids = Ids(r);
        Assert.Equal("open-path", ids[0]);                            // errors first
        Assert.Contains("dashed-on-cut", ids);
        Assert.Contains("units-assumed", ids);
        Assert.Contains("duplicates-removed", ids);
        Assert.Contains("tiny-removed", ids);
        Assert.Contains("text-kept", ids);
        var open = r.Checks.First(c => c.Id == "open-path");
        Assert.Equal(2, (int)open.Params["count"]);                   // the lone line and the dashed stroke
        Assert.Equal(140, (double)open.Params["length"], 6);
        Assert.Equal(2, r.OpenPierces);
    }

    [Fact]
    public void An_empty_block_is_an_error_that_names_it()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Block("HOLE", b => b.Circle(0, 0, 3)).Insert("HOLE", 40, 10));
        var c = Assert.Single(r.Checks, c => c.Id == "block-empty");
        Assert.Equal("error", c.Severity);
        Assert.Equal("HOLE", c.Params["blocks"]);
    }

    [Fact]
    public void An_array_inside_a_block_is_an_error_that_names_the_block()
    {
        var doc = new ACadSharp.CadDocument(ACadSharp.ACadVersion.AC1018);
        var hole = new ACadSharp.Tables.BlockRecord("HOLE");
        hole.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(hole);
        var grid = new ACadSharp.Tables.BlockRecord("GRID");
        grid.Entities.Add(new ACadSharp.Entities.Insert(hole) { ColumnCount = 4, ColumnSpacing = 10 });
        doc.BlockRecords.Add(grid);
        doc.Entities.Add(new ACadSharp.Entities.Insert(grid) { InsertPoint = new CSMath.XYZ(5, 5, 0) });
        var c = Assert.Single(Processor.Process(AcadFile.Write(doc, false), new Settings()).Checks, c => c.Id == "block-array");
        Assert.Equal("error", c.Severity);
        Assert.Equal("GRID", c.Params["blocks"]);
    }

    [Fact]
    public void A_file_with_nothing_to_cut_says_so()
    {
        var r = Run(new Dxf().Layer("MARK").Line(0, 0, 10, 0, "MARK"));
        Assert.Contains("empty-cut", Ids(r));
        Assert.Empty(r.Parts);
    }

    [Fact]
    public void A_file_whose_cut_is_only_tiny_slivers_has_nothing_to_cut()
    {
        var r = Run(new Dxf().Line(0, 0, 0.0005, 0).Line(5, 5, 5.0004, 5));
        var emptyCut = Assert.Single(r.Checks, c => c.Id == "empty-cut");
        Assert.Equal("error", emptyCut.Severity);
        Assert.Contains("tiny-removed", Ids(r));
        Assert.Empty(r.Parts);
    }

    [Fact]
    public void The_json_result_follows_the_contract()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Circle(20, 25, 5).Polyline(true, "0", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1)));
        using var doc = JsonDocument.Parse(ResultJson.Write("plate.dxf", r));
        var root = doc.RootElement;
        Assert.Equal("result", root.GetProperty("type").GetString());
        Assert.Equal("plate.dxf", root.GetProperty("file").GetProperty("name").GetString());
        Assert.Equal(1, root.GetProperty("parts").GetArrayLength());
        var part = root.GetProperty("parts")[0];
        Assert.Equal(2, part.GetProperty("holes").GetArrayLength());
        Assert.Equal(3, part.GetProperty("pierces").GetInt32());
        var kinds = root.GetProperty("contours").EnumerateArray().SelectMany(c => c.GetProperty("segs").EnumerateArray()).Select(s => s.GetProperty("t").GetString()).ToHashSet();
        Assert.Equal(new HashSet<string> { "L", "A", "C" }, kinds);
        Assert.Equal("units-assumed", root.GetProperty("checks")[0].GetProperty("id").GetString());
        using var err = JsonDocument.Parse(ResultJson.Error("x.dwg", "version", "too new"));
        Assert.Equal("error", err.RootElement.GetProperty("type").GetString());
    }

    [Fact]
    public void The_repaired_dxf_reads_back_with_the_same_geometry_and_greek_text()
    {
        var r = Run(new Dxf().CodePage("ANSI_1253").Layer("MARK", 5)
            .Rect(0, 0, 100, 50).Circle(20, 25, 5).Polyline(true, "0", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1))
            .Line(10, 45, 40, 45, "MARK").Text(5, 5, 3, "ΑΒΓ-1"));
        var text = System.Text.Encoding.Latin1.GetString(r.Dxf);
        Assert.Contains("AC1009", text);
        var rd = new ReadDXF(new MemoryStream(r.Dxf));
        rd.DoWork(null, CancellationToken.None);
        Assert.True(rd.Result);
        Assert.Equal(new[] { "CUT", "MARK", "TEXT" }, rd.Entities.Select(e => e.LayerName).Distinct().OrderBy(x => x).ToArray());
        Assert.Equal("ΑΒΓ-1", rd.Entities.OfType<Text>().Single().TextString);
        var back = Processor.Process(r.Dxf, new Settings());
        Assert.Equal(r.Parts[0].Area, back.Parts[0].Area, 6);
        Assert.Equal(r.Parts[0].CutLength, back.Parts[0].CutLength, 6);
        Assert.Equal(r.MarkLength, back.MarkLength, 6);
    }
}
